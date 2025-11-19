-- Ajouter les nouveaux champs d'identification pour les acheteurs dans la table parcelles
ALTER TABLE public.parcelles 
ADD COLUMN IF NOT EXISTS buyer_last_name TEXT,
ADD COLUMN IF NOT EXISTS buyer_first_name TEXT,
ADD COLUMN IF NOT EXISTS buyer_profession TEXT,
ADD COLUMN IF NOT EXISTS buyer_birth_place TEXT,
ADD COLUMN IF NOT EXISTS buyer_birth_date DATE,
ADD COLUMN IF NOT EXISTS buyer_marital_status TEXT,
ADD COLUMN IF NOT EXISTS buyer_children_count INTEGER,
ADD COLUMN IF NOT EXISTS buyer_address TEXT;

-- Ajouter les nouveaux champs d'identification pour les acheteurs dans la table hectares
ALTER TABLE public.hectares 
ADD COLUMN IF NOT EXISTS buyer_last_name TEXT,
ADD COLUMN IF NOT EXISTS buyer_first_name TEXT,
ADD COLUMN IF NOT EXISTS buyer_profession TEXT,
ADD COLUMN IF NOT EXISTS buyer_birth_place TEXT,
ADD COLUMN IF NOT EXISTS buyer_birth_date DATE,
ADD COLUMN IF NOT EXISTS buyer_marital_status TEXT,
ADD COLUMN IF NOT EXISTS buyer_children_count INTEGER,
ADD COLUMN IF NOT EXISTS buyer_address TEXT;