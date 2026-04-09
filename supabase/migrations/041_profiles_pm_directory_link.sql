-- Reverse FK from profiles back to pm_directory
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pm_directory_id uuid
    REFERENCES public.pm_directory(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_pm_directory_id
  ON public.profiles(pm_directory_id);

-- Surface phone on profiles (sourced from pm_directory)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;
