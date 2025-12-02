-- Créer les politiques RLS pour le bucket buyer-documents

-- Permettre aux utilisateurs authentifiés de créer des fichiers
CREATE POLICY "Authenticated users can upload buyer documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'buyer-documents' AND
  auth.uid() IS NOT NULL
);

-- Permettre aux utilisateurs authentifiés de lire tous les documents acheteurs
CREATE POLICY "Authenticated users can view buyer documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'buyer-documents');

-- Permettre aux utilisateurs de supprimer leurs propres uploads
CREATE POLICY "Users can delete their own buyer documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'buyer-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);