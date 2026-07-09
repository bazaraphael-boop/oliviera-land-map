import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, MapPin, ChevronDown, ChevronUp, Users, Grid3X3 } from "lucide-react";
import { useNotify } from "@/hooks/useNotify";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

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
  surface_vendue: number;
}

const Sites = () => {
  const navigate = useNavigate();
  const { notify } = useNotify();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteStats, setSiteStats] = useState<Record<string, SiteStats>>({});
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHectaresDialog, setShowHectaresDialog] = useState(false);
  const [selectedSiteHectares, setSelectedSiteHectares] = useState<any[]>([]);
  const [selectedSiteName, setSelectedSiteName] = useState("");
  const [expandedHectare, setExpandedHectare] = useState<string | null>(null);
  const [hectareParcelles, setHectareParcelles] = useState<Record<string, any[]>>({});
  const [loadingParcelles, setLoadingParcelles] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    surface_totale: "",
    quota_percentage: "",
  });

  useEffect(() => {
    checkAuth();
    fetchSites();
    fetchSiteStats();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };

  const fetchSites = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("sites")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSites((data as any) || []);
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors du chargement des sites", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSiteStats = async () => {
    try {
      const { data: hectares, error } = await (supabase as any)
        .from("hectares")
        .select("site_id, surface, status");

      if (error) throw error;

      const stats: Record<string, SiteStats> = {};
      
      hectares?.forEach((hectare: any) => {
        if (!hectare.site_id) return;
        
        if (!stats[hectare.site_id]) {
          stats[hectare.site_id] = {
            hectares_count: 0,
            surface_vendue: 0,
          };
        }
        
        stats[hectare.site_id].hectares_count += 1;
        
        if (hectare.status === "sold" || hectare.status === "vendu") {
          stats[hectare.site_id].surface_vendue += parseFloat(hectare.surface || 0);
        }
      });

      setSiteStats(stats);
    } catch (error) {
      console.error("Erreur:", error);
    }
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
      fetchSites();
      fetchSiteStats();
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
      fetchSites();
      fetchSiteStats();
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
    if (percentage >= 80) return "text-red-600";
    if (percentage >= 50) return "text-orange-600";
    return "text-green-600";
  };

  const showSiteHectares = async (siteId: string, siteName: string) => {
    try {
      const { data: hectares, error } = await (supabase as any)
        .from("hectares")
        .select("*")
        .eq("site_id", siteId)
        .order("name", { ascending: true });

      if (error) throw error;

      // Pre-load parcelle counts for all hectares
      const hectareIds = (hectares || []).map((h: any) => h.id);
      const parcelleCounts: Record<string, number> = {};
      
      if (hectareIds.length > 0) {
        const { data: parcelles, error: pError } = await (supabase as any)
          .from("parcelles")
          .select("hectare_id")
          .in("hectare_id", hectareIds);

        if (!pError && parcelles) {
          parcelles.forEach((p: any) => {
            parcelleCounts[p.hectare_id] = (parcelleCounts[p.hectare_id] || 0) + 1;
          });
        }
      }

      // Attach parcelle count to each hectare
      const enrichedHectares = (hectares || []).map((h: any) => ({
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
      const { data: parcelles, error } = await (supabase as any)
        .from("parcelles")
        .select("*")
        .eq("hectare_id", hectareId)
        .order("numero", { ascending: true });

      if (error) throw error;

      setHectareParcelles(prev => ({ ...prev, [hectareId]: parcelles || [] }));
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors du chargement des parcelles", "error");
    } finally {
      setLoadingParcelles(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <DashboardSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Gestion des Sites</h1>
              <p className="text-muted-foreground">Gérez vos différents sites et leurs quotas de vente</p>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Nouveau Site
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{isEditMode ? "Modifier le Site" : "Nouveau Site"}</DialogTitle>
                  <DialogDescription>
                    Remplissez les informations du site
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
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="quota_percentage">Quota de Vente (%)</Label>
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
                      Pourcentage maximum du site pouvant être vendu
                    </p>
                  </div>
                  
                  <div className="flex justify-end gap-2">
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
                      {isEditMode ? "Modifier" : "Créer"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Sites Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sites.map((site) => {
              const stats = siteStats[site.id] || { hectares_count: 0, surface_vendue: 0 };
              const percentageVendu = site.surface_totale > 0 
                ? (stats.surface_vendue / site.surface_totale) * 100 
                : 0;
              const remainingSurface = site.surface_totale - stats.surface_vendue;
              const quotaUsed = site.quota_percentage > 0 
                ? (percentageVendu / site.quota_percentage) * 100 
                : 0;

              return (
                <Card key={site.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{site.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {site.surface_totale} ha
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(site)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(site.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div 
                      className="cursor-pointer hover:bg-muted/50 p-2 rounded-lg transition-colors"
                      onClick={() => showSiteHectares(site.id, site.name)}
                    >
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Hectares occupés</span>
                        <span className="text-foreground font-medium">
                          {stats.hectares_count} / {Math.floor(site.surface_totale)}
                        </span>
                      </div>
                      <Progress 
                        value={(stats.hectares_count / Math.floor(site.surface_totale)) * 100} 
                        className="h-2" 
                      />
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        Cliquez pour voir les détails
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Surface vendue</span>
                        <span className={getQuotaColor(percentageVendu)}>
                          {stats.surface_vendue.toFixed(2)} ha ({percentageVendu.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress value={percentageVendu} className="h-2" />
                    </div>

                    {site.quota_percentage > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Quota vendu</span>
                          <span className={getQuotaColor(quotaUsed)}>
                            {quotaUsed.toFixed(1)}% / {site.quota_percentage}%
                          </span>
                        </div>
                        <Progress value={Math.min(quotaUsed, 100)} className="h-2" />
                      </div>
                    )}

                    <div className="pt-4 border-t border-border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Surface disponible</span>
                        <span className="font-medium text-foreground">
                          {remainingSurface.toFixed(2)} ha
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {sites.length === 0 && (
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucun site trouvé</p>
            </div>
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
              {selectedSiteHectares.length} hectare{selectedSiteHectares.length > 1 ? 's' : ''} dans ce site — Cliquez sur un hectare pour voir ses parcelles
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-3">
              {selectedSiteHectares.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucun hectare dans ce site
                </div>
              ) : (
                selectedSiteHectares.map((hectare) => {
                  const parcelles = hectareParcelles[hectare.id] || [];
                  const isExpanded = expandedHectare === hectare.id;
                  const isSold = hectare.status === "sold" || hectare.status === "vendu";
                  const isWholeHectareSold = isSold && hectare.parcelle_count === 0 && hectare.buyer_name;
                  const totalSlots = 16;
                  const parcelleCount = hectare.parcelle_count || 0;
                  const occupiedParcelles = parcelles.filter((p: any) => p.status === "vendue" || p.status === "occupée" || p.buyer_name);

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
                                  {isWholeHectareSold ? "16/16 occupées" : `${parcelleCount}/${totalSlots} parcelles`}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {/* Compact quota indicator */}
                            <div className="w-10 h-10 rounded-full border-2 border-border flex items-center justify-center">
                              <span className={`text-xs font-bold ${
                                isWholeHectareSold || parcelleCount >= 13
                                  ? "text-destructive"
                                  : parcelleCount >= 8
                                  ? "text-orange-500"
                                  : "text-primary"
                              }`}>
                                {isWholeHectareSold ? "16" : parcelleCount}
                              </span>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* Buyer info summary for sold hectares */}
                        {isSold && hectare.buyer_name && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="w-3 h-3" />
                            <span>{hectare.buyer_name}</span>
                            {hectare.buyer_phone && <span>• {hectare.buyer_phone}</span>}
                          </div>
                        )}
                      </div>

                      {/* Expanded section */}
                      {isExpanded && (
                        <div className="border-t border-border bg-muted/20">
                          {loadingParcelles === hectare.id ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">
                              Chargement des parcelles...
                            </div>
                          ) : isWholeHectareSold ? (
                            /* Hectare vendu en entier - pas de parcelles subdivisées */
                            <div className="p-4 space-y-3">
                              <div className="p-3 rounded-lg bg-card border border-border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-foreground">Quota d'occupation</span>
                                  <span className="text-sm font-semibold text-destructive">
                                    16 / 16 — Complet
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
                              {/* Quota bar */}
                              <div className="p-3 rounded-lg bg-card border border-border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm font-medium text-foreground">Quota d'occupation</span>
                                  <span className="text-sm font-semibold text-foreground">
                                    {parcelles.length} / {totalSlots} parcelles
                                  </span>
                                </div>
                                <Progress value={(parcelles.length / totalSlots) * 100} className="h-2.5" />
                                <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                                  <span>{occupiedParcelles.length} occupée{occupiedParcelles.length > 1 ? 's' : ''}</span>
                                  <span>{totalSlots - parcelles.length} disponible{totalSlots - parcelles.length > 1 ? 's' : ''}</span>
                                </div>
                              </div>

                              {/* Parcelles list */}
                              <div className="grid gap-2">
                                {parcelles.map((parcelle: any) => {
                                  const isOccupied = parcelle.status === "vendue" || parcelle.status === "occupée" || parcelle.buyer_name;
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
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium text-sm text-foreground">
                                              Parcelle {parcelle.numero}
                                            </span>
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
                                          <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground shrink-0">
                                            RMB: {parcelle.rmb_number}
                                          </span>
                                        )}
                                      </div>

                                      {/* Buyer info for occupied parcels */}
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
    </div>
  );
};

export default Sites;
