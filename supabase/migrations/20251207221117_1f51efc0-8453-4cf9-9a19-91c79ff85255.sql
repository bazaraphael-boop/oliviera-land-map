-- Add new buyer identification fields to hectares table
ALTER TABLE public.hectares
ADD COLUMN IF NOT EXISTS buyer_village_origin text,
ADD COLUMN IF NOT EXISTS buyer_groupement text,
ADD COLUMN IF NOT EXISTS buyer_secteur text,
ADD COLUMN IF NOT EXISTS buyer_territoire text,
ADD COLUMN IF NOT EXISTS buyer_province text;

-- Add new buyer identification fields to parcelles table
ALTER TABLE public.parcelles
ADD COLUMN IF NOT EXISTS buyer_village_origin text,
ADD COLUMN IF NOT EXISTS buyer_groupement text,
ADD COLUMN IF NOT EXISTS buyer_secteur text,
ADD COLUMN IF NOT EXISTS buyer_territoire text,
ADD COLUMN IF NOT EXISTS buyer_province text;