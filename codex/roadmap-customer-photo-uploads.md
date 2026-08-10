# Customer Photo Uploads

## Goal

Allow an authorized customer contact to upload photos of damaged work, quality
concerns, or other site conditions directly from the ProjectHub customer portal.

## Current limitation

- The customer portal only displays the number of project photos on file.
- `/api/pm/photos` only permits internal roles.
- The current upload path requires a delegated Microsoft provider token, which
  email/password customer accounts do not have.

## Recommended implementation

1. Add a customer-facing photo gallery and mobile-friendly upload control to the
   customer project view.
2. Authorize every list, content, and upload request against an active
   `project_customer_contacts` row with `portal_access = true` for the signed-in
   profile and requested project.
3. Upload through Microsoft Graph application credentials to a `Customer Photos`
   folder beneath the project's configured SharePoint folder. Never require or
   borrow an internal user's delegated Microsoft token.
4. Reuse the existing client-side image compression behavior, accept images only,
   enforce the server payload limit, sanitize filenames, and generate unique
   SharePoint filenames.
5. Record the result in `project_photos` with `uploaded_by_profile_id`, caption,
   taken date, original filename, content type, and SharePoint identifiers.
6. Show customer-originated photos in the internal PM Photos tab with uploader and
   upload-date context. Customers may view their accessible project's photos but
   may not delete or move files in the first release.

## Security and acceptance checks

- A customer cannot list, view, or upload photos for any project not explicitly
  granted through `project_customer_contacts`.
- Image MIME type, decoded content, and file size are validated server-side.
- SharePoint application permissions are limited to the intended TCC site when
  possible.
- Upload failure never creates an orphaned `project_photos` row.
- Successful uploads appear for both the customer and assigned internal team.
- Mobile capture and multi-image selection work on current iOS and Android
  browsers.
