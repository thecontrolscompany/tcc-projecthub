alter table pursuits
  add column if not exists onedrive_item_id text;

create unique index if not exists pursuits_onedrive_item_id_idx
  on pursuits (onedrive_item_id)
  where onedrive_item_id is not null;

comment on column pursuits.onedrive_item_id is
  'OneDrive folder item ID - used to detect already-imported historical bid folders.';
