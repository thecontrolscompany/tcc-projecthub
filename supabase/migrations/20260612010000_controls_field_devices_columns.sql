ALTER TABLE public.controls_assembly_catalog
  ADD COLUMN IF NOT EXISTS part_number text,
  ADD COLUMN IF NOT EXISTS manufacturer text;
