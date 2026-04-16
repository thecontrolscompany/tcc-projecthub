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
  │   ├── Bids/
  │   ├── Active Projects/
  │   ├── Completed Projects/
  │   └── _Templates/
  └── (other SharePoint libraries)
```

### Opportunity / Bid Folders

```
Bids/
  └── QR-2026-001 - Crestview K-8 - HVAC Controls/
      ├── 01 Customer Uploads/       ← customer files on submission
      ├── 02 Internal Review/        ← internal notes, marked-up drawings
      ├── 03 Estimate Working/       ← estimate .xlsm, working proposal .docx, scratch files
      ├── 04 Submitted Quote/        ← final customer-issued proposal PDF/DOCX
      └── 99 Archive - Legacy Files/
```

### Project Folders

```
Active Projects/
  └── 2026-041 - Mobile Arena - Controls Upgrade/
      ├── 01 Estimate Baseline/      ← awarded proposal + locked estimate snapshot
      ├── 02 Drawings & Specs/       ← issued-for-construction documents
      ├── 03 Submittals/             ← equipment submittals, shop drawings
      ├── 04 Drawings/               ← current project drawing set
      ├── 05 Change Orders/          ← CO documentation
      ├── 06 Closeout/               ← O&Ms, punch lists, final billing
      ├── 07 Billing/                ← monthly billing export .xlsx files
      └── 99 Archive - Legacy Files/
```

### Completed Project Folders

```
Completed Projects/
  └── 2025-118 - Example Closed Job/
      ├── 01 Contract/
      ├── 02 Estimate/
      ├── 03 Submittals/
      ├── 04 Drawings/
      ├── 05 Change Orders/
      ├── 06 Closeout/
      ├── 07 Billing/
      └── 99 Archive - Legacy Files/
```

### Templates

```
_Templates/
  ├── Active Project Folder Template/  ← used when creating new project folder
  ├── Bid Folder Template/
  ├── Completed Project Folder Template/
  └── Opportunity Master Templates/
      ├── Electrical Budgeting Tool v15.xlsm
      └── HVAC Control Installation Proposal-Template.docx
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
| Create bid / opportunity folder | `POST /sites/{id}/drive/items/{parentId}/children` | On quote request submission |
| Upload customer files | `PUT /sites/{id}/drive/root:/{path}:/content` | During quote request file upload |
| Upload proposal / estimate package | `PUT /sites/{id}/drive/root:/{path}:/content` | During Opportunity Hub document ingestion |
| Create project folder tree | Multiple POST calls | On "Award Project" action |
| Copy awarded opportunity files to project baseline | `POST /drives/{id}/items/{itemId}/copy` | On project award |
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
   /Bids/QR-2026-001 - CustomerName - ProjectName/
   /Bids/QR-2026-001 .../01 Customer Uploads/
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

## 5b. Opportunity Hub Document Package Flow

For internal Opportunity Hub work, uploaded proposal and estimate files should live in the bid folder instead of a separate estimate library.

```
Admin / estimator uploads:
  - proposal .docx
  - proposal .pdf
  - estimate .xlsm
        ↓
1. Store source records in Supabase
2. Upload files to:
   /Bids/QR-2026-001 - CustomerName - ProjectName/03 Estimate Working/
     - proposal .docx
     - estimate .xlsm
   /Bids/QR-2026-001 - CustomerName - ProjectName/04 Submitted Quote/
     - proposal .pdf
     - optionally the locked proposal .docx that matches the sent version
3. Store file metadata and extracted values in Supabase
4. On award, copy the final proposal/estimate package into:
   /Active Projects/YYYY-NNN - ProjectName/01 Estimate Baseline/
```

### Opportunity creation template drop

When a new internal opportunity is created, the system should also copy the current
master estimating/proposal templates from the SharePoint root templates area into the
new bid folder.

Recommended master-template source:

```
/_Templates/Opportunity Master Templates/
  Electrical Budgeting Tool v15.xlsm
  HVAC Control Installation Proposal-Template.docx
```

Recommended destination on new opportunity creation:

```
/Bids/QR-2026-001 - CustomerName - ProjectName/03 Estimate Working/
  Electrical Budgeting Tool v15.xlsm
  HVAC Control Installation Proposal-Andalusia ES Addition.docx
```

Rules:

- copy the current master estimate workbook exactly as named, including its current version number such as `v15`
- copy the current master proposal template and rename `Template` to the project name
- keep the master templates editable in `_Templates/Opportunity Master Templates/` so staff can update the source files without code changes
- future opportunities should always use the latest master templates present in `_Templates/Opportunity Master Templates/`
- existing opportunities should keep the version that was copied at creation time

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
- Opportunity Hub records should point to the `Bids/...` folder until awarded
- Project records should point to the `Active Projects/...` folder after conversion
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

When creating a new bid or project folder, copy from the `_Templates/` library rather than creating each subfolder individually. This ensures consistent structure and allows templates to be updated without code changes.

```
POST /sites/{siteId}/drive/items/{templateFolderId}/copy
Body: { name: "2026-041 - Mobile Arena - Controls Upgrade",
        parentReference: { id: projectsLibraryId } }
```

This single API call copies the entire template tree including all subfolders.

For Opportunity Hub, use the same principle for the bid folder plus the working files:

- copy the `Bid Folder Template` tree into `Bids/...`
- then copy the current files from `_Templates/Opportunity Master Templates/` into `03 Estimate Working/`
- rename the proposal template copy from `HVAC Control Installation Proposal-Template.docx` to `HVAC Control Installation Proposal-{Project Name}.docx`
