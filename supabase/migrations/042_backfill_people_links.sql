-- Set profiles.pm_directory_id where email matches
UPDATE public.profiles p
SET
  pm_directory_id = pmd.id,
  phone           = COALESCE(p.phone, pmd.phone)
FROM public.pm_directory pmd
WHERE LOWER(TRIM(pmd.email)) = LOWER(TRIM(p.email))
  AND p.pm_directory_id IS NULL;

-- Set pm_directory.profile_id where email matches and not yet linked
UPDATE public.pm_directory pmd
SET profile_id = p.id
FROM public.profiles p
WHERE LOWER(TRIM(p.email)) = LOWER(TRIM(pmd.email))
  AND pmd.profile_id IS NULL;
