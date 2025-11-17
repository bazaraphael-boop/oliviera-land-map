-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

-- Create user_permissions junction table
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission_code text NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, permission_code)
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Policies for permissions table
CREATE POLICY "Admins can view all permissions"
  ON public.permissions
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert permissions"
  ON public.permissions
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Policies for user_permissions table
CREATE POLICY "Admins can view all user permissions"
  ON public.user_permissions
  FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own permissions"
  ON public.user_permissions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert user permissions"
  ON public.user_permissions
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete user permissions"
  ON public.user_permissions
  FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Insert default permissions
INSERT INTO public.permissions (code, label, description) VALUES
  ('manage_users', 'Gérer les utilisateurs', 'Créer, modifier et supprimer des utilisateurs'),
  ('manage_hectares', 'Gérer les hectares', 'Créer, modifier et supprimer des hectares'),
  ('manage_parcelles', 'Gérer les parcelles', 'Créer, modifier et supprimer des parcelles'),
  ('manage_sites', 'Gérer les sites', 'Créer, modifier et supprimer des sites'),
  ('view_buyers', 'Voir les acheteurs', 'Consulter la liste des acheteurs'),
  ('manage_payments', 'Gérer les paiements', 'Créer et gérer les paiements'),
  ('generate_reports', 'Générer des rapports', 'Créer et télécharger des rapports'),
  ('view_documents', 'Voir les documents', 'Consulter les documents'),
  ('manage_settings', 'Gérer les paramètres', 'Accéder et modifier les paramètres'),
  ('view_total_revenue', 'Voir les revenus total', 'Consulter les revenus totaux de l''application')
ON CONFLICT (code) DO NOTHING;

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_permissions
    WHERE user_id = _user_id
      AND permission_code = _permission_code
  )
$$;