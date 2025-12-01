import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, FileText, Upload, Download, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Document {
  id: string;
  type: string;
  title: string;
  file_url: string | null;
  created_at: string;
  uploaded_by: string | null;
  parcelle_id: string | null;
}

interface BuyerDocument {
  id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
  buyer_id: string;
  notes: string | null;
}

interface UnifiedDocument {
  id: string;
  type: string;
  title: string;
  created_at: string;
  source: 'parcelle' | 'acheteur';
  file_url?: string | null;
  buyer_id?: string;
  parcelle_id?: string | null;
  notes?: string | null;
}

interface Parcelle {
  id: string;
  numero: string;
}

const Documents = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<UnifiedDocument[]>([]);
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newDocument, setNewDocument] = useState({
    type: "",
    title: "",
    parcelle_id: "",
  });

  useEffect(() => {
    checkAuth();
    loadAllDocuments();
    loadParcelles();

    // Configuration Realtime pour buyer_documents
    const buyerDocsChannel = supabase
      .channel('buyer-documents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'buyer_documents'
        },
        () => {
          loadAllDocuments();
        }
      )
      .subscribe();

    // Configuration Realtime pour documents
    const docsChannel = supabase
      .channel('documents-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents'
        },
        () => {
          loadAllDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(buyerDocsChannel);
      supabase.removeChannel(docsChannel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };

  const loadAllDocuments = async () => {
    try {
      // Charger les documents parcelles
      const { data: parcelDocs, error: parcelError } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (parcelError) throw parcelError;

      // Charger les documents acheteurs
      const { data: buyerDocs, error: buyerError } = await supabase
        .from("buyer_documents")
        .select("*")
        .order("uploaded_at", { ascending: false });

      if (buyerError) throw buyerError;

      // Mapper les documents parcelles
      const mappedParcelDocs: UnifiedDocument[] = (parcelDocs || []).map(doc => ({
        id: doc.id,
        type: doc.type,
        title: doc.title,
        created_at: doc.created_at,
        source: 'parcelle' as const,
        file_url: doc.file_url,
        parcelle_id: doc.parcelle_id,
      }));

      // Mapper les documents acheteurs
      const mappedBuyerDocs: UnifiedDocument[] = (buyerDocs || []).map(doc => ({
        id: doc.id,
        type: doc.document_type,
        title: doc.file_name,
        created_at: doc.uploaded_at,
        source: 'acheteur' as const,
        buyer_id: doc.buyer_id,
        notes: doc.notes,
      }));

      // Fusionner et trier par date
      const allDocs = [...mappedParcelDocs, ...mappedBuyerDocs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setDocuments(allDocs);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des documents");
    } finally {
      setLoading(false);
    }
  };

  const loadParcelles = async () => {
    try {
      const { data, error } = await supabase
        .from("parcelles")
        .select("id, numero")
        .order("numero");

      if (error) throw error;
      setParcelles(data || []);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const handleAddDocument = async () => {
    if (!newDocument.type || !newDocument.title) {
      toast.error("Veuillez remplir tous les champs requis");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("documents").insert({
        type: newDocument.type,
        title: newDocument.title,
        parcelle_id: newDocument.parcelle_id || null,
        uploaded_by: user?.id,
      });

      if (error) throw error;

      toast.success("Document ajouté avec succès");
      setShowAddDialog(false);
      setNewDocument({ type: "", title: "", parcelle_id: "" });
      loadAllDocuments();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'ajout du document");
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce document ?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Document supprimé avec succès");
      loadAllDocuments();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression du document");
    }
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Gestion des Documents
          </h1>
          <p className="text-muted-foreground">
            Gérez tous vos documents importants
          </p>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un document..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button onClick={() => setShowAddDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Nouveau Document
          </Button>
        </div>

        {/* Documents Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <Card key={doc.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  {doc.source === 'acheteur' ? (
                    <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded">
                      Acheteur
                    </span>
                  ) : (
                    <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded">
                      Parcelle
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDocument(doc.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <h3 className="font-semibold text-foreground mb-2">
                {doc.title}
              </h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>{doc.type}</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                </div>

                {doc.notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {doc.notes}
                  </p>
                )}
              </div>

              {doc.file_url && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-4"
                  onClick={() => window.open(doc.file_url!, "_blank")}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              )}
            </Card>
          ))}
        </div>

        {filteredDocuments.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucun document trouvé
            </h3>
            <p className="text-muted-foreground">
              Commencez par ajouter votre premier document
            </p>
          </div>
        )}

        {/* Dialog Nouveau Document */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau Document</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="type">Type de document *</Label>
                <Select
                  value={newDocument.type}
                  onValueChange={(value) =>
                    setNewDocument({ ...newDocument, type: value })
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contrat">Contrat</SelectItem>
                    <SelectItem value="Acte de vente">Acte de vente</SelectItem>
                    <SelectItem value="Plan">Plan</SelectItem>
                    <SelectItem value="Certificat">Certificat</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={newDocument.title}
                  onChange={(e) =>
                    setNewDocument({ ...newDocument, title: e.target.value })
                  }
                  placeholder="Ex: Contrat de vente parcelle A1"
                />
              </div>

              <div>
                <Label htmlFor="parcelle">Parcelle associée (optionnel)</Label>
                <Select
                  value={newDocument.parcelle_id}
                  onValueChange={(value) =>
                    setNewDocument({ ...newDocument, parcelle_id: value })
                  }
                >
                  <SelectTrigger id="parcelle">
                    <SelectValue placeholder="Sélectionner une parcelle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucune</SelectItem>
                    {parcelles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        Parcelle {p.numero}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Annuler
              </Button>
              <Button onClick={handleAddDocument}>Ajouter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Documents;
