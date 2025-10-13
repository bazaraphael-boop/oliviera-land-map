import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const Parcelles = () => {
  const navigate = useNavigate();
  const [parcelles, setParcelles] = useState<any[]>([]);
  const [hectares, setHectares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingParcelle, setEditingParcelle] = useState<any>(null);
  const [formData, setFormData] = useState({
    hectare_id: "",
    numero: "",
    surface: "",
    prix: "",
    status: "disponible",
    buyer_name: "",
    buyer_phone: "",
    buyer_email: "",
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
      return;
    }
    loadData();
  };

  const loadData = async () => {
    try {
      const [parcellesRes, hectaresRes] = await Promise.all([
        supabase.from("parcelles").select("*, hectares(name)").order("created_at", { ascending: false }),
        supabase.from("hectares").select("*").order("name"),
      ]);

      if (parcellesRes.error) throw parcellesRes.error;
      if (hectaresRes.error) throw hectaresRes.error;

      setParcelles(parcellesRes.data || []);
      setHectares(hectaresRes.data || []);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parcelleData = {
        hectare_id: formData.hectare_id,
        numero: formData.numero,
        surface: parseFloat(formData.surface),
        prix: parseFloat(formData.prix),
        status: formData.status,
        buyer_name: formData.buyer_name || null,
        buyer_phone: formData.buyer_phone || null,
        buyer_email: formData.buyer_email || null,
        sale_date: formData.status === "vendue" ? new Date().toISOString() : null,
      };

      if (editingParcelle) {
        const { error } = await supabase
          .from("parcelles")
          .update(parcelleData)
          .eq("id", editingParcelle.id);
        if (error) throw error;
        toast.success("Parcelle modifiée");
      } else {
        const { error } = await supabase.from("parcelles").insert(parcelleData);
        if (error) throw error;
        toast.success("Parcelle créée");
      }

      setIsDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette parcelle ?")) return;

    try {
      const { error } = await supabase.from("parcelles").delete().eq("id", id);
      if (error) throw error;
      toast.success("Parcelle supprimée");
      loadData();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const resetForm = () => {
    setFormData({
      hectare_id: "",
      numero: "",
      surface: "",
      prix: "",
      status: "disponible",
      buyer_name: "",
      buyer_phone: "",
      buyer_email: "",
    });
    setEditingParcelle(null);
  };

  const openEditDialog = (parcelle: any) => {
    setEditingParcelle(parcelle);
    setFormData({
      hectare_id: parcelle.hectare_id || "",
      numero: parcelle.numero,
      surface: parcelle.surface.toString(),
      prix: parcelle.prix.toString(),
      status: parcelle.status,
      buyer_name: parcelle.buyer_name || "",
      buyer_phone: parcelle.buyer_phone || "",
      buyer_email: parcelle.buyer_email || "",
    });
    setIsDialogOpen(true);
  };

  const filteredParcelles = parcelles.filter((p) =>
    p.numero.toLowerCase().includes(searchTerm.toLowerCase())
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Parcelles</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gérez vos parcelles et leurs ventes
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Parcelle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingParcelle ? "Modifier la parcelle" : "Nouvelle parcelle"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Hectare</Label>
                  <select
                    className="w-full px-3 py-2 rounded-md border border-border bg-background"
                    value={formData.hectare_id}
                    onChange={(e) =>
                      setFormData({ ...formData, hectare_id: e.target.value })
                    }
                    required
                  >
                    <option value="">Sélectionner un hectare</option>
                    {hectares.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Numéro</Label>
                    <Input
                      value={formData.numero}
                      onChange={(e) =>
                        setFormData({ ...formData, numero: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Surface (m²)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.surface}
                      onChange={(e) =>
                        setFormData({ ...formData, surface: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prix (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.prix}
                      onChange={(e) =>
                        setFormData({ ...formData, prix: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Statut</Label>
                    <select
                      className="w-full px-3 py-2 rounded-md border border-border bg-background"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option value="disponible">Disponible</option>
                      <option value="reservee">Réservée</option>
                      <option value="vendue">Vendue</option>
                    </select>
                  </div>
                </div>

                {formData.status === "vendue" && (
                  <>
                    <hr className="my-4" />
                    <h4 className="font-semibold">Informations de l'acheteur</h4>
                    <div>
                      <Label>Nom complet</Label>
                      <Input
                        value={formData.buyer_name}
                        onChange={(e) =>
                          setFormData({ ...formData, buyer_name: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Téléphone</Label>
                        <Input
                          value={formData.buyer_phone}
                          onChange={(e) =>
                            setFormData({ ...formData, buyer_phone: e.target.value })
                          }
                        />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={formData.buyer_email}
                          onChange={(e) =>
                            setFormData({ ...formData, buyer_email: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </>
                )}

                <Button type="submit" className="w-full">
                  {editingParcelle ? "Modifier" : "Créer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une parcelle..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredParcelles.map((parcelle) => (
            <Card key={parcelle.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    Parcelle {parcelle.numero}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {parcelle.hectares?.name}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    parcelle.status === "disponible"
                      ? "bg-green-100 text-green-800"
                      : parcelle.status === "vendue"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {parcelle.status.charAt(0).toUpperCase() + parcelle.status.slice(1)}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm">
                  <span className="text-muted-foreground">Surface:</span>{" "}
                  <span className="font-medium">{parcelle.surface} m²</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Prix:</span>{" "}
                  <span className="font-medium">{parcelle.prix} USD</span>
                </p>
                {parcelle.buyer_name && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Acheteur:</span>{" "}
                    <span className="font-medium">{parcelle.buyer_name}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(parcelle)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(parcelle.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}

          {filteredParcelles.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">
                Aucune parcelle trouvée.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Parcelles;
