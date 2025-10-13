-- Create hectares table
CREATE TABLE public.hectares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  surface DECIMAL(10,2) NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create parcelles table
CREATE TABLE public.parcelles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hectare_id UUID REFERENCES public.hectares(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  surface DECIMAL(10,2) NOT NULL,
  prix DECIMAL(15,2) NOT NULL,
  status TEXT DEFAULT 'disponible',
  buyer_name TEXT,
  buyer_phone TEXT,
  buyer_email TEXT,
  sale_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parcelle_id UUID REFERENCES public.parcelles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  file_url TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hectares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Hectares policies
CREATE POLICY "Authenticated users can view hectares"
ON public.hectares FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create hectares"
ON public.hectares FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update hectares"
ON public.hectares FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete hectares"
ON public.hectares FOR DELETE
TO authenticated
USING (true);

-- Parcelles policies
CREATE POLICY "Authenticated users can view parcelles"
ON public.parcelles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create parcelles"
ON public.parcelles FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update parcelles"
ON public.parcelles FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete parcelles"
ON public.parcelles FOR DELETE
TO authenticated
USING (true);

-- Documents policies
CREATE POLICY "Authenticated users can view documents"
ON public.documents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create documents"
ON public.documents FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can delete documents"
ON public.documents FOR DELETE
TO authenticated
USING (auth.uid() = uploaded_by);

-- Update triggers
CREATE TRIGGER update_hectares_updated_at
BEFORE UPDATE ON public.hectares
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parcelles_updated_at
BEFORE UPDATE ON public.parcelles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();