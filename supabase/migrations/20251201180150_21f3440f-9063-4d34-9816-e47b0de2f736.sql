-- Activer Realtime pour la table buyer_documents
ALTER TABLE buyer_documents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE buyer_documents;

-- Activer Realtime pour la table documents
ALTER TABLE documents REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE documents;