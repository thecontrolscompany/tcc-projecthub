# TCC — SharePoint Integration Strategy

**Date:** 2026-03-30

---

## 1. Role of SharePoint

SharePoint is not an optional future add-on. It is the document backbone of the platform.

**What belongs in SharePoint:**
- Customer-uploaded files (plans, specs, addenda, photos)
- Internal review documents
- Estimate working files and submitted proposals
- Signed contracts
- Project drawings and submittals
- Billing export archives
- POC sheets (already there via OneDrive)
- Closeout packages

**What belongs in Supabase (not SharePoint):**
- All operational records (quotes, estimates, projects, billing periods, users)
- Metadata about files (filename, size, path, upload date, uploader)
- Status and workflow state
- Relational data (who assigned what, when, to whom)

The two systems are complementary. Every record in Supabase has a `sharepoint_folder` column linking to its corresponding SharePoint location.

---

## 2. Folder Structure Conventions

### Root Libraries

```
/sites/TheControlsCompany/
  ├── Shared Documents/
  │   ├── Quote Requests/
  │   ├── Estimates/
  │   ├── Projects/
  │   └── _Templates/
  └── (other SharePoint libraries)
```

### Quote Request Folders

```
Quote Requests/
  └── QR-2026-001 - Crestview K-8 - HVAC Controls/
      ├── 01 Customer Uploads/       ← customer files on submission
      ├── 02 Internal Review/        ← internal notes, marked-up drawings
      ├── 03 Estimate Working/       ← estimating scratch files
      └── 04 Submitted Quote/        ← final proposal PDF/DOCX
```

### Estimate Folders

```
Estimates/
  └── EST-2026-014 - Crestview K-8 - HVAC Controls/
      ├── 01 Source Documents/       ← copied from quote request uploads
      ├── 02 Working/                ← scratch files
      └── 03 Submitted Proposal/     ← generated proposal .docx
```

### Project Folders

```
Projects/
  └── 2026-041 - Mobile Arena - Controls Upgrade/
      ├── 01 Estimate Baseline/      ← awarded proposal + locked estimate snapshot
      ├── 02 Drawings & Specs/       ← issued-for-construction documents
      ├── 03 Submittals/             ← equipment submittals, shop drawings
      ├── 04 Billing/                ← monthly billing export .xlsx files
      ├── 05 Change Orders/          ← CO documentation
      └── 06 Closeout/               ← O&Ms, punch lists, final billing
```

### Templates

```
_Templates/
  ├── Project Folder Template/       ← used when creating new project folder
  ├── Quote Request Folder Template/
  └── Estimate Folder Template/
```

---

## 3. Graph API Integration Points

### Already Implemented (this repo)

| Operation | API call | Used in |
|-----------|---------|---------|
| Read POC sheet cell | `GET /me/drive/root:/{path}:/workbook/...` | `/api/sync-poc` |
| Upload billing export | `PUT /me/drive/root:/{path}:/content` | `/api/export-excel` |
| Create Outlook draft | `POST /me/messages` | `/api/generate-emails` |

### To Be Implemented

| Operation | API call | Trigger |
|-----------|---------|---------|
| Create quote request folder | `POST /sites/{id}/drive/items/{parentId}/children` | On quote request submission |
| Upload customer files | `PUT /sites/{id}/drive/root:/{path}:/content` | During quote request file upload |
| Create estimate folder | `POST /sites/{id}/drive/items/...` | On "Create Estimate" action |
| Copy files to estimate folder | `POST /drives/{id}/items/{itemId}/copy` | On estimate creation from quote |
| Create project folder tree | Multiple POST calls | On "Award Project" action |
| Copy proposal to project baseline | `POST /drives/{id}/items/{itemId}/copy` | On project award |
| Browse SharePoint folder | `GET /sites/{id}/drive/items/{folderId}/children` | `/documents` page |
| Get file download URL | `GET /drives/{id}/items/{fileId}` | File preview / download |

