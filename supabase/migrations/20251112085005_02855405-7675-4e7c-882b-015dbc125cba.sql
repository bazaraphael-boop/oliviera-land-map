-- Ajouter les champs de vente dans la table hectares pour permettre l'achat d'hectares
ALTER TABLE public.hectares 
ADD COLUMN IF NOT EXISTS buyer_name text,
ADD COLUMN IF NOT EXISTS buyer_phone text,
ADD COLUMN IF NOT EXISTS buyer_email text,
ADD COLUMN IF NOT EXISTS sale_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'total' CHECK (payment_type IN ('partiel', 'total')),
ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS sale_type text DEFAULT 'normal' CHECK (sale_type IN ('onereux', 'normal')),
ADD COLUMN IF NOT EXISTS purchase_type text CHECK (purchase_type IN ('parcelle', 'hectare', 'demi-hectare'));

-- Créer une table pour l'historique des paiements
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parcelle_id uuid REFERENCES public.parcelles(id) ON DELETE CASCADE,
  hectare_id uuid REFERENCES public.hectares(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date timestamp with time zone NOT NULL DEFAULT now(),
  payment_method text,
  notes text,
  invoice_number text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_reference_check CHECK (
    (parcelle_id IS NOT NULL AND hectare_id IS NULL) OR 
    (parcelle_id IS NULL AND hectare_id IS NOT NULL)
  )
);

-- Enable RLS on payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Create policies for payments table
CREATE POLICY "Authenticated users can view payments" 
ON public.payments 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create payments" 
ON public.payments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update payments" 
ON public.payments 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete payments" 
ON public.payments 
FOR DELETE 
USING (true);

-- Add purchase_type to parcelles as well
ALTER TABLE public.parcelles 
ADD COLUMN IF NOT EXISTS purchase_type text CHECK (purchase_type IN ('parcelle', 'hectare', 'demi-hectare'));