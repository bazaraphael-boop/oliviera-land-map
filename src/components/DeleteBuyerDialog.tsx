import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { 
  Trash2, AlertTriangle, RefreshCw, CheckCircle2, 
  MapPin, Grid3x3, Map as MapIcon, Loader2, DollarSign
} from "lucide-react";

interface ParcelleItem {
  id: string;
  numero: string;
  rmb_number?: string | null;
  surface: number;
  prix?: number;
}

interface HectareItem {
  id: string;
  name: string;
  rmb_number?: string | null;
  surface: number;
  prix?: number;
}

interface AcheteurToDelete {
  id: string;
  buyer_name: string;
  buyer_phone?: string | null;
  buyer_email?: string | null;
  totalAchat: number;
  nombreParcelles: number;
  nombreHectares: number;
  parcelles: ParcelleItem[];
  hectares: HectareItem[];
}

interface DeleteBuyerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acheteur: AcheteurToDelete | null;
  onSuccess?: () => void;
}

export function DeleteBuyerDialog({
  open,
  onOpenChange,
  acheteur,
  onSuccess,
}: DeleteBuyerDialogProps) {
  const queryClient = useQueryClient();
  const [deleteMode, setDeleteMode] = useState<"free_lands" | "hard_delete">("free_lands");
  const [deleteDocuments, setDeleteDocuments] = useState<boolean>(true);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  if (!acheteur) return null;

  const parcelleIds = acheteur.parcelles.map((p) => p.id);
  const hectareIds = acheteur.hectares.map((h) => h.id);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);

      const clearedParcelFields = {
        status: "disponible",
        buyer_name: null,
        buyer_last_name: null,
        buyer_first_name: null,
        buyer_phone: null,
        buyer_email: null,
        buyer_profession: null,
        buyer_birth_place: null,
        buyer_birth_date: null,
        buyer_marital_status: null,
        buyer_children_count: null,
        buyer_address: null,
        buyer_village_origin: null,
        buyer_groupement: null,
        buyer_secteur: null,
        buyer_territoire: null,
        buyer_province: null,
        merged_group_id: null,
        rmb_number: null,
        prix: 0,
        amount_paid: 0,
        remaining_amount: 0,
        sale_date: null,
        sale_type: null,
        payment_type: "total",
        paper_form_completed: false,
      };

      const clearedHectareFields = {
        status: "available",
        buyer_name: null,
        buyer_last_name: null,
        buyer_first_name: null,
        buyer_phone: null,
        buyer_email: null,
        buyer_profession: null,
        buyer_birth_place: null,
        buyer_birth_date: null,
        buyer_marital_status: null,
        buyer_children_count: null,
        buyer_address: null,
        buyer_village_origin: null,
        buyer_groupement: null,
        buyer_secteur: null,
        buyer_territoire: null,
        buyer_province: null,
        rmb_number: null,
        prix: 0,
        amount_paid: 0,
        remaining_amount: 0,
        sale_date: null,
        sale_type: null,
        purchase_type: "hectare",
        payment_type: "total",
        paper_form_completed: false,
      };

      // 1. Suppression des documents associés si cochée ou si suppression définitive
      if (deleteDocuments || deleteMode === "hard_delete") {
        if (parcelleIds.length > 0) {
          const { error: docErr } = await supabase
            .from("documents")
            .delete()
            .in("parcelle_id", parcelleIds);
          if (docErr) console.warn("Erreur suppression documents parcelles:", docErr);
        }
        const { error: bDocErr } = await supabase
          .from("buyer_documents")
          .delete()
          .or(`buyer_id.eq.${acheteur.id},buyer_id.eq.${acheteur.buyer_name}`);
        if (bDocErr) console.warn("Erreur suppression buyer_documents:", bDocErr);
      }

      // 2. Traitement des parcelles
      if (parcelleIds.length > 0) {
        if (deleteMode === "hard_delete") {
          // Suppression définitive des lignes de parcelles
          const { error: pDeleteErr } = await supabase
            .from("parcelles")
            .delete()
            .in("id", parcelleIds);
          if (pDeleteErr) throw pDeleteErr;
        } else {
          // Libération des parcelles : repasse en disponible et efface les données de l'acquéreur
          const { error: pUpdateErr } = await supabase
            .from("parcelles")
            .update(clearedParcelFields)
            .in("id", parcelleIds);
          if (pUpdateErr) throw pUpdateErr;
        }
      }

      // 3. Traitement des hectares : on les libère pour préserver le plan d'ensemble (SANS merged_group_id)
      if (hectareIds.length > 0) {
        const { error: hUpdateErr } = await supabase
          .from("hectares")
          .update(clearedHectareFields)
          .in("id", hectareIds);
        if (hUpdateErr) throw hUpdateErr;
      }

      // 4. Invalidation complète de tous les caches React Query
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["acheteurs"] }),
        queryClient.invalidateQueries({ queryKey: ["parcelles"] }),
        queryClient.invalidateQueries({ queryKey: ["hectares"] }),
        queryClient.invalidateQueries({ queryKey: ["existing-buyers-detection"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-dialog-hectares"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-dialog-parcelles"] }),
      ]);

      toast.success(
        deleteMode === "free_lands"
          ? `L'acquéreur ${acheteur.buyer_name} a été supprimé et ses terrains ont été remis en statut disponible !`
          : `L'acquéreur ${acheteur.buyer_name} et ses parcelles ont été supprimés définitivement !`
      );

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Erreur lors de la suppression de l'acquéreur :", err);
      toast.error(err?.message || "Une erreur est survenue lors de la suppression");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border shadow-2xl p-5 sm:p-6">
        <DialogHeader className="space-y-2 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold text-foreground truncate">
                Supprimer le concessionnaire
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cette action supprimera le profil de l'acheteur de la liste officielle.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Fiche récapitulative de l'acquéreur */}
          <div className="p-3.5 rounded-xl border border-border bg-muted/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">{acheteur.buyer_name}</span>
              <Badge variant="outline" className="text-[11px] font-mono">
                {acheteur.totalAchat.toLocaleString()} USD
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {acheteur.parcelles.length > 0 && (
                <span className="flex items-center gap-1 bg-background px-2 py-1 rounded border border-border">
                  <Grid3x3 className="w-3.5 h-3.5 text-emerald-600" />
                  <strong>{acheteur.parcelles.length}</strong> parcelle{acheteur.parcelles.length > 1 ? "s" : ""}
                </span>
              )}
              {acheteur.hectares.length > 0 && (
                <span className="flex items-center gap-1 bg-background px-2 py-1 rounded border border-border">
                  <MapIcon className="w-3.5 h-3.5 text-blue-600" />
                  <strong>{acheteur.hectares.length}</strong> hectare{acheteur.hectares.length > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Liste rapide des RMB associés */}
            {(acheteur.parcelles.length > 0 || acheteur.hectares.length > 0) && (
              <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                <span>Numéros et RMB associés : </span>
                <span className="font-mono font-medium text-foreground">
                  {[
                    ...acheteur.parcelles.map((p) => p.rmb_number || p.numero),
                    ...acheteur.hectares.map((h) => h.rmb_number || h.name),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
            )}
          </div>

          {/* Choix du mode de suppression */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Que souhaitez-vous faire des terrains associés ?
            </Label>

            <RadioGroup
              value={deleteMode}
              onValueChange={(val: "free_lands" | "hard_delete") => setDeleteMode(val)}
              className="space-y-2 pt-1"
            >
              {/* Option 1 : Libérer les terrains */}
              <div
                onClick={() => setDeleteMode("free_lands")}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  deleteMode === "free_lands"
                    ? "border-emerald-500 bg-emerald-500/5 shadow-2xs"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <RadioGroupItem value="free_lands" id="free_lands" className="mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="free_lands" className="font-semibold text-xs text-foreground cursor-pointer">
                        Libérer les terrains (Remettre en disponible)
                      </Label>
                      <Badge className="bg-emerald-600 text-white text-[9px] py-0 h-4">
                        Recommandé
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      L'acquéreur est retiré de la liste. Ses parcelles et hectares redeviennent immédiatement 
                      <strong> disponibles</strong> et leurs numéros RMB sont libérés pour de futures inscriptions.
                    </p>
                  </div>
                </div>
              </div>

              {/* Option 2 : Suppression définitive */}
              <div
                onClick={() => setDeleteMode("hard_delete")}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  deleteMode === "hard_delete"
                    ? "border-destructive bg-destructive/5 shadow-2xs"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <RadioGroupItem value="hard_delete" id="hard_delete" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="hard_delete" className="font-semibold text-xs text-destructive cursor-pointer">
                      Supprimer définitivement les parcelles
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Supprime complètement les lignes de parcelles créées de la base de données. 
                      Les hectares sont remis en disponible.
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Option documents */}
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="delete_docs"
              checked={deleteDocuments}
              onCheckedChange={(c) => setDeleteDocuments(Boolean(c))}
            />
            <label
              htmlFor="delete_docs"
              className="text-xs text-muted-foreground cursor-pointer font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Supprimer également les documents archivés associés
            </label>
          </div>

          {/* Avertissement final */}
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Cette action est immédiate et libérera les conflits RMB associés à cet acheteur.
            </span>
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => onOpenChange(false)}
              className="flex-1 h-9 text-xs"
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
              className="flex-1 h-9 text-xs font-semibold gap-1.5 shadow-sm"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Suppression en cours...
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  Confirmer la suppression
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
