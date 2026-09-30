import { useState, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Grid3x3, Plus, Trash2, CheckCircle2, Save, 
  MapPin, DollarSign, Layers, Sparkles, AlertCircle, Loader2, ArrowRight
} from "lucide-react";
import { extractRmbNumber, getNextAvailableRmb } from "@/lib/rmbSuite";

interface Parcelle {
  id: string;
  numero: string;
  surface: number;
  prix: number;
  sale_date: string | null;
  hectare_id?: string | null;
  payment_type: string;
  amount_paid: number;
  remaining_amount: number;
  sale_type: string;
  purchase_type: string | null;
  rmb_number: string | null;
  nombreParcelles?: number;
  hectares?: {
    name: string;
    location: string;
  } | null;
}

interface Acheteur {
  id: string;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  buyer_last_name?: string | null;
  buyer_first_name?: string | null;
  buyer_profession?: string | null;
  buyer_birth_place?: string | null;
  buyer_birth_date?: string | null;
  buyer_marital_status?: string | null;
  buyer_children_count?: number | null;
  buyer_address?: string | null;
  buyer_village_origin?: string | null;
  buyer_groupement?: string | null;
  buyer_secteur?: string | null;
  buyer_territoire?: string | null;
  buyer_province?: string | null;
  parcelles: Parcelle[];
  hectares: any[];
  totalAchat: number;
  nombreParcelles: number;
  nombreHectares: number;
}

interface EditBuyerQuotaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  acheteur: Acheteur | null;
  onSuccess?: () => void;
}

