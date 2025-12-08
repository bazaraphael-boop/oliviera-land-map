import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  User, MapPin, Phone, Mail, Calendar, DollarSign, 
  Briefcase, Heart, Baby, Home, Globe, ChevronRight 
} from "lucide-react";
import { BuyerDocuments } from "@/components/BuyerDocuments";

interface Acheteur {
  id: string;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  buyer_last_name: string | null;
  buyer_first_name: string | null;
  buyer_profession: string | null;
  buyer_birth_place: string | null;
  buyer_birth_date: string | null;
  buyer_marital_status: string | null;
  buyer_children_count: number | null;
  buyer_address: string | null;
  buyer_village_origin: string | null;
  buyer_groupement: string | null;
  buyer_secteur: string | null;
  buyer_territoire: string | null;
  buyer_province: string | null;
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

interface BuyerDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acheteur: Acheteur | null;
  onLocaliser: (parcelleId: string) => void;
}

function InfoItem({ icon: Icon, label, value, className = "" }: { 
  icon?: any; 
  label: string; 
  value: string | number | null | undefined;
  className?: string;
}) {
  const displayValue = value !== null && value !== undefined && value !== '' 
    ? value 
    : null;
  
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      {Icon && <Icon className="w-4 h-4 text-primary/60 mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">
          {displayValue || <span className="italic text-muted-foreground font-normal">Non renseigné</span>}
        </p>
      </div>
    </div>
  );
}

export function BuyerDetailsDialog({ open, onOpenChange, acheteur, onLocaliser }: BuyerDetailsDialogProps) {
  if (!acheteur) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card p-0">
        {/* Header with gradient */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border">
          <DialogHeader className="p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-sm">
                <User className="w-7 h-7 sm:w-8 sm:h-8 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground">
                  {acheteur.buyer_name}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Fiche complète de l'acheteur
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Card className="p-4 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-bold text-foreground">
                    {acheteur.nombreParcelles + acheteur.nombreHectares}
                  </p>
                  <p className="text-xs text-muted-foreground">Acquisitions</p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-bold text-foreground">
                    {acheteur.totalAchat.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">USD Total</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Identification Card */}
          <Card className="overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b border-border">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Fiche d'identification
              </h4>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Identité */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identité</p>
                <InfoItem 
                  label="Nom complet" 
                  value={acheteur.buyer_name} 
                />
                <InfoItem 
                  icon={Briefcase}
                  label="Profession" 
                  value={acheteur.buyer_profession} 
                />
              </div>

              {/* Naissance */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Naissance</p>
                <InfoItem 
                  icon={MapPin}
                  label="Lieu de naissance" 
                  value={acheteur.buyer_birth_place} 
                />
                <InfoItem 
                  icon={Calendar}
                  label="Date de naissance" 
                  value={acheteur.buyer_birth_date 
                    ? new Date(acheteur.buyer_birth_date).toLocaleDateString('fr-FR') 
                    : null
                  } 
                />
              </div>

              {/* État civil */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">État civil</p>
                <InfoItem 
                  icon={Heart}
                  label="Situation" 
                  value={acheteur.buyer_marital_status} 
                />
                <InfoItem 
                  icon={Baby}
                  label="Nombre d'enfants" 
                  value={acheteur.buyer_children_count} 
                />
              </div>

              {/* Contact */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</p>
                <InfoItem 
                  icon={Home}
                  label="Adresse" 
                  value={acheteur.buyer_address} 
                />
                <InfoItem 
                  icon={Phone}
                  label="Téléphone" 
                  value={acheteur.buyer_phone} 
                />
                <InfoItem 
                  icon={Mail}
                  label="Email" 
                  value={acheteur.buyer_email} 
                />
              </div>

              {/* Origine */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg sm:col-span-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Origine
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <InfoItem label="Village" value={acheteur.buyer_village_origin} />
                  <InfoItem label="Groupement" value={acheteur.buyer_groupement} />
                  <InfoItem label="Secteur" value={acheteur.buyer_secteur} />
                  <InfoItem label="Territoire" value={acheteur.buyer_territoire} />
                  <InfoItem label="Province" value={acheteur.buyer_province} />
                </div>
              </div>
            </div>
          </Card>

          {/* Purchases List */}
          <Card className="overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b border-border">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Achats effectués
              </h4>
            </div>
            <div className="p-4 space-y-3">
              {/* Hectares */}
              {acheteur.hectares.map((hectare) => (
                <div 
                  key={hectare.id} 
                  className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-semibold text-foreground">
                            Hectare {hectare.name}
                          </h5>
                          {hectare.rmb_number && (
                            <Badge variant="outline" className="text-xs">
                              RMB {hectare.rmb_number}
                            </Badge>
                          )}
                          {hectare.sale_type === "onereux" && (
                            <Badge variant="secondary" className="text-xs">
                              À titre onéreux
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {hectare.surface} ha • {hectare.prix.toLocaleString()} USD
                          {hectare.payment_type === "partiel" && (
                            <span className="text-orange-600 ml-2">
                              (Reste: {hectare.remaining_amount.toLocaleString()} USD)
                            </span>
                          )}
                        </p>
                        {hectare.sale_date && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(hectare.sale_date).toLocaleDateString('fr-FR', { 
                              year: 'numeric', month: 'long', day: 'numeric' 
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Parcelles */}
              {acheteur.parcelles.map((parcelle) => (
                <div 
                  key={parcelle.id} 
                  className="p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-semibold text-foreground">
                            Parcelle {parcelle.numero}
                          </h5>
                          {parcelle.rmb_number && (
                            <Badge variant="outline" className="text-xs">
                              RMB {parcelle.rmb_number}
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
                        <p className="text-sm text-muted-foreground mt-1">
                          {parcelle.surface} m² • {parcelle.prix.toLocaleString()} USD
                          {parcelle.payment_type === "partiel" && (
                            <span className="text-orange-600 ml-2">
                              (Reste: {parcelle.remaining_amount.toLocaleString()} USD)
                            </span>
                          )}
                        </p>
                        {parcelle.sale_date && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(parcelle.sale_date).toLocaleDateString('fr-FR', { 
                              year: 'numeric', month: 'long', day: 'numeric' 
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onLocaliser(parcelle.id)}
                      className="self-start sm:self-center"
                    >
                      <MapPin className="w-4 h-4 mr-1" />
                      Localiser
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}

              {acheteur.parcelles.length === 0 && acheteur.hectares.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun achat enregistré
                </p>
              )}
            </div>
          </Card>

          {/* Documents Section */}
          <Card className="overflow-hidden">
            <BuyerDocuments 
              buyerId={acheteur.id}
              buyerName={acheteur.buyer_name}
            />
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
