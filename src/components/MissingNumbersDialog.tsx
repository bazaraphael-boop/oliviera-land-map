import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  ListOrdered,
  Plus,
  Hash,
  Copy,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import {
  auditHectare,
  auditGlobalRmb,
  type HectareItem,
  type ParcelleItem,
} from "@/lib/numberingAudit";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface MissingNumbersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hectares: HectareItem[];
  parcelles: ParcelleItem[];
  defaultHectareId?: string;
  onCreateParcelle?: (hectareId: string, suggestedNumero: string) => void;
}

export function MissingNumbersDialog({
  open,
  onOpenChange,
  hectares,
  parcelles,
  defaultHectareId,
  onCreateParcelle,
}: MissingNumbersDialogProps) {
  const [selectedHectareId, setSelectedHectareId] = useState<string>(
    defaultHectareId && defaultHectareId !== "all"
      ? defaultHectareId
      : hectares[0]?.id || ""
  );
  const [activeTab, setActiveTab] = useState<string>("parcelles");

  // Synchroniser avec defaultHectareId si fourni et changé
  useMemo(() => {
    if (defaultHectareId && defaultHectareId !== "all") {
      setSelectedHectareId(defaultHectareId);
    } else if (!selectedHectareId && hectares.length > 0) {
      setSelectedHectareId(hectares[0].id);
    }
  }, [defaultHectareId, hectares]);

  const selectedHectare = useMemo(
    () => hectares.find((h) => h.id === selectedHectareId) || hectares[0],
    [hectares, selectedHectareId]
  );

  const parcellesInSelectedHectare = useMemo(
    () => (selectedHectare ? parcelles.filter((p) => p.hectare_id === selectedHectare.id) : []),
    [parcelles, selectedHectare]
  );

  // Audit de l'hectare sélectionné
  const hectareAudit = useMemo(() => {
    if (!selectedHectare) return null;
    return auditHectare(selectedHectare, parcellesInSelectedHectare, 16);
  }, [selectedHectare, parcellesInSelectedHectare]);

  // Audit global des RMB
  const rmbAudit = useMemo(() => {
    return auditGlobalRmb(parcelles, hectares);
  }, [parcelles, hectares]);

  // Audit de tous les hectares pour la vue récapitulative
  const allHectaresAudits = useMemo(() => {
    return hectares.map((h) => {
      const hParcelles = parcelles.filter((p) => p.hectare_id === h.id);
      return auditHectare(h, hParcelles, 16);
    });
  }, [hectares, parcelles]);

  const totalGapsAcrossAllHectares = useMemo(() => {
    return allHectaresAudits.reduce((acc, a) => acc + a.missingGaps.length, 0);
  }, [allHectaresAudits]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Numéro "${text}" copié dans le presse-papiers`);
  };

  const handleCreateWithNumber = (hectareId: string, numero: string) => {
    onOpenChange(false);
    if (onCreateParcelle) {
      onCreateParcelle(hectareId, numero);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 bg-card border-border">
        {/* Header */}
        <div className="p-6 border-b border-border bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <ListOrdered className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  Détecteur de numéros manquants & Ordre cadastral
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Analysez les séquences, comblez les trous de numérotation et assurez l'ordre des parcelles.
                </DialogDescription>
              </div>
            </div>

            {totalGapsAcrossAllHectares > 0 && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 text-xs shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                {totalGapsAcrossAllHectares} trou{totalGapsAcrossAllHectares > 1 ? "s" : ""} détecté{totalGapsAcrossAllHectares > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-3 border-b border-border bg-background">
            <TabsList className="grid grid-cols-3 w-full max-w-md">
              <TabsTrigger value="parcelles" className="text-xs">
                Parcelles par Hectare
              </TabsTrigger>
              <TabsTrigger value="rmb" className="text-xs">
                Séquence RMB
              </TabsTrigger>
              <TabsTrigger value="tous" className="text-xs">
                Vue d'ensemble ({hectares.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* TAB 1: PARCELLES PAR HECTARE */}
            <TabsContent value="parcelles" className="m-0 space-y-5">
              {/* Sélecteur d'hectare */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-muted/20">
                <div className="space-y-0.5">
                  <label className="text-xs font-semibold text-foreground">Hectare analysé :</label>
                  <p className="text-[11px] text-muted-foreground">Sélectionnez l'hectare à auditer</p>
                </div>
                <Select value={selectedHectareId} onValueChange={setSelectedHectareId}>
                  <SelectTrigger className="w-full sm:w-[280px] bg-background">
                    <SelectValue placeholder="Choisir un hectare" />
                  </SelectTrigger>
                  <SelectContent>
                    {hectares.map((h) => {
                      const audit = allHectaresAudits.find((a) => a.hectareId === h.id);
                      return (
                        <SelectItem key={h.id} value={h.id}>
                          <span className="font-medium">{h.name}</span>
                          {audit && audit.missingGaps.length > 0 && (
                            <span className="ml-2 text-xs text-orange-600 font-bold">
                              ({audit.missingGaps.length} trou{audit.missingGaps.length > 1 ? "s" : ""})
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {hectareAudit && (
                <>
                  {/* Alert Status Banner */}
                  {hectareAudit.hasGaps ? (
                    <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/10 space-y-2">
                      <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-bold text-sm">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>
                          {hectareAudit.missingGaps.length} numéro{hectareAudit.missingGaps.length > 1 ? "s" : ""}{" "}
                          manquant{hectareAudit.missingGaps.length > 1 ? "s" : ""} (trou dans la séquence)
                        </span>
                      </div>
                      <p className="text-xs text-orange-700/80 dark:text-orange-300">
                        La numérotation a été interrompue. Les numéros suivants n'ont pas encore été enregistrés :
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {hectareAudit.missingGaps.map((num) => {
                          const numero = `${hectareAudit.prefix}/${num}`;
                          return (
                            <Badge
                              key={num}
                              className="bg-orange-500 hover:bg-orange-600 text-white font-mono text-xs px-2.5 py-1 gap-1.5 cursor-pointer shadow-sm"
                              onClick={() => handleCreateWithNumber(hectareAudit.hectareId, numero)}
                              title="Cliquez pour créer la parcelle avec ce numéro"
                            >
                              <span>{numero}</span>
                              <Plus className="w-3 h-3 ml-0.5" />
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  ) : hectareAudit.highestNumber > 0 ? (
                    <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                          Numérotation ordonnée sans aucun trou
                        </p>
                        <p className="text-xs text-emerald-700/80 dark:text-emerald-400">
                          Toutes les parcelles de 1 à {hectareAudit.highestNumber} se suivent consécutivement.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-border bg-muted/40 text-center text-xs text-muted-foreground">
                      Aucune parcelle n'a encore été créée dans cet hectare. La séquence commencera à 1.
                    </div>
                  )}

                  {/* Doublons éventuels */}
                  {hectareAudit.hasDuplicates && (
                    <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 space-y-2">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold text-sm">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>Doublons détectés ({hectareAudit.duplicates.length})</span>
                      </div>
                      <p className="text-xs text-red-700/80 dark:text-red-300">
                        Attention : ces numéros sont attribués à plusieurs parcelles en même temps :
                      </p>
                      <div className="space-y-1">
                        {hectareAudit.duplicates.map((dup) => (
                          <div key={dup.num} className="text-xs font-mono font-bold text-red-700 dark:text-red-300">
                            • Numéro {dup.fullNumero} (utilisé {dup.parcelles.length} fois)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grille des 16 emplacements de l'hectare */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        Séquence des 16 emplacements cadastrals
                      </h4>
                      <span className="text-xs text-muted-foreground font-medium">
                        {hectareAudit.totalParcelles} / {hectareAudit.maxCapacity} parcelles
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {Array.from({ length: 16 }, (_, i) => i + 1).map((slotNum) => {
                        const parcellesList = hectareAudit.presentMap.get(slotNum);
                        const isPresent = Boolean(parcellesList && parcellesList.length > 0);
                        const isGap = !isPresent && slotNum <= hectareAudit.highestNumber;
                        const isRemaining = !isPresent && slotNum > hectareAudit.highestNumber;
                        const suggestedNumero = `${hectareAudit.prefix}/${slotNum}`;

                        return (
                          <div
                            key={slotNum}
                            className={cn(
                              "p-3 rounded-xl border transition-all relative flex flex-col justify-between min-h-[90px]",
                              isPresent
                                ? parcellesList![0].status === "vendu"
                                  ? "bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200"
                                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                                : isGap
                                ? "bg-orange-500/15 border-dashed border-2 border-orange-500 text-orange-900 dark:text-orange-200 shadow-sm animate-pulse"
                                : "bg-muted/30 border-dashed border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-xs font-bold font-mono">
                                #{slotNum}
                              </span>
                              {isPresent ? (
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[9px] px-1.5 py-0",
                                    parcellesList![0].status === "vendu"
                                      ? "bg-blue-500 text-white"
                                      : "bg-emerald-600 text-white"
                                  )}
                                >
                                  {parcellesList![0].status === "vendu" ? "Vendu" : "Disponible"}
                                </Badge>
                              ) : isGap ? (
                                <Badge className="text-[9px] px-1.5 py-0 bg-orange-600 text-white font-bold">
                                  MANQUANT
                                </Badge>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">Libre</span>
                              )}
                            </div>

                            {isPresent ? (
                              <div className="mt-1 min-w-0">
                                <p className="font-bold text-xs truncate">
                                  {parcellesList![0].numero}
                                </p>
                                <p className="text-[10px] opacity-75 truncate">
                                  {parcellesList![0].buyer_name || `${parcellesList![0].surface || 600} m²`}
                                </p>
                              </div>
                            ) : (
                              <div className="mt-1">
                                <p className="text-xs font-mono font-medium truncate opacity-70">
                                  {suggestedNumero}
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isGap ? "default" : "outline"}
                                  className={cn(
                                    "w-full h-6 text-[10px] mt-1 gap-1 px-1.5",
                                    isGap && "bg-orange-600 hover:bg-orange-700 text-white"
                                  )}
                                  onClick={() => handleCreateWithNumber(hectareAudit.hectareId, suggestedNumero)}
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>{isGap ? "Combler" : "Créer"}</span>
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* TAB 2: SEQUENCE GLOBALE RMB */}
            <TabsContent value="rmb" className="m-0 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs text-muted-foreground">Plage RMB enregistrée</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {rmbAudit.minRmb !== null && rmbAudit.maxRmb !== null
                      ? `RMB ${rmbAudit.minRmb} → ${rmbAudit.maxRmb}`
                      : "Aucun RMB"}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs text-muted-foreground">Total numéros RMB affectés</p>
                  <p className="text-lg font-bold text-emerald-600 mt-0.5">
                    {rmbAudit.presentNumbers.length}
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-xs text-muted-foreground">Numéros RMB sautés / manquants</p>
                  <p
                    className={cn(
                      "text-lg font-bold mt-0.5",
                      rmbAudit.missingNumbers.length > 0 ? "text-orange-600" : "text-emerald-600"
                    )}
                  >
                    {rmbAudit.missingNumbers.length}
                  </p>
                </div>
              </div>

              {/* Trous dans la série RMB */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-primary" />
                    Numéros RMB manquants dans la série (cliquez pour copier)
                  </h4>
                </div>

                {rmbAudit.missingNumbers.length === 0 ? (
                  <div className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-1">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                      Séquence RMB continue !
                    </p>
                    <p className="text-xs text-emerald-700/80 dark:text-emerald-400">
                      Aucun numéro RMB n'a été sauté entre RMB {rmbAudit.minRmb} et RMB {rmbAudit.maxRmb}.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Les numéros ci-dessous ont été sautés dans l'enregistrement. Vous pouvez les réutiliser pour rétablir l'ordre :
                    </p>
                    <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                      {rmbAudit.missingNumbers.map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handleCopy(`RMB ${num}`)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 text-xs font-mono font-bold transition-colors group"
                        >
                          <span>RMB {num}</span>
                          <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Doublons RMB éventuels */}
              {rmbAudit.duplicates.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Numéros RMB en doublon sur la concession
                  </h4>
                  <div className="space-y-2">
                    {rmbAudit.duplicates.map((dup) => (
                      <div
                        key={dup.rmb}
                        className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-red-700 dark:text-red-300">
                            {dup.rmb}
                          </span>
                          <span className="text-muted-foreground ml-2">
                            attribué à : {dup.items.map((i) => i.name).join(", ")}
                          </span>
                        </div>
                        <Badge variant="destructive" className="text-[10px]">
                          {dup.count} fois
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: VUE D'ENSEMBLE TOUS LES HECTARES */}
            <TabsContent value="tous" className="m-0 space-y-4">
              <p className="text-xs text-muted-foreground">
                Vue récapitulative de la continuité de numérotation pour l'ensemble des {hectares.length} hectares :
              </p>

              <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-semibold text-foreground">Hectare</th>
                      <th className="text-center p-3 font-semibold text-foreground">Parcelles</th>
                      <th className="text-left p-3 font-semibold text-foreground">Trous dans la séquence</th>
                      <th className="text-center p-3 font-semibold text-foreground">Statut</th>
                      <th className="p-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allHectaresAudits.map((audit) => {
                      const isComplete = audit.totalParcelles >= 16;
                      return (
                        <tr key={audit.hectareId} className="hover:bg-muted/40 transition-colors">
                          <td className="p-3 font-medium text-foreground">
                            <div>{audit.hectareName}</div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Préfixe: {audit.prefix}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-bold">{audit.totalParcelles}</span> / 16
                          </td>
                          <td className="p-3">
                            {audit.missingGaps.length === 0 ? (
                              <span className="text-emerald-600 font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Aucun trou
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {audit.missingGaps.map((gap) => (
                                  <Badge
                                    key={gap}
                                    variant="outline"
                                    className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-500/30 font-mono"
                                  >
                                    /{gap}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {audit.hasGaps ? (
                              <Badge variant="outline" className="bg-orange-500/15 text-orange-600 border-orange-500/30 text-[10px]">
                                {audit.missingGaps.length} trou{audit.missingGaps.length > 1 ? "s" : ""}
                              </Badge>
                            ) : isComplete ? (
                              <Badge className="bg-blue-600 text-white text-[10px]">Complet</Badge>
                            ) : (
                              <Badge className="bg-emerald-600 text-white text-[10px]">Ordonné</Badge>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => {
                                setSelectedHectareId(audit.hectareId);
                                setActiveTab("parcelles");
                              }}
                            >
                              <span>Inspecter</span>
                              <ArrowRight className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            💡 Astuce : Combler les trous permet de garder une numérotation continue sans numéros orphelins.
          </p>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
