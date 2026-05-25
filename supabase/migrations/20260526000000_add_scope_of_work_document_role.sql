-- Add 'scope_of_work' to the document_role check constraint on opportunity_documents.
ALTER TABLE opportunity_documents
  DROP CONSTRAINT IF EXISTS opportunity_documents_document_role_check;

ALTER TABLE opportunity_documents
  ADD CONSTRAINT opportunity_documents_document_role_check
  CHECK (document_role IN (
    'proposal_docx',
    'proposal_pdf',
    'estimate_xlsm',
    'addendum',
    'supporting_scope',
    'customer_upload',
    'scope_of_work'
  ));
