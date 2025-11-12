import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, MapPin, DollarSign } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Badge } from "@/components/ui/badge";
import { PaymentDialog } from "@/components/PaymentDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Hectare {
  id: string;
  name: string;
  surface: number;
  location: string;
  status: string;
  created_at: string;
  prix: number;
  rmb_number: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  sale_date: string | null;
  payment_type: string | null;
  amount_paid: number;
  remaining_amount: number;
  sale_type: string | null;
  purchase_type: string | null;
}

const Hectares = () => {
  const navigate = useNavigate();
  const [hectares, setHectares] = useState<Hectare[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedHectare, setSelectedHectare] = useState<Hectare | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    surface: "",
    location: "",
    status: "available",
    prix: "",
    rmb_number: "",
    buyer_name: "",
    buyer_phone: "",
    buyer_email: "",
    sale_type: "normal",
    purchase_type: "hectare",
  });

  useEffect(() => {
    checkAuth();
    fetchHectares();
  }, []);

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
      if (isEditMode && editingId) {
        // Mode édition
        const { error } = await supabase
          .from("hectares")
          .update({
            name: formData.name,
            surface: parseFloat(formData.surface),
            location: formData.location,
            status: formData.status,
            prix: parseFloat(formData.prix) || 0,
            rmb_number: formData.rmb_number || null,
          })
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Hectare modifié avec succès");
      } else {
        // Mode création
        const { error } = await supabase.from("hectares").insert([
          {
            name: formData.name,
            surface: parseFloat(formData.surface),
            location: formData.location,
            status: formData.status,
            prix: parseFloat(formData.prix) || 0,
            rmb_number: formData.rmb_number || null,
          },
        ]);

        if (error) throw error;
        toast.success("Hectare créé avec succès");
      }

      setIsDialogOpen(false);
      setIsEditMode(false);
      setEditingId(null);
      setFormData({ name: "", surface: "", location: "", status: "available", prix: "", rmb_number: "", buyer_name: "", buyer_phone: "", buyer_email: "", sale_type: "normal", purchase_type: "hectare" });
      fetchHectares();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error(isEditMode ? "Erreur lors de la modification" : "Erreur lors de la création");
    }
  };

  const handleEdit = (hectare: Hectare) => {
    setFormData({
      name: hectare.name,
      surface: hectare.surface.toString(),
      location: hectare.location || "",
      status: hectare.status,
      prix: hectare.prix.toString(),
      rmb_number: hectare.rmb_number || "",
      buyer_name: hectare.buyer_name || "",
      buyer_phone: hectare.buyer_phone || "",
      buyer_email: hectare.buyer_email || "",
      sale_type: hectare.sale_type || "normal",
      purchase_type: hectare.purchase_type || "hectare",
    });
    setEditingId(hectare.id);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleAddPayment = (hectare: Hectare) => {
    setSelectedHectare(hectare);
    setPaymentDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet hectare ?")) return;

    try {
      const { error } = await supabase.from("hectares").delete().eq("id", id);
      if (error) throw error;

      toast.success("Hectare supprimé");
      fetchHectares();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const filteredHectares = hectares.filter((h) =>
    h.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.location?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold text-foreground mb-2">Gestion des Hectares</h1>
          <p className="text-muted-foreground">Gérez vos terrains et leurs parcelles</p>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un hectare..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setIsEditMode(false);
              setEditingId(null);
              setFormData({ name: "", surface: "", location: "", status: "available", prix: "", rmb_number: "", buyer_name: "", buyer_phone: "", buyer_email: "", sale_type: "normal", purchase_type: "hectare" });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvel Hectare
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isEditMode ? "Modifier l'hectare" : "Créer un nouvel hectare"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Nom</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Surface (hectares)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.surface}
                    onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>Localisation</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Prix (USD)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.prix}
                    onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
                    placeholder="Prix total de l'hectare"
                  />
                </div>
                <div>
                  <Label>Numéro RMB</Label>
                  <Input
                    value={formData.rmb_number}
                    onChange={(e) => setFormData({ ...formData, rmb_number: e.target.value })}
                    placeholder="Ex: RMB-2024-001"
                  />
                </div>
                
                {formData.status === "vendu" && (
                  <>
                    <div className="col-span-2 border-t border-border pt-4">
                      <h3 className="font-semibold mb-3">Informations acheteur</h3>
                    </div>
                    
                    <div>
                      <Label>Nom de l'acheteur</Label>
                      <Input
                        value={formData.buyer_name}
                        onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                        placeholder="Nom complet"
                      />
                    </div>
                    
                    <div>
                      <Label>Téléphone</Label>
                      <Input
                        value={formData.buyer_phone}
                        onChange={(e) => setFormData({ ...formData, buyer_phone: e.target.value })}
                        placeholder="+243..."
                      />
                    </div>
                    
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={formData.buyer_email}
                        onChange={(e) => setFormData({ ...formData, buyer_email: e.target.value })}
                        placeholder="email@example.com"
                      />
                    </div>
                    
                    <div>
                      <Label>Type de vente</Label>
                      <select
                        value={formData.sale_type}
                        onChange={(e) => setFormData({ ...formData, sale_type: e.target.value })}
                        className="w-full h-10 px-3 rounded-md border border-input bg-background"
                      >
                        <option value="normal">Vente normale</option>
                        <option value="onereux">À titre onéreux</option>
                      </select>
                    </div>
                  </>
                )}
                
                <Button type="submit" className="w-full col-span-2">
                  {isEditMode ? "Modifier" : "Créer"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredHectares.map((hectare) => (
            <Card key={hectare.id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{hectare.name}</h3>
                      {hectare.status === "vendu" && hectare.sale_type === "onereux" && (
                        <Badge variant="secondary" className="text-xs">À titre onéreux</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{hectare.surface} ha</p>
                    {hectare.prix > 0 && (
                      <p className="text-sm font-semibold text-primary">${hectare.prix.toLocaleString()}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(hectare)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(hectare.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1 mb-3">
                {hectare.location && (
                  <p className="text-sm text-muted-foreground">
                    📍 {hectare.location}
                  </p>
                )}
                {hectare.rmb_number && (
                  <p className="text-sm text-muted-foreground">
                    RMB: {hectare.rmb_number}
                  </p>
                )}
                
                {hectare.status === "vendu" && hectare.buyer_name && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm font-semibold text-foreground">{hectare.buyer_name}</p>
                    {hectare.buyer_phone && (
                      <p className="text-xs text-muted-foreground">{hectare.buyer_phone}</p>
                    )}
                    {hectare.payment_type === "partiel" && (
                      <div className="mt-2 p-2 bg-muted rounded">
                        <p className="text-xs">
                          Payé: <span className="font-semibold">${hectare.amount_paid.toLocaleString()}</span>
                        </p>
                        <p className="text-xs text-destructive">
                          Reste: <span className="font-semibold">${hectare.remaining_amount.toLocaleString()}</span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border gap-2">
                {hectare.status === "vendu" && hectare.remaining_amount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddPayment(hectare)}
                    className="flex-1"
                  >
                    <DollarSign className="w-4 h-4 mr-1" />
                    Paiement
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/parcelles?hectare=${hectare.id}`)}
                  className="flex-1"
                >
                  Parcelles
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {filteredHectares.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucun hectare trouvé
            </h3>
            <p className="text-muted-foreground">
              Commencez par créer votre premier hectare
            </p>
          </div>
        )}
      </div>
      
      {selectedHectare && (
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          itemId={selectedHectare.id}
          itemType="hectare"
          itemName={selectedHectare.name}
          totalPrice={selectedHectare.prix}
          remainingAmount={selectedHectare.remaining_amount}
          buyerName={selectedHectare.buyer_name || undefined}
          onPaymentComplete={fetchHectares}
        />
      )}
    </div>
  );
};

export default Hectares;
