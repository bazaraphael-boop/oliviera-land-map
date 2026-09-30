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
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getNextAvailableRmb, extractRmbNumber } from "@/lib/rmbSuite";
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
  const { buyers, findMatchingBuyers, refetch: refetchBuyerDetection } = useBuyerDetection();

  // Chargement des hectares et parcelles pour le calcul de RMB et jauges
  const { data: hectares = [] } = useQuery({
    queryKey: ["unified-dialog-hectares"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hectares")
        .select("id, name, surface, rmb_number, location, status, buyer_name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 1000 * 30,
  });

  const { data: parcelles = [] } = useQuery({
    queryKey: ["unified-dialog-parcelles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parcelles")
        .select("id, numero, surface, hectare_id, rmb_number, status, merged_group_id, buyer_name")
        .order("numero");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 1000 * 30,
  });

  // Suggestion automatique du prochain numéro RMB
  const nextRmbProposal = useMemo(() => {
    return getNextAvailableRmb(parcelles, hectares);
  }, [parcelles, hectares]);

  // État du formulaire
  const [itemType, setItemType] = useState<LandItemType>(defaultItemType);
  const [hectareQuantity, setHectareQuantity] = useState<string>("1");
  const [hectarePreset, setHectarePreset] = useState<string>("1ha");
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

  // Initialisation à l'ouverture du dialogue
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
  }, [open, defaultItemType, defaultHectareId]);

  // Gestion du type de bien et presets
  const handleItemTypeChange = (newType: LandItemType) => {
    setItemType(newType);
    if (newType === "hectare") {
      setHectarePreset("1ha");
      setHectareQuantity("1");
      setSurface("10000");
    } else {
      if (surface === "10000" || surface === "5000" || surface === "2000" || surface === "20000") {
        setSurface("600");
      }
    }
  };

  const handleHectareQuantityChange = (val: string) => {
    setHectareQuantity(val);
    setHectarePreset("custom");
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) {
      setSurface(Math.round(n * 10000).toString());
    }
  };

  const handleSurfaceChange = (val: string) => {
    setSurface(val);
    if (itemType === "hectare") {
      const n = parseFloat(val);
      if (!isNaN(n) && n > 0) {
        const ha = Math.round((n / 10000) * 10000) / 10000;
        setHectareQuantity(ha.toString());
        setHectarePreset("custom");
      }
    }
  };

  const applyHectarePreset = (preset: "1ha" | "2ha" | "demi" | "2000m2") => {
    setHectarePreset(preset);
    if (preset === "1ha") {
      setHectareQuantity("1");
      setSurface("10000");
    } else if (preset === "2ha") {
      setHectareQuantity("2");
      setSurface("20000");
    } else if (preset === "demi") {
      setHectareQuantity("0.5");
      setSurface("5000");
    } else if (preset === "2000m2") {
      setHectareQuantity("0.2");
      setSurface("2000");
    }
  };

  // Détection en direct des acquéreurs existants
  const fullNameComputed = `${nom.trim()} ${postNom.trim()} ${prenom.trim()}`.trim();
  const detectedBuyers = useMemo(() => {
    if (fullNameComputed.length < 2) return [];
    return findMatchingBuyers(fullNameComputed);
  }, [fullNameComputed, findMatchingBuyers]);

  // Synchronisation intelligente lors de la saisie du numéro de bien
  const handleNumeroChange = (val: string) => {
    const prev = numero;
    setNumero(val);
    if (!rmbNumber || rmbNumber === prev) {
      setRmbNumber(val);
    }
  };

  // Détection des conflits et doublons de numéros RMB / Nom de terrain en temps réel
  const rmbConflict = useMemo(() => {
    const currentRmb = rmbNumber.trim();
    const currentNumero = numero.trim();

    if (!currentRmb && !currentNumero) return null;

    // 1. Conflit sur le numéro RMB attribué (si renseigné)
    if (currentRmb) {
      const targetRmbNum = extractRmbNumber(currentRmb);
      const targetNormRmb = normalizeText(currentRmb);

      // Vérifier dans les parcelles (seules les parcelles vendues avec acquéreur actif bloquent)
      for (const p of parcelles) {
        const isSold = p.status === "vendu" || p.status === "sold";
        const hasBuyer = Boolean(p.buyer_name && p.buyer_name.trim().length > 0);
        if (!isSold || !hasBuyer) continue;

        const pRmbNum = extractRmbNumber(p.rmb_number) ?? (p.numero?.toUpperCase().includes("RMB") ? extractRmbNumber(p.numero) : null);
        const isExactMatch = (p.rmb_number && normalizeText(p.rmb_number) === targetNormRmb) || (p.numero && normalizeText(p.numero) === targetNormRmb);
        const isNumMatch = targetRmbNum !== null && pRmbNum !== null && targetRmbNum === pRmbNum;

        if (isExactMatch || isNumMatch) {
          return {
            type: "parcelle" as const,
            id: p.id,
            nameOrNumero: p.numero,
            rmbNumber: p.rmb_number || p.numero,
            buyerName: p.buyer_name,
            status: p.status,
            conflictType: "rmb" as const,
          };
        }
      }

      // Vérifier dans les hectares
      for (const h of hectares) {
        const isSold = h.status === "vendu" || h.status === "sold";
        const hasBuyer = Boolean(h.buyer_name && h.buyer_name.trim().length > 0);
        if (!isSold || !hasBuyer) continue;

        const hRmbNum = extractRmbNumber(h.rmb_number) ?? (h.name?.toUpperCase().includes("RMB") ? extractRmbNumber(h.name) : null);
        const isExactMatch = (h.rmb_number && normalizeText(h.rmb_number) === targetNormRmb) || (h.name && normalizeText(h.name) === targetNormRmb);
        const isNumMatch = targetRmbNum !== null && hRmbNum !== null && targetRmbNum === hRmbNum;

        if (isExactMatch || isNumMatch) {
          return {
            type: "hectare" as const,
            id: h.id,
            nameOrNumero: h.name,
            rmbNumber: h.rmb_number || h.name,
            buyerName: h.buyer_name,
            status: h.status,
            conflictType: "rmb" as const,
          };
        }
      }
    }

    // 2. Conflit direct sur le nom / numéro du bien (si non capturé par le RMB)
    if (currentNumero) {
      const targetNormNum = normalizeText(currentNumero);
      const isRmbFormat = currentNumero.toUpperCase().includes("RMB");
      const targetNumRmb = isRmbFormat ? extractRmbNumber(currentNumero) : null;

      if (itemType === "hectare") {
        for (const h of hectares) {
          const isSold = h.status === "vendu" || h.status === "sold";
          const hasBuyer = Boolean(h.buyer_name && h.buyer_name.trim().length > 0);
          if (!isSold || !hasBuyer) continue;

          const isExact = normalizeText(h.name) === targetNormNum;
          const isRmbMatch = targetNumRmb !== null && extractRmbNumber(h.name) === targetNumRmb;
          if (isExact || isRmbMatch) {
            return {
              type: "hectare" as const,
              id: h.id,
              nameOrNumero: h.name,
              rmbNumber: h.rmb_number || h.name,
              buyerName: h.buyer_name,
              status: h.status,
              conflictType: isRmbFormat ? ("rmb" as const) : ("numero" as const),
            };
          }
        }
      } else {
        for (const p of parcelles) {
          const isSold = p.status === "vendu" || p.status === "sold";
          const hasBuyer = Boolean(p.buyer_name && p.buyer_name.trim().length > 0);
          if (!isSold || !hasBuyer) continue;

          const isExact = normalizeText(p.numero) === targetNormNum;
          const isRmbMatch = targetNumRmb !== null && extractRmbNumber(p.numero) === targetNumRmb;
          if (isExact || isRmbMatch) {
            return {
              type: "parcelle" as const,
              id: p.id,
              nameOrNumero: p.numero,
              rmbNumber: p.rmb_number || p.numero,
              buyerName: p.buyer_name,
              status: p.status,
              conflictType: isRmbFormat ? ("rmb" as const) : ("numero" as const),
            };
          }
        }
      }
    }

    return null;
  }, [rmbNumber, numero, parcelles, hectares, itemType]);

  // Vérifier si le conflit est autorisé (acquéreur existant en mode conservation de son dossier RMB)
  const isConflictAllowed = useMemo(() => {
    if (!rmbConflict) return true;
    if (selectedExistingBuyer && existingBuyerMode === "keep_rmb") {
      const buyerNorm = normalizeText(selectedExistingBuyer.buyer_name);
      const conflictBuyerNorm = normalizeText(rmbConflict.buyerName);
      const targetRmbNum = extractRmbNumber(rmbConflict.rmbNumber);

      const hasRmb = selectedExistingBuyer.rmbNumbers.some(
        (r) =>
          normalizeText(r) === normalizeText(rmbConflict.rmbNumber) ||
          (targetRmbNum !== null && extractRmbNumber(r) === targetRmbNum)
      );

      if (hasRmb || (buyerNorm && conflictBuyerNorm && buyerNorm === conflictBuyerNorm)) {
        return true;
      }
    }
    return false;
  }, [rmbConflict, selectedExistingBuyer, existingBuyerMode]);

  // Liste des numéros RMB existants partageant le préfixe ou le texte tapé
  const matchingPrefixRmbList = useMemo(() => {
    const rawQuery = (rmbNumber || numero || "").trim();
    if (rawQuery.length < 2) return [];
    if (rmbConflict) return []; // Inutile si déjà un conflit exact

    const query = rawQuery.toLowerCase();
    const results: { rmb: string; owner?: string | null; type: string }[] = [];
    const seen = new Set<string>();

    for (const p of parcelles) {
      const isSold = p.status === "vendu" || p.status === "sold";
      const hasBuyer = Boolean(p.buyer_name && p.buyer_name.trim().length > 0);
      if (!isSold || !hasBuyer) continue;

      const val = (p.rmb_number || p.numero || "").trim();
      if (val && val.toLowerCase().includes(query) && !seen.has(val.toLowerCase())) {
        seen.add(val.toLowerCase());
        results.push({
          rmb: val,
          owner: p.buyer_name,
          type: "Parcelle",
        });
        if (results.length >= 4) break;
      }
    }

    if (results.length < 4) {
      for (const h of hectares) {
        const isSold = h.status === "vendu" || h.status === "sold";
        const hasBuyer = Boolean(h.buyer_name && h.buyer_name.trim().length > 0);
        if (!isSold || !hasBuyer) continue;

        const val = (h.rmb_number || h.name || "").trim();
        if (val && val.toLowerCase().includes(query) && !seen.has(val.toLowerCase())) {
          seen.add(val.toLowerCase());
          results.push({
            rmb: val,
            owner: h.buyer_name,
            type: "Hectare",
          });
          if (results.length >= 4) break;
        }
      }
    }

    return results;
  }, [rmbNumber, numero, parcelles, hectares, rmbConflict]);

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
    setHectareQuantity("1");
    setHectarePreset("1ha");
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

    if (rmbConflict && !isConflictAllowed) {
      toast.error(
        `Le numéro ${rmbConflict.rmbNumber || rmbConflict.nameOrNumero} est déjà attribué à ${rmbConflict.buyerName || "un autre dossier"}. Veuillez choisir un autre numéro ou utiliser la suite logique.`
      );
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
        // Enregistrement d'un Hectare avec surface exacte
        const surfaceInHa = Math.round((surfaceNum / 10000) * 10000) / 10000;
        // La contrainte PostgreSQL check autorise 'parcelle', 'hectare', 'demi-hectare'
        const purchaseType = (surfaceInHa >= 0.49 && surfaceInHa <= 0.51) ? "demi-hectare" : "hectare";

        const hectarePayload = {
          name: numero.trim(),
          surface: surfaceInHa,
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
          purchase_type: purchaseType,
          prix: parsedPrix,
          payment_type: (isOnereux || isARenseigner) ? "total" : paymentType,
          amount_paid: parsedAmountPaid,
          remaining_amount: parsedRemaining,
          sale_date: isARenseigner ? null : new Date().toISOString(),
        };

        const existingAvailableHectare = hectares.find(
          (h) =>
            h.status !== "vendu" &&
            h.status !== "sold" &&
            (normalizeText(h.name) === normalizeText(numero.trim()) ||
              (rmbNumber.trim() && h.rmb_number && normalizeText(h.rmb_number) === normalizeText(rmbNumber.trim())))
        );

        if (existingAvailableHectare) {
          const { error } = await supabase
            .from("hectares")
            .update(hectarePayload)
            .eq("id", existingAvailableHectare.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("hectares").insert([hectarePayload]);
          if (error) throw error;
        }
      } else {
        // Enregistrement d'une Parcelle (seule ou dans un hectare)
        const targetHectareId = itemType === "parcelle_in_hectare" ? hectareId : null;

        const parcellePayload = {
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
        };

        const existingAvailableParcelle = parcelles.find(
          (p) =>
            p.status !== "vendu" &&
            p.status !== "sold" &&
            (normalizeText(p.numero) === normalizeText(numero.trim()) ||
              (rmbNumber.trim() && p.rmb_number && normalizeText(p.rmb_number) === normalizeText(rmbNumber.trim())))
        );

        if (existingAvailableParcelle) {
          const { error } = await supabase
            .from("parcelles")
            .update(parcellePayload)
            .eq("id", existingAvailableParcelle.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("parcelles").insert([parcellePayload]);
          if (error) throw error;
        }
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
              {/* Carte 1 : Parcelle dans hectare */}
              <button
                type="button"
                onClick={() => handleItemTypeChange("parcelle_in_hectare")}
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
                onClick={() => handleItemTypeChange("parcelle_alone")}
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

              {/* Carte 3 : Hectare complet, fraction ou multiple */}
              <button
                type="button"
                onClick={() => handleItemTypeChange("hectare")}
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
                    Hectare (Terrain)
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                    1 ha, 2 ha, 0.2 ha (2 000 m²), etc.
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
              <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                    Quantité & Format d'hectare souhaité *
                  </Label>
                  <span className="text-[11px] text-purple-700 dark:text-purple-300 font-mono font-bold">
                    {hectareQuantity} ha = {Number(surface || 0)} m²
                  </span>
                </div>

                {/* Boutons de présélection rapide */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  <Button
                    type="button"
                    variant={hectarePreset === "1ha" ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyHectarePreset("1ha")}
                    className={`h-8 text-xs font-semibold ${
                      hectarePreset === "1ha" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""
                    }`}
                  >
                    1 ha (10 000 m²)
                  </Button>
                  <Button
                    type="button"
                    variant={hectarePreset === "2ha" ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyHectarePreset("2ha")}
                    className={`h-8 text-xs font-semibold ${
                      hectarePreset === "2ha" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""
                    }`}
                  >
                    2 ha (20 000 m²)
                  </Button>
                  <Button
                    type="button"
                    variant={hectarePreset === "demi" ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyHectarePreset("demi")}
                    className={`h-8 text-xs font-semibold ${
                      hectarePreset === "demi" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""
                    }`}
                  >
                    Demi-ha (5 000 m²)
                  </Button>
                  <Button
                    type="button"
                    variant={hectarePreset === "2000m2" ? "default" : "outline"}
                    size="sm"
                    onClick={() => applyHectarePreset("2000m2")}
                    className={`h-8 text-xs font-semibold ${
                      hectarePreset === "2000m2" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""
                    }`}
                  >
                    0.2 ha (2 000 m²)
                  </Button>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                  <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>
                    Vous pouvez choisir un bouton rapide ou renseigner librement la quantité ou la surface en m².
                  </span>
                </div>
              </div>
            )}

            {/* Numérotation et surface */}
            <div className={`grid grid-cols-1 ${itemType === "hectare" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"} gap-3`}>
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
                  onChange={(e) => handleNumeroChange(e.target.value)}
                  placeholder={itemType === "hectare" ? "Ex: Hectare 05" : "Ex: RMB 012"}
                  className={`mt-1 h-9 text-xs sm:text-sm ${
                    rmbConflict && !isConflictAllowed ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                  required
                />
              </div>

              {itemType === "hectare" && (
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Quantité d'ha *</Label>
                    <span className="text-[10px] text-muted-foreground">Ex: 1, 0.2, 2</span>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={hectareQuantity}
                    onChange={(e) => handleHectareQuantityChange(e.target.value)}
                    className="mt-1 h-9 text-xs sm:text-sm font-semibold"
                    placeholder="1"
                    required
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Surface (m²) *</Label>
                  {itemType === "hectare" && (
                    <span className="text-[10px] text-purple-700 dark:text-purple-300 font-medium">
                      Calcul auto
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  step="0.01"
                  value={surface}
                  onChange={(e) => handleSurfaceChange(e.target.value)}
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
                  className={`mt-1 h-9 text-xs sm:text-sm font-mono ${
                    rmbConflict && !isConflictAllowed ? "border-destructive focus-visible:ring-destructive" : ""
                  }`}
                />
              </div>
            </div>

            {/* Détection en direct des doublons et alertes RMB */}
            {rmbConflict ? (
              isConflictAllowed ? (
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs space-y-1 animate-in fade-in">
                  <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-300 font-semibold">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>Dossier RMB existant confirmé pour cet acquéreur</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-5">
                    Le numéro <strong className="font-mono text-foreground">{rmbConflict.rmbNumber}</strong> correspond bien au dossier de{" "}
                    <strong className="text-foreground">{selectedExistingBuyer?.buyer_name}</strong>. Ce bien sera rattaché à son dossier existant.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-destructive/10 border border-destructive/40 rounded-xl space-y-2 text-xs animate-in fade-in">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-bold text-destructive flex items-center justify-between">
                        <span>Numéro déjà existant (Doublon détecté)</span>
                        <Badge variant="destructive" className="text-[10px] uppercase font-bold py-0 h-4">
                          Déjà attribué
                        </Badge>
                      </div>
                      <p className="text-foreground/90 mt-1 text-[11px] leading-relaxed">
                        Le numéro <strong className="font-mono underline">{rmbConflict.rmbNumber || rmbConflict.nameOrNumero}</strong> est déjà utilisé par{" "}
                        <strong className="text-foreground">{rmbConflict.buyerName ? `l'acquéreur "${rmbConflict.buyerName}"` : `un terrain existant`}</strong> ({rmbConflict.type === "hectare" ? "Hectare" : "Parcelle"}).
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-destructive/20 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          Prochain RMB disponible : <strong className="font-mono text-primary font-bold">{nextRmbProposal.nextFormatted}</strong>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setNumero(nextRmbProposal.nextFormatted);
                            setRmbNumber(nextRmbProposal.nextFormatted);
                            toast.success(`Numéro ajusté à ${nextRmbProposal.nextFormatted}`);
                          }}
                          className="h-7 text-xs bg-background border-primary/40 hover:bg-primary/10 text-primary font-semibold gap-1.5"
                        >
                          <Sparkles className="w-3 h-3" />
                          Utiliser {nextRmbProposal.nextFormatted}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : matchingPrefixRmbList.length > 0 ? (
              <div className="p-2.5 bg-muted/60 border border-border rounded-lg text-xs space-y-1.5 animate-in fade-in">
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-primary" />
                  <span>Numéros existants contenant cette saisie :</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {matchingPrefixRmbList.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-background border border-border text-foreground font-mono"
                    >
                      <span className="font-semibold text-primary">{item.rmb}</span>
                      {item.owner && <span className="text-muted-foreground font-sans">({item.owner})</span>}
                    </span>
                  ))}
                </div>
              </div>
            ) : (rmbNumber || numero) ? (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium pl-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Numéro disponible (aucun doublon détecté)</span>
              </div>
            ) : null}
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
