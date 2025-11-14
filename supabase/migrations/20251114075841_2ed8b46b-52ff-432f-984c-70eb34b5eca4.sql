-- Drop existing permissive policies on hectares table
DROP POLICY IF EXISTS "Authenticated users can view hectares" ON public.hectares;
DROP POLICY IF EXISTS "Authenticated users can create hectares" ON public.hectares;
DROP POLICY IF EXISTS "Authenticated users can update hectares" ON public.hectares;
DROP POLICY IF EXISTS "Authenticated users can delete hectares" ON public.hectares;

-- Create restrictive RLS policies that only allow admins
CREATE POLICY "Only admins can view hectares with buyer information"
ON public.hectares
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can create hectares"
ON public.hectares
FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update hectares"
ON public.hectares
FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete hectares"
ON public.hectares
FOR DELETE
USING (public.is_admin(auth.uid()));