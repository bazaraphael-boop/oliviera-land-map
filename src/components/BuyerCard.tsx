import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Phone, Mail, DollarSign, Pin, ChevronRight, FileText, MapPin } from "lucide-react";

interface Acheteur {
  id: string;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  parcelles: {
    id: string;
    rmb_number: string | null;
  }[];
  hectares: {
    id: string;
    rmb_number: string | null;
  }[];
  totalAchat: number;
  nombreParcelles: number;
  nombreHectares: number;
  paper_form_completed: boolean;
}

interface BuyerCardProps {
  acheteur: Acheteur;
  onShowDetails: () => void;
  onEdit: () => void;
  onTogglePaperForm: () => void;
}

export function BuyerCard({ acheteur, onShowDetails, onEdit, onTogglePaperForm }: BuyerCardProps) {
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

  return (
    <Card 
      className={`group overflow-hidden transition-all duration-300 hover:shadow-lg ${
        !acheteur.paper_form_completed 
          ? 'border-l-4 border-l-orange-500 bg-gradient-to-r from-orange-500/5 to-transparent' 
          : 'hover:border-primary/30'
      }`}
    >
      <div className="p-4 sm:p-5">
        {/* Header Mobile-first */}
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Avatar & Pin indicator */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-sm">
              <User className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
            </div>
            {!acheteur.paper_form_completed && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shadow-sm">
                <Pin className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* RMB Badge */}
            {rmbList.length > 0 && (
              <div className="mb-1.5">
                <Badge variant="outline" className="text-xs font-semibold bg-primary/5 border-primary/20 text-primary">
                  <FileText className="w-3 h-3 mr-1" />
                  RMB {rmbList.join(', ')}
                </Badge>
              </div>
            )}

            {/* Name */}
            <h3 className="text-base sm:text-lg font-semibold text-foreground truncate mb-2">
              {acheteur.buyer_name}
            </h3>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {acheteur.nombreParcelles > 0 && (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20 text-xs font-medium">
                  <MapPin className="w-3 h-3 mr-1" />
                  {acheteur.nombreParcelles} parcelle{acheteur.nombreParcelles > 1 ? 's' : ''}
                </Badge>
              )}
              {acheteur.nombreHectares > 0 && (
                <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20 text-xs font-medium">
                  <MapPin className="w-3 h-3 mr-1" />
                  {acheteur.nombreHectares} hectare{acheteur.nombreHectares > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Contact Info - Compact on mobile */}
            <div className="space-y-1.5 text-sm">
              {acheteur.buyer_phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 text-primary/60" />
                  <span className="truncate">{acheteur.buyer_phone}</span>
                </div>
              )}
              {acheteur.buyer_email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 text-primary/60" />
                  <span className="truncate">{acheteur.buyer_email}</span>
                </div>
              )}
            </div>
          </div>

          {/* Amount - Desktop only inline */}
          <div className="hidden sm:flex flex-col items-end gap-2">
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">
                {acheteur.totalAchat.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">USD</span>
              </p>
              <p className="text-xs text-muted-foreground">Valeur totale</p>
            </div>
          </div>
        </div>

        {/* Amount - Mobile */}
        <div className="sm:hidden mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Valeur totale</span>
            </div>
            <p className="text-base font-bold text-foreground">
              {acheteur.totalAchat.toLocaleString()} USD
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-border/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Paper form checkbox */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePaperForm();
            }}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
          >
            <Checkbox 
              checked={acheteur.paper_form_completed}
              className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
            />
            <span className={`text-sm font-medium ${
              acheteur.paper_form_completed 
                ? 'text-emerald-600' 
                : 'text-orange-600'
            }`}>
              {acheteur.paper_form_completed ? 'Formulaire rempli' : 'À remplir sur papier'}
            </span>
          </button>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={onEdit}
              className="flex-1 sm:flex-none"
            >
              Modifier
            </Button>
            <Button 
              size="sm"
              onClick={onShowDetails}
              className="flex-1 sm:flex-none group/btn"
            >
              Détails
              <ChevronRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-0.5 transition-transform" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
