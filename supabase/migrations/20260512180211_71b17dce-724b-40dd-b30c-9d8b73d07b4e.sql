
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE public.leves_terrain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom_agent text NOT NULL,
  nom_client text,
  points jsonb NOT NULL,
  geometry geometry(Polygon, 4326),
  surface_calculee numeric,
  notes text,
  date_enregistrement timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leves_terrain_geom_idx ON public.leves_terrain USING GIST (geometry);
CREATE INDEX leves_terrain_created_by_idx ON public.leves_terrain (created_by);

ALTER TABLE public.leves_terrain ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all leves" ON public.leves_terrain
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view their own leves" ON public.leves_terrain
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can create leves" ON public.leves_terrain
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);

CREATE POLICY "Admins can update leves" ON public.leves_terrain
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can update their own leves" ON public.leves_terrain
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Admins can delete leves" ON public.leves_terrain
  FOR DELETE USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can delete their own leves" ON public.leves_terrain
  FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER update_leves_terrain_updated_at
  BEFORE UPDATE ON public.leves_terrain
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.point_in_existing_parcelle(_lat numeric, _lng numeric)
RETURNS TABLE(id uuid, nom_agent text, nom_client text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lt.id, lt.nom_agent, lt.nom_client
  FROM public.leves_terrain lt
  WHERE lt.geometry IS NOT NULL
    AND ST_Contains(lt.geometry, ST_SetSRID(ST_MakePoint(_lng, _lat), 4326));
$$;