### Required Graph API Permissions (Delegated)

```
Files.ReadWrite           (OneDrive — already in scope)
Sites.ReadWrite.All       (SharePoint site libraries — needs to be added)
Mail.ReadWrite            (Outlook drafts — already in scope)
User.Read                 (User identity — already in scope)
```

**Note:** `Sites.ReadWrite.All` requires admin consent in Azure AD. This must be requested in the Azure app registration.

---

## 4. SharePoint vs OneDrive

Currently, the code uses OneDrive personal drive (`/me/drive`). For SharePoint site libraries, the API path is different:

```
OneDrive personal:    /me/drive/root:/{path}:/...
SharePoint site:      /sites/{siteId}/drive/root:/{path}:/...
```

The site ID is retrieved once:
```
GET /sites/thecontrolscompany.sharepoint.com:/sites/TheControlsCompany
→ returns { id: "abc123,def456,ghi789" }
```

Then cached in env vars or a config table. All SharePoint operations use this site ID.

**Recommended:** Add `SHAREPOINT_SITE_ID` to `.env.local` and the Graph API client.

---

## 5. File Upload Flow for Customer Quote Requests

This is the most complex SharePoint flow and should be designed carefully.

```
Customer submits quote request form with file attachments
        ↓
API route /api/quotes/submit receives form data + files
        ↓
1. Insert quote_request record in Supabase → get QR-YYYY-NNN
2. Create SharePoint folder:
   /Quote Requests/QR-2026-001 - CustomerName - ProjectName/
   /Quote Requests/QR-2026-001 .../01 Customer Uploads/
3. Upload each attachment to /01 Customer Uploads/ folder
4. Insert quote_request_attachments rows (sharepoint_path, filename, size)
5. Send notification email draft to admin (via Outlook Graph API)
6. Return success to customer UI
```

**File size limits:** SharePoint supports files up to 250 GB via resumable upload. For the quote intake form, a 50 MB limit per file is appropriate.

**Chunked upload:** Files over 4 MB should use the Graph API resumable upload session:
```
POST /me/drive/root:/{path}:/createUploadSession
PUT {uploadUrl} with Content-Range header
```

---

## 6. Document Browser (`/documents`)

The `/documents` page should be a lightweight SharePoint file browser that:
- Displays the folder tree for the relevant context (project, quote, estimate)
- Shows file thumbnails/icons, names, sizes, dates
- Allows download
- Allows upload (for internal users)
- Opens files in browser where possible (SharePoint previews via embed URL)
- Does not try to replicate the full SharePoint UI — just what's needed operationally

**Implementation approach:**
- Each project/quote/estimate detail page has a "Documents" tab that renders the folder for that record's `sharepoint_folder` value
- The `/documents` route is a general-purpose browser for admin use
- File list: `GET /sites/{siteId}/drive/root:/{folderPath}:/children`
- Download URL: `@microsoft.graph.downloadUrl` property on each file item

---

## 7. Supabase ↔ SharePoint Consistency

Every record in Supabase that has a SharePoint folder stores the path in a `sharepoint_folder` column. These paths are relative to the SharePoint site root.

If a folder is renamed or moved in SharePoint manually, the path in Supabase becomes stale. To handle this:
- Prefer using SharePoint item IDs (stable, rename-safe) alongside path strings
- Add `sharepoint_item_id` column alongside `sharepoint_folder` where feasible
- Log SharePoint operations in a `sharepoint_sync_log` table (optional, useful for debugging)

---

## 8. Template Folder Provisioning

When creating a new quote/estimate/project folder, copy from the `_Templates/` library rather than creating each subfolder individually. This ensures consistent structure and allows templates to be updated without code changes.

```
POST /sites/{siteId}/drive/items/{templateFolderId}/copy
Body: { name: "2026-041 - Mobile Arena - Controls Upgrade",
        parentReference: { id: projectsLibraryId } }
```

This single API call copies the entire template tree including all subfolders.
