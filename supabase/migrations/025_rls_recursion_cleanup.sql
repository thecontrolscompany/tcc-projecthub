DROP POLICY IF EXISTS "Installer reads assignments for own projects" ON public.project_assignments;
DROP POLICY IF EXISTS "Customer reads assignments for accessible projects" ON public.project_assignments;

DROP POLICY IF EXISTS "Admin manages profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin reads all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Ops manager reads all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Customer reads assigned team profiles" ON public.profiles;
