-- Ajouter les colonnes de coordonnées GPS aux hectares
ALTER TABLE public.hectares 
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Ajouter les colonnes de coordonnées GPS aux parcelles
ALTER TABLE public.parcelles 
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- Ajouter des commentaires pour documenter les colonnes
COMMENT ON COLUMN public.hectares.latitude IS 'Latitude GPS de l''hectare';
COMMENT ON COLUMN public.hectares.longitude IS 'Longitude GPS de l''hectare';
COMMENT ON COLUMN public.parcelles.latitude IS 'Latitude GPS de la parcelle';
COMMENT ON COLUMN public.parcelles.longitude IS 'Longitude GPS de la parcelle';