-- Créer un bucket de stockage pour les documents des acheteurs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'buyer-documents',
  'buyer-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf']
);

-- Créer une table pour les documents des acheteurs
CREATE TABLE IF NOT EXISTS public.buyer_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id TEXT NOT NULL, -- Identifiant unique de l'acheteur (combinaison nom + phone)
  document_type TEXT NOT NULL, -- Type de document (carte d'identité, attestation, contrat, etc.)
  file_path TEXT NOT NULL, -- Chemin du fichier dans le bucket storage
  file_name TEXT NOT NULL, -- Nom original du fichier
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  uploaded_by UUID REFERENCES auth.users(id),
  notes TEXT -- Notes optionnelles sur le document
);

-- Enable RLS
ALTER TABLE public.buyer_documents ENABLE ROW LEVEL SECURITY;

-- Policies pour buyer_documents
CREATE POLICY "Les utilisateurs authentifiés peuvent voir tous les documents"
  ON public.buyer_documents
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Les utilisateurs authentifiés peuvent ajouter des documents"
  ON public.buyer_documents
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = uploaded_by);

CREATE POLICY "Les utilisateurs authentifiés peuvent supprimer leurs propres documents"
  ON public.buyer_documents
  FOR DELETE
  USING (auth.uid() = uploaded_by);

-- Policies pour le bucket storage buyer-documents
CREATE POLICY "Les utilisateurs authentifiés peuvent voir les documents"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'buyer-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Les utilisateurs authentifiés peuvent uploader des documents"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'buyer-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Les utilisateurs peuvent supprimer leurs propres documents"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'buyer-documents' AND auth.uid() IS NOT NULL);

CREATE POLICY "Les utilisateurs authentifiés peuvent mettre à jour les documents"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'buyer-documents' AND auth.uid() IS NOT NULL);

-- Index pour améliorer les performances
CREATE INDEX idx_buyer_documents_buyer_id ON public.buyer_documents(buyer_id);
CREATE INDEX idx_buyer_documents_uploaded_at ON public.buyer_documents(uploaded_at DESC);