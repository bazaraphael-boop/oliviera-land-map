import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hectareCapacity } from "@/lib/hectareCapacity";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Edit,
  Trash2,
  MapPin,
  ChevronDown,
  ChevronUp,
  Users,
  Grid3X3,
  AlertTriangle,
  Link2,
  CheckCircle2,
  Layers,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useNotify } from "@/hooks/useNotify";
import DashboardSidebar from "@/components/DashboardSidebar";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

interface Site {
  id: string;
  name: string;
  surface_totale: number;
  quota_percentage: number;
  surface_vendue: number;
  created_at: string;
}

interface SiteStats {
  hectares_count: number;
  sold_hectares_count: number;
  direct_sold_ha: number;
  parcelles_count: number;
  sold_parcelles_count: number;
  parcelles_ha: number;
  surface_vendue: number; // total ha epuises (direct_sold_ha + parcelles_ha)
  surface_disponible: number;
  rate_epuisement: number;
}

const Sites = () => {
  const navigate = useNavigate();
  const { notify } = useNotify();

  const [sites, setSites] = useState<Site[]>([]);
  const [hectares, setHectares] = useState<any[]>([]);
  const [parcelles, setParcelles] = useState<any[]>([]);
  const [siteStats, setSiteStats] = useState<Record<string, SiteStats>>({});
  const [loading, setLoading] = useState(true);

  // Dialogue création / édition de site
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    surface_totale: "",
    quota_percentage: "",
  });

  // Dialogue détail des hectares d'un site
  const [showHectaresDialog, setShowHectaresDialog] = useState(false);
  const [selectedSiteHectares, setSelectedSiteHectares] = useState<any[]>([]);
  const [selectedSiteName, setSelectedSiteName] = useState("");
  const [expandedHectare, setExpandedHectare] = useState<string | null>(null);
  const [hectareParcelles, setHectareParcelles] = useState<Record<string, any[]>>({});
  const [loadingParcelles, setLoadingParcelles] = useState<string | null>(null);

  // Dialogue de rattachement des hectares non affectés
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignTargetSiteId, setAssignTargetSiteId] = useState<string>("");
  const [assigningHectareId, setAssigningHectareId] = useState<string | "all" | null>(null);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchAllData();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);

      const [sitesRes, hectaresRes, parcellesRes] = await Promise.all([
        (supabase as any).from("sites").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("hectares").select("*").order("name", { ascending: true }),
        (supabase as any).from("parcelles").select("*").order("numero", { ascending: true }),
      ]);

      if (sitesRes.error) throw sitesRes.error;
      if (hectaresRes.error) throw hectaresRes.error;
      if (parcellesRes.error) throw parcellesRes.error;

      const loadedSites: Site[] = sitesRes.data || [];
      const loadedHectares: any[] = hectaresRes.data || [];
      const loadedParcelles: any[] = parcellesRes.data || [];

      setSites(loadedSites);
      setHectares(loadedHectares);
      setParcelles(loadedParcelles);

      computeStats(loadedSites, loadedHectares, loadedParcelles);
    } catch (error) {
      console.error("Erreur chargement données cadastrales:", error);
      notify("Erreur", "Erreur lors du chargement des données cadastrales", "error");
    } finally {
      setLoading(false);
    }
  };

  const PARCELLES_PER_HA = 15;

  const computeStats = (loadedSites: Site[], loadedHectares: any[], loadedParcelles: any[]) => {
    const soldHectaresGlobal = loadedHectares.filter(h => h.status === "sold" || h.status === "vendu");
    const soldHectareIdsGlobal = new Set(soldHectaresGlobal.map(h => h.id));

    const stats: Record<string, SiteStats> = {};

    loadedSites.forEach(s => {
      stats[s.id] = {
        hectares_count: 0,
        sold_hectares_count: 0,
        direct_sold_ha: 0,
        parcelles_count: 0,
        sold_parcelles_count: 0,
        parcelles_ha: 0,
        surface_vendue: 0,
        surface_disponible: Number(s.surface_totale || 0),
        rate_epuisement: 0,
      };
    });

    // 1. Attribuer les hectares rattachés à leur site
    loadedHectares.forEach(h => {
      if (!h.site_id || !stats[h.site_id]) return;

      stats[h.site_id].hectares_count += 1;

      if (h.status === "sold" || h.status === "vendu") {
        stats[h.site_id].sold_hectares_count += 1;
        const raw = Number(h.surface || 1);
        const inHa = raw >= 100 ? raw / 10000 : raw;
        stats[h.site_id].direct_sold_ha += inHa;
      }
    });

    // 2. Attribuer les parcelles aux sites (via hectare_id -> site_id)
    const hectareToSiteMap = new Map(loadedHectares.map(h => [h.id, h.site_id]));

    loadedParcelles.forEach(p => {
      const parentSiteId = p.site_id || (p.hectare_id ? hectareToSiteMap.get(p.hectare_id) : null);
      if (!parentSiteId || !stats[parentSiteId]) return;

      const pCount = Math.max(1, Math.ceil(Number(p.surface || 600) / 600));
      stats[parentSiteId].parcelles_count += pCount;

      // Seulement si vendue et pas dans un hectare déjà vendu en entier (évite le double décompte)
      if (p.status === "vendu" || p.status === "vendue") {
        if (!p.hectare_id || !soldHectareIdsGlobal.has(p.hectare_id)) {
          stats[parentSiteId].sold_parcelles_count += pCount;
        }
      }
    });

    // 3. Calculer les totaux consolidés (règle 1 ha = 15 parcelles)
    loadedSites.forEach(s => {
      const st = stats[s.id];
      st.parcelles_ha = st.sold_parcelles_count / PARCELLES_PER_HA;
      st.surface_vendue = Math.round((st.direct_sold_ha + st.parcelles_ha) * 1000) / 1000;
      st.surface_disponible = Math.max(0, Math.round((Number(s.surface_totale || 0) - st.surface_vendue) * 1000) / 1000);
      st.rate_epuisement = s.surface_totale > 0 ? (st.surface_vendue / Number(s.surface_totale)) * 100 : 0;
    });

    setSiteStats(stats);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const siteData = {
        name: formData.name,
        surface_totale: parseFloat(formData.surface_totale),
        quota_percentage: parseFloat(formData.quota_percentage) || 0,
      };

      if (isEditMode && editingId) {
        const { error } = await (supabase as any)
          .from("sites")
          .update(siteData as any)
          .eq("id", editingId);

        if (error) throw error;
        notify("Succès", "Site modifié avec succès", "success");
      } else {
        const { error } = await (supabase as any)
          .from("sites")
          .insert([siteData as any]);

        if (error) throw error;
        notify("Succès", "Site créé avec succès", "success");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchAllData();
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors de l'enregistrement du site", "error");
    }
  };

  const handleEdit = (site: Site) => {
    setFormData({
      name: site.name,
      surface_totale: site.surface_totale.toString(),
      quota_percentage: site.quota_percentage.toString(),
    });
    setEditingId(site.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce site ?")) return;

    try {
      const { error } = await (supabase as any)
        .from("sites")
        .delete()
        .eq("id", id);

      if (error) throw error;
      notify("Succès", "Site supprimé avec succès", "success");
      fetchAllData();
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors de la suppression du site", "error");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      surface_totale: "",
      quota_percentage: "",
    });
    setIsEditMode(false);
    setEditingId(null);
  };

  const getQuotaColor = (percentage: number) => {
    if (percentage >= 80) return "text-red-600 dark:text-red-400";
    if (percentage >= 50) return "text-orange-600 dark:text-orange-400";
    return "text-emerald-600 dark:text-emerald-400";
  };

  const showSiteHectares = async (siteId: string, siteName: string) => {
    try {
      const { data: siteHectaresList, error } = await (supabase as any)
        .from("hectares")
        .select("*")
        .eq("site_id", siteId)
        .order("name", { ascending: true });

      if (error) throw error;

      const hectareIds = (siteHectaresList || []).map((h: any) => h.id);
      const parcelleCounts: Record<string, number> = {};

      if (hectareIds.length > 0) {
        const { data: pList, error: pError } = await (supabase as any)
          .from("parcelles")
          .select("hectare_id, surface, status")
          .in("hectare_id", hectareIds);

        if (!pError && pList) {
          pList.forEach((p: any) => {
            const count = Math.max(1, Math.ceil(Number(p.surface || 600) / 600));
            parcelleCounts[p.hectare_id] = (parcelleCounts[p.hectare_id] || 0) + count;
          });
        }
      }

      const enrichedHectares = (siteHectaresList || []).map((h: any) => ({
        ...h,
        parcelle_count: parcelleCounts[h.id] || 0,
      }));

      setSelectedSiteHectares(enrichedHectares);
      setSelectedSiteName(siteName);
      setExpandedHectare(null);
      setHectareParcelles({});
      setShowHectaresDialog(true);
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors du chargement des hectares", "error");
    }
  };

  const toggleHectareParcelles = async (hectareId: string) => {
    if (expandedHectare === hectareId) {
      setExpandedHectare(null);
      return;
    }

    setExpandedHectare(hectareId);

    if (hectareParcelles[hectareId]) return;

    setLoadingParcelles(hectareId);
    try {
      const { data: pData, error } = await (supabase as any)
        .from("parcelles")
        .select("*")
        .eq("hectare_id", hectareId)
        .order("numero", { ascending: true });

      if (error) throw error;

      setHectareParcelles(prev => ({ ...prev, [hectareId]: pData || [] }));
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors du chargement des parcelles", "error");
    } finally {
      setLoadingParcelles(null);
    }
  };

  // Rattachement d'hectares non affectés à un site choisi
  const handleAssignHectareToSite = async (targetHectareId: string | "all", targetSiteId: string) => {
    if (!targetSiteId) {
      toast.error("Veuillez choisir un site de destination");
      return;
    }

    try {
      setIsSubmittingAssign(true);

      if (targetHectareId === "all") {
        const unassignedIds = unassignedHectares.map((h) => h.id);
        if (unassignedIds.length === 0) return;

        const { error } = await (supabase as any)
          .from("hectares")
          .update({ site_id: targetSiteId })
          .in("id", unassignedIds);

        if (error) throw error;
        toast.success(`${unassignedIds.length} hectare(s) rattaché(s) au site avec succès !`);
      } else {
        const { error } = await (supabase as any)
          .from("hectares")
          .update({ site_id: targetSiteId })
          .eq("id", targetHectareId);

        if (error) throw error;
        toast.success("Hectare rattaché au site avec succès !");
      }

      setAssignDialogOpen(false);
      setAssigningHectareId(null);
      setAssignTargetSiteId("");
      fetchAllData();
    } catch (error) {
      console.error("Erreur rattachement:", error);
      toast.error("Erreur lors du rattachement de l'hectare au site");
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <DashboardSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground flex items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
            <span>Chargement des données cadastrales...</span>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // CALCULS GLOBAUX STRICTEMENT HARMONISÉS AVEC LE TABLEAU DE BORD (1 ha = 15 p.)
  // =========================================================================
  const soldParcelles = parcelles.filter(p => p.status === "vendu" || p.status === "vendue");
  const soldHectares = hectares.filter(h => h.status === "sold" || h.status === "vendu");
  const soldHectareIds = new Set(soldHectares.map(h => h.id));

  // 1. Hectares vendus directs
  let directSoldHectares = 0;
  soldHectares.forEach(h => {
    const raw = Number(h.surface || 1);
    const inHa = raw >= 100 ? raw / 10000 : raw;
    directSoldHectares += inHa;
  });
  const directSoldHectaresCount = soldHectares.length;
  const directSoldParcellesEquiv = directSoldHectares * PARCELLES_PER_HA;

  // 2. Parcelles vendues hors hectares déjà vendus en bloc
  const independentSoldParcelles = soldParcelles.filter(p => !p.hectare_id || !soldHectareIds.has(p.hectare_id));
  const soldParcellesCount = independentSoldParcelles.reduce((sum, p) =>
    sum + Math.max(1, Math.ceil(Number(p.surface || 600) / 600)), 0
  );
  const parcellesSoldInHectares = soldParcellesCount / PARCELLES_PER_HA;

  // 3. Quota compilé total réel épuisé (identique Tableau de Bord)
  const totalHectaresEpuises = Math.round((directSoldHectares + parcellesSoldInHectares) * 1000) / 1000;
  const totalQuotasEpuisesParcelles = Math.round(directSoldParcellesEquiv + soldParcellesCount);
  const totalSurface = sites.reduce((s, x) => s + (Number(x.surface_totale) || 0), 0);
  const globalRemainingHa = Math.max(0, Math.round((totalSurface - totalHectaresEpuises) * 1000) / 1000);
  const globalRateEpuisement = totalSurface > 0 ? (totalHectaresEpuises / totalSurface) * 100 : 0;

  // 4. Détection des hectares sans site
  const siteIdSet = new Set(sites.map(s => s.id));
  const unassignedHectares = hectares.filter(h => !h.site_id || !siteIdSet.has(h.site_id));
  const unassignedSoldHectares = unassignedHectares.filter(h => h.status === "sold" || h.status === "vendu");
  const unassignedDirectSoldHa = unassignedSoldHectares.reduce((sum, h) => {
    const raw = Number(h.surface || 1);
    return sum + (raw >= 100 ? raw / 10000 : raw);
  }, 0);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
          {/* Header */}
          <PageHeader
            title="Gestion des Sites"
            description="Point de départ : créez vos zones foncières, découpez-les en hectares et suivez le quota réel d'épuisement."
            actions={
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  className="gap-2 w-full sm:w-auto shadow-elegant"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  Nouveau Site
                </Button>
              </div>
            }
          />

          {/* Dialog création / modification site */}
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{isEditMode ? "Modifier le Site" : "Nouveau Site"}</DialogTitle>
                <DialogDescription>
                  Renseignez les paramètres et la superficie du site
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nom du Site *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="mt-1"
                    placeholder="ex: Muanda village site 1, Littoral..."
                  />
                </div>
                
                <div>
                  <Label htmlFor="surface_totale">Surface Totale (ha) *</Label>
                  <Input
                    id="surface_totale"
                    type="number"
                    step="0.01"
                    value={formData.surface_totale}
                    onChange={(e) => setFormData({ ...formData, surface_totale: e.target.value })}
                    required
                    className="mt-1"
                    placeholder="ex: 1600"
                  />
                </div>
                
                <div>
                  <Label htmlFor="quota_percentage">Quota d'alerte de Vente (%)</Label>
                  <Input
                    id="quota_percentage"
                    type="number"
                    step="0.01"
                    max="100"
                    value={formData.quota_percentage}
                    onChange={(e) => setFormData({ ...formData, quota_percentage: e.target.value })}
                    placeholder="0"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Pourcentage indicatif de réserve ou de limite commerciale
                  </p>
                </div>
                
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit">
                    {isEditMode ? "Modifier" : "Créer le Site"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Résumé global harmonisé à 100% avec le Tableau de Bord */}
          {sites.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Card className="p-3 sm:p-4 border-border/60">
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground truncate">Sites</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground mt-1 tabular-nums truncate">{sites.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">enregistrés</p>
              </Card>

              <Card className="p-3 sm:p-4 border-border/60">
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground truncate">Surface totale</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground mt-1 tabular-nums truncate">{totalSurface.toFixed(2)} ha</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">portefeuille concession</p>
              </Card>

              <Card className="p-3 sm:p-4 border-border/60">
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground truncate">Surface épuisée</p>
                <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums truncate">
                  {totalHectaresEpuises.toFixed(2)} ha
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {globalRateEpuisement.toFixed(1)}% ({totalQuotasEpuisesParcelles} p. cumulées)
                </p>
              </Card>

              <Card className="p-3 sm:p-4 border-border/60">
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground truncate">Hectares suivis</p>
                <p className="text-lg sm:text-2xl font-bold text-foreground mt-1 tabular-nums truncate">{hectares.length}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                  {directSoldHectaresCount} vendus directs · {globalRemainingHa.toFixed(2)} ha disp.
                </p>
              </Card>
            </div>
          )}

          {/* Bannière informative si des hectares ne sont pas encore affectés à un site */}
          {unassignedHectares.length > 0 && (
            <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {unassignedHectares.length} hectare(s) non affecté(s) à un site spécifique ({unassignedDirectSoldHa.toFixed(2)} ha vendus)
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ces terrains sont bien comptabilisés dans le total général de la concession ({totalHectaresEpuises.toFixed(2)} ha), mais n'ont pas encore été reliés à l'un de vos {sites.length} sites.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAssigningHectareId("all");
                  setAssignDialogOpen(true);
                }}
                className="shrink-0 border-amber-500/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 text-xs gap-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                Rattacher à un site
              </Button>
            </div>
          )}

          {/* Grille des Sites */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {sites.map((site) => {
              const stats = siteStats[site.id] || {
                hectares_count: 0,
                sold_hectares_count: 0,
                direct_sold_ha: 0,
                parcelles_count: 0,
                sold_parcelles_count: 0,
                parcelles_ha: 0,
                surface_vendue: 0,
                surface_disponible: site.surface_totale,
                rate_epuisement: 0,
              };

              const quotaUsed = site.quota_percentage > 0 
                ? (stats.rate_epuisement / site.quota_percentage) * 100 
                : 0;

              return (
                <Card key={site.id} className="overflow-hidden border-border/60 hover:shadow-elegant transition-shadow flex flex-col">
                  {/* En-tête */}
                  <div className="flex items-start justify-between gap-2 p-4 sm:p-5 bg-muted/40 border-b border-border/60">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-gradient-hero flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-foreground truncate">{site.name}</h3>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {site.surface_totale} ha · {stats.hectares_count} hectare{stats.hectares_count > 1 ? "s" : ""} rattaché{stats.hectares_count > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(site)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(site.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Indicateurs avec règle cadastrale consolidée 1 ha = 15 parcelles */}
                  <div className="p-4 sm:p-5 space-y-4 flex-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border/60 p-3 bg-muted/20">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Épuisée / Vendue</p>
                        <p className={`text-base font-bold tabular-nums ${getQuotaColor(stats.rate_epuisement)}`}>
                          {stats.surface_vendue.toFixed(2)} ha
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {stats.direct_sold_ha.toFixed(2)} ha dir. + {stats.sold_parcelles_count} p.
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/60 p-3 bg-muted/20">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Disponible</p>
                        <p className="text-base font-bold text-foreground tabular-nums">
                          {stats.surface_disponible.toFixed(2)} ha
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          sur {site.surface_totale} ha
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Taux d'épuisement foncier</span>
                        <span className={`font-semibold tabular-nums ${getQuotaColor(stats.rate_epuisement)}`}>
                          {stats.rate_epuisement.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={stats.rate_epuisement} className="h-1.5" />
                    </div>

                    {site.quota_percentage > 0 && (
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">Quota autorisé consommé</span>
                          <span className={`font-medium tabular-nums ${getQuotaColor(quotaUsed)}`}>
                            {quotaUsed.toFixed(1)}% / {site.quota_percentage}%
                          </span>
                        </div>
                        <Progress value={Math.min(quotaUsed, 100)} className="h-1.5" />
                      </div>
                    )}

                    <div>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Hectares découpés / suivis</span>
                        <span className="text-foreground font-medium tabular-nums">
                          {stats.hectares_count} / {Math.floor(site.surface_totale)} ha
                        </span>
                      </div>
                      <Progress
                        value={(stats.hectares_count / Math.max(Math.floor(site.surface_totale), 1)) * 100}
                        className="h-1.5"
                      />
                    </div>
                  </div>

                  {/* Pied de carte */}
                  <button
                    onClick={() => showSiteHectares(site.id, site.name)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-primary border-t border-border/60 hover:bg-muted/60 transition-colors"
                  >
                    <Grid3X3 className="w-4 h-4" />
                    Voir les hectares & parcelles ({stats.hectares_count})
                  </button>
                </Card>
              );
            })}
          </div>

          {sites.length === 0 && (
            <Card className="text-center py-14 border-dashed">
              <MapPin className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium text-foreground">Aucun site enregistré</p>
              <p className="text-sm text-muted-foreground mt-1">Créez votre premier site pour commencer le suivi.</p>
            </Card>
          )}

        </div>
      </div>

      {/* Dialog pour afficher les hectares du site */}
      <Dialog open={showHectaresDialog} onOpenChange={setShowHectaresDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Hectares du site: {selectedSiteName}
            </DialogTitle>
            <DialogDescription>
              {selectedSiteHectares.length} hectare{selectedSiteHectares.length > 1 ? 's' : ''} rattaché{selectedSiteHectares.length > 1 ? 's' : ''} à ce site — Règle cadastrale : 1 hectare = 15 parcelles
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-3">
              {selectedSiteHectares.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun hectare rattaché à ce site pour le moment.
                </div>
              ) : (
                selectedSiteHectares.map((hectare) => {
                  const parcelles = hectareParcelles[hectare.id] || [];
                  const isExpanded = expandedHectare === hectare.id;
                  const isSold = hectare.status === "sold" || hectare.status === "vendu";
                  const isWholeHectareSold = isSold && hectare.parcelle_count === 0 && hectare.buyer_name;
                  const totalSlots = hectareCapacity(hectare); // 15 parcelles par hectare, 8 pour un demi-hectare
                  const parcelleCount = hectare.parcelle_count || 0;

                  return (
                    <Card key={hectare.id} className="overflow-hidden">
                      {/* Hectare header - clickable */}
                      <div
                        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleHectareParcelles(hectare.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Grid3X3 className="w-4 h-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-foreground truncate">
                                  {hectare.name}
                                </h4>
                                <Badge
                                  variant={isSold ? "destructive" : "default"}
                                  className="text-xs"
                                >
                                  {isSold ? "Vendu" : "Disponible"}
                                </Badge>
                                {isWholeHectareSold && (
                                  <Badge variant="outline" className="text-xs">
                                    Hectare entier
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{hectare.surface} ha</span>
                                <span>•</span>
                                <span>{hectare.prix ? `${Number(hectare.prix).toLocaleString()} USD` : "Prix N/A"}</span>
                                <span>•</span>
                                <span className="font-medium">
                                  {isWholeHectareSold ? `${totalSlots}/${totalSlots} occupées` : `${parcelleCount}/${totalSlots} parcelles`}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center">
                              <span className={`text-xs font-bold ${
                                isWholeHectareSold || parcelleCount >= totalSlots - 2
                                  ? "text-destructive"
                                  : parcelleCount >= Math.ceil(totalSlots / 2)
                                  ? "text-orange-500"
                                  : "text-primary"
                              }`}>
                                {isWholeHectareSold ? totalSlots : parcelleCount}
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Info acheteur si hectare vendu */}
                        {isSold && hectare.buyer_name && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />
                            <span>{hectare.buyer_name}</span>
                            {hectare.buyer_phone && <span>• {hectare.buyer_phone}</span>}
                          </div>
                        )}
                      </div>

                      {/* Section dépliée */}
                      {isExpanded && (
                        <div className="border-t border-border bg-muted/20">
                          {loadingParcelles === hectare.id ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">
                              Chargement des parcelles...
                            </div>
                          ) : isWholeHectareSold ? (
                            <div className="p-4 space-y-3">
                              <div className="p-3 rounded-lg bg-card border border-border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-foreground">Quota d'occupation</span>
                                  <span className="text-sm font-semibold text-destructive">
                                    {totalSlots} / {totalSlots} — Complet
                                  </span>
                                </div>
                                <Progress value={100} className="h-2.5" />
                              </div>

                              <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5">
                                <p className="text-sm font-medium text-foreground mb-3">
                                  Hectare entier vendu à :
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-muted-foreground" />
                                    <span className="font-medium text-foreground">{hectare.buyer_name}</span>
                                  </div>
                                  {hectare.buyer_phone && (
                                    <div className="text-muted-foreground">📞 {hectare.buyer_phone}</div>
                                  )}
                                  {hectare.buyer_email && (
                                    <div className="text-muted-foreground">✉️ {hectare.buyer_email}</div>
                                  )}
                                  {hectare.sale_date && (
                                    <div className="text-muted-foreground">
                                      📅 {new Date(hectare.sale_date).toLocaleDateString('fr-FR')}
                                    </div>
                                  )}
                                  {hectare.rmb_number && (
                                    <div className="text-muted-foreground">📋 RMB: {hectare.rmb_number}</div>
                                  )}
                                  {hectare.buyer_profession && (
                                    <div className="text-muted-foreground">💼 {hectare.buyer_profession}</div>
                                  )}
                                  {hectare.buyer_address && (
                                    <div className="text-muted-foreground sm:col-span-2">📍 {hectare.buyer_address}</div>
                                  )}
                                </div>
                                {hectare.amount_paid != null && Number(hectare.amount_paid) > 0 && (
                                  <div className="mt-3 pt-3 border-t border-border/50 flex gap-4">
                                    <span className="text-primary font-medium text-sm">
                                      Payé: {Number(hectare.amount_paid).toLocaleString()} USD
                                    </span>
                                    {hectare.remaining_amount != null && Number(hectare.remaining_amount) > 0 && (
                                      <span className="text-destructive font-medium text-sm">
                                        Reste: {Number(hectare.remaining_amount).toLocaleString()} USD
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : parcelles.length === 0 ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">
                              Aucune parcelle enregistrée dans cet hectare
                            </div>
                          ) : (
                            <div className="p-4 space-y-3">
                              {(() => {
                                const occupiedEffectif = parcelles.reduce((total: number, p: any) =>
                                  total + Math.max(1, Math.ceil(Number(p.surface || 600) / 600)), 0
                                );
                                return (
                                  <div className="p-3 rounded-lg bg-card border border-border">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium text-foreground">Quota d'occupation</span>
                                      <span className="text-sm font-semibold text-foreground">
                                        {occupiedEffectif} / {totalSlots} parcelles
                                      </span>
                                    </div>
                                    <Progress value={(occupiedEffectif / totalSlots) * 100} className="h-2.5" />
                                    <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                                      <span>{occupiedEffectif} occupée{occupiedEffectif > 1 ? 's' : ''}</span>
                                      <span>{Math.max(0, totalSlots - occupiedEffectif)} disponible{totalSlots - occupiedEffectif > 1 ? 's' : ''}</span>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Liste des parcelles */}
                              <div className="grid gap-2">
                                {parcelles.map((parcelle: any) => {
                                  const isOccupied = parcelle.status === "vendue" || parcelle.status === "occupée" || parcelle.status === "vendu" || parcelle.buyer_name;
                                  const pCount = Math.max(1, Math.ceil(Number(parcelle.surface || 600) / 600));
                                  return (
                                    <div
                                      key={parcelle.id}
                                      className={`p-3 rounded-lg border transition-colors ${
                                        isOccupied
                                          ? "border-destructive/30 bg-destructive/5"
                                          : "border-border bg-card"
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-medium text-sm text-foreground">
                                              Parcelle {parcelle.numero}
                                            </span>
                                            {pCount > 1 && (
                                              <Badge className="text-[10px] bg-emerald-600 text-white font-semibold px-1.5 py-0">
                                                {pCount} parcelles ({parcelle.surface} m²)
                                              </Badge>
                                            )}
                                            <Badge
                                              variant={isOccupied ? "destructive" : "secondary"}
                                              className="text-[10px] px-1.5 py-0"
                                            >
                                              {isOccupied ? "Occupée" : "Disponible"}
                                            </Badge>
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            {parcelle.surface} m² • {Number(parcelle.prix).toLocaleString()} USD
                                          </p>
                                        </div>

                                        {parcelle.rmb_number && (
                                          <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground shrink-0 font-mono">
                                            RMB: {parcelle.rmb_number}
                                          </span>
                                        )}
                                      </div>

                                      {isOccupied && parcelle.buyer_name && (
                                        <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                                          <div className="flex items-center gap-1.5">
                                            <Users className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-foreground font-medium">{parcelle.buyer_name}</span>
                                          </div>
                                          {parcelle.buyer_phone && (
                                            <div className="text-muted-foreground">📞 {parcelle.buyer_phone}</div>
                                          )}
                                          {parcelle.buyer_email && (
                                            <div className="text-muted-foreground">✉️ {parcelle.buyer_email}</div>
                                          )}
                                          {parcelle.sale_date && (
                                            <div className="text-muted-foreground">
                                              📅 {new Date(parcelle.sale_date).toLocaleDateString('fr-FR')}
                                            </div>
                                          )}
                                          {parcelle.amount_paid != null && Number(parcelle.amount_paid) > 0 && (
                                            <div className="sm:col-span-2 mt-1 flex gap-3">
                                              <span className="text-primary font-medium">
                                                Payé: {Number(parcelle.amount_paid).toLocaleString()} USD
                                              </span>
                                              {parcelle.remaining_amount != null && Number(parcelle.remaining_amount) > 0 && (
                                                <span className="text-destructive font-medium">
                                                  Reste: {Number(parcelle.remaining_amount).toLocaleString()} USD
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog pour rattacher un ou tous les hectares non affectés à un site */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Link2 className="w-5 h-5 text-primary" />
              Rattachement à un site
            </DialogTitle>
            <DialogDescription>
              {assigningHectareId === "all"
                ? `Rattacher les ${unassignedHectares.length} hectare(s) non affectés à un site existant.`
                : "Sélectionnez le site auquel rattacher cet hectare."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block">
                Site de destination *
              </Label>
              <Select value={assignTargetSiteId} onValueChange={setAssignTargetSiteId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir un site (ex: Muanda village site 1...)" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.surface_totale} ha)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assigningHectareId === "all" ? (
              <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">
                  Hectares concernés ({unassignedHectares.length}) :
                </p>
                <div className="max-h-32 overflow-y-auto pr-1 space-y-0.5">
                  {unassignedHectares.map((h) => (
                    <div key={h.id} className="flex justify-between">
                      <span className="font-mono">{h.name} {h.rmb_number ? `(${h.rmb_number})` : ""}</span>
                      <span>{h.surface} ha · {h.status === "vendu" || h.status === "sold" ? "Vendu" : "Disponible"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setAssignDialogOpen(false)}
                disabled={isSubmittingAssign}
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={!assignTargetSiteId || isSubmittingAssign}
                onClick={() => handleAssignHectareToSite(assigningHectareId || "all", assignTargetSiteId)}
                className="gap-2"
              >
                {isSubmittingAssign ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Rattachement en cours...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Valider le rattachement
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Sites;
