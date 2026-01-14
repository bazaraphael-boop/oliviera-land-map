-- Add new permission for viewing buyer PII data
INSERT INTO public.permissions (code, label, description) 
VALUES ('view_buyer_pii', 'Voir les données personnelles des acheteurs', 'Permet de visualiser les informations personnelles sensibles des acheteurs (nom, téléphone, email, adresse, etc.)')
ON CONFLICT (code) DO NOTHING;

-- Create function to check if user can view buyer PII
CREATE OR REPLACE FUNCTION public.can_view_buyer_pii(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id) AND public.has_permission(_user_id, 'view_buyer_pii')
$$;

-- Drop existing hectares policies
DROP POLICY IF EXISTS "Only admins can view hectares with buyer information" ON public.hectares;
DROP POLICY IF EXISTS "Only admins can create hectares" ON public.hectares;
DROP POLICY IF EXISTS "Only admins can update hectares" ON public.hectares;
DROP POLICY IF EXISTS "Only admins can delete hectares" ON public.hectares;

-- Create new policies with granular PII access control
-- Admins can view hectares but buyer info columns will be controlled by the view
CREATE POLICY "Admins can view hectares"
ON public.hectares
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins with PII permission can create hectares with buyer info"
ON public.hectares
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) AND 
  (
    -- If no buyer info, allow
    (buyer_name IS NULL AND buyer_phone IS NULL AND buyer_email IS NULL) OR
    -- If buyer info, require PII permission
    can_view_buyer_pii(auth.uid())
  )
);

CREATE POLICY "Admins with PII permission can update hectares"
ON public.hectares
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (
  is_admin(auth.uid()) AND 
  (
    -- If no buyer info being added, allow
    (buyer_name IS NULL AND buyer_phone IS NULL AND buyer_email IS NULL) OR
    -- If buyer info, require PII permission
    can_view_buyer_pii(auth.uid())
  )
);

CREATE POLICY "Admins can delete hectares"
ON public.hectares
FOR DELETE
USING (is_admin(auth.uid()));

-- Drop existing parcelles policies
DROP POLICY IF EXISTS "Only admins can view parcelles with buyer information" ON public.parcelles;
DROP POLICY IF EXISTS "Only admins can create parcelles" ON public.parcelles;
DROP POLICY IF EXISTS "Only admins can update parcelles" ON public.parcelles;
DROP POLICY IF EXISTS "Only admins can delete parcelles" ON public.parcelles;

-- Create new policies for parcelles with granular PII access control
CREATE POLICY "Admins can view parcelles"
ON public.parcelles
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins with PII permission can create parcelles with buyer info"
ON public.parcelles
FOR INSERT
WITH CHECK (
  is_admin(auth.uid()) AND 
  (
    -- If no buyer info, allow
    (buyer_name IS NULL AND buyer_phone IS NULL AND buyer_email IS NULL) OR
    -- If buyer info, require PII permission
    can_view_buyer_pii(auth.uid())
  )
);

CREATE POLICY "Admins with PII permission can update parcelles"
ON public.parcelles
FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (
  is_admin(auth.uid()) AND 
  (
    -- If no buyer info being added, allow
    (buyer_name IS NULL AND buyer_phone IS NULL AND buyer_email IS NULL) OR
    -- If buyer info, require PII permission
    can_view_buyer_pii(auth.uid())
  )
);

CREATE POLICY "Admins can delete parcelles"
ON public.parcelles
FOR DELETE
USING (is_admin(auth.uid()));

-- Add unique constraint on permissions.code if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'permissions_code_key'
  ) THEN
    ALTER TABLE public.permissions ADD CONSTRAINT permissions_code_key UNIQUE (code);
  END IF;
END $$;