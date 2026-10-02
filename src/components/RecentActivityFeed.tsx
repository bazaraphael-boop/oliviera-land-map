import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Activity, 
  FileText, 
  Upload, 
  Download, 
  Eye, 
  MapPin, 
  Layers, 
  DollarSign, 
  Clock, 
  RefreshCw, 
  Search, 
  ExternalLink, 
  CheckCircle2, 
  User, 
  ChevronRight, 
  Loader2, 
  X,
  CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { normalizeText } from "@/hooks/useBuyerDetection";

export type ActivityCategory = "all" | "documents" | "sales" | "payments";

export interface ActivityItem {
  id: string;
  category: "documents" | "sales" | "payments";
  type: "document_buyer" | "document_parcel" | "sale_parcelle" | "sale_hectare" | "payment";
  title: string;
  description: string;
  timestamp: string; // Date ISO
  buyerName?: string | null;
  targetName?: string | null;
  amount?: number | null;
  surface?: number | null;
  filePath?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  documentType?: string | null;
  rmbNumber?: string | null;
  link?: string;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  carte_identite: "Carte d'identité",
  attestation: "Attestation d'attribution",
  contrat: "Contrat de vente",
  recu_paiement: "Reçu de paiement",
  autre: "Autre justificatif",
};

export const RecentActivityFeed = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Preview Dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");

  const formatActivityDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 1) return "À l'instant";
      if (diffMin < 60) return `Il y a ${diffMin} min`;
      if (diffHours < 24) return `Il y a ${diffHours} h`;
      if (diffDays === 1) {
        return `Hier à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
      }
      if (diffDays < 7) return `Il y a ${diffDays} jours`;

      return date.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const loadActivities = async () => {
    try {
      // 1. Récupérer les documents acheteurs récents
      const { data: buyerDocs } = await supabase
        .from("buyer_documents")
        .select("id, document_type, file_name, file_path, uploaded_at, buyer_id, notes")
        .order("uploaded_at", { ascending: false })
        .limit(35);

      // 2. Récupérer les documents parcelles récents
      const { data: parcelDocs } = await supabase
        .from("documents")
        .select("id, type, title, file_url, created_at, parcelle_id")
        .order("created_at", { ascending: false })
        .limit(30);

      // 3. Récupérer les parcelles vendues récentes
      const { data: parcelles } = await supabase
        .from("parcelles")
        .select("id, numero, buyer_name, prix, amount_paid, payment_type, sale_date, created_at, rmb_number")
        .eq("status", "vendu")
        .not("buyer_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(35);

      // 4. Récupérer les hectares vendus récents
      const { data: hectares } = await supabase
        .from("hectares")
        .select("id, name, buyer_name, prix, surface, amount_paid, payment_type, sale_date, created_at, rmb_number")
        .or("status.eq.sold,status.eq.vendu")
        .not("buyer_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(35);

      const items: ActivityItem[] = [];

      // Mapper documents acheteurs
      (buyerDocs || []).forEach((doc) => {
        const rawDate = doc.uploaded_at || new Date().toISOString();
        const typeLabel = DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type || "Document";
        const buyerDisplay = doc.buyer_id ? doc.buyer_id.trim() : "Concessionnaire";

        items.push({
          id: `bdoc-${doc.id}`,
          category: "documents",
          type: "document_buyer",
          title: `Ajout de pièce justificative : ${doc.file_name}`,
          description: `${typeLabel} rattaché(e) au dossier de ${buyerDisplay}`,
          timestamp: rawDate,
          buyerName: buyerDisplay,
          targetName: doc.file_name,
          filePath: doc.file_path,
          fileName: doc.file_name,
          documentType: typeLabel,
          link: "/acheteurs",
        });
      });

      // Mapper documents parcelles
      (parcelDocs || []).forEach((doc) => {
        const rawDate = doc.created_at || new Date().toISOString();
        items.push({
          id: `pdoc-${doc.id}`,
          category: "documents",
          type: "document_parcel",
          title: `Document foncier téléversé : ${doc.title}`,
          description: `Type : ${doc.type || "Document"}`,
          timestamp: rawDate,
          targetName: doc.title,
          fileUrl: doc.file_url,
          fileName: doc.title,
          documentType: doc.type,
          link: "/documents",
        });
      });

      // Mapper ventes de parcelles
      (parcelles || []).forEach((p) => {
        const rawDate = p.sale_date || p.created_at || new Date().toISOString();
        const price = Number(p.prix || 0);
        const amountPaid = Number(p.amount_paid || 0);
        const isPartiel = p.payment_type === "partiel";

        items.push({
          id: `sale-p-${p.id}`,
          category: isPartiel ? "payments" : "sales",
          type: "sale_parcelle",
          title: `Vente de la Parcelle ${p.numero}`,
          description: `Acquéreur : ${p.buyer_name}${p.rmb_number ? ` • RMB ${p.rmb_number}` : ""} • Montant : ${price.toLocaleString()} USD${isPartiel ? ` (Acompte versé : ${amountPaid.toLocaleString()} USD)` : ""}`,
          timestamp: rawDate,
          buyerName: p.buyer_name,
          targetName: `Parcelle ${p.numero}`,
          amount: price,
          rmbNumber: p.rmb_number,
          link: "/acheteurs",
        });
      });

      // Mapper attributions d'hectares
      (hectares || []).forEach((h) => {
        const rawDate = h.sale_date || h.created_at || new Date().toISOString();
        const price = Number(h.prix || 0);
        const surface = Number(h.surface || 1);
        const amountPaid = Number(h.amount_paid || 0);
        const isPartiel = h.payment_type === "partiel";

        items.push({
          id: `sale-h-${h.id}`,
          category: isPartiel ? "payments" : "sales",
          type: "sale_hectare",
          title: `Attribution de l'Hectare ${h.name}`,
          description: `Concessionnaire : ${h.buyer_name}${h.rmb_number ? ` • RMB ${h.rmb_number}` : ""} • Surface : ${surface} ha • ${price.toLocaleString()} USD${isPartiel ? ` (Acompte : ${amountPaid.toLocaleString()} USD)` : ""}`,
          timestamp: rawDate,
          buyerName: h.buyer_name,
          targetName: `Hectare ${h.name}`,
          amount: price,
          surface,
          rmbNumber: h.rmb_number,
          link: "/acheteurs",
        });
      });

      // Trier chronologiquement (le plus récent en premier)
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setActivities(items);
    } catch (error) {
      console.error("Erreur chargement activités récentes:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadActivities();

    // Configuration des écouteurs temps réel Supabase
    const channel = supabase
      .channel("dashboard-activities-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "buyer_documents" },
        () => {
          loadActivities();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents" },
        () => {
          loadActivities();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "parcelles" },
        () => {
          loadActivities();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "hectares" },
        () => {
          loadActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadActivities();
    toast.success("Activités actualisées");
  };

  const handleDownload = async (activity: ActivityItem) => {
    const path = activity.filePath || activity.fileUrl;
    if (!path) {
      toast.error("Fichier non disponible");
      return;
    }

    try {
      setDownloadingId(activity.id);
      toast.info("Téléchargement du document...");

      if (path.startsWith("http://") || path.startsWith("https://")) {
        const response = await fetch(path);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = activity.fileName || "document";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
        toast.success("Document téléchargé");
        return;
      }

      // Téléchargement depuis buyer-documents
      const { data, error } = await supabase.storage
        .from("buyer-documents")
        .download(path);

      if (error || !data) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from("buyer-documents")
          .createSignedUrl(path, 3600, {
            download: activity.fileName || "document",
          });

        if (signedError || !signedData?.signedUrl) {
          throw signedError || new Error("Impossible de générer le lien");
        }

        const link = document.createElement("a");
        link.href = signedData.signedUrl;
        link.download = activity.fileName || "document";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const blobUrl = window.URL.createObjectURL(data);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = activity.fileName || "document";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(blobUrl);
        document.body.removeChild(a);
      }

      toast.success("Document téléchargé avec succès");
    } catch (err: any) {
      console.error("Erreur téléchargement:", err);
      toast.error("Erreur téléchargement : " + (err?.message || "inconnue"));
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (activity: ActivityItem) => {
    const path = activity.filePath || activity.fileUrl;
    if (!path) return;

    try {
      if (path.startsWith("http://") || path.startsWith("https://")) {
        setPreviewUrl(path);
        setPreviewTitle(activity.fileName || "Aperçu document");
        setPreviewOpen(true);
        return;
      }

      const { data, error } = await supabase.storage
        .from("buyer-documents")
        .createSignedUrl(path, 3600);

      if (error || !data?.signedUrl) {
        throw error || new Error("Aperçu indisponible");
      }

      setPreviewUrl(data.signedUrl);
      setPreviewTitle(activity.fileName || "Aperçu document");
      setPreviewOpen(true);
    } catch (err) {
      console.error("Erreur aperçu:", err);
      toast.error("Impossible d'afficher l'aperçu du document");
    }
  };

  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      // Filtre catégorie
      if (selectedCategory !== "all" && act.category !== selectedCategory) {
        return false;
      }

      // Filtre recherche textuelle
      if (!searchQuery.trim()) return true;
      const q = normalizeText(searchQuery);
      return (
        normalizeText(act.title).includes(q) ||
        normalizeText(act.description).includes(q) ||
        (act.buyerName && normalizeText(act.buyerName).includes(q)) ||
        (act.targetName && normalizeText(act.targetName).includes(q)) ||
        (act.documentType && normalizeText(act.documentType).includes(q)) ||
        (act.rmbNumber && normalizeText(act.rmbNumber).includes(q))
      );
    });
  }, [activities, selectedCategory, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: activities.length,
      documents: activities.filter((a) => a.category === "documents").length,
      sales: activities.filter((a) => a.category === "sales").length,
      payments: activities.filter((a) => a.category === "payments").length,
    };
  }, [activities]);

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "document_buyer":
        return {
          icon: FileText,
          bg: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 border-blue-500/20",
          badge: "Document Acheteur",
          badgeColor: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
        };
      case "document_parcel":
        return {
          icon: Upload,
          bg: "bg-cyan-500/10 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border-cyan-500/20",
          badge: "Document Parcelle",
          badgeColor: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30",
        };
      case "sale_parcelle":
        return {
          icon: MapPin,
          bg: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/20",
          badge: "Vente Parcelle",
          badgeColor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        };
      case "sale_hectare":
        return {
          icon: Layers,
          bg: "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 border-purple-500/20",
          badge: "Attribution Hectare",
          badgeColor: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
        };
      case "payment":
        return {
          icon: CreditCard,
          bg: "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/20",
          badge: "Paiement / Acompte",
          badgeColor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
        };
      default:
        return {
          icon: Activity,
          bg: "bg-muted text-muted-foreground",
          badge: "Activité",
          badgeColor: "bg-muted text-muted-foreground",
        };
    }
  };

  return (
    <Card className="p-4 sm:p-6 bg-card border-border shadow-sm">
      {/* En-tête de section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Activités & Événements Récents
            </h3>
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              En direct
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Suivi des ajouts de documents, ventes de parcelles, attributions d'hectares et transactions en temps réel
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="h-8 text-xs gap-1.5"
            title="Rafraîchir les activités"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Actualiser</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/documents")}
            className="h-8 text-xs gap-1 text-primary hover:text-primary/90"
          >
            <span>Tous les documents</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Barre de filtres et recherche */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-4 pb-3">
        {/* Onglets Filtres */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <Button
            size="sm"
            variant={selectedCategory === "all" ? "default" : "outline"}
            onClick={() => setSelectedCategory("all")}
            className="h-8 text-xs font-medium rounded-lg shrink-0"
          >
            Toutes ({counts.all})
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "documents" ? "default" : "outline"}
            onClick={() => setSelectedCategory("documents")}
            className="h-8 text-xs font-medium rounded-lg shrink-0 gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documents ({counts.documents})</span>
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "sales" ? "default" : "outline"}
            onClick={() => setSelectedCategory("sales")}
            className="h-8 text-xs font-medium rounded-lg shrink-0 gap-1"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Ventes & Terrains ({counts.sales})</span>
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "payments" ? "default" : "outline"}
            onClick={() => setSelectedCategory("payments")}
            className="h-8 text-xs font-medium rounded-lg shrink-0 gap-1"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Paiements ({counts.payments})</span>
          </Button>
        </div>

        {/* Champ de recherche */}
        <div className="relative min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Filtrer par acquéreur, document..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-muted/40 border-border rounded-lg"
          />
        </div>
      </div>

      {/* Liste des Activités */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs">Chargement du journal d'activités...</p>
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="py-10 text-center border rounded-xl border-dashed border-border bg-muted/20 my-2">
          <Activity className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">Aucune activité trouvée</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {searchQuery ? "Aucun événement ne correspond à votre recherche" : "Les activités s'afficheront ici en direct"}
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[420px] pr-3 -mr-3">
          <div className="space-y-2.5 my-1">
            {filteredActivities.map((act) => {
              const meta = getActivityIcon(act.type);
              const Icon = meta.icon;
              const hasFile = Boolean(act.filePath || act.fileUrl);

              return (
                <div
                  key={act.id}
                  className="p-3 sm:p-3.5 rounded-xl border border-border/70 bg-gradient-to-r from-card to-muted/20 hover:border-primary/40 hover:bg-muted/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Icône catégorie */}
                    <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${meta.bg}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Contenu textuel */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {act.title}
                        </span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${meta.badgeColor}`}>
                          {meta.badge}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {act.description}
                      </p>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground/80">
                        <Clock className="w-3 h-3 text-muted-foreground/60 shrink-0" />
                        <span>{formatActivityDate(act.timestamp)}</span>
                        {act.buyerName && (
                          <>
                            <span>•</span>
                            <span className="text-foreground/80 font-medium truncate flex items-center gap-1">
                              <User className="w-3 h-3 text-primary/70 shrink-0" />
                              {act.buyerName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions contextuelles */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center pl-12 sm:pl-0">
                    {hasFile && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownload(act)}
                          disabled={downloadingId === act.id}
                          className="h-8 px-2.5 text-xs gap-1 font-medium border-primary/30 hover:bg-primary/10 text-primary"
                          title="Télécharger la pièce justificative"
                        >
                          {downloadingId === act.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span className="hidden sm:inline">Télécharger</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePreview(act)}
                          className="h-8 w-8 p-0"
                          title="Aperçu du document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}

                    {act.link && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(act.link!)}
                        className="h-8 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                        title="Voir la fiche détaillée"
                      >
                        <span className="hidden md:inline">Voir</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6">
          <DialogHeader className="shrink-0 pb-3 border-b flex flex-row items-center justify-between pr-6">
            <DialogTitle className="truncate text-base sm:text-lg">
              {previewTitle}
            </DialogTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPreviewOpen(false)}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>
          {previewUrl && (
            <div className="flex-1 overflow-auto py-4 flex items-center justify-center min-h-[350px]">
              {previewTitle.toLowerCase().endsWith(".pdf") ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh] border rounded-lg"
                  title="Aperçu du document"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={previewTitle}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
