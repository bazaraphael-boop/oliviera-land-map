import React from "react";
import { UserCheck, Sparkles, Plus, CheckCircle2, X, Phone, Mail, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ExistingBuyer } from "@/hooks/useBuyerDetection";

interface BuyerQuotaSuggestionProps {
  matches: ExistingBuyer[];
  selectedBuyer: ExistingBuyer | null;
  onSelectBuyer: (buyer: ExistingBuyer) => void;
  onDetachBuyer: () => void;
  itemSurface?: number;
  itemLabel?: string;
  className?: string;
}

export const BuyerQuotaSuggestion: React.FC<BuyerQuotaSuggestionProps> = ({
  matches,
  selectedBuyer,
  onSelectBuyer,
  onDetachBuyer,
  itemSurface = 600,
  itemLabel = "cette parcelle",
  className = "",
}) => {
  const additionalQuota = Math.max(1, Math.ceil(itemSurface / 600));

  // 1. Si un acheteur existant a été sélectionné pour cumul de quota
  if (selectedBuyer) {
    const totalNewQuotas = selectedBuyer.quotas + additionalQuota;
    return (
      <div className={`p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1.5 animate-in fade-in ${className}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
              Rattaché au quota de {selectedBuyer.buyer_name}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDetachBuyer}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Détacher et traiter comme un nouvel acheteur distinct"
          >
            <X className="w-3 h-3 mr-1" />
            Détacher
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-300 pl-6">
          <Badge variant="outline" className="bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 border-emerald-500/40 text-[10px] font-semibold">
            Quota actuel : {selectedBuyer.quotas} → Nouveau : {totalNewQuotas} quotas ({selectedBuyer.totalSurface + itemSurface} m²)
          </Badge>
          {selectedBuyer.primaryRmb && (
            <span className="font-mono font-medium">
              📁 Dossier : {selectedBuyer.primaryRmb}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 2. Si des correspondances sont détectées
  if (matches.length === 0) return null;

  return (
    <div className={`space-y-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-in fade-in slide-in-from-top-1 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>
            {matches.length === 1
              ? "Acquéreur déjà enregistré détecté !"
              : `${matches.length} acquéreurs similaires détectés`}
          </span>
        </div>
        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
          Suggestion de cumul
        </span>
      </div>

      <div className="space-y-2">
        {matches.slice(0, 3).map((buyer) => {
          const totalAfter = buyer.quotas + additionalQuota;
          return (
            <div
              key={buyer.id}
              className="p-2.5 bg-card/80 border border-amber-500/20 rounded-lg space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <UserCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-foreground">
                      {buyer.buyer_name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 font-semibold"
                    >
                      {buyer.quotas} quota{buyer.quotas > 1 ? "s" : ""} déjà acquis ({buyer.totalSurface} m²)
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-1">
                    {buyer.primaryRmb && (
                      <span className="flex items-center gap-1 font-mono text-purple-700 dark:text-purple-300 font-medium">
                        <FolderOpen className="w-3 h-3 text-purple-600" />
                        {buyer.primaryRmb}
                      </span>
                    )}
                    {buyer.buyer_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {buyer.buyer_phone}
                      </span>
                    )}
                    {buyer.buyer_email && (
                      <span className="flex items-center gap-1 truncate max-w-[150px]">
                        <Mail className="w-3 h-3" />
                        {buyer.buyer_email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                className="w-full text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1.5"
                onClick={() => onSelectBuyer(buyer)}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  Ajouter {itemLabel} à son quota (Passera à {totalAfter} quotas)
                </span>
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
