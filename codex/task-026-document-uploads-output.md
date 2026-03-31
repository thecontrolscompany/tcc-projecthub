# Task 026 Document Uploads Output

## What Changed

- Added `POST /api/admin/upload-project-document` at `src/app/api/admin/upload-project-document/route.ts`.
- The route requires admin auth, accepts multipart form uploads, looks up the project `sharepoint_folder`, maps document type to the correct SharePoint subfolder, and uploads the file to Microsoft Graph using an app-only token from `AZURE_CLIENT_SECRET`.
- Updated `src/components/admin-projects-tab.tsx` so the Edit Project modal now includes an Uploads section for Contract, Scope, and Estimate files.
- New projects now stay in the modal after creation, show the same Uploads section, and poll the `projects` table for `sharepoint_folder` so uploads enable shortly after SharePoint provisioning finishes.
- Upload state is tracked per document type with idle, uploading, success, and error messaging.

## Verification

- Ran `npm run build` successfully after implementation.
