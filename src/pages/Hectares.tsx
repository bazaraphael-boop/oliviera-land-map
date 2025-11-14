import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, MapPin, DollarSign, User, CreditCard, Package } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Site {
  id: string;
  name: string;
  surface_totale: number;
}

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
  site_id: string | null;
}

const Hectares = () => {
  const navigate = useNavigate();
  const [hectares, setHectares] = useState<Hectare[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedHectare, setSelectedHectare] = useState<Hectare | null>(null);
  const [parcellesDialogOpen, setParcellesDialogOpen] = useState(false);
  const [parcelles, setParcelles] = useState<any[]>([]);
  const [selectedParcelle, setSelectedParcelle] = useState<any | null>(null);
  const [parcelleDetailsOpen, setParcelleDetailsOpen] = useState(false);
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
    payment_type: "total",
    amount_paid: "",
    remaining_amount: "",
    site_id: "",
  });

  useEffect(() => {
    checkAuth();
    fetchSites();
    fetchHectares();
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
        .select("id, name, surface_totale")
        .order("name");

      if (error) throw error;
      setSites((data as any) || []);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des sites");
    }
  };

  const fetchHectares = async () => {
    try {
      const { data, error } = await supabase
        .from("hectares")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setHectares((data as any) || []);
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
      // Déterminer si c'est une vente (si un nom d'acheteur est fourni)
      const isVente = formData.buyer_name.trim() !== "";
      const prix = parseFloat(formData.prix) || 0;
      const amountPaid = parseFloat(formData.amount_paid) || (formData.payment_type === "total" ? prix : 0);
      const remainingAmount = formData.payment_type === "partiel" ? prix - amountPaid : 0;
      
      const hectareData = {
        name: formData.name,
        surface: parseFloat(formData.surface),
        location: formData.location,
        status: isVente ? "vendu" : formData.status,
        prix: prix,
        rmb_number: formData.rmb_number || null,
        buyer_name: isVente ? formData.buyer_name : null,
        buyer_phone: isVente ? formData.buyer_phone || null : null,
        buyer_email: isVente ? formData.buyer_email || null : null,
        sale_type: isVente ? formData.sale_type : null,
        purchase_type: isVente ? formData.purchase_type : null,
        payment_type: isVente ? formData.payment_type : null,
        amount_paid: isVente ? amountPaid : 0,
        remaining_amount: isVente ? remainingAmount : 0,
        sale_date: isVente ? new Date().toISOString() : null,
        site_id: formData.site_id || null,
      };
      
      if (isEditMode && editingId) {
        // Mode édition
        const { error } = await supabase
          .from("hectares")
          .update(hectareData)
          .eq("id", editingId);

        if (error) throw error;
        toast.success("Hectare modifié avec succès");
      } else {
        // Mode création
        const { error } = await supabase.from("hectares").insert([hectareData]);

        if (error) throw error;
        toast.success("Hectare créé avec succès");
      }

      setIsDialogOpen(false);
      setIsEditMode(false);
      setEditingId(null);
      setFormData({ name: "", surface: "", location: "", status: "available", prix: "", rmb_number: "", buyer_name: "", buyer_phone: "", buyer_email: "", sale_type: "normal", purchase_type: "hectare", payment_type: "total", amount_paid: "", remaining_amount: "", site_id: "" });
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
      payment_type: hectare.payment_type || "total",
      amount_paid: hectare.amount_paid.toString(),
      remaining_amount: hectare.remaining_amount.toString(),
      site_id: hectare.site_id || "",
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

  const fetchParcelles = async (hectareId: string) => {
    try {
      const { data, error } = await supabase
        .from("parcelles")
        .select("*")
        .eq("hectare_id", hectareId)
        .order("numero");

      if (error) throw error;
      setParcelles(data || []);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des parcelles");
    }
  };

  const handleOpenParcelles = async (hectare: Hectare) => {
    setSelectedHectare(hectare);
    await fetchParcelles(hectare.id);
    setParcellesDialogOpen(true);
  };

  const handleParcelleClick = (parcelleNum: string) => {
    const parcelle = parcelles.find(p => p.numero === parcelleNum);
    setSelectedParcelle(parcelle || { numero: parcelleNum, status: 'disponible' });
    setParcelleDetailsOpen(true);
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
              setFormData({ name: "", surface: "", location: "", status: "available", prix: "", rmb_number: "", buyer_name: "", buyer_phone: "", buyer_email: "", sale_type: "normal", purchase_type: "hectare", payment_type: "total", amount_paid: "", remaining_amount: "", site_id: "" });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvel Hectare
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
              <DialogHeader className="border-b border-border pb-4">
                <DialogTitle className="text-2xl flex items-center gap-2">
                  <Package className="w-6 h-6 text-primary" />
                  {isEditMode ? "Modifier l'hectare" : "Créer un nouvel hectare"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6 pt-4">
                {/* Informations générales */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold text-lg">Informations générales</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Nom</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Ex: Hectare A1"
                        required
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Surface (hectares)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.surface}
                        onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                        placeholder="1.00"
                        required
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Localisation</Label>
                      <Input
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="Ex: Zone Nord"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Numéro RMB</Label>
                      <Input
                        value={formData.rmb_number}
                        onChange={(e) => setFormData({ ...formData, rmb_number: e.target.value })}
                        placeholder="Ex: RMB-2024-001"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Site *</Label>
                      <Select
                        value={formData.site_id}
                        onValueChange={(value) => setFormData({ ...formData, site_id: value })}
                        required
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Sélectionner un site" />
                        </SelectTrigger>
                        <SelectContent>
                          {sites.map((site) => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.name} ({site.surface_totale} ha)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Prix (USD)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.prix}
                      onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
                      placeholder="Prix total de l'hectare"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                {/* Informations acheteur */}
                <div className="bg-blue-500/5 p-4 rounded-lg border-l-4 border-l-blue-500 space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold text-lg">Informations acheteur</h3>
                    <Badge variant="outline" className="ml-auto text-xs">Optionnel</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Remplissez ces informations pour marquer l'hectare comme vendu
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium">Nom de l'acheteur</Label>
                      <Input
                        value={formData.buyer_name}
                        onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
                        placeholder="Nom complet (optionnel)"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Téléphone</Label>
                      <Input
                        value={formData.buyer_phone}
                        onChange={(e) => setFormData({ ...formData, buyer_phone: e.target.value })}
                        placeholder="+243..."
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium">Email</Label>
                      <Input
                        type="email"
                        value={formData.buyer_email}
                        onChange={(e) => setFormData({ ...formData, buyer_email: e.target.value })}
                        placeholder="email@example.com"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Détails de la vente - affiché seulement si acheteur renseigné */}
                {formData.buyer_name && (
                  <div className="bg-green-500/5 p-4 rounded-lg border-l-4 border-l-green-500 space-y-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="w-5 h-5 text-green-500" />
                      <h3 className="font-semibold text-lg">Détails de la vente</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Type d'achat</Label>
                        <select
                          value={formData.purchase_type}
                          onChange={(e) => setFormData({ ...formData, purchase_type: e.target.value })}
                          className="w-full h-10 px-3 rounded-md border border-input bg-background mt-1"
                        >
                          <option value="hectare">Hectare complet</option>
                          <option value="demi-hectare">Demi-hectare</option>
                        </select>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Type de vente</Label>
                        <select
                          value={formData.sale_type}
                          onChange={(e) => setFormData({ ...formData, sale_type: e.target.value })}
                          className="w-full h-10 px-3 rounded-md border border-input bg-background mt-1"
                        >
                          <option value="normal">Vente normale</option>
                          <option value="onereux">À titre onéreux</option>
                        </select>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Type de paiement</Label>
                        <select
                          value={formData.payment_type}
                          onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
                          className="w-full h-10 px-3 rounded-md border border-input bg-background mt-1"
                        >
                          <option value="total">Paiement total</option>
                          <option value="partiel">Paiement partiel</option>
                        </select>
                      </div>
                      
                      {formData.payment_type === "partiel" && (
                        <div>
                          <Label className="text-sm font-medium">Montant payé (accompte)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.amount_paid}
                            onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                            placeholder="Montant déjà payé"
                            className="mt-1"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setIsEditMode(false);
                      setEditingId(null);
                      setFormData({
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
                        payment_type: "total",
                        amount_paid: "",
                        remaining_amount: "",
                        site_id: "",
                      });
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" className="flex-1">
                    {isEditMode ? "Modifier" : "Créer"}
                  </Button>
                </div>
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
                  onClick={() => handleOpenParcelles(hectare)}
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
          rmbNumber={selectedHectare.rmb_number || undefined}
          onPaymentComplete={fetchHectares}
        />
      )}

      {/* Dialog du tableau de parcelles */}
      <Dialog open={parcellesDialogOpen} onOpenChange={setParcellesDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-card">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-2xl flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">Parcelles - {selectedHectare?.name}</div>
                <div className="text-sm text-muted-foreground font-normal mt-1">
                  {selectedHectare?.location && `${selectedHectare.location} • `}
                  {parcelles.filter(p => p.status === 'vendu').length} vendue(s) sur 15
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-6 space-y-6">
            {/* Statistiques */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 bg-green-500/5 border-green-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <MapPin className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-700">
                      {15 - parcelles.filter(p => p.status === 'vendu').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Disponibles</div>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-red-500/5 border-red-500/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <User className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-700">
                      {parcelles.filter(p => p.status === 'vendu').length}
                    </div>
                    <div className="text-xs text-muted-foreground">Vendues</div>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <DollarSign className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-primary">
                      {Math.round((parcelles.filter(p => p.status === 'vendu').length / 15) * 100)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Taux de vente</div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Grille des parcelles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Plan des parcelles</h3>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-500/30 border-2 border-green-500 rounded"></div>
                    <span className="text-xs text-muted-foreground">Disponible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500/30 border-2 border-red-500 rounded"></div>
                    <span className="text-xs text-muted-foreground">Vendue</span>
                  </div>
                </div>
              </div>
              
              <Card className="p-6 bg-muted/30">
                <div className="grid grid-cols-5 gap-4">
                  {Array.from({ length: 15 }, (_, i) => {
                    const parcelleNum = (i + 1).toString().padStart(3, '0');
                    const parcelle = parcelles.find(p => p.numero === parcelleNum);
                    const isVendu = parcelle?.status === 'vendu';
                    const isDisponible = !parcelle || parcelle?.status === 'disponible';
                    
                    return (
                      <div
                        key={i}
                        onClick={() => handleParcelleClick(parcelleNum)}
                        className={`
                          relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center
                          font-bold text-xl transition-all hover:scale-105 cursor-pointer shadow-sm
                          ${isVendu ? 'bg-red-500/20 border-red-500 text-red-700 hover:bg-red-500/30' : ''}
                          ${isDisponible ? 'bg-green-500/20 border-green-500 text-green-700 hover:bg-green-500/30' : ''}
                        `}
                        title={isVendu ? `Vendue à ${parcelle?.buyer_name || 'N/A'}` : 'Disponible - Cliquez pour voir'}
                      >
                        <span className="text-2xl">{parcelleNum}</span>
                        {isVendu && (
                          <div className="absolute top-1 right-1">
                            <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => setParcellesDialogOpen(false)}
              >
                Fermer
              </Button>
              <Button
                onClick={() => {
                  setParcellesDialogOpen(false);
                  navigate(`/parcelles?hectare=${selectedHectare?.id}`);
                }}
              >
                Gérer les parcelles
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog des détails de parcelle */}
      <Dialog open={parcelleDetailsOpen} onOpenChange={setParcelleDetailsOpen}>
        <DialogContent className="max-w-md bg-card">
          <DialogHeader className="border-b border-border pb-4">
            <DialogTitle className="text-2xl flex items-center gap-3">
              <div className={`p-2 rounded-lg ${selectedParcelle?.status === 'vendu' ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                <MapPin className={`w-6 h-6 ${selectedParcelle?.status === 'vendu' ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <div>
                <div className="text-xl font-bold">Parcelle {selectedParcelle?.numero}</div>
                <Badge 
                  variant={selectedParcelle?.status === 'vendu' ? 'destructive' : 'default'}
                  className="mt-1"
                >
                  {selectedParcelle?.status === 'vendu' ? 'Vendue' : 'Disponible'}
                </Badge>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedParcelle?.status === 'vendu' ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">Acheteur</div>
                      <div className="font-semibold">{selectedParcelle?.buyer_name || 'N/A'}</div>
                    </div>
                  </div>

                  {selectedParcelle?.buyer_phone && (
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground">Téléphone</div>
                      <div className="font-medium">{selectedParcelle.buyer_phone}</div>
                    </div>
                  )}

                  {selectedParcelle?.buyer_email && (
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground">Email</div>
                      <div className="font-medium">{selectedParcelle.buyer_email}</div>
                    </div>
                  )}

                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <div className="text-xs text-muted-foreground">Prix de vente</div>
                      <div className="font-semibold">{selectedParcelle?.prix?.toLocaleString('fr-FR')} USD</div>
                    </div>
                  </div>

                  {selectedParcelle?.surface && (
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Surface</div>
                        <div className="font-semibold">{selectedParcelle.surface} m²</div>
                      </div>
                    </div>
                  )}

                  {selectedParcelle?.rmb_number && (
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground">Numéro RMB</div>
                      <div className="font-medium">{selectedParcelle.rmb_number}</div>
                    </div>
                  )}

                  {selectedParcelle?.sale_date && (
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground">Date de vente</div>
                      <div className="font-medium">
                        {new Date(selectedParcelle.sale_date).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  )}

                  {selectedParcelle?.payment_type === 'partiel' && (
                    <div className="flex items-start gap-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                      <CreditCard className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs text-muted-foreground">Paiement partiel</div>
                        <div className="font-semibold text-yellow-700">
                          Payé: {selectedParcelle?.amount_paid?.toLocaleString('fr-FR')} USD
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Reste: {selectedParcelle?.remaining_amount?.toLocaleString('fr-FR')} USD
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Parcelle disponible</h3>
                <p className="text-sm text-muted-foreground">
                  Cette parcelle est disponible à la vente.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={() => setParcelleDetailsOpen(false)}
            >
              Fermer
            </Button>
            {selectedParcelle?.id && (
              <Button
                onClick={() => {
                  setParcelleDetailsOpen(false);
                  setParcellesDialogOpen(false);
                  navigate(`/parcelles?parcelle=${selectedParcelle.id}`);
                }}
              >
                Voir détails complets
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Hectares;
