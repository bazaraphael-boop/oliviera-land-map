import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Grid3x3, DollarSign, User, Phone, Mail, Calendar, Package, CreditCard } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Badge } from "@/components/ui/badge";
import { PaymentDialog } from "@/components/PaymentDialog";
import jsPDF from "jspdf";
import headerImage from "@/assets/en_tete_concession_manuel.jpg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
  buyer_email: string | null;
  sale_date: string | null;
  hectare_id: string;
  payment_type: string;
  amount_paid: number;
  remaining_amount: number;
  sale_type: string;
  purchase_type: string | null;
  rmb_number: string | null;
  hectares?: {
    name: string;
    rmb_number: string | null;
  };
}

interface Hectare {
  id: string;
  name: string;
  rmb_number: string | null;
}

const Parcelles = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [hectares, setHectares] = useState<Hectare[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedParcelle, setSelectedParcelle] = useState<Parcelle | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedHectare, setSelectedHectare] = useState<string>(
    searchParams.get("hectare") || "all"
  );
  const [formData, setFormData] = useState({
    numero: "",
    surface: "",
    prix: "",
    hectare_id: searchParams.get("hectare") || "",
    rmb_number: "",
  });
  const [editFormData, setEditFormData] = useState({
    status: "",
    buyer_name: "",
    buyer_phone: "",
    buyer_email: "",
    sale_date: "",
    payment_type: "total",
    amount_paid: "",
    sale_type: "normal",
    prix: "",
    purchase_type: "parcelle",
    rmb_number: "",
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
        .select("id, name, rmb_number")
        .order("name");

      if (error) throw error;
      setHectares(data || []);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const fetchParcelles = async () => {
    try {
      let query = supabase.from("parcelles").select(`
        *,
        hectares (
          name,
          rmb_number
        )
      `);
      
      if (selectedHectare && selectedHectare !== "all") {
        query = query.eq("hectare_id", selectedHectare);
      }

      const { data, error } = await query.order("numero");

      if (error) throw error;
      setParcelles((data as any) || []);
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
      // Vérifier combien de parcelles existent déjà pour cet hectare
      const { data: existingParcelles, error: countError } = await supabase
        .from("parcelles")
        .select("id", { count: "exact" })
        .eq("hectare_id", formData.hectare_id);

      if (countError) throw countError;

      const parcelleCount = existingParcelles?.length || 0;

      if (parcelleCount >= 15) {
        toast.error("Limite atteinte : un hectare ne peut contenir que 15 parcelles maximum");
        return;
      }

      const { error } = await supabase.from("parcelles").insert([
        {
          numero: formData.numero,
          surface: parseFloat(formData.surface),
          prix: parseFloat(formData.prix),
          hectare_id: formData.hectare_id,
          status: "disponible",
          rmb_number: formData.rmb_number || null,
        },
      ]);

      if (error) throw error;

      toast.success("Parcelle créée avec succès");
      setIsDialogOpen(false);
      setFormData({ numero: "", surface: "", prix: "", hectare_id: selectedHectare, rmb_number: "" });
      fetchParcelles();
      queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
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
      queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleEdit = (parcelle: Parcelle) => {
    setSelectedParcelle(parcelle);
    setEditFormData({
      status: parcelle.status || "disponible",
      buyer_name: parcelle.buyer_name || "",
      buyer_phone: parcelle.buyer_phone || "",
      buyer_email: parcelle.buyer_email || "",
      sale_date: parcelle.sale_date || "",
      payment_type: parcelle.payment_type || "total",
      amount_paid: parcelle.amount_paid?.toString() || "",
      sale_type: parcelle.sale_type || "normal",
      prix: parcelle.prix?.toString() || "",
      purchase_type: parcelle.purchase_type || "parcelle",
      rmb_number: parcelle.rmb_number || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleAddPayment = (parcelle: Parcelle) => {
    setSelectedParcelle(parcelle);
    setPaymentDialogOpen(true);
  };

  const handleUpdateParcelle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedParcelle) return;

    try {
      const updateData: any = {
        status: editFormData.status,
        prix: parseFloat(editFormData.prix) || selectedParcelle.prix,
        sale_type: editFormData.sale_type,
        purchase_type: editFormData.purchase_type,
        rmb_number: editFormData.rmb_number || null,
      };

      if (editFormData.status === "vendu") {
        if (!editFormData.buyer_name) {
          toast.error("Le nom de l'acheteur est requis pour une vente");
          return;
        }
        
        const prix = parseFloat(editFormData.prix) || selectedParcelle.prix;
        const amountPaid = parseFloat(editFormData.amount_paid) || 0;
        
        updateData.buyer_name = editFormData.buyer_name;
        updateData.buyer_phone = editFormData.buyer_phone || null;
        updateData.buyer_email = editFormData.buyer_email || null;
        updateData.sale_date = editFormData.sale_date || new Date().toISOString();
        updateData.payment_type = editFormData.payment_type;
        updateData.amount_paid = amountPaid;
        updateData.remaining_amount = editFormData.payment_type === "partiel" ? prix - amountPaid : 0;
      } else {
        // Si le statut n'est pas "vendu", on enlève les infos acheteur
        updateData.buyer_name = null;
        updateData.buyer_phone = null;
        updateData.buyer_email = null;
        updateData.sale_date = null;
        updateData.payment_type = "total";
        updateData.amount_paid = 0;
        updateData.remaining_amount = 0;
      }

      const { error } = await supabase
        .from("parcelles")
        .update(updateData)
        .eq("id", selectedParcelle.id);

      if (error) throw error;

      toast.success("Parcelle mise à jour avec succès");
      
      // Générer la facture si vendu
      if (editFormData.status === "vendu") {
        await generateInvoice(selectedParcelle, updateData);
      }
      
      setIsEditDialogOpen(false);
      setSelectedParcelle(null);
      fetchParcelles();
      queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const filteredParcelles = parcelles.filter((p) =>
    p.numero.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const generateInvoice = async (parcelle: Parcelle, saleData: any) => {
    try {
      const pdf = new jsPDF();
      
      // Ajouter l'en-tête image
      pdf.addImage(headerImage, 'JPEG', 0, 0, 210, 30);
      
      let yPos = 40;
      
      // Titre
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("FACTURE DE VENTE", 105, yPos, { align: "center" });
      yPos += 15;
      
      // Informations générales
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Date: ${new Date(saleData.sale_date).toLocaleDateString()}`, 20, yPos);
      yPos += 10;
      pdf.text(`Parcelle N°: ${parcelle.numero}`, 20, yPos);
      yPos += 10;
      pdf.text(`Surface: ${parcelle.surface} m²`, 20, yPos);
      yPos += 15;
      
      // Type de vente
      pdf.setFont("helvetica", "bold");
      pdf.text(`Type de vente: ${saleData.sale_type === "onereux" ? "À titre onéreux" : "Vente normale"}`, 20, yPos);
      yPos += 15;
      
      // Informations acheteur
      pdf.setFontSize(14);
      pdf.text("INFORMATIONS ACHETEUR", 20, yPos);
      yPos += 8;
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Nom: ${saleData.buyer_name}`, 20, yPos);
      yPos += 7;
      if (saleData.buyer_phone) {
        pdf.text(`Téléphone: ${saleData.buyer_phone}`, 20, yPos);
        yPos += 7;
      }
      if (saleData.buyer_email) {
        pdf.text(`Email: ${saleData.buyer_email}`, 20, yPos);
        yPos += 7;
      }
      yPos += 10;
      
      // Détails financiers
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("DÉTAILS FINANCIERS", 20, yPos);
      yPos += 8;
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Prix total: $${saleData.prix.toLocaleString()}`, 20, yPos);
      yPos += 7;
      pdf.text(`Type de paiement: ${saleData.payment_type === "partiel" ? "Paiement partiel" : "Paiement total"}`, 20, yPos);
      yPos += 7;
      
      if (saleData.payment_type === "partiel") {
        pdf.text(`Montant payé: $${saleData.amount_paid.toLocaleString()}`, 20, yPos);
        yPos += 7;
        pdf.setFont("helvetica", "bold");
        pdf.text(`Montant restant: $${saleData.remaining_amount.toLocaleString()}`, 20, yPos);
        pdf.setFont("helvetica", "normal");
      } else {
        pdf.setFont("helvetica", "bold");
        pdf.text("PAYÉ INTÉGRALEMENT", 20, yPos);
        pdf.setFont("helvetica", "normal");
      }
      
      // Pied de page
      yPos = 270;
      pdf.setFontSize(10);
      pdf.text("___________________________", 20, yPos);
      pdf.text("___________________________", 120, yPos);
      yPos += 5;
      pdf.text("Signature Vendeur", 20, yPos);
      pdf.text("Signature Acheteur", 120, yPos);
      
      // Sauvegarder le PDF
      pdf.save(`facture-parcelle-${parcelle.numero}-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success("Facture générée avec succès");
    } catch (error) {
      console.error("Erreur génération facture:", error);
      toast.error("Erreur lors de la génération de la facture");
    }
  };

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
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Créer une nouvelle parcelle</DialogTitle>
                <DialogDescription>
                  Remplissez les informations de base de la parcelle
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Hectare *</Label>
                    <Select
                      value={formData.hectare_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, hectare_id: value })
                      }
                    >
                      <SelectTrigger className="mt-1">
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
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Grid3x3 className="w-4 h-4" />
                        Numéro *
                      </Label>
                      <Input
                        value={formData.numero}
                        onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                        placeholder="Ex: 001"
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Surface (m²) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.surface}
                        onChange={(e) => setFormData({ ...formData, surface: e.target.value })}
                        placeholder="Ex: 400"
                        required
                        className="mt-1"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Prix (USD) *
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.prix}
                      onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
                      placeholder="Ex: 5000"
                      required
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium">Numéro RMB</Label>
                    <Input
                      value={formData.rmb_number}
                      onChange={(e) => setFormData({ ...formData, rmb_number: e.target.value })}
                      placeholder="Ex: RMB-001"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" className="flex-1">Créer la parcelle</Button>
                </div>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleEdit(parcelle)}
                  >
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
                {(parcelle.rmb_number || parcelle.hectares?.rmb_number) && (
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-xs text-muted-foreground">RMB:</span>
                    <Badge variant="outline" className="text-xs font-medium bg-purple-500/5 border-purple-500/20 text-foreground">
                      {parcelle.rmb_number || parcelle.hectares?.rmb_number}
                    </Badge>
                  </div>
                )}
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Prix:</span>
                  <span className="text-sm font-semibold">${parcelle.prix.toLocaleString()}</span>
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  <div className={`text-xs px-2 py-1 rounded ${getStatusBadge(parcelle.status)}`}>
                    {parcelle.status}
                  </div>
                  
                  {parcelle.sale_type === "onereux" && (
                    <Badge variant="secondary" className="text-xs">
                      À titre onéreux
                    </Badge>
                  )}
                  
                  {parcelle.payment_type === "partiel" && parcelle.status === "vendu" && (
                    <Badge variant="outline" className="text-xs">
                      Paiement partiel
                    </Badge>
                  )}
                </div>

                {parcelle.buyer_name && (
                  <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                    <div>Acheteur: {parcelle.buyer_name}</div>
                    {parcelle.payment_type === "partiel" && (
                      <div className="mt-1">
                        <div>Payé: ${parcelle.amount_paid.toLocaleString()}</div>
                        <div className="font-semibold text-destructive">
                          Reste: ${parcelle.remaining_amount.toLocaleString()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {parcelle.status === "vendu" && parcelle.remaining_amount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddPayment(parcelle)}
                    className="w-full mt-2"
                  >
                    <DollarSign className="w-3 h-3 mr-1" />
                    Ajouter un paiement
                  </Button>
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

        {/* Dialog Édition Parcelle */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Modifier Parcelle {selectedParcelle?.numero}
              </DialogTitle>
              <DialogDescription>
                Modifiez les informations de la parcelle et de la vente
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateParcelle} className="space-y-6">
              {/* Section: Informations de base */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Informations de base</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Statut *</Label>
                    <Select
                      value={editFormData.status}
                      onValueChange={(value) =>
                        setEditFormData({ ...editFormData, status: value })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="disponible">Disponible</SelectItem>
                        <SelectItem value="reserve">Réservé</SelectItem>
                        <SelectItem value="vendu">Vendu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Prix (USD) *
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editFormData.prix}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, prix: e.target.value })
                      }
                      placeholder="Modifier le prix"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Type de vente</Label>
                  <Select
                    value={editFormData.sale_type}
                    onValueChange={(value) =>
                      setEditFormData({ ...editFormData, sale_type: value })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Vente normale</SelectItem>
                      <SelectItem value="onereux">À titre onéreux</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-sm font-medium">Numéro RMB</Label>
                  <Input
                    value={editFormData.rmb_number}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, rmb_number: e.target.value })
                    }
                    placeholder="Ex: RMB-001"
                    className="mt-1"
                  />
                </div>
              </div>

              <Separator />

              {editFormData.status === "vendu" && (
                <>
                  {/* Section: Informations Acheteur */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Informations Acheteur
                    </h3>
                    
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <User className="w-3 h-3" />
                        Nom complet *
                      </Label>
                      <Input
                        value={editFormData.buyer_name}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, buyer_name: e.target.value })
                        }
                        placeholder="Ex: Jean Dupont"
                        required
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          Téléphone
                        </Label>
                        <Input
                          value={editFormData.buyer_phone}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, buyer_phone: e.target.value })
                          }
                          placeholder="+243 123 456 789"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          Email
                        </Label>
                        <Input
                          type="email"
                          value={editFormData.buyer_email}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, buyer_email: e.target.value })
                          }
                          placeholder="email@exemple.com"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        Date de vente
                      </Label>
                      <Input
                        type="date"
                        value={editFormData.sale_date ? new Date(editFormData.sale_date).toISOString().split('T')[0] : ""}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, sale_date: e.target.value })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Section: Détails de paiement */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Détails de paiement
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Type de paiement *</Label>
                        <Select
                          value={editFormData.payment_type}
                          onValueChange={(value) =>
                            setEditFormData({ ...editFormData, payment_type: value })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="total">Paiement total</SelectItem>
                            <SelectItem value="partiel">Paiement partiel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Package className="w-3 h-3" />
                          Type d'achat *
                        </Label>
                        <Select
                          value={editFormData.purchase_type}
                          onValueChange={(value) =>
                            setEditFormData({ ...editFormData, purchase_type: value })
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="parcelle">Parcelle</SelectItem>
                            <SelectItem value="hectare">Hectare</SelectItem>
                            <SelectItem value="demi-hectare">Demi-hectare</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {editFormData.payment_type === "partiel" && (
                      <div>
                        <Label>Montant payé (USD) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editFormData.amount_paid}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, amount_paid: e.target.value })
                          }
                          placeholder="Montant déjà payé"
                          required
                        />
                        {editFormData.amount_paid && editFormData.prix && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Restant: ${(parseFloat(editFormData.prix) - parseFloat(editFormData.amount_paid)).toLocaleString()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1">
                  Enregistrer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        
        {selectedParcelle && (
          <PaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            itemId={selectedParcelle.id}
            itemType="parcelle"
            itemName={`Parcelle ${selectedParcelle.numero}`}
            totalPrice={selectedParcelle.prix}
            remainingAmount={selectedParcelle.remaining_amount}
            buyerName={selectedParcelle.buyer_name || undefined}
            rmbNumber={selectedParcelle.rmb_number || selectedParcelle.hectares?.rmb_number || undefined}
            onPaymentComplete={() => {
              fetchParcelles();
              queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Parcelles;
