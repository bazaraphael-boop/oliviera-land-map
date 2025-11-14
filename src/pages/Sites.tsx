import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Edit, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
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

const Sites = () => {
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    surface_totale: "",
    quota_percentage: "",
  });

  useEffect(() => {
    checkAuth();
    fetchSites();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des sites");
    } finally {
      setLoading(false);
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
        const { error } = await supabase
          .from("sites")
          .update(siteData)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Site modifié avec succès");
      } else {
        const { error } = await supabase
          .from("sites")
          .insert([siteData]);

        if (error) throw error;
        toast.success("Site créé avec succès");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchSites();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'enregistrement du site");
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
      const { error } = await supabase
        .from("sites")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Site supprimé avec succès");
      fetchSites();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression du site");
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
              const percentageVendu = site.surface_totale > 0 
                ? (site.surface_vendue / site.surface_totale) * 100 
                : 0;
              const remainingSurface = site.surface_totale - site.surface_vendue;
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
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Surface vendue</span>
                        <span className={getQuotaColor(percentageVendu)}>
                          {site.surface_vendue.toFixed(2)} ha ({percentageVendu.toFixed(1)}%)
                        </span>
                      </div>
                      <Progress value={percentageVendu} className="h-2" />
                    </div>

                    {site.quota_percentage > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-muted-foreground">Quota utilisé</span>
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
    </div>
  );
};

export default Sites;
