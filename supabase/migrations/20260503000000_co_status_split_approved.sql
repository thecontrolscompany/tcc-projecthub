-- Split approved CO status into two: approved via PO, approved via email/docs
ALTER TYPE co_status ADD VALUE IF NOT EXISTS 'approved_po';
ALTER TYPE co_status ADD VALUE IF NOT EXISTS 'approved_email';
