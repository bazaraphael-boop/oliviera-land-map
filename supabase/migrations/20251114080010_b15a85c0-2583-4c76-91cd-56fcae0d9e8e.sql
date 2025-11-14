-- Drop existing permissive policies on parcelles table
DROP POLICY IF EXISTS "Authenticated users can view parcelles" ON public.parcelles;
DROP POLICY IF EXISTS "Authenticated users can create parcelles" ON public.parcelles;
DROP POLICY IF EXISTS "Authenticated users can update parcelles" ON public.parcelles;
DROP POLICY IF EXISTS "Authenticated users can delete parcelles" ON public.parcelles;

-- Create restrictive RLS policies that only allow admins
CREATE POLICY "Only admins can view parcelles with buyer information"
ON public.parcelles
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can create parcelles"
ON public.parcelles
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update parcelles"
ON public.parcelles
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete parcelles"
ON public.parcelles
FOR DELETE
USING (public.is_admin(auth.uid()));