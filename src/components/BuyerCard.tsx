import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Phone, Mail, MapPin, Edit2, ChevronRight, Pin, FileText, DollarSign } from "lucide-react";

interface Acheteur {
  id: string;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  parcelles: any[];
  hectares: any[];
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
  const isPinned = !acheteur.paper_form_completed;
  const rmbNumber = acheteur.parcelles[0]?.rmb_number || acheteur.hectares[0]?.rmb_number;
  
  return (
    <Card className={`relative overflow-hidden transition-all duration-200 ${isPinned ? 'border-orange-500/50 bg-gradient-to-r from-orange-500/5 via-card to-card shadow-sm' : 'bg-card hover:shadow-md'}`}>
      {isPinned && <div className="absolute top-0 left-0 w-1 h-full bg-orange-500" />}
      <div className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl shrink-0 flex items-center justify-center ${isPinned ? 'bg-orange-500/20' : 'bg-gradient-to-br from-primary/20 to-primary/5'}`}>
              {isPinned ? <Pin className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" /> : <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-foreground text-sm sm:text-base truncate flex-1">{acheteur.buyer_name}</h3>
                {rmbNumber && <Badge variant="outline" className="shrink-0 text-[10px] sm:text-xs">RMB {rmbNumber}</Badge>}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1">
                {acheteur.buyer_phone && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="w-3 h-3 shrink-0" /><span className="truncate">{acheteur.buyer_phone}</span></span>}
                {acheteur.buyer_email && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3 shrink-0" /><span className="truncate">{acheteur.buyer_email}</span></span>}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pl-0 sm:pl-[52px]">
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto sm:overflow-visible flex-nowrap sm:flex-wrap -mx-1 px-1">
              {acheteur.nombreParcelles > 0 && (
                <Badge variant="secondary" className="shrink-0 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                  <MapPin className="w-3 h-3 mr-0.5 sm:mr-1" />
                  {acheteur.nombreParcelles} parc.
                </Badge>
              )}
              {acheteur.nombreHectares > 0 && (
                <Badge className="shrink-0 bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                  <MapPin className="w-3 h-3 mr-0.5 sm:mr-1" />
                  {acheteur.nombreHectares} ha
                </Badge>
              )}
              <Badge variant="outline" className="shrink-0 text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5">
                <DollarSign className="w-3 h-3 mr-0.5" />
                {acheteur.totalAchat.toLocaleString()}
              </Badge>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="flex items-center gap-1 cursor-pointer p-1 rounded hover:bg-muted/50" onClick={(e) => { e.stopPropagation(); onTogglePaperForm(); }}>
                <Checkbox checked={acheteur.paper_form_completed} className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <FileText className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${acheteur.paper_form_completed ? 'text-emerald-500' : 'text-orange-500'}`} />
              </div>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="h-7 w-7 sm:h-8 sm:w-8 p-0"><Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
              <Button variant="outline" size="sm" onClick={onShowDetails} className="h-7 sm:h-8 px-2 sm:px-3 text-xs"><span className="hidden sm:inline">Détails</span><span className="sm:hidden">Voir</span><ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5 sm:ml-1" /></Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}