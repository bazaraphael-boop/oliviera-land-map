import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Grid3x3 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Parcelle {
  id: string;
  numero: string;
  surface: number;
  prix: number;
  status: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  hectare_id: string;
}

interface Hectare {
  id: string;
  name: string;
}

const Parcelles = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [hectares, setHectares] = useState<Hectare[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedHectare, setSelectedHectare] = useState<string>(
    searchParams.get("hectare") || "all"
  );
  const [formData, setFormData] = useState({
    numero: "",
    surface: "",
    prix: "",
    hectare_id: searchParams.get("hectare") || "",
  });

  useEffect(() => {
    checkAuth();
    fetchHectares();
    fetchParcelles();
  }, [selectedHectare]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };

  const fetchHectares = async () => {
    try {
      const { data, error } = await supabase
        .from("hectares")
        .select("id, name")
        .order("name");

      if (error) throw error;
      setHectares(data || []);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const fetchParcelles = async () => {
    try {
      let query = supabase.from("parcelles").select("*");
      
      if (selectedHectare && selectedHectare !== "all") {
        query = query.eq("hectare_id", selectedHectare);
      }

      const { data, error } = await query.order("numero");

      if (error) throw error;
      setParcelles(data || []);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des parcelles");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase.from("parcelles").insert([
        {
          numero: formData.numero,
          surface: parseFloat(formData.surface),
          prix: parseFloat(formData.prix),
          hectare_id: formData.hectare_id,
          status: "disponible",
        },
      ]);

      if (error) throw error;

      toast.success("Parcelle créée avec succès");
      setIsDialogOpen(false);
      setFormData({ numero: "", surface: "", prix: "", hectare_id: selectedHectare });
      fetchParcelles();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la création");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette parcelle ?")) return;

    try {
      const { error } = await supabase.from("parcelles").delete().eq("id", id);
      if (error) throw error;

      toast.success("Parcelle supprimée");
      fetchParcelles();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const filteredParcelles = parcelles.filter((p) =>
    p.numero.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const colors = {
      disponible: "bg-green-500/10 text-green-500",
      vendu: "bg-blue-500/10 text-blue-500",
      reserve: "bg-orange-500/10 text-orange-500",
    };
    return colors[status as keyof typeof colors] || colors.disponible;
  };

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
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestion des Parcelles</h1>
          <p className="text-muted-foreground">Gérez vos parcelles par hectare</p>
        </div>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <Select value={selectedHectare} onValueChange={setSelectedHectare}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Tous les hectares" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les hectares</SelectItem>
              {hectares.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une parcelle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle Parcelle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une nouvelle parcelle</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Hectare</Label>
                  <Select
                    value={formData.hectare_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, hectare_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un hectare" />
                    </SelectTrigger>
                    <SelectContent>
                      {hectares.map((h) => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Numéro</Label>
                  <Input
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Surface (m²)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.surface}
                    onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Prix (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.prix}
                    onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Créer</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredParcelles.map((parcelle) => (
            <Card key={parcelle.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center">
                    <Grid3x3 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Parcelle {parcelle.numero}</h3>
                    <p className="text-xs text-muted-foreground">{parcelle.surface} m²</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Edit className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(parcelle.id)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Prix:</span>
                  <span className="text-sm font-semibold">${parcelle.prix.toLocaleString()}</span>
                </div>
                
                <div className={`text-xs px-2 py-1 rounded text-center ${getStatusBadge(parcelle.status)}`}>
                  {parcelle.status}
                </div>

                {parcelle.buyer_name && (
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    Acheteur: {parcelle.buyer_name}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {filteredParcelles.length === 0 && (
          <div className="text-center py-12">
            <Grid3x3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucune parcelle trouvée
            </h3>
            <p className="text-muted-foreground">
              Commencez par créer votre première parcelle
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Parcelles;
