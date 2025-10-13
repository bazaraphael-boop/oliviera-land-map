import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, User, MapPin, Phone, Mail, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
    hectares?: {
      name: string;
      location: string;
    };
  }[];
  totalAchat: number;
  nombreParcelles: number;
}

const Acheteurs = () => {
  const navigate = useNavigate();
  const [acheteurs, setAcheteurs] = useState<Acheteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAcheteur, setSelectedAcheteur] = useState<Acheteur | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkAuth();
    loadAcheteurs();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };

  const loadAcheteurs = async () => {
    try {
      // Récupérer toutes les parcelles vendues avec les infos des acheteurs
      const { data: parcelles, error } = await supabase
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

      if (error) throw error;

      // Regrouper par acheteur
      const acheteursMap = new Map<string, Acheteur>();

      parcelles?.forEach((parcelle) => {
        const buyerKey = parcelle.buyer_name.toLowerCase().trim();
        
        if (!acheteursMap.has(buyerKey)) {
          acheteursMap.set(buyerKey, {
            id: buyerKey,
            buyer_name: parcelle.buyer_name,
            buyer_phone: parcelle.buyer_phone,
            buyer_email: parcelle.buyer_email,
            parcelles: [],
            totalAchat: 0,
            nombreParcelles: 0,
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
          hectares: parcelle.hectares,
        });
        acheteur.totalAchat += Number(parcelle.prix);
        acheteur.nombreParcelles += 1;

        // Mettre à jour les infos de contact si elles sont plus récentes
        if (parcelle.buyer_phone && !acheteur.buyer_phone) {
          acheteur.buyer_phone = parcelle.buyer_phone;
        }
        if (parcelle.buyer_email && !acheteur.buyer_email) {
          acheteur.buyer_email = parcelle.buyer_email;
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

  const handleLocaliser = (parcelleId: string) => {
    // Rediriger vers la page de localisation avec l'ID de la parcelle
    navigate(`/localisation?parcelle=${parcelleId}`);
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

          <Button onClick={() => navigate("/parcelles")}>
            Nouveau Acheteur
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
                      <h3 className="text-lg font-semibold text-foreground">
                        {acheteur.buyer_name}
                      </h3>
                      <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-500 border border-green-500/20">
                        {acheteur.nombreParcelles} parcelle{acheteur.nombreParcelles > 1 ? 's' : ''}
                      </span>
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

                <Button onClick={() => handleShowDetails(acheteur)}>
                  Voir Détails
                </Button>
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
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Détails de l'acheteur - {selectedAcheteur?.buyer_name}
              </DialogTitle>
            </DialogHeader>

            {selectedAcheteur && (
              <div className="space-y-6">
                {/* Informations de contact */}
                <Card className="p-4">
                  <h4 className="font-semibold text-foreground mb-3">
                    Informations de contact
                  </h4>
                  <div className="space-y-2">
                    {selectedAcheteur.buyer_phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedAcheteur.buyer_phone}</span>
                      </div>
                    )}
                    {selectedAcheteur.buyer_email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedAcheteur.buyer_email}</span>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Résumé des achats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground mb-1">
                      Nombre de parcelles
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {selectedAcheteur.nombreParcelles}
                    </p>
                  </Card>
                  <Card className="p-4">
                    <p className="text-sm text-muted-foreground mb-1">
                      Valeur totale
                    </p>
                    <p className="text-2xl font-bold text-foreground">
                      {selectedAcheteur.totalAchat.toLocaleString()} USD
                    </p>
                  </Card>
                </div>

                {/* Liste des parcelles */}
                <div>
                  <h4 className="font-semibold text-foreground mb-3">
                    Parcelles achetées
                  </h4>
                  <div className="space-y-3">
                    {selectedAcheteur.parcelles.map((parcelle) => (
                      <Card key={parcelle.id} className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold text-foreground">
                                Parcelle {parcelle.numero}
                              </h5>
                              <span className="text-xs text-muted-foreground">
                                {parcelle.hectares?.name}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Surface: </span>
                                <span className="font-medium">{parcelle.surface} m²</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Prix: </span>
                                <span className="font-medium">
                                  {parcelle.prix.toLocaleString()} USD
                                </span>
                              </div>
                              {parcelle.sale_date && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Date: </span>
                                  <span className="font-medium">
                                    {new Date(parcelle.sale_date).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                              {parcelle.hectares?.location && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Localisation: </span>
                                  <span className="font-medium">
                                    {parcelle.hectares.location}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLocaliser(parcelle.id)}
                          >
                            <MapPin className="w-4 h-4 mr-2" />
                            Localiser
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Acheteurs;
