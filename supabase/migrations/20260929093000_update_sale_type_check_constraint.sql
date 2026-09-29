-- Mise à jour de la contrainte check pour autoriser 'a_renseigner' en plus de 'onereux' et 'normal'
-- et s'assurer que NULL est explicitement accepté pour les ventes en attente.

ALTER TABLE public.parcelles DROP CONSTRAINT IF EXISTS parcelles_sale_type_check;
ALTER TABLE public.parcelles ADD CONSTRAINT parcelles_sale_type_check CHECK (sale_type IS NULL OR sale_type IN ('onereux', 'normal', 'a_renseigner'));

ALTER TABLE public.hectares DROP CONSTRAINT IF EXISTS hectares_sale_type_check;
ALTER TABLE public.hectares ADD CONSTRAINT hectares_sale_type_check CHECK (sale_type IS NULL OR sale_type IN ('onereux', 'normal', 'a_renseigner'));
