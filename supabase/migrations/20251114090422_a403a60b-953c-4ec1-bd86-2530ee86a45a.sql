-- Create sites table
CREATE TABLE public.sites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  surface_totale NUMERIC NOT NULL,
  quota_percentage NUMERIC DEFAULT 0,
  surface_vendue NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- Create policies for sites
CREATE POLICY "Only admins can view sites"
ON public.sites
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can create sites"
ON public.sites
FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update sites"
ON public.sites
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete sites"
ON public.sites
FOR DELETE
USING (is_admin(auth.uid()));

-- Add site_id to hectares table
ALTER TABLE public.hectares
ADD COLUMN site_id UUID REFERENCES public.sites(id);

-- Create trigger for sites updated_at
CREATE TRIGGER update_sites_updated_at
BEFORE UPDATE ON public.sites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial sites
INSERT INTO public.sites (name, surface_totale, quota_percentage) VALUES
('Muanda village site 1', 97, 0),
('Isetech 144ha site 2', 144, 0),
('Site 3: d''olivera', 5000, 0);