import React, { useState, useEffect, useMemo } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  MapPin,
  Grid3x3,
  Layers,
  Sparkles,
  UserCheck,
  UserPlus,
  Clock,
  ChevronDown,
  CheckCircle2,
  DollarSign,
  Info,
  Building,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNextAvailableRmb } from "@/lib/rmbSuite";
import { useBuyerDetection, type ExistingBuyer, normalizeText } from "@/hooks/useBuyerDetection";
import { HectareSelector } from "@/components/HectareSelector";

export type LandItemType = "parcelle_in_hectare" | "parcelle_alone" | "hectare";

interface UnifiedLandSaleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultItemType?: LandItemType;
  defaultHectareId?: string;
  onSuccess?: () => void;
}

export const UnifiedLandSaleDialog: React.FC<UnifiedLandSaleDialogProps> = ({
  open,
  onOpenChange,
  defaultItemType = "parcelle_in_hectare",
  defaultHectareId = "",
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const { buyers, findMatchingBuyers } = useBuyerDetection();

  // Chargement des hectares et parcelles pour le calcul de RMB et jauges
  const { data: hectares = [] } = useQuery({
    queryKey: ["unified-dialog-hectares"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hectares")
        .select("id, name, surface, rmb_number, location, status")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const { data: parcelles = [] } = useQuery({
    queryKey: ["unified-dialog-parcelles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelles")
        .select("id, numero, surface, hectare_id, rmb_number, status, merged_group_id")
        .order("numero");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Suggestion automatique du prochain numéro RMB
  const nextRmbProposal = useMemo(() => {
    return getNextAvailableRmb(parcelles, hectares);
  }, [parcelles, hectares]);

  // État du formulaire
  const [itemType, setItemType] = useState<LandItemType>(defaultItemType);
  const [hectareSubType, setHectareSubType] = useState<"complet" | "demi" | "custom">("complet");
  const [hectareId, setHectareId] = useState<string>(defaultHectareId);
  const [numero, setNumero] = useState<string>("");
  const [rmbNumber, setRmbNumber] = useState<string>("");
  const [surface, setSurface] = useState<string>("600");

  // Informations Acquéreur
  const [nom, setNom] = useState<string>("");
  const [postNom, setPostNom] = useState<string>("");
  const [prenom, setPrenom] = useState<string>("");
  const [telephone, setTelephone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [profession, setProfession] = useState<string>("");
  const [adresse, setAdresse] = useState<string>("");
  const [maritalStatus, setMaritalStatus] = useState<string>("celibataire");
  const [childrenCount, setChildrenCount] = useState<string>("");
  const [birthPlace, setBirthPlace] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>("");
  const [showCivilDetails, setShowCivilDetails] = useState<boolean>(false);

  // Gestion Acquéreur Existant
  const [selectedExistingBuyer, setSelectedExistingBuyer] = useState<ExistingBuyer | null>(null);
  const [existingBuyerMode, setExistingBuyerMode] = useState<"keep_rmb" | "new_rmb">("keep_rmb");

  // Vente et modalités financières
  const [saleType, setSaleType] = useState<"normal" | "onereux" | "a_renseigner">("normal");
  const [prix, setPrix] = useState<string>("");
  const [paymentType, setPaymentType] = useState<"total" | "partiel">("total");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialisation à l'ouverture
  useEffect(() => {
    if (open) {
      setItemType(defaultItemType);
      if (defaultHectareId) {
        setHectareId(defaultHectareId);
      } else if (hectares.length > 0 && !hectareId) {
        setHectareId(hectares[0].id);
      }

      // Par défaut, pré-suggérer le prochain RMB
      const proposal = nextRmbProposal.nextFormatted;
      setNumero(proposal);
      setRmbNumber(proposal);
    }
  }, [open, defaultItemType, defaultHectareId, hectares]);

  // Synchronisation de la surface selon le type de bien
  useEffect(() => {
    if (itemType === "hectare") {
      if (hectareSubType === "complet") setSurface("10000");
      else if (hectareSubType === "demi") setSurface("5000");
    } else {
      if (surface === "10000" || surface === "5000") {
        setSurface("600");
      }
    }
  }, [itemType, hectareSubType]);

  // Détection en direct des acquéreurs existants
  const fullNameComputed = `${nom.trim()} ${postNom.trim()} ${prenom.trim()}`.trim();
  const detectedBuyers = useMemo(() => {
    if (fullNameComputed.length < 2) return [];
    return findMatchingBuyers(fullNameComputed);
  }, [fullNameComputed, findMatchingBuyers]);

  // Sélection d'un acquéreur existant
  const handleSelectBuyer = (buyer: ExistingBuyer) => {
    setSelectedExistingBuyer(buyer);
    // Pré-remplir les données de l'acquéreur
    setNom(buyer.buyer_name || "");
    if (buyer.buyer_last_name) setPostNom(buyer.buyer_last_name);
    if (buyer.buyer_first_name) setPrenom(buyer.buyer_first_name);
    if (buyer.buyer_phone) setTelephone(buyer.buyer_phone);
    if (buyer.buyer_email) setEmail(buyer.buyer_email);
    if (buyer.buyer_profession) setProfession(buyer.buyer_profession);
    if (buyer.buyer_address) setAdresse(buyer.buyer_address);
    if (buyer.buyer_marital_status) setMaritalStatus(buyer.buyer_marital_status);
    if (buyer.buyer_children_count) setChildrenCount(buyer.buyer_children_count.toString());
    if (buyer.buyer_birth_place) setBirthPlace(buyer.buyer_birth_place);
    if (buyer.buyer_birth_date) setBirthDate(buyer.buyer_birth_date);

    // Si on garde son RMB
    if (existingBuyerMode === "keep_rmb" && buyer.primaryRmb) {
      setRmbNumber(buyer.primaryRmb);
    }
  };

  const handleDetachBuyer = () => {
    setSelectedExistingBuyer(null);
    setRmbNumber(nextRmbProposal.nextFormatted);
  };

  // Changement de mode RMB pour client existant
  const handleRmbModeChange = (mode: "keep_rmb" | "new_rmb") => {
    setExistingBuyerMode(mode);
    if (mode === "keep_rmb" && selectedExistingBuyer?.primaryRmb) {
      setRmbNumber(selectedExistingBuyer.primaryRmb);
      toast.info(`Conservation du dossier ${selectedExistingBuyer.primaryRmb} pour cet acheteur`);
    } else {
      setRmbNumber(nextRmbProposal.nextFormatted);
      toast.info(`Attribution d'un nouveau numéro : ${nextRmbProposal.nextFormatted}`);
    }
  };

  // Calcul de la capacité de l'hectare d'accueil
  const getHectareOccupancy = (hId: string) => {
    const list = parcelles.filter((p) => p.hectare_id === hId);
    const occupied = list.reduce((total, p) => total + Math.ceil(Number(p.surface || 600) / 600), 0);
    return {
      occupied,
      remaining: Math.max(0, 16 - occupied),
      total: 16,
    };
  };

  const currentHectareOccupancy = useMemo(() => {
    if (!hectareId) return { occupied: 0, remaining: 16, total: 16 };
    return getHectareOccupancy(hectareId);
  }, [hectareId, parcelles]);

  // Réinitialisation du formulaire
  const resetForm = () => {
    setNumero("");
    setRmbNumber("");
    setSurface("600");
    setNom("");
    setPostNom("");
    setPrenom("");
    setTelephone("");
    setEmail("");
    setProfession("");
    setAdresse("");
    setChildrenCount("");
    setBirthPlace("");
    setBirthDate("");
    setSelectedExistingBuyer(null);
    setExistingBuyerMode("keep_rmb");
    setSaleType("normal");
    setPrix("");
    setPaymentType("total");
    setAmountPaid("");
    setShowCivilDetails(false);
  };

  // Validation et soumission atomique
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const buyerName = fullNameComputed;
    if (!buyerName) {
      toast.error("Veuillez renseigner le nom de l'acquéreur");
      return;
    }

    if (!numero.trim()) {
      toast.error("Veuillez renseigner un numéro pour ce terrain");
      return;
    }

    const surfaceNum = parseFloat(surface);
    if (isNaN(surfaceNum) || surfaceNum <= 0) {
      toast.error("Veuillez saisir une surface valide supérieure à 0");
      return;
    }

    // Vérification de la capacité pour les parcelles en hectare
    if (itemType === "parcelle_in_hectare") {
      if (!hectareId) {
        toast.error("Veuillez sélectionner un hectare d'accueil existant");
        return;
      }
      const newEffectif = Math.ceil(surfaceNum / 600);
      if (currentHectareOccupancy.occupied + newEffectif > 16) {
        toast.error(
          `Capacité dépassée : cet hectare dispose de ${currentHectareOccupancy.remaining} places disponibles (${newEffectif} requises)`
        );
        return;
      }
    }

    const isOnereux = saleType === "onereux";
    const isARenseigner = saleType === "a_renseigner";

    const parsedPrix = (isOnereux || isARenseigner) ? 0 : (parseFloat(prix) || 0);
    const parsedAmountPaid = (isOnereux || isARenseigner)
      ? 0
      : paymentType === "total"
      ? parsedPrix
      : (parseFloat(amountPaid) || 0);
    const parsedRemaining = (isOnereux || isARenseigner) ? 0 : Math.max(0, parsedPrix - parsedAmountPaid);

    // Détermination du mergedGroupId si rattachement à un client existant en mode cumul
    let finalMergeGroupId: string | null = null;
    if (selectedExistingBuyer && existingBuyerMode === "keep_rmb") {
      finalMergeGroupId = selectedExistingBuyer.mergedGroupId || selectedExistingBuyer.id;
    }

    try {
      setIsSubmitting(true);

      if (itemType === "hectare") {
        // Enregistrement d'un Hectare
        const { error } = await supabase.from("hectares").insert([
          {
            name: numero.trim(),
            surface: surfaceNum / 10000, // En hectares
            status: "vendu",
            buyer_name: buyerName,
            buyer_phone: telephone.trim() || null,
            buyer_email: email.trim() || null,
            rmb_number: rmbNumber.trim() || null,
            sale_type: isARenseigner ? null : saleType,
            purchase_type: hectareSubType === "demi" ? "demi_hectare" : "hectare",
            prix: parsedPrix,
            payment_type: (isOnereux || isARenseigner) ? "total" : paymentType,
            amount_paid: parsedAmountPaid,
            remaining_amount: parsedRemaining,
            sale_date: isARenseigner ? null : new Date().toISOString(),
          },
        ]);

        if (error) throw error;
      } else {
        // Enregistrement d'une Parcelle (seule ou dans un hectare)
        const targetHectareId = itemType === "parcelle_in_hectare" ? hectareId : null;

        const { error } = await supabase.from("parcelles").insert([
          {
            numero: numero.trim(),
            surface: surfaceNum,
            hectare_id: targetHectareId,
            status: "vendu",
            buyer_name: buyerName,
            buyer_last_name: postNom.trim() || null,
            buyer_first_name: prenom.trim() || null,
            buyer_phone: telephone.trim() || null,
            buyer_email: email.trim() || null,
            buyer_profession: profession.trim() || null,
            buyer_address: adresse.trim() || null,
            buyer_marital_status: maritalStatus || null,
            buyer_children_count: childrenCount ? parseInt(childrenCount, 10) : null,
            buyer_birth_place: birthPlace.trim() || null,
            buyer_birth_date: birthDate || null,
            rmb_number: rmbNumber.trim() || null,
            sale_type: isARenseigner ? null : saleType,
            purchase_type: "parcelle",
            prix: parsedPrix,
            payment_type: (isOnereux || isARenseigner) ? "total" : paymentType,
            amount_paid: parsedAmountPaid,
            remaining_amount: parsedRemaining,
            merged_group_id: finalMergeGroupId,
            sale_date: isARenseigner ? null : new Date().toISOString(),
          },
        ]);

        if (error) throw error;
      }

      // Invalidation des caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["acheteurs"] }),
        queryClient.invalidateQueries({ queryKey: ["parcelles"] }),
        queryClient.invalidateQueries({ queryKey: ["hectares"] }),
        queryClient.invalidateQueries({ queryKey: ["existing-buyers-detection"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-dialog-hectares"] }),
        queryClient.invalidateQueries({ queryKey: ["unified-dialog-parcelles"] }),
      ]);

      const successMsg = selectedExistingBuyer
        ? existingBuyerMode === "keep_rmb"
          ? `Terrain ajouté au quota du dossier ${selectedExistingBuyer.primaryRmb || buyerName} !`
          : `Nouveau dossier ${rmbNumber} créé pour ${buyerName} !`
        : `Acquisition foncière enregistrée avec succès pour ${buyerName} !`;

      toast.success(successMsg);
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error("Erreur enregistrement guichet unique:", err);
      toast.error(err?.message || "Erreur lors de l'enregistrement de l'acquisition");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-1 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Nouvelle Inscription Foncière & Acquéreur
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Guichet unique d'attribution : choisissez le bien et renseignez l'acquéreur en un clic.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-3">
          {/* ================= ÉTAPE 1 : CHOIX DU BIEN ================= */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              1. Type de terrain & Emplacement
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Carte 1 : Parcelle dans un hectare */}
              <button
                type="button"
                onClick={() => setItemType("parcelle_in_hectare")}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  itemType === "parcelle_in_hectare"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                    : "border-border hover:border-primary/50 bg-card hover:bg-muted/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                      <Grid3x3 className="w-4 h-4" />
                    </div>
                    {itemType === "parcelle_in_hectare" && (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="font-bold text-xs sm:text-sm text-foreground">
                    Parcelle en Hectare
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    Affectée à un hectare existant
                  </div>
                </div>
              </button>

              {/* Carte 2 : Parcelle seule */}
              <button
                type="button"
                onClick={() => setItemType("parcelle_alone")}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  itemType === "parcelle_alone"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                    : "border-border hover:border-primary/50 bg-card hover:bg-muted/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600">
                      <MapPin className="w-4 h-4" />
                    </div>
                    {itemType === "parcelle_alone" && (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="font-bold text-xs sm:text-sm text-foreground">
                    Parcelle Seule
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    Terrain autonome hors hectare
                  </div>
                </div>
              </button>

              {/* Carte 3 : Hectare complet ou demi */}
              <button
                type="button"
                onClick={() => setItemType("hectare")}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  itemType === "hectare"
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary"
                    : "border-border hover:border-primary/50 bg-card hover:bg-muted/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
                      <Layers className="w-4 h-4" />
                    </div>
                    {itemType === "hectare" && (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="font-bold text-xs sm:text-sm text-foreground">
                    Hectare Entier
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    Hectare complet ou demi-hectare
                  </div>
                </div>
              </button>
            </div>

            {/* Détails du bien selon sélection */}
            {itemType === "parcelle_in_hectare" && (
              <div className="p-3 bg-muted/30 border border-border rounded-xl space-y-2">
                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Hectare d'accueil *</span>
                  {hectareId && (
                    <span className="text-[11px] text-muted-foreground">
                      Disponibilité :{" "}
                      <strong className="text-foreground">
                        {currentHectareOccupancy.remaining} places
                      </strong>{" "}
                      sur 16
                    </span>
                  )}
                </Label>
                <HectareSelector
                  hectares={hectares}
                  selectedId={hectareId}
                  onSelect={(id) => setHectareId(id)}
                  getOccupancy={getHectareOccupancy}
                  placeholder="Sélectionner un hectare existant"
                />
              </div>
            )}

            {itemType === "hectare" && (
              <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-2">
                <Label className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                  Format de l'hectare *
                </Label>
                <RadioGroup
                  value={hectareSubType}
                  onValueChange={(val: any) => setHectareSubType(val)}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-2.5 bg-background">
                    <RadioGroupItem value="complet" id="h-complet" />
                    <label htmlFor="h-complet" className="text-xs font-medium cursor-pointer">
                      Hectare complet (10 000 m²)
                    </label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2.5 bg-background">
                    <RadioGroupItem value="demi" id="h-demi" />
                    <label htmlFor="h-demi" className="text-xs font-medium cursor-pointer">
                      Demi-hectare (5 000 m²)
                    </label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Numérotation et surface */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Nom / N° du bien *</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setNumero(nextRmbProposal.nextFormatted);
                      setRmbNumber(nextRmbProposal.nextFormatted);
                    }}
                    className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1"
                    title="Insérer le prochain numéro dans la suite logique"
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>Suite {nextRmbProposal.nextFormatted}</span>
                  </button>
                </div>
                <Input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder={itemType === "hectare" ? "Ex: Hectare 05" : "Ex: RMB 012"}
                  className="mt-1 h-9 text-xs sm:text-sm"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Surface (m²) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={surface}
                  onChange={(e) => setSurface(e.target.value)}
                  className="mt-1 h-9 text-xs sm:text-sm"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Numéro RMB attribué</Label>
                <Input
                  value={rmbNumber}
                  onChange={(e) => setRmbNumber(e.target.value)}
                  placeholder="Ex: RMB 012"
                  className="mt-1 h-9 text-xs sm:text-sm font-mono"
                />
              </div>
            </div>
          </div>

          {/* ================= ÉTAPE 2 : ACQUÉREUR ================= */}
          <div className="space-y-3 pt-2 border-t border-border">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-primary" />
              2. Informations de l'acquéreur
            </Label>

            {/* Détection acquéreur existant */}
            {selectedExistingBuyer ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                      Acquéreur existant : {selectedExistingBuyer.buyer_name}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDetachBuyer}
                    className="h-6 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    Changer / Détacher
                  </Button>
                </div>

                <div className="text-[11px] text-amber-700 dark:text-amber-300">
                  Cet acquéreur possède déjà{" "}
                  <strong>{selectedExistingBuyer.quotas} quota(s)</strong> (
                  {selectedExistingBuyer.totalSurface} m²) sur le dossier{" "}
                  <strong>{selectedExistingBuyer.primaryRmb || "N/A"}</strong>.
                </div>

                {/* Choix crucial : même RMB ou nouveau RMB */}
                <div className="pt-1 border-t border-amber-500/20">
                  <Label className="text-[11px] font-bold text-amber-900 dark:text-amber-200 block mb-1.5">
                    Comment affecter cette nouvelle acquisition ?
                  </Label>
                  <RadioGroup
                    value={existingBuyerMode}
                    onValueChange={(val: any) => handleRmbModeChange(val)}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                  >
                    <div
                      onClick={() => handleRmbModeChange("keep_rmb")}
                      className={`p-2 rounded-lg border cursor-pointer text-left transition-all ${
                        existingBuyerMode === "keep_rmb"
                          ? "bg-amber-500/20 border-amber-600 ring-1 ring-amber-600"
                          : "bg-background border-border hover:bg-muted"
                      }`}
                    >
                      <div className="font-semibold text-xs text-foreground">
                        📁 Même dossier (RMB existant)
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Conserve {selectedExistingBuyer.primaryRmb || "le même numéro"} et cumule le quota (+
                        {Math.max(1, Math.ceil(Number(surface || 600) / 600))})
                      </div>
                    </div>

                    <div
                      onClick={() => handleRmbModeChange("new_rmb")}
                      className={`p-2 rounded-lg border cursor-pointer text-left transition-all ${
                        existingBuyerMode === "new_rmb"
                          ? "bg-amber-500/20 border-amber-600 ring-1 ring-amber-600"
                          : "bg-background border-border hover:bg-muted"
                      }`}
                    >
                      <div className="font-semibold text-xs text-foreground">
                        ✨ Nouveau dossier RMB distinct
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Attribue un nouveau RMB ({nextRmbProposal.nextFormatted}) indépendant
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            ) : detectedBuyers.length > 0 ? (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Client déjà existant trouvé dans la base :</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {detectedBuyers.slice(0, 2).map((b) => (
                    <Button
                      key={b.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSelectBuyer(b)}
                      className="h-7 text-xs bg-background/80 hover:bg-amber-500/20 border-amber-500/30"
                    >
                      <UserCheck className="w-3 h-3 mr-1 text-amber-600" />
                      {b.buyer_name} ({b.quotas} quotas • {b.primaryRmb || "sans RMB"})
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Saisie Nom / Prénom / Téléphone */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-medium">Nom de famille *</Label>
                <Input
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex: KABAMBA"
                  className="mt-1 h-9 text-xs sm:text-sm"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Post-nom</Label>
                <Input
                  value={postNom}
                  onChange={(e) => setPostNom(e.target.value)}
                  placeholder="Ex: TSHIBANGU"
                  className="mt-1 h-9 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Prénom</Label>
                <Input
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Ex: Patrick"
                  className="mt-1 h-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Téléphone</Label>
                <Input
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="+243..."
                  className="mt-1 h-9 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="acquéreur@domaine.com"
                  className="mt-1 h-9 text-xs sm:text-sm"
                />
              </div>
            </div>

            {/* Volet repliable pour état civil détaillé */}
            <Collapsible open={showCivilDetails} onOpenChange={setShowCivilDetails}>
              <CollapsibleTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 p-0"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showCivilDetails ? "rotate-180" : ""}`}
                  />
                  <span>{showCivilDetails ? "Masquer détails d'état civil" : "+ Compléter état civil (adresse, profession...)"}</span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Profession</Label>
                    <Input
                      value={profession}
                      onChange={(e) => setProfession(e.target.value)}
                      placeholder="Ex: Enseignant, Commerçant..."
                      className="mt-1 h-9 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Adresse</Label>
                    <Input
                      value={adresse}
                      onChange={(e) => setAdresse(e.target.value)}
                      placeholder="Ex: Av. du Port n° 12, Muanda"
                      className="mt-1 h-9 text-xs sm:text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-medium">État civil</Label>
                    <Select value={maritalStatus} onValueChange={setMaritalStatus}>
                      <SelectTrigger className="mt-1 h-9 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="celibataire">Célibataire</SelectItem>
                        <SelectItem value="marie">Marié(e)</SelectItem>
                        <SelectItem value="divorce">Divorcé(e)</SelectItem>
                        <SelectItem value="veuf">Veuf / Veuve</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Lieu de naissance</Label>
                    <Input
                      value={birthPlace}
                      onChange={(e) => setBirthPlace(e.target.value)}
                      placeholder="Ex: Boma"
                      className="mt-1 h-9 text-xs sm:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Date de naissance</Label>
                    <Input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="mt-1 h-9 text-xs sm:text-sm"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* ================= ÉTAPE 3 : MODALITÉS DE VENTE ================= */}
          <div className="space-y-3 pt-2 border-t border-border">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-primary" />
              3. Modalités de vente
            </Label>

            <div>
              <Label className="text-xs font-medium">Type de vente *</Label>
              <Select value={saleType} onValueChange={(val: any) => setSaleType(val)}>
                <SelectTrigger className="mt-1 h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Vente normale (avec prix & paiements)</SelectItem>
                  <SelectItem value="onereux">À titre gratuit (cession gratuite)</SelectItem>
                  <SelectItem value="a_renseigner">À renseigner (modalités à venir)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {saleType === "a_renseigner" ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold">Vente enregistrée en attente</div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">
                    Les prix, acomptes et dates seront renseignés ultérieurement. Aucun montant n'est exigé à cette étape.
                  </div>
                </div>
              </div>
            ) : saleType === "onereux" ? (
              <div className="p-3 bg-muted/40 border border-border rounded-xl text-xs text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span>Ce terrain est attribué à titre gracieux (montant total fixé à 0 USD).</span>
              </div>
            ) : (
              <div className="space-y-3 p-3 bg-muted/20 border border-border rounded-xl">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium">Prix total (USD) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={prix}
                      onChange={(e) => setPrix(e.target.value)}
                      placeholder="Ex: 5000"
                      className="mt-1 h-9 text-xs sm:text-sm"
                      required
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-medium">Type de versement *</Label>
                    <Select value={paymentType} onValueChange={(val: any) => setPaymentType(val)}>
                      <SelectTrigger className="mt-1 h-9 text-xs sm:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="total">Paiement total immédiat</SelectItem>
                        <SelectItem value="partiel">Paiement par acompte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {paymentType === "partiel" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs font-medium">Acompte versé (USD)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        placeholder="Ex: 2000"
                        className="mt-1 h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-medium">Reste à payer (USD)</Label>
                      <div className="mt-1 h-9 px-3 rounded-md border border-border bg-muted flex items-center text-xs sm:text-sm font-semibold text-orange-600">
                        ${Math.max(0, (parseFloat(prix) || 0) - (parseFloat(amountPaid) || 0)).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5 font-semibold">
              {isSubmitting ? (
                <>Enregistrement en cours...</>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Valider l'inscription
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
