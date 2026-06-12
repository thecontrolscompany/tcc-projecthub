ALTER TABLE public.controls_assembly_catalog
  ADD COLUMN IF NOT EXISTS io_type text;
