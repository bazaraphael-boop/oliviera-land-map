-- Ajouter le champ prix et numéro RMB dans la table hectares
ALTER TABLE public.hectares 
ADD COLUMN IF NOT EXISTS prix numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS rmb_number text;

-- Ajouter les champs pour les paiements partiels et type de vente dans la table parcelles
ALTER TABLE public.parcelles 
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'total' CHECK (payment_type IN ('partiel', 'total')),
ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sale_type text DEFAULT 'normal' CHECK (sale_type IN ('onereux', 'normal'));

-- Commentaires pour documenter les nouveaux champs
COMMENT ON COLUMN public.hectares.prix IS 'Prix total de l''hectare';
COMMENT ON COLUMN public.hectares.rmb_number IS 'Numéro RMB de l''hectare';
COMMENT ON COLUMN public.parcelles.payment_type IS 'Type de paiement: partiel ou total';
COMMENT ON COLUMN public.parcelles.amount_paid IS 'Montant déjà payé';
COMMENT ON COLUMN public.parcelles.remaining_amount IS 'Montant restant à payer';
COMMENT ON COLUMN public.parcelles.sale_type IS 'Type de vente: à titre onéreux ou vente normale';