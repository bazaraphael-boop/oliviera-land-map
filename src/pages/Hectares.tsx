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

const Hectares = () => {
  const navigate = useNavigate();
  const [hectares, setHectares] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHectare, setEditingHectare] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "",
    surface: "",
    location: "",
    status: "available",
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
    loadHectares();
  };

  const loadHectares = async () => {
    try {
      const { data, error } = await supabase
        .from("hectares")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHectares(data || []);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des hectares");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingHectare) {
        const { error } = await supabase
          .from("hectares")
          .update({
            name: formData.name,
            surface: parseFloat(formData.surface),
            location: formData.location,
            status: formData.status,
          })
          .eq("id", editingHectare.id);

        if (error) throw error;
        toast.success("Hectare modifié avec succès");
      } else {
        const { error } = await supabase.from("hectares").insert({
          name: formData.name,
          surface: parseFloat(formData.surface),
          location: formData.location,
          status: formData.status,
        });

        if (error) throw error;
        toast.success("Hectare créé avec succès");
      }

      setIsDialogOpen(false);
      resetForm();
      loadHectares();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet hectare ?")) return;

    try {
      const { error } = await supabase.from("hectares").delete().eq("id", id);
      if (error) throw error;
      toast.success("Hectare supprimé");
      loadHectares();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const resetForm = () => {
    setFormData({ name: "", surface: "", location: "", status: "available" });
    setEditingHectare(null);
  };

  const openEditDialog = (hectare: any) => {
    setEditingHectare(hectare);
    setFormData({
      name: hectare.name,
      surface: hectare.surface.toString(),
      location: hectare.location || "",
      status: hectare.status,
    });
    setIsDialogOpen(true);
  };

  const filteredHectares = hectares.filter((h) =>
    h.name.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h1 className="text-3xl font-bold text-foreground">Hectares</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Gérez vos terrains et leurs informations
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvel Hectare
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingHectare ? "Modifier l'hectare" : "Nouvel hectare"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label>Surface (hectares)</Label>
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
                <div>
                  <Label>Localisation</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
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
                    <option value="available">Disponible</option>
                    <option value="sold">Vendu</option>
                    <option value="reserved">Réservé</option>
                  </select>
                </div>
                <Button type="submit" className="w-full">
                  {editingHectare ? "Modifier" : "Créer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un hectare..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHectares.map((hectare) => (
            <Card key={hectare.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {hectare.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {hectare.surface} hectares
                  </p>
                </div>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    hectare.status === "available"
                      ? "bg-green-100 text-green-800"
                      : hectare.status === "sold"
                      ? "bg-red-100 text-red-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {hectare.status === "available"
                    ? "Disponible"
                    : hectare.status === "sold"
                    ? "Vendu"
                    : "Réservé"}
                </span>
              </div>

              {hectare.location && (
                <p className="text-sm text-muted-foreground mb-4">
                  📍 {hectare.location}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(hectare)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(hectare.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}

          {filteredHectares.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">
                Aucun hectare trouvé. Créez-en un pour commencer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Hectares;
