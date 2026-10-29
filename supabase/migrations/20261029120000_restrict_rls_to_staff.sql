-- Sécurité : les politiques ci-dessous n'exigeaient qu'une session valide.
-- Comme l'inscription était ouverte, n'importe quel compte créé librement
-- pouvait lire ou modifier les paiements et les pièces des acheteurs.
-- On les réserve désormais au personnel (public.is_staff), comme les
-- justificatifs de paiement (bucket payment-proofs).

-- ===== payments =====
DROP POLICY IF EXISTS "Authenticated users can view payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can create payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can update payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can delete payments" ON public.payments;

CREATE POLICY "Staff can view payments" ON public.payments
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can create payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Staff can update payments" ON public.payments
  FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "Admins can delete payments" ON public.payments
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ===== buyer_documents (table) =====
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent voir tous les documents" ON public.buyer_documents;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent ajouter des documents" ON public.buyer_documents;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent supprimer leurs propres documents" ON public.buyer_documents;

CREATE POLICY "Staff can view buyer documents" ON public.buyer_documents
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can add buyer documents" ON public.buyer_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = uploaded_by);
CREATE POLICY "Uploader or admin can delete buyer documents" ON public.buyer_documents
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()) AND (auth.uid() = uploaded_by OR public.is_admin(auth.uid())));

-- ===== buyer-documents (stockage) =====
-- Deux jeux de politiques se cumulaient ; on les remplace tous.
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent voir les documents" ON storage.objects;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent uploader des documents" ON storage.objects;
DROP POLICY IF EXISTS "Les utilisateurs peuvent supprimer leurs propres documents" ON storage.objects;
DROP POLICY IF EXISTS "Les utilisateurs authentifiés peuvent mettre à jour les documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload buyer documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view buyer documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own buyer documents" ON storage.objects;

CREATE POLICY "Staff can read buyer document files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'buyer-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "Staff can upload buyer document files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'buyer-documents' AND public.is_staff(auth.uid()));
CREATE POLICY "Owner or admin can delete buyer document files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'buyer-documents' AND public.is_staff(auth.uid())
         AND (owner_id = auth.uid()::text OR public.is_admin(auth.uid())));

-- ===== documents =====
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can create documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON public.documents;

CREATE POLICY "Staff can view documents" ON public.documents
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "Staff can create documents" ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND auth.uid() = uploaded_by);
CREATE POLICY "Uploader or admin can delete documents" ON public.documents
  FOR DELETE TO authenticated
  USING (public.is_staff(auth.uid()) AND (auth.uid() = uploaded_by OR public.is_admin(auth.uid())));

-- ===== audit_logs =====
-- Les entrées sont écrites par des fonctions SECURITY DEFINER, qui
-- contournent la RLS : aucun client ne doit pouvoir en insérer.
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
