import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, User, MapPin, Phone, Mail, Calendar, DollarSign, Plus } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Acheteur {
  id: string;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  parcelles: {
    id: string;
    numero: string;
    surface: number;
    prix: number;
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
      location: string;
    };
  }[];
  hectares: {
    id: string;
    name: string;
    surface: number;
    prix: number;
    sale_date: string | null;
    location: string | null;
    payment_type: string;
    amount_paid: number;
    remaining_amount: number;
    sale_type: string;
    purchase_type: string | null;
    rmb_number: string | null;
  }[];
  totalAchat: number;
  nombreParcelles: number;
  nombreHectares: number;
}

const Acheteurs = () => {
  const navigate = useNavigate();
  const [acheteurs, setAcheteurs] = useState<Acheteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAcheteur, setSelectedAcheteur] = useState<Acheteur | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showNewBuyerDialog, setShowNewBuyerDialog] = useState(false);
  const [showEditBuyerDialog, setShowEditBuyerDialog] = useState(false);
  const [availableHectares, setAvailableHectares] = useState<any[]>([]);
  const [availableParcelles, setAvailableParcelles] = useState<any[]>([]);
  const [newBuyerForm, setNewBuyerForm] = useState({
    nom: "",
    post_nom: "",
    prenom: "",
    buyer_phone: "",
    buyer_email: "",
    purchase_type: "hectare",
    item_type: "hectare" as "hectare" | "parcelle",
    selected_item: "",
    sale_type: "normal",
    payment_type: "total",
    amount_paid: "",
    rmb_number: "",
    prix: "",
  });
  const [editBuyerForm, setEditBuyerForm] = useState({
    buyer_name: "",
    buyer_phone: "",
    buyer_email: "",
  });

  useEffect(() => {
    checkAuth();
    loadAcheteurs();
  }, []);

  useEffect(() => {
    if (showNewBuyerDialog) {
      loadAvailableItems();
    }
  }, [showNewBuyerDialog, newBuyerForm.item_type]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };


  const loadAcheteurs = async () => {
    try {
      // Récupérer toutes les parcelles vendues
      const { data: parcelles, error: parcellesError } = await supabase
        .from("parcelles")
        .select(`
          *,
          hectares (
            name,
            location
          )
        `)
        .eq("status", "vendu")
        .not("buyer_name", "is", null);

      if (parcellesError) throw parcellesError;
      
      // Récupérer tous les hectares vendus
      const { data: hectares, error: hectaresError } = await supabase
        .from("hectares")
        .select("*")
        .eq("status", "vendu")
        .not("buyer_name", "is", null);

      if (hectaresError) throw hectaresError;

      // Regrouper par acheteur
      const acheteursMap = new Map<string, Acheteur>();

      // Traiter les parcelles
      parcelles?.forEach((parcelle) => {
        const buyerKey = parcelle.buyer_name.toLowerCase().trim();
        
        if (!acheteursMap.has(buyerKey)) {
          acheteursMap.set(buyerKey, {
            id: buyerKey,
            buyer_name: parcelle.buyer_name,
            buyer_phone: parcelle.buyer_phone,
            buyer_email: parcelle.buyer_email,
            parcelles: [],
            hectares: [],
            totalAchat: 0,
            nombreParcelles: 0,
            nombreHectares: 0,
          });
        }

        const acheteur = acheteursMap.get(buyerKey)!;
        acheteur.parcelles.push({
          id: parcelle.id,
          numero: parcelle.numero,
          surface: parcelle.surface,
          prix: parcelle.prix,
          sale_date: parcelle.sale_date,
          hectare_id: parcelle.hectare_id,
          payment_type: parcelle.payment_type,
          amount_paid: parcelle.amount_paid || 0,
          remaining_amount: parcelle.remaining_amount || 0,
          sale_type: parcelle.sale_type,
          purchase_type: parcelle.purchase_type,
          rmb_number: parcelle.rmb_number,
          hectares: parcelle.hectares,
        });
        acheteur.totalAchat += Number(parcelle.amount_paid || parcelle.prix);
        acheteur.nombreParcelles += 1;

        if (parcelle.buyer_phone && !acheteur.buyer_phone) {
          acheteur.buyer_phone = parcelle.buyer_phone;
        }
        if (parcelle.buyer_email && !acheteur.buyer_email) {
          acheteur.buyer_email = parcelle.buyer_email;
        }
      });
      
      // Traiter les hectares
      hectares?.forEach((hectare) => {
        const buyerKey = hectare.buyer_name.toLowerCase().trim();
        
        if (!acheteursMap.has(buyerKey)) {
          acheteursMap.set(buyerKey, {
            id: buyerKey,
            buyer_name: hectare.buyer_name,
            buyer_phone: hectare.buyer_phone,
            buyer_email: hectare.buyer_email,
            parcelles: [],
            hectares: [],
            totalAchat: 0,
            nombreParcelles: 0,
            nombreHectares: 0,
          });
        }

        const acheteur = acheteursMap.get(buyerKey)!;
        acheteur.hectares.push({
          id: hectare.id,
          name: hectare.name,
          surface: hectare.surface,
          prix: hectare.prix,
          sale_date: hectare.sale_date,
          location: hectare.location,
          payment_type: hectare.payment_type,
          amount_paid: hectare.amount_paid || 0,
          remaining_amount: hectare.remaining_amount || 0,
          sale_type: hectare.sale_type,
          purchase_type: hectare.purchase_type,
          rmb_number: hectare.rmb_number,
        });
        acheteur.totalAchat += Number(hectare.amount_paid || hectare.prix);
        acheteur.nombreHectares += 1;

        if (hectare.buyer_phone && !acheteur.buyer_phone) {
          acheteur.buyer_phone = hectare.buyer_phone;
        }
        if (hectare.buyer_email && !acheteur.buyer_email) {
          acheteur.buyer_email = hectare.buyer_email;
        }
      });

      const acheteursArray = Array.from(acheteursMap.values()).sort(
        (a, b) => b.totalAchat - a.totalAchat
      );

      setAcheteurs(acheteursArray);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des acheteurs");
    } finally {
      setLoading(false);
    }
  };

  const handleShowDetails = (acheteur: Acheteur) => {
    setSelectedAcheteur(acheteur);
    setShowDetails(true);
  };

  const handleEditBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAcheteur) return;
    
    try {
      // Mettre à jour toutes les parcelles de cet acheteur
      const parcelleIds = selectedAcheteur.parcelles.map(p => p.id);
      if (parcelleIds.length > 0) {
        const { error: parcellesError } = await supabase
          .from("parcelles")
          .update({
            buyer_name: editBuyerForm.buyer_name,
            buyer_phone: editBuyerForm.buyer_phone || null,
            buyer_email: editBuyerForm.buyer_email || null,
          })
          .in("id", parcelleIds);

        if (parcellesError) throw parcellesError;
      }

      // Mettre à jour tous les hectares de cet acheteur
      const hectareIds = selectedAcheteur.hectares.map(h => h.id);
      if (hectareIds.length > 0) {
        const { error: hectaresError } = await supabase
          .from("hectares")
          .update({
            buyer_name: editBuyerForm.buyer_name,
            buyer_phone: editBuyerForm.buyer_phone || null,
            buyer_email: editBuyerForm.buyer_email || null,
          })
          .in("id", hectareIds);

        if (hectaresError) throw hectaresError;
      }

      toast.success("Acheteur modifié avec succès");
      setShowEditBuyerDialog(false);
      loadAcheteurs(); // Recharger la liste
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la modification de l'acheteur");
    }
  };

  const handleLocaliser = (parcelleId: string) => {
    // Rediriger vers la page de localisation avec l'ID de la parcelle
    navigate(`/localisation?parcelle=${parcelleId}`);
  };

  const loadAvailableItems = async () => {
    try {
      if (newBuyerForm.item_type === "hectare") {
        const { data, error } = await supabase
          .from("hectares")
          .select("*")
          .eq("status", "available")
          .order("name");
        
        if (error) throw error;
        setAvailableHectares(data || []);
      } else {
        const { data, error } = await supabase
          .from("parcelles")
          .select(`
            *,
            hectares (
              name,
              location
            )
          `)
          .eq("status", "disponible")
          .order("numero");
        
        if (error) throw error;
        setAvailableParcelles(data || []);
      }
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des items disponibles");
    }
  };

  const handleNewBuyerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newBuyerForm.selected_item) {
      toast.error("Veuillez sélectionner un hectare ou une parcelle");
      return;
    }

    try {
      const selectedItem = newBuyerForm.item_type === "hectare"
        ? availableHectares.find(h => h.id === newBuyerForm.selected_item)
        : availableParcelles.find(p => p.id === newBuyerForm.selected_item);

      if (!selectedItem) {
        toast.error("Item sélectionné introuvable");
        return;
      }

      // Concaténer les trois parties du nom
      const fullName = `${newBuyerForm.nom} ${newBuyerForm.post_nom} ${newBuyerForm.prenom}`.trim();

      const prix = newBuyerForm.prix ? parseFloat(newBuyerForm.prix) : (selectedItem.prix || 0);
      const amountPaid = newBuyerForm.payment_type === "total" 
        ? prix 
        : Number(newBuyerForm.amount_paid);
      const remainingAmount = prix - amountPaid;

      const updateData = {
        buyer_name: fullName,
        buyer_phone: newBuyerForm.buyer_phone || null,
        buyer_email: newBuyerForm.buyer_email || null,
        status: newBuyerForm.item_type === "hectare" ? "vendu" : undefined,
        sale_date: new Date().toISOString(),
        sale_type: newBuyerForm.sale_type,
        purchase_type: newBuyerForm.purchase_type,
        payment_type: newBuyerForm.payment_type,
        amount_paid: amountPaid,
        remaining_amount: remainingAmount,
        rmb_number: newBuyerForm.rmb_number || null,
        prix: prix,
      };

      if (newBuyerForm.item_type === "hectare") {
        const { error } = await supabase
          .from("hectares")
          .update(updateData)
          .eq("id", newBuyerForm.selected_item);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("parcelles")
          .update({ ...updateData, status: "vendu" })
          .eq("id", newBuyerForm.selected_item);

        if (error) throw error;
      }

      toast.success("Acheteur enregistré avec succès");
      setShowNewBuyerDialog(false);
      setNewBuyerForm({
        nom: "",
        post_nom: "",
        prenom: "",
        buyer_phone: "",
        buyer_email: "",
        purchase_type: "hectare",
        item_type: "hectare",
        selected_item: "",
        sale_type: "normal",
        payment_type: "total",
        amount_paid: "",
        rmb_number: "",
        prix: "",
      });
      loadAcheteurs();
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de l'enregistrement de l'acheteur");
    }
  };

  const filteredAcheteurs = acheteurs.filter((a) =>
    a.buyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.buyer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.buyer_email?.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Gestion des Acheteurs
          </h1>
          <p className="text-muted-foreground">
            Consultez la liste des acheteurs et leurs achats
          </p>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un acheteur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{acheteurs.length} acheteurs</span>
          </div>

          <Button onClick={() => setShowNewBuyerDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvel Acheteur
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{acheteurs.length}</p>
                <p className="text-sm text-muted-foreground">Total Acheteurs</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {acheteurs.reduce((sum, a) => sum + a.totalAchat, 0).toLocaleString()} USD
                </p>
                <p className="text-sm text-muted-foreground">Revenus Totaux</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {acheteurs.reduce((sum, a) => sum + a.nombreParcelles, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Parcelles Vendues</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Acheteurs List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredAcheteurs.map((acheteur) => (
            <Card key={acheteur.id} className="p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-6 h-6 text-primary" />
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {(() => {
                        const rmbNumbers = new Set<string>();
                        acheteur.parcelles.forEach(p => {
                          if (p.rmb_number) rmbNumbers.add(p.rmb_number);
                        });
                        acheteur.hectares.forEach(h => {
                          if (h.rmb_number) rmbNumbers.add(h.rmb_number);
                        });
                        const rmbList = Array.from(rmbNumbers).sort((a, b) => {
                          const numA = parseInt(a.replace(/\D/g, '')) || 0;
                          const numB = parseInt(b.replace(/\D/g, '')) || 0;
                          return numA - numB;
                        });
                        
                        return rmbList.length > 0 && (
                          <span className="text-sm font-medium text-primary">
                            RMB {rmbList.join(', ')} -
                          </span>
                        );
                      })()}
                      <h3 className="text-lg font-semibold text-foreground">
                        {acheteur.buyer_name}
                      </h3>
                      <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-500 border border-green-500/20">
                        {acheteur.nombreParcelles} parcelle{acheteur.nombreParcelles > 1 ? 's' : ''}
                      </span>
                      {acheteur.nombreHectares > 0 && (
                        <span className="text-xs px-2 py-1 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          {acheteur.nombreHectares} hectare{acheteur.nombreHectares > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {acheteur.buyer_phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          <span>{acheteur.buyer_phone}</span>
                        </div>
                      )}

                      {acheteur.buyer_email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span>{acheteur.buyer_email}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-semibold text-foreground">
                          {acheteur.totalAchat.toLocaleString()} USD
                        </span>
                        <span>de valeur totale</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedAcheteur(acheteur);
                      setEditBuyerForm({
                        buyer_name: acheteur.buyer_name,
                        buyer_phone: acheteur.buyer_phone || "",
                        buyer_email: acheteur.buyer_email || "",
                      });
                      setShowEditBuyerDialog(true);
                    }}
                  >
                    Modifier
                  </Button>
                  <Button onClick={() => handleShowDetails(acheteur)}>
                    Voir Détails
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredAcheteurs.length === 0 && (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucun acheteur trouvé
            </h3>
            <p className="text-muted-foreground">
              Aucun acheteur ne correspond à votre recherche
            </p>
          </div>
        )}

        {/* Dialog Détails Acheteur */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-xl flex items-center gap-2">
                <User className="w-6 h-6" />
                Détails de l'acheteur - {selectedAcheteur?.buyer_name}
              </DialogTitle>
            </DialogHeader>

            {selectedAcheteur && (
              <div className="space-y-6 pt-4">
                {/* Informations de contact */}
                <Card className="p-5 bg-muted/50">
                  <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Phone className="w-5 h-5 text-primary" />
                    Informations de contact
                  </h4>
                  <div className="space-y-3">
                    {selectedAcheteur.buyer_phone && (
                      <div className="flex items-center gap-3 text-sm p-2 bg-background rounded">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{selectedAcheteur.buyer_phone}</span>
                      </div>
                    )}
                    {selectedAcheteur.buyer_email && (
                      <div className="flex items-center gap-3 text-sm p-2 bg-background rounded">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{selectedAcheteur.buyer_email}</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Résumé des achats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-5 bg-gradient-to-br from-primary/10 to-primary/5">
                    <div className="flex items-center gap-3 mb-2">
                      <MapPin className="w-5 h-5 text-primary" />
                      <p className="text-sm text-muted-foreground">Total achats</p>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      {selectedAcheteur.nombreParcelles + selectedAcheteur.nombreHectares}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedAcheteur.nombreParcelles} parcelle{selectedAcheteur.nombreParcelles > 1 ? 's' : ''} + {selectedAcheteur.nombreHectares} hectare{selectedAcheteur.nombreHectares > 1 ? 's' : ''}
                    </p>
                  </Card>
                  <Card className="p-5 bg-gradient-to-br from-green-500/10 to-green-500/5">
                    <div className="flex items-center gap-3 mb-2">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      <p className="text-sm text-muted-foreground">Valeur totale</p>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      {selectedAcheteur.totalAchat.toLocaleString()} USD
                    </p>
                  </Card>
                </div>

                {/* Liste des achats (hectares + parcelles) */}
                <div>
                  <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Achats effectués
                  </h4>
                  <div className="space-y-3">
                    {/* Afficher les hectares */}
                    {selectedAcheteur.hectares.map((hectare) => (
                      <Card key={hectare.id} className="p-5 hover:shadow-md transition-shadow bg-gradient-to-br from-blue-500/5 to-transparent border-l-4 border-l-blue-500">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h5 className="font-semibold text-foreground text-lg">
                                  Hectare {hectare.name}
                                </h5>
                                <Badge variant="default" className="text-xs">
                                  {hectare.purchase_type || 'hectare'}
                                </Badge>
                                {hectare.sale_type === "onereux" && (
                                  <Badge variant="secondary" className="text-xs">
                                    À titre onéreux
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 p-3 rounded-lg">
                            <div className="flex flex-col">
                              <span className="text-muted-foreground text-xs mb-1">Surface</span>
                              <span className="font-semibold">{hectare.surface} ha</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground text-xs mb-1">Prix</span>
                              <span className="font-semibold">
                                {hectare.prix.toLocaleString()} USD
                              </span>
                            </div>
                            {hectare.payment_type === "partiel" && (
                              <>
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground text-xs mb-1">Payé</span>
                                  <span className="font-semibold text-green-600">
                                    {hectare.amount_paid.toLocaleString()} USD
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground text-xs mb-1">Restant</span>
                                  <span className="font-semibold text-orange-600">
                                    {hectare.remaining_amount.toLocaleString()} USD
                                  </span>
                                </div>
                              </>
                            )}
                          </div>

                          {(hectare.sale_date || hectare.location) && (
                            <div className="flex flex-col gap-2 text-sm pt-2 border-t border-border">
                              {hectare.sale_date && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {new Date(hectare.sale_date).toLocaleDateString('fr-FR', { 
                                      year: 'numeric', 
                                      month: 'long', 
                                      day: 'numeric' 
                                    })}
                                  </span>
                                </div>
                              )}
                              {hectare.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">{hectare.location}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                    
                    {/* Afficher les parcelles */}
                    {selectedAcheteur.parcelles.map((parcelle) => (
                      <Card key={parcelle.id} className="p-5 hover:shadow-md transition-shadow bg-gradient-to-br from-green-500/5 to-transparent border-l-4 border-l-green-500">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <h5 className="font-semibold text-foreground text-lg">
                                  Parcelle {parcelle.numero}
                                </h5>
                                {parcelle.purchase_type && (
                                  <Badge variant="outline" className="text-xs">
                                    {parcelle.purchase_type}
                                  </Badge>
                                )}
                                {parcelle.sale_type === "onereux" && (
                                  <Badge variant="secondary" className="text-xs">
                                    À titre onéreux
                                  </Badge>
                                )}
                              </div>
                              {parcelle.hectares?.name && (
                                <p className="text-xs text-muted-foreground">
                                  Hectare {parcelle.hectares.name}
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLocaliser(parcelle.id)}
                            >
                              <MapPin className="w-4 h-4 mr-1" />
                              Localiser
                            </Button>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-sm bg-muted/50 p-3 rounded-lg">
                            <div className="flex flex-col">
                              <span className="text-muted-foreground text-xs mb-1">Surface</span>
                              <span className="font-semibold">{parcelle.surface} m²</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground text-xs mb-1">Prix</span>
                              <span className="font-semibold">
                                {parcelle.prix.toLocaleString()} USD
                              </span>
                            </div>
                            {parcelle.payment_type === "partiel" && (
                              <>
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground text-xs mb-1">Payé</span>
                                  <span className="font-semibold text-green-600">
                                    {parcelle.amount_paid.toLocaleString()} USD
                                  </span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-muted-foreground text-xs mb-1">Restant</span>
                                  <span className="font-semibold text-orange-600">
                                    {parcelle.remaining_amount.toLocaleString()} USD
                                  </span>
                                </div>
                              </>
                            )}
                          </div>

                          {(parcelle.sale_date || parcelle.hectares?.location) && (
                            <div className="flex flex-col gap-2 text-sm pt-2 border-t border-border">
                              {parcelle.sale_date && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {new Date(parcelle.sale_date).toLocaleDateString('fr-FR', { 
                                      year: 'numeric', 
                                      month: 'long', 
                                      day: 'numeric' 
                                    })}
                                  </span>
                                </div>
                              )}
                              {parcelle.hectares?.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {parcelle.hectares.location}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog Modifier Acheteur */}
        <Dialog open={showEditBuyerDialog} onOpenChange={setShowEditBuyerDialog}>
          <DialogContent className="max-w-md bg-card">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-xl">Modifier l'acheteur</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEditBuyer} className="space-y-4 pt-4">
              <div>
                <Label className="text-sm font-medium">Nom complet *</Label>
                <Input
                  value={editBuyerForm.buyer_name}
                  onChange={(e) => setEditBuyerForm({ ...editBuyerForm, buyer_name: e.target.value })}
                  placeholder="Nom complet"
                  className="mt-1.5 bg-background"
                  required
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Téléphone</Label>
                <Input
                  value={editBuyerForm.buyer_phone}
                  onChange={(e) => setEditBuyerForm({ ...editBuyerForm, buyer_phone: e.target.value })}
                  placeholder="Numéro de téléphone"
                  className="mt-1.5 bg-background"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Email</Label>
                <Input
                  type="email"
                  value={editBuyerForm.buyer_email}
                  onChange={(e) => setEditBuyerForm({ ...editBuyerForm, buyer_email: e.target.value })}
                  placeholder="Adresse email"
                  className="mt-1.5 bg-background"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowEditBuyerDialog(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" className="flex-1">
                  Enregistrer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog Nouvel Acheteur */}
        <Dialog open={showNewBuyerDialog} onOpenChange={setShowNewBuyerDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-xl">Enregistrer un nouvel acheteur</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleNewBuyerSubmit} className="space-y-6 pt-4">
              <Accordion type="multiple" defaultValue={["acheteur", "achat", "paiement"]} className="space-y-2">
                {/* Section 1: Informations acheteur */}
                <AccordionItem value="acheteur" className="border rounded-lg bg-muted/30 px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-2 text-base font-semibold">
                      <User className="w-5 h-5 text-primary" />
                      Informations de l'acheteur
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Nom *</Label>
                          <Input
                            value={newBuyerForm.nom}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, nom: e.target.value })}
                            placeholder="Nom"
                            className="mt-1.5 bg-background"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Post Nom *</Label>
                          <Input
                            value={newBuyerForm.post_nom}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, post_nom: e.target.value })}
                            placeholder="Post Nom"
                            className="mt-1.5 bg-background"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Prénom *</Label>
                          <Input
                            value={newBuyerForm.prenom}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, prenom: e.target.value })}
                            placeholder="Prénom"
                            className="mt-1.5 bg-background"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Téléphone</Label>
                          <Input
                            value={newBuyerForm.buyer_phone}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, buyer_phone: e.target.value })}
                            placeholder="+243 XXX XXX XXX"
                            className="mt-1.5 bg-background"
                          />
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium">Email</Label>
                          <Input
                            type="email"
                            value={newBuyerForm.buyer_email}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, buyer_email: e.target.value })}
                            placeholder="email@example.com"
                            className="mt-1.5 bg-background"
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 2: Détails de l'achat */}
                <AccordionItem value="achat" className="border rounded-lg bg-muted/30 px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-2 text-base font-semibold">
                      <MapPin className="w-5 h-5 text-primary" />
                      Détails de l'achat
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Type d'item *</Label>
                        <Select
                          value={newBuyerForm.item_type}
                          onValueChange={(value: "hectare" | "parcelle") => 
                            setNewBuyerForm({ ...newBuyerForm, item_type: value, selected_item: "" })
                          }
                        >
                          <SelectTrigger className="mt-1.5 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100]">
                            <SelectItem value="hectare">Hectare</SelectItem>
                            <SelectItem value="parcelle">Parcelle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sélection de l'hectare ou parcelle */}
                      <div>
                        <Label className="text-sm font-medium">
                          {newBuyerForm.item_type === "hectare" ? "Sélectionner un hectare *" : "Sélectionner une parcelle *"}
                        </Label>
                        <Select
                          value={newBuyerForm.selected_item}
                          onValueChange={(value) => setNewBuyerForm({ ...newBuyerForm, selected_item: value })}
                        >
                          <SelectTrigger className="mt-1.5 bg-background">
                            <SelectValue placeholder={`Choisir ${newBuyerForm.item_type === "hectare" ? "un hectare" : "une parcelle"}`} />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100] max-h-[300px]">
                            {newBuyerForm.item_type === "hectare" ? (
                              availableHectares.length > 0 ? (
                                availableHectares.map((h) => (
                                  <SelectItem key={h.id} value={h.id}>
                                    {h.name} - {h.surface} ha - ${h.prix.toLocaleString()}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>Aucun hectare disponible</SelectItem>
                              )
                            ) : (
                              availableParcelles.length > 0 ? (
                                availableParcelles.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    Parcelle {p.numero} - {p.surface} m² - ${p.prix.toLocaleString()}
                                    {p.hectares && ` (${p.hectares.name})`}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>Aucune parcelle disponible</SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Type d'achat (hectare/demi-hectare/parcelle) */}
                      <div>
                        <Label className="text-sm font-medium">Type d'achat</Label>
                        <Select
                          value={newBuyerForm.purchase_type}
                          onValueChange={(value) => setNewBuyerForm({ ...newBuyerForm, purchase_type: value })}
                        >
                          <SelectTrigger className="mt-1.5 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100]">
                            <SelectItem value="hectare">Hectare complet</SelectItem>
                            <SelectItem value="demi-hectare">Demi-hectare</SelectItem>
                            <SelectItem value="parcelle">Parcelle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Type de vente</Label>
                        <Select
                          value={newBuyerForm.sale_type}
                          onValueChange={(value) => setNewBuyerForm({ ...newBuyerForm, sale_type: value })}
                        >
                          <SelectTrigger className="mt-1.5 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100]">
                            <SelectItem value="normal">Vente normale</SelectItem>
                            <SelectItem value="onereux">À titre onéreux</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Numéro RMB</Label>
                          <Input
                            value={newBuyerForm.rmb_number}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, rmb_number: e.target.value })}
                            placeholder="ex: RMB-001"
                            className="mt-1.5 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Montant d'achat (USD) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newBuyerForm.prix}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, prix: e.target.value })}
                            placeholder="Montant en USD"
                            className="mt-1.5 bg-background"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 3: Paiement */}
                <AccordionItem value="paiement" className="border rounded-lg bg-muted/30 px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-2 text-base font-semibold">
                      <DollarSign className="w-5 h-5 text-primary" />
                      Paiement
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Type de paiement *</Label>
                        <Select
                          value={newBuyerForm.payment_type}
                          onValueChange={(value) => setNewBuyerForm({ ...newBuyerForm, payment_type: value })}
                        >
                          <SelectTrigger className="mt-1.5 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100]">
                            <SelectItem value="total">Paiement total</SelectItem>
                            <SelectItem value="partiel">Paiement partiel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {newBuyerForm.payment_type === "partiel" && (
                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-3">
                          <Label className="text-sm font-medium">Montant de l'acompte *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={newBuyerForm.amount_paid}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, amount_paid: e.target.value })}
                            placeholder="Montant payé en USD"
                            className="bg-background"
                            required
                          />
                          <p className="text-xs text-muted-foreground flex items-start gap-2">
                            <span className="text-amber-600">ℹ️</span>
                            Le montant restant sera calculé automatiquement
                          </p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowNewBuyerDialog(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" className="flex-1">
                  <User className="w-4 h-4 mr-2" />
                  Enregistrer l'acheteur
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Acheteurs;
