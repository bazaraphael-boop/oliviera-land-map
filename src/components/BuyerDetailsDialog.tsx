import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  User, MapPin, Phone, Mail, Calendar, DollarSign, 
  Briefcase, Heart, Baby, Home, Globe, ChevronRight, 
  ChevronDown, FileText, FolderOpen, Pencil
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
  onEditIdentification?: (acheteur: Acheteur) => void;
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

interface CollapsibleSectionProps {
  title: string;
  icon: any;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string;
  onEdit?: () => void;
}

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children, badge, onEdit }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between bg-muted/50 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border">
          <CollapsibleTrigger className="flex-1 flex items-center justify-between hover:bg-muted/70 transition-colors -mx-3 sm:-mx-4 -my-2.5 sm:-my-3 px-3 sm:px-4 py-2.5 sm:py-3">
            <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm sm:text-base">
              <Icon className="w-4 h-4 text-primary" />
              {title}
              {badge && <Badge variant="secondary" className="ml-2 text-xs">{badge}</Badge>}
            </h4>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="ml-2 h-7 px-2 shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
        <CollapsibleContent>
          <div className="p-3 sm:p-4">
            {children}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function BuyerDetailsDialog({ open, onOpenChange, acheteur, onEditIdentification }: BuyerDetailsDialogProps) {
  if (!acheteur) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl h-[90vh] flex flex-col bg-card p-0 sm:w-full">
        {/* Header fixe */}
        <div className="shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border">
          <DialogHeader className="p-3 sm:p-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-sm shrink-0">
                <User className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg sm:text-xl font-bold text-foreground truncate">
                  {acheteur.buyer_name}
                </DialogTitle>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Fiche complète de l'acheteur
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Contenu scrollable */}
        <ScrollArea className="flex-1 px-3 sm:px-4">
          <div className="py-4 space-y-3 sm:space-y-4">
            {/* Stats Summary - toujours visible */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <Card className="p-2.5 sm:p-3 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg sm:text-2xl font-bold text-foreground">
                      {acheteur.nombreParcelles + acheteur.nombreHectares}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Acquisitions</p>
                  </div>
                </div>
              </Card>
              <Card className="p-2.5 sm:p-3 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-base sm:text-xl font-bold text-foreground truncate">
                      {acheteur.totalAchat.toLocaleString()}
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">USD Total</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Section Identification - collapsible */}
            <CollapsibleSection 
              title="Fiche d'identification" 
              icon={User} 
              defaultOpen={false}
              onEdit={onEditIdentification ? () => onEditIdentification(acheteur) : undefined}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Identité */}
                <div className="space-y-2 p-2.5 bg-muted/30 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identité</p>
                  <InfoItem label="Nom complet" value={acheteur.buyer_name} />
                  <InfoItem icon={Briefcase} label="Profession" value={acheteur.buyer_profession} />
                </div>

                {/* Naissance */}
                <div className="space-y-2 p-2.5 bg-muted/30 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Naissance</p>
                  <InfoItem icon={MapPin} label="Lieu" value={acheteur.buyer_birth_place} />
                  <InfoItem 
                    icon={Calendar}
                    label="Date" 
                    value={acheteur.buyer_birth_date 
                      ? new Date(acheteur.buyer_birth_date).toLocaleDateString('fr-FR') 
                      : null
                    } 
                  />
                </div>

                {/* État civil */}
                <div className="space-y-2 p-2.5 bg-muted/30 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">État civil</p>
                  <InfoItem icon={Heart} label="Situation" value={acheteur.buyer_marital_status} />
                  <InfoItem icon={Baby} label="Enfants" value={acheteur.buyer_children_count} />
                </div>

                {/* Contact */}
                <div className="space-y-2 p-2.5 bg-muted/30 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</p>
                  <InfoItem icon={Home} label="Adresse" value={acheteur.buyer_address} />
                  <InfoItem icon={Phone} label="Téléphone" value={acheteur.buyer_phone} />
                  <InfoItem icon={Mail} label="Email" value={acheteur.buyer_email} />
                </div>

                {/* Origine */}
                <div className="space-y-2 p-2.5 bg-muted/30 rounded-lg sm:col-span-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    Origine
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <InfoItem label="Village" value={acheteur.buyer_village_origin} />
                    <InfoItem label="Groupement" value={acheteur.buyer_groupement} />
                    <InfoItem label="Secteur" value={acheteur.buyer_secteur} />
                    <InfoItem label="Territoire" value={acheteur.buyer_territoire} />
                    <InfoItem label="Province" value={acheteur.buyer_province} />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Section Achats - collapsible */}
            <CollapsibleSection 
              title="Achats effectués" 
              icon={MapPin} 
              defaultOpen={true}
              badge={`${acheteur.nombreParcelles + acheteur.nombreHectares}`}
            >
              <div className="space-y-2">
                {/* Hectares */}
                {acheteur.hectares.map((hectare) => (
                  <div 
                    key={hectare.id} 
                    className="p-2.5 sm:p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20"
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="font-semibold text-foreground text-sm">
                                Hectare {hectare.name}
                              </h5>
                              {hectare.rmb_number && (
                                <Badge variant="outline" className="text-[10px]">
                                  RMB {hectare.rmb_number}
                                </Badge>
                              )}
                            </div>
                            {hectare.sale_type === "onereux" && (
                              <Badge variant="secondary" className="text-[10px] mt-1">
                                À titre gratuit
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {hectare.surface} ha • {hectare.prix.toLocaleString()} USD
                        </p>
                        {hectare.payment_type === "partiel" && (
                          <p className="text-[10px] text-orange-600">
                            Reste: {hectare.remaining_amount.toLocaleString()} USD
                          </p>
                        )}
                        {hectare.sale_date && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(hectare.sale_date).toLocaleDateString('fr-FR', { 
                              year: 'numeric', month: 'short', day: 'numeric' 
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Parcelles */}
                {acheteur.parcelles.map((parcelle) => (
                  <div 
                    key={parcelle.id} 
                    className="p-2.5 sm:p-3 rounded-lg bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20"
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="font-semibold text-foreground text-sm">
                                Parcelle {parcelle.numero}
                              </h5>
                              {parcelle.rmb_number && (
                                <Badge variant="outline" className="text-[10px]">
                                  RMB {parcelle.rmb_number}
                                </Badge>
                              )}
                            </div>
                            {parcelle.sale_type === "onereux" && (
                              <Badge variant="secondary" className="text-[10px] mt-1">
                                À titre gratuit
                              </Badge>
                            )}
                            {parcelle.hectares?.name && (
                              <p className="text-[10px] text-muted-foreground">
                                Hectare {parcelle.hectares.name}
                              </p>
                            )}
                          </div>

                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {parcelle.surface} m² • {parcelle.prix.toLocaleString()} USD
                        </p>
                        {parcelle.payment_type === "partiel" && (
                          <p className="text-[10px] text-orange-600">
                            Reste: {parcelle.remaining_amount.toLocaleString()} USD
                          </p>
                        )}
                        {parcelle.sale_date && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(parcelle.sale_date).toLocaleDateString('fr-FR', { 
                              year: 'numeric', month: 'short', day: 'numeric' 
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {acheteur.parcelles.length === 0 && acheteur.hectares.length === 0 && (
                  <p className="text-center text-muted-foreground py-6 text-sm">
                    Aucun achat enregistré
                  </p>
                )}
              </div>
            </CollapsibleSection>

            {/* Section Documents - collapsible */}
            <CollapsibleSection title="Documents" icon={FolderOpen} defaultOpen={false}>
              <BuyerDocuments 
                buyerId={acheteur.id}
                buyerName={acheteur.buyer_name}
              />
            </CollapsibleSection>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