export function EditBuyerQuotaDialog({
  open,
  onOpenChange,
  acheteur,
  onSuccess,
}: EditBuyerQuotaDialogProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"existing" | "add_new">("existing");
  const [savingParcelId, setSavingParcelId] = useState<string | null>(null);
  const [detachingParcelId, setDetachingParcelId] = useState<string | null>(null);
  const [isAddingParcel, setIsAddingParcel] = useState<boolean>(false);

  // Formulaire local pour chaque parcelle existante (indexé par id)
  const [parcellesDrafts, setParcellesDrafts] = useState<
    Record<
      string,
      {
        numero: string;
        rmb_number: string;
        surface: string;
        prix: string;
        payment_type: "total" | "partiel";
        amount_paid: string;
        sale_type: string;
      }
    >
  >({});

  // Formulaire pour ajouter une nouvelle parcelle au quota de cet acquéreur
  const [newParcelNumero, setNewParcelNumero] = useState<string>("");
  const [newParcelRmb, setNewParcelRmb] = useState<string>("");
  const [newParcelSurface, setNewParcelSurface] = useState<string>("600");
  const [newParcelType, setNewParcelType] = useState<"in_hectare" | "standalone">("in_hectare");
  const [newParcelHectareId, setNewParcelHectareId] = useState<string>("");
  const [newParcelSaleType, setNewParcelSaleType] = useState<string>("normal");
  const [newParcelPrix, setNewParcelPrix] = useState<string>("");
  const [newParcelPaymentType, setNewParcelPaymentType] = useState<"total" | "partiel">("total");
  const [newParcelAmountPaid, setNewParcelAmountPaid] = useState<string>("");

  // Charger la liste des hectares disponibles pour affectation
  const { data: allHectares = [] } = useQuery({
    queryKey: ["all-hectares-for-quota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hectares")
        .select("id, name, location, surface")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 0,
  });

  const { data: allParcelles = [] } = useQuery({
    queryKey: ["all-parcelles-for-quota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelles")
        .select("id, numero, rmb_number, surface, hectare_id, status")
        .order("numero");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 0,
  });

  // Suggestion automatique du prochain RMB disponible
  const nextRmbProposal = useMemo(() => {
    return getNextAvailableRmb(allParcelles, allHectares);
  }, [allParcelles, allHectares]);

  // Initialisation à chaque ouverture ou changement d'acheteur
  useMemo(() => {
    if (!acheteur) return;
    const initialDrafts: Record<string, any> = {};
    acheteur.parcelles.forEach((p) => {
      initialDrafts[p.id] = {
        numero: p.numero || "",
        rmb_number: p.rmb_number || p.numero || "",
        surface: String(p.surface || 600),
        prix: String(p.prix || 0),
        payment_type: (p.payment_type as "total" | "partiel") || "total",
        amount_paid: String(p.amount_paid || 0),
        sale_type: p.sale_type || "normal",
      };
    });
    setParcellesDrafts(initialDrafts);

    // Initialiser le formulaire d'ajout
    const nextProp = nextRmbProposal.nextFormatted;
    setNewParcelNumero(nextProp);
    setNewParcelRmb(nextProp);
    if (allHectares.length > 0 && !newParcelHectareId) {
      setNewParcelHectareId(allHectares[0].id);
    }
  }, [acheteur, open, allHectares, nextRmbProposal]);

  if (!acheteur) return null;

  // Calcul du quota total actuel
  const currentTotalQuotas = acheteur.parcelles.reduce((sum, p) => {
    const draft = parcellesDrafts[p.id];
    const surf = draft ? parseFloat(draft.surface) || 600 : p.surface || 600;
    return sum + Math.max(1, Math.ceil(surf / 600));
  }, 0);

  const currentTotalSurface = acheteur.parcelles.reduce((sum, p) => {
    const draft = parcellesDrafts[p.id];
    const surf = draft ? parseFloat(draft.surface) || 600 : p.surface || 600;
    return sum + surf;
  }, 0);

  // Gestion des changements de formulaire draft
  const updateDraft = (
    pId: string,
    field: "numero" | "rmb_number" | "surface" | "prix" | "payment_type" | "amount_paid" | "sale_type",
    val: any
  ) => {
    setParcellesDrafts((prev) => {
      const existing = prev[pId] || {
        numero: "",
        rmb_number: "",
        surface: "600",
        prix: "0",
        payment_type: "total",
        amount_paid: "0",
        sale_type: "normal",
      };
      return {
        ...prev,
        [pId]: {
          ...existing,
          [field]: val,
        },
      };
    });
  };

  // Preset de quotas pour une parcelle existante
  const applyPresetToExisting = (pId: string, quotaMultiplier: number) => {
    const targetSurface = quotaMultiplier * 600;
    updateDraft(pId, "surface", String(targetSurface));
    toast.info(`Quota défini à ${quotaMultiplier} parcelle${quotaMultiplier > 1 ? "s" : ""} (${targetSurface} m²)`);
  };

  // Enregistrer les modifications d'une parcelle
  const handleSaveParcel = async (pId: string) => {
    const draft = parcellesDrafts[pId];
    if (!draft) return;

    const surfaceNum = parseFloat(draft.surface);
    if (isNaN(surfaceNum) || surfaceNum <= 0) {
      toast.error("Veuillez saisir une surface valide");
      return;
    }

    const prixNum = parseFloat(draft.prix) || 0;
    const amountPaidNum = draft.payment_type === "total" ? prixNum : parseFloat(draft.amount_paid) || 0;
    const remainingNum = Math.max(0, prixNum - amountPaidNum);

    try {
      setSavingParcelId(pId);

      const { error } = await supabase
        .from("parcelles")
        .update({
          numero: draft.numero.trim(),
          rmb_number: draft.rmb_number.trim() || null,
          surface: surfaceNum,
          prix: prixNum,
          payment_type: draft.payment_type,
          amount_paid: amountPaidNum,
          remaining_amount: remainingNum,
          sale_type: draft.sale_type,
        })
        .eq("id", pId);

      if (error) throw error;

      // Invalider les requêtes
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["acheteurs"] }),
        queryClient.invalidateQueries({ queryKey: ["parcelles"] }),
        queryClient.invalidateQueries({ queryKey: ["existing-buyers-detection"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-dialog-parcelles"] }),
        queryClient.invalidateQueries({ queryKey: ["all-parcelles-for-quota"] }),
      ]);

      const quotaCount = Math.max(1, Math.ceil(surfaceNum / 600));
      toast.success(
        `Quota de la parcelle ${draft.numero} mis à jour : ${quotaCount} parcelle(s) (${surfaceNum} m²)`
      );
      onSuccess?.();
    } catch (err: any) {
      console.error("Erreur mise à jour parcelle quota :", err);
      toast.error(err?.message || "Erreur lors de la mise à jour");
    } finally {
      setSavingParcelId(null);
    }
  };

  // Détacher / libérer une parcelle du dossier de l'acquéreur
  const handleDetachParcel = async (pId: string, numero: string) => {
    if (
      !confirm(
        `Voulez-vous vraiment détacher la parcelle ${numero} de cet acquéreur ? Elle sera remise en statut "disponible" et libérée de son quota.`
      )
    ) {
      return;
    }

    try {
      setDetachingParcelId(pId);

      const { error } = await supabase
        .from("parcelles")
        .update({
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
          prix: 0,
          amount_paid: 0,
          remaining_amount: 0,
          sale_date: null,
          sale_type: null,
          paper_form_completed: false,
        })
        .eq("id", pId);

      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["acheteurs"] }),
        queryClient.invalidateQueries({ queryKey: ["parcelles"] }),
        queryClient.invalidateQueries({ queryKey: ["existing-buyers-detection"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-dialog-parcelles"] }),
        queryClient.invalidateQueries({ queryKey: ["all-parcelles-for-quota"] }),
      ]);

      toast.success(`Parcelle ${numero} détachée et remise en disponible !`);
      onSuccess?.();
    } catch (err: any) {
      console.error("Erreur détachement parcelle :", err);
      toast.error(err?.message || "Erreur lors du détachement");
    } finally {
      setDetachingParcelId(null);
    }
  };

  // Ajouter une nouvelle parcelle supplémentaire au quota de cet acquéreur
  const handleAddNewParcel = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newParcelNumero.trim()) {
      toast.error("Veuillez renseigner un numéro de parcelle");
      return;
    }

    const surfaceNum = parseFloat(newParcelSurface);
    if (isNaN(surfaceNum) || surfaceNum <= 0) {
      toast.error("Veuillez saisir une surface valide");
      return;
    }

    if (newParcelType === "in_hectare" && !newParcelHectareId) {
      toast.error("Veuillez sélectionner un hectare d'accueil");
      return;
    }

    const targetHectare = newParcelType === "in_hectare" ? newParcelHectareId : null;
    const prixNum = parseFloat(newParcelPrix) || 0;
    const amountPaidNum = newParcelPaymentType === "total" ? prixNum : parseFloat(newParcelAmountPaid) || 0;
    const remainingNum = Math.max(0, prixNum - amountPaidNum);

    try {
      setIsAddingParcel(true);

      const { error } = await supabase.from("parcelles").insert([
        {
          numero: newParcelNumero.trim(),
          rmb_number: newParcelRmb.trim() || newParcelNumero.trim(),
          surface: surfaceNum,
          hectare_id: targetHectare,
          status: "vendu",
          buyer_name: acheteur.buyer_name,
          buyer_phone: acheteur.buyer_phone,
          buyer_email: acheteur.buyer_email,
          buyer_last_name: acheteur.buyer_last_name,
          buyer_first_name: acheteur.buyer_first_name,
          buyer_profession: acheteur.buyer_profession,
          buyer_birth_place: acheteur.buyer_birth_place,
          buyer_birth_date: acheteur.buyer_birth_date,
          buyer_marital_status: acheteur.buyer_marital_status,
          buyer_children_count: acheteur.buyer_children_count,
          buyer_address: acheteur.buyer_address,
          buyer_village_origin: acheteur.buyer_village_origin,
          buyer_groupement: acheteur.buyer_groupement,
          buyer_secteur: acheteur.buyer_secteur,
          buyer_territoire: acheteur.buyer_territoire,
          buyer_province: acheteur.buyer_province,
          purchase_type: "parcelle",
          sale_type: newParcelSaleType,
          prix: prixNum,
          payment_type: newParcelPaymentType,
          amount_paid: amountPaidNum,
          remaining_amount: remainingNum,
          sale_date: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["acheteurs"] }),
        queryClient.invalidateQueries({ queryKey: ["parcelles"] }),
        queryClient.invalidateQueries({ queryKey: ["existing-buyers-detection"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-dialog-parcelles"] }),
        queryClient.invalidateQueries({ queryKey: ["all-parcelles-for-quota"] }),
      ]);

      const addedQuotas = Math.max(1, Math.ceil(surfaceNum / 600));
      toast.success(
        `Parcelle ${newParcelNumero} (${addedQuotas} quotas, ${surfaceNum} m²) ajoutée avec succès au compte de ${acheteur.buyer_name} !`
      );

      // Réinitialiser
      setNewParcelSurface("600");
      setActiveTab("existing");
      onSuccess?.();
    } catch (err: any) {
      console.error("Erreur ajout parcelle au quota :", err);
      toast.error(err?.message || "Erreur lors de l'ajout de la parcelle");
    } finally {
      setIsAddingParcel(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 bg-card border-border shadow-2xl">
        <DialogHeader className="space-y-1 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-bold truncate">
                Gestion des Quotas & Parcelles — {acheteur.buyer_name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Modifiez la surface, ajustez les quotas attribués (1 parcelle = 600 m²) ou ajoutez de nouvelles parcelles.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Synthèse du quota de l'acquéreur */}
        <div className="p-3.5 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex flex-wrap items-center justify-between gap-3 mt-3">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Quota global actuel
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-bold text-foreground">
                {currentTotalQuotas} parcelle{currentTotalQuotas > 1 ? "s" : ""}
              </span>
              <Badge className="bg-primary text-primary-foreground font-semibold text-xs">
                {currentTotalSurface.toLocaleString("fr-FR")} m²
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="bg-background px-2.5 py-1 rounded-md border border-border font-medium">
              🏷️ {acheteur.parcelles.length} parcelle{acheteur.parcelles.length > 1 ? "s" : ""} enregistrée{acheteur.parcelles.length > 1 ? "s" : ""}
            </span>
            {acheteur.nombreHectares > 0 && (
              <span className="bg-background px-2.5 py-1 rounded-md border border-border font-medium">
                🌲 {acheteur.nombreHectares} ha
              </span>
            )}
          </div>
        </div>

        {/* Navigation Onglets */}
        <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="mt-4">
          <TabsList className="grid grid-cols-2 w-full h-10">
            <TabsTrigger value="existing" className="text-xs font-semibold gap-1.5">
              <Grid3x3 className="w-3.5 h-3.5" />
              Parcelles attribuées ({acheteur.parcelles.length})
            </TabsTrigger>
            <TabsTrigger value="add_new" className="text-xs font-semibold gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Ajouter une parcelle au quota
            </TabsTrigger>
          </TabsList>

          {/* ONGLET 1 : Parcelles existantes */}
          <TabsContent value="existing" className="space-y-4 pt-3">
            {acheteur.parcelles.length === 0 ? (
              <div className="text-center py-8 p-4 rounded-xl border border-dashed border-border bg-muted/20">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                <p className="text-sm font-semibold text-foreground">Aucune parcelle individuelle rattachée</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Cet acquéreur ne possède que des hectares ou n'a pas encore de parcelle attribuée.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab("add_new")}
                  className="mt-3 gap-1.5 text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter sa première parcelle
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {acheteur.parcelles.map((p) => {
                  const draft = parcellesDrafts[p.id] || {
                    numero: p.numero,
                    rmb_number: p.rmb_number || p.numero,
                    surface: String(p.surface || 600),
                    prix: String(p.prix || 0),
                    payment_type: (p.payment_type as any) || "total",
                    amount_paid: String(p.amount_paid || 0),
                    sale_type: p.sale_type || "normal",
                  };
                  const surfNum = parseFloat(draft.surface) || 600;
                  const calculatedQuotas = Math.max(1, Math.ceil(surfNum / 600));
                  const isSaving = savingParcelId === p.id;
                  const isDetaching = detachingParcelId === p.id;

                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/30 transition-colors space-y-3"
                    >
                      {/* En-tête de la parcelle */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">
                            Parcelle {draft.numero || p.numero}
                          </span>
                          {draft.rmb_number && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              RMB {draft.rmb_number}
                            </Badge>
                          )}
                          <Badge className="bg-emerald-600 text-white text-[10px] font-semibold">
                            {calculatedQuotas} quota{calculatedQuotas > 1 ? "s" : ""} ({surfNum} m²)
                          </Badge>
                        </div>

                        {p.hectares?.name ? (
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-primary" />
                            Dans l'hectare : <strong>{p.hectares.name}</strong>
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            🏷️ Parcelle seule (hors hectare)
                          </span>
                        )}
                      </div>

                      {/* Presets rapides de quotas (1p = 600m2, 2p = 1200m2, etc.) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider">
                            Ajuster le Quota (Parcelles de 600 m²)
                          </span>
                          <span className="text-[11px] text-primary font-medium">
                            Actuel : {calculatedQuotas} parcelle{calculatedQuotas > 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={surfNum === 600 ? "default" : "outline"}
                            onClick={() => applyPresetToExisting(p.id, 1)}
                            className="h-8 text-xs font-semibold"
                          >
                            1 p. (600 m²)
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={surfNum === 1200 ? "default" : "outline"}
                            onClick={() => applyPresetToExisting(p.id, 2)}
                            className="h-8 text-xs font-semibold"
                          >
                            2 p. (1 200 m²)
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={surfNum === 1800 ? "default" : "outline"}
                            onClick={() => applyPresetToExisting(p.id, 3)}
                            className="h-8 text-xs font-semibold"
                          >
                            3 p. (1 800 m²)
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={surfNum === 2400 ? "default" : "outline"}
                            onClick={() => applyPresetToExisting(p.id, 4)}
                            className="h-8 text-xs font-semibold"
                          >
                            4 p. (2 400 m²)
                          </Button>
                        </div>
                      </div>

                      {/* Saisie détaillée (Numéro, RMB, Surface personnalisée) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                        <div>
                          <Label className="text-xs font-medium">Numéro de parcelle</Label>
                          <Input
                            value={draft.numero}
                            onChange={(e) => updateDraft(p.id, "numero", e.target.value)}
                            className="h-8 text-xs mt-1 bg-background"
                            placeholder="Ex: P12"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-medium">Numéro RMB</Label>
                          <Input
                            value={draft.rmb_number}
                            onChange={(e) => updateDraft(p.id, "rmb_number", e.target.value)}
                            className="h-8 text-xs mt-1 bg-background font-mono"
                            placeholder="Ex: RMB 012"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-medium">Surface libre (m²)</Label>
                          <Input
                            type="number"
                            step="10"
                            value={draft.surface}
                            onChange={(e) => updateDraft(p.id, "surface", e.target.value)}
                            className="h-8 text-xs mt-1 bg-background font-semibold"
                            placeholder="600"
                          />
                        </div>
                      </div>

                      {/* Modalités financières pour cette parcelle */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-border/40">
                        <div>
                          <Label className="text-xs font-medium">Prix convenu (USD)</Label>
                          <Input
                            type="number"
                            value={draft.prix}
                            onChange={(e) => updateDraft(p.id, "prix", e.target.value)}
                            className="h-8 text-xs mt-1 bg-background"
                            placeholder="0"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-medium">Modalité de paiement</Label>
                          <Select
                            value={draft.payment_type}
                            onValueChange={(val: any) => updateDraft(p.id, "payment_type", val)}
                          >
                            <SelectTrigger className="h-8 text-xs mt-1 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="total">Paiement Total</SelectItem>
                              <SelectItem value="partiel">Paiement Partiel (Acompte)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {draft.payment_type === "partiel" && (
                          <div>
                            <Label className="text-xs font-medium">Acompte versé (USD)</Label>
                            <Input
                              type="number"
                              value={draft.amount_paid}
                              onChange={(e) => updateDraft(p.id, "amount_paid", e.target.value)}
                              className="h-8 text-xs mt-1 bg-background font-semibold"
                              placeholder="0"
                            />
                          </div>
                        )}
                      </div>

                      {/* Boutons d'action pour cette parcelle */}
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isDetaching || isSaving}
                          onClick={() => handleDetachParcel(p.id, draft.numero || p.numero)}
                          className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                        >
                          {isDetaching ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          <span>Détacher cette parcelle</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          disabled={isSaving || isDetaching}
                          onClick={() => handleSaveParcel(p.id)}
                          className="h-8 text-xs font-semibold gap-1.5 shadow-2xs"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Enregistrement...</span>
                            </>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5" />
                              <span>Valider ce quota</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ONGLET 2 : Ajouter une nouvelle parcelle */}
          <TabsContent value="add_new" className="pt-3">
            <form onSubmit={handleAddNewParcel} className="space-y-4">
              <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-3">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary" />
                  Nouvelle Parcelle à ajouter au compte de {acheteur.buyer_name}
                </span>

                {/* Type de rattachement */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Type d'affectation</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={newParcelType === "in_hectare" ? "default" : "outline"}
                      onClick={() => setNewParcelType("in_hectare")}
                      className="h-8 text-xs font-semibold"
                    >
                      Dans un Hectare existant
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={newParcelType === "standalone" ? "default" : "outline"}
                      onClick={() => setNewParcelType("standalone")}
                      className="h-8 text-xs font-semibold"
                    >
                      Parcelle seule (hors hectare)
                    </Button>
                  </div>
                </div>

                {newParcelType === "in_hectare" && (
                  <div>
                    <Label className="text-xs font-medium">Sélectionner l'hectare d'accueil *</Label>
                    <Select
                      value={newParcelHectareId}
                      onValueChange={(val) => setNewParcelHectareId(val)}
                    >
                      <SelectTrigger className="h-9 text-xs mt-1 bg-background">
                        <SelectValue placeholder="Choisir un hectare..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allHectares.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            Hectare {h.name} {h.location ? `(${h.location})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Numéros & RMB */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Numéro de parcelle *</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setNewParcelNumero(nextRmbProposal.nextFormatted);
                          setNewParcelRmb(nextRmbProposal.nextFormatted);
                        }}
                        className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Suite {nextRmbProposal.nextFormatted}</span>
                      </button>
                    </div>
                    <Input
                      value={newParcelNumero}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewParcelNumero(val);
                        if (!newParcelRmb || newParcelRmb === newParcelNumero) {
                          setNewParcelRmb(val);
                        }
                      }}
                      placeholder="Ex: RMB 176"
                      className="h-9 text-xs mt-1 bg-background font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Numéro RMB</Label>
                    <Input
                      value={newParcelRmb}
                      onChange={(e) => setNewParcelRmb(e.target.value)}
                      placeholder="Ex: RMB 176"
                      className="h-9 text-xs mt-1 bg-background font-mono"
                    />
                  </div>
                </div>

                {/* Quota et surface */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <Label className="text-xs font-medium">Quota / Surface (m²) *</Label>
                    <span className="text-[11px] text-primary font-semibold">
                      = {Math.max(1, Math.ceil((parseFloat(newParcelSurface) || 600) / 600))} quota(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={newParcelSurface === "600" ? "default" : "outline"}
                      onClick={() => setNewParcelSurface("600")}
                      className="h-8 text-xs font-semibold"
                    >
                      1 p. (600 m²)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={newParcelSurface === "1200" ? "default" : "outline"}
                      onClick={() => setNewParcelSurface("1200")}
                      className="h-8 text-xs font-semibold"
                    >
                      2 p. (1 200 m²)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={newParcelSurface === "1800" ? "default" : "outline"}
                      onClick={() => setNewParcelSurface("1800")}
                      className="h-8 text-xs font-semibold"
                    >
                      3 p. (1 800 m²)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={newParcelSurface === "2400" ? "default" : "outline"}
                      onClick={() => setNewParcelSurface("2400")}
                      className="h-8 text-xs font-semibold"
                    >
                      4 p. (2 400 m²)
                    </Button>
                  </div>

                  <Input
                    type="number"
                    step="10"
                    value={newParcelSurface}
                    onChange={(e) => setNewParcelSurface(e.target.value)}
                    className="h-9 text-xs mt-1 bg-background font-semibold"
                    placeholder="Surface personnalisée en m²"
                    required
                  />
                </div>

                {/* Modalités financières */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
                  <div>
                    <Label className="text-xs font-medium">Prix (USD)</Label>
                    <Input
                      type="number"
                      value={newParcelPrix}
                      onChange={(e) => setNewParcelPrix(e.target.value)}
                      placeholder="0"
                      className="h-9 text-xs mt-1 bg-background"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Modalité de paiement</Label>
                    <Select
                      value={newParcelPaymentType}
                      onValueChange={(val: any) => setNewParcelPaymentType(val)}
                    >
                      <SelectTrigger className="h-9 text-xs mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="total">Paiement Total</SelectItem>
                        <SelectItem value="partiel">Paiement Partiel (Acompte)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newParcelPaymentType === "partiel" && (
                    <div>
                      <Label className="text-xs font-medium">Acompte versé (USD)</Label>
                      <Input
                        type="number"
                        value={newParcelAmountPaid}
                        onChange={(e) => setNewParcelAmountPaid(e.target.value)}
                        placeholder="0"
                        className="h-9 text-xs mt-1 bg-background font-semibold"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTab("existing")}
                  className="flex-1 h-9 text-xs"
                >
                  Retour à la liste
                </Button>
                <Button
                  type="submit"
                  disabled={isAddingParcel}
                  className="flex-1 h-9 text-xs font-semibold gap-1.5 shadow-sm"
                >
                  {isAddingParcel ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Ajout en cours...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Ajouter cette parcelle au quota
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
