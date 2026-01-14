-- Drop existing SELECT policies on hectares and parcelles
DROP POLICY IF EXISTS "Admins can view hectares" ON public.hectares;
DROP POLICY IF EXISTS "Admins can view parcelles" ON public.parcelles;

-- Create new SELECT policies requiring view_buyer_pii permission
CREATE POLICY "Only admins with PII permission can view hectares"
ON public.hectares
FOR SELECT
USING (can_view_buyer_pii(auth.uid()));

CREATE POLICY "Only admins with PII permission can view parcelles"
ON public.parcelles
FOR SELECT
USING (can_view_buyer_pii(auth.uid()));