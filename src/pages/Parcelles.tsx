import { useEffect, useState, useMemo, useDeferredValue, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Grid3x3, DollarSign, User, Phone, Mail, Calendar, Package, CreditCard, MapPin, ListOrdered, Hash, Sparkles, Layers, ArrowLeftRight, Check, Loader2, MoreVertical, ArrowUpDown, UserCheck, Clock, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { PaymentDialog } from "@/components/PaymentDialog";
import { HectareSelector } from "@/components/HectareSelector";
import { MultiDocumentUploader, uploadDocEntries, type DocEntry } from "@/components/MultiDocumentUploader";
import { auditHectare } from "@/lib/numberingAudit";
import { compareParcellesByRmbSuite, getNextAvailableRmb, extractRmbNumber, getNextParcelleInHectareRmb, getHectareRootRmb } from "@/lib/rmbSuite";
import { useBuyerDetection, type ExistingBuyer, normalizeText } from "@/hooks/useBuyerDetection";
import { BuyerQuotaSuggestion } from "@/components/BuyerQuotaSuggestion";
import { hectareCapacity } from "@/lib/hectareCapacity";
import { UnifiedLandSaleDialog } from "@/components/UnifiedLandSaleDialog";
import jsPDF from "jspdf";
import headerImage from "@/assets/en_tete_concession_manuel.jpg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Parcelle {
  id: string;
  merged_group_id?: string | null;
  numero: string;
  surface: number;
  prix: number;
  status: string;
  buyer_name: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
  sale_date: string | null;
  hectare_id: string | null;
  payment_type: string;
  amount_paid: number;
  remaining_amount: number;
  sale_type: string;
  purchase_type: string | null;
  rmb_number: string | null;
  latitude: number | null;
  longitude: number | null;
  hectares?: {
    name: string;
    rmb_number: string | null;
  } | null;
}

interface Hectare {
  id: string;
  name: string;
  rmb_number: string | null;
  latitude: number | null;
  longitude: number | null;
  surface: number | null;
  purchase_type: string | null;
}

const Parcelles = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [allParcelles, setAllParcelles] = useState<Parcelle[]>([]);
  const [hectares, setHectares] = useState<Hectare[]>([]);
  const [loading, setLoading] = useState(true);
  // Rechargement de la liste après un changement d'onglet ou d'hectare
  const [listLoading, setListLoading] = useState(false);
  // Numéro de la dernière requête de liste : une réponse plus ancienne qui
  // arrive en retard ne doit pas écraser la vue actuellement sélectionnée.
  const listRequestId = useRef(0);
  // Parcelle dont la fenêtre « Modifier » attend ses documents
  const editDocsParcelleId = useRef<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"rmb_asc" | "numero_asc" | "numero_desc" | "surface_desc" | "status">("rmb_asc");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedParcelle, setSelectedParcelle] = useState<Parcelle | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedHectare, setSelectedHectare] = useState<string>(
    searchParams.get("hectare") || "standalone"
  );
  // "all", "standalone" et "assigned" (toutes les parcelles sur un hectare) sont des vues ;
  // toute autre valeur est l'identifiant d'un hectare précis.
  const isSpecificHectare = !["all", "standalone", "assigned"].includes(selectedHectare);
  const parcelleScope: "all" | "standalone" | "hectare" =
    selectedHectare === "all" ? "all" : selectedHectare === "standalone" ? "standalone" : "hectare";

  // Hook de détection intelligente d'acquéreurs existants et de leur quota
  const { findMatchingBuyers, refetch: refetchBuyerDetection } = useBuyerDetection();
  const [selectedExistingBuyer, setSelectedExistingBuyer] = useState<ExistingBuyer | null>(null);

  // Calcul du prochain numéro de la suite logique RMB (comblement de trou ou numéro suivant)
  const nextRmbProposal = useMemo(() => {
    return getNextAvailableRmb(allParcelles, hectares);
  }, [allParcelles, hectares]);

  const [formData, setFormData] = useState({
    assignment_type: (searchParams.get("hectare") ? "hectare" : "standalone") as "hectare" | "standalone",
    numero: "",
    surface: "",
    prix: "",
    hectare_id: searchParams.get("hectare") || "",
    rmb_number: "",
    sale_type: "normal",
    latitude: "",
    longitude: "",
  });

  // Documents pour le formulaire de création
  const [newDocs, setNewDocs] = useState<DocEntry[]>([]);
  // Documents pour le formulaire d'édition
  const [editDocs, setEditDocs] = useState<DocEntry[]>([]);
  // Documents existants pour la parcelle en cours d'édition
  const [existingDocs, setExistingDocs] = useState<{id:string;title:string;type:string;file_url:string}[]>([]);

  // État pour la réaffectation rapide (parcelle seule vs affecter à un hectare)
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [parcelleToReassign, setParcelleToReassign] = useState<Parcelle | null>(null);
  const [reassignType, setReassignType] = useState<"standalone" | "hectare">("standalone");
  const [reassignHectareId, setReassignHectareId] = useState<string>("");
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  // Calculer l'effectif restant pour un hectare donné
  const getHectareOccupancy = (hectareId: string) => {
    const hectareParcelles = allParcelles.filter(p => p.hectare_id === hectareId);
    const occupiedEffectif = hectareParcelles.reduce((total, p) => {
      return total + Math.ceil(p.surface / 600);
    }, 0);
    const capacity = hectareCapacity(hectares.find(h => h.id === hectareId));
    return {
      occupied: occupiedEffectif,
      remaining: capacity - occupiedEffectif,
      total: capacity
    };
  };
  const [editFormData, setEditFormData] = useState({
    assignment_type: "hectare" as "hectare" | "standalone",
    status: "",
    buyer_name: "",
    buyer_phone: "",
    buyer_email: "",
    sale_date: "",
    payment_type: "total",
    amount_paid: "",
    sale_type: "normal",
    prix: "",
    purchase_type: "parcelle",
    rmb_number: "",
    hectare_id: "",
    latitude: "",
    longitude: "",
  });

  const getHectarePrefix = (name: string) => {
    const cleanName = name.replace(/\s+/g, ' ').trim();
    const deIndex = cleanName.toLowerCase().indexOf(" de ");
    if (deIndex > 0) {
      return cleanName.substring(0, deIndex).trim();
    }
    const parIndex = cleanName.toLowerCase().indexOf(" par ");
    if (parIndex > 0) {
      return cleanName.substring(0, parIndex).trim();
    }
    const words = cleanName.split(' ');
    if (words.length >= 2 && words[0].toUpperCase() === "RMB") {
      return `${words[0]} ${words[1]}`;
    }
    return words[0];
  };

  const handleHectareChange = async (hectareId: string) => {
    setFormData(prev => ({ ...prev, hectare_id: hectareId }));
    if (!hectareId) return;

    try {
      const selectedHec = hectares.find(h => h.id === hectareId);
      if (!selectedHec) return;

      // Récupérer toutes les parcelles déjà créées pour cet hectare
      const { data: hParcelles, error } = await supabase
        .from("parcelles")
        .select("id, numero, rmb_number, hectare_id, status")
        .eq("hectare_id", hectareId);

      if (error) throw error;

      // Calculer le prochain numéro dérivé dans cet hectare racine (ex: RMB 223/01, 223/02...)
      const prop = getNextParcelleInHectareRmb(selectedHec, hParcelles || []);

      setFormData(prev => ({
        ...prev,
        numero: prop.formattedNumero,
        rmb_number: prop.formattedRmb,
      }));

      toast.info(`Sous-parcelle indexée : ${prop.formattedRmb} assignée à l'hectare racine ${selectedHec.name}`);
    } catch (err) {
      console.error("Erreur lors du calcul automatique du numéro de parcelle:", err);
    }
  };

  const handleOpenCreateDialog = () => {
    if (isSpecificHectare) {
      const activeHec = hectares.find(h => h.id === selectedHectare);
      const hParcelles = allParcelles.filter(p => p.hectare_id === selectedHectare);
      const prop = getNextParcelleInHectareRmb(activeHec, hParcelles);
      setFormData({
        assignment_type: "hectare",
        numero: prop.formattedNumero,
        surface: "600",
        prix: "",
        hectare_id: selectedHectare,
        rmb_number: prop.formattedRmb,
        sale_type: "normal",
        latitude: "",
        longitude: "",
      });
    } else {
      setFormData({
        assignment_type: "standalone",
        numero: nextRmbProposal.nextFormatted,
        surface: "600",
        prix: "",
        hectare_id: "",
        rmb_number: nextRmbProposal.nextFormatted,
        sale_type: "normal",
        latitude: "",
        longitude: "",
      });
    }
    setNewDocs([]);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    checkAuth();
    fetchHectares();
    fetchAllParcelles();
  }, []);

  useEffect(() => {
    fetchParcelles();
  }, [selectedHectare]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };

  const fetchHectares = async () => {
    try {
      const { data, error } = await supabase
        .from("hectares")
        .select("id, name, rmb_number, latitude, longitude, surface, purchase_type")
        .order("name");

      if (error) throw error;
      setHectares(data || []);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const fetchAllParcelles = async () => {
    try {
      const { data, error } = await supabase
        .from("parcelles")
        .select("id, hectare_id, surface, numero, rmb_number, status");

      if (error) throw error;
      setAllParcelles((data as any) || []);
    } catch (error) {
      console.error("Erreur:", error);
    }
  };

  const fetchParcelles = async () => {
    const requestId = ++listRequestId.current;
    setListLoading(true);
    try {
      let query = supabase.from("parcelles").select(`
        *,
        hectares (
          name,
          rmb_number,
          latitude,
          longitude
        )
      `);
      
      if (selectedHectare === "standalone") {
        query = query.is("hectare_id", null);
      } else if (selectedHectare === "assigned") {
        query = query.not("hectare_id", "is", null);
      } else if (selectedHectare && selectedHectare !== "all") {
        query = query.eq("hectare_id", selectedHectare);
      }

      const { data, error } = await query.order("numero");

      if (requestId !== listRequestId.current) return;
      if (error) throw error;
      setParcelles((data as any) || []);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des parcelles");
    } finally {
      if (requestId === listRequestId.current) {
        setLoading(false);
        setListLoading(false);
      }
    }
  };

  // Liste affichée + données des compteurs (onglets, occupation des hectares, prochain RMB)
  const refreshParcelles = () => Promise.all([fetchParcelles(), fetchAllParcelles()]);

  // ===== Sélection multiple et actions groupées =====
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkHectareId, setBulkHectareId] = useState("");
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  // Changer de vue repart d'une sélection vide
  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedHectare]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedParcelles = useMemo(
    () => parcelles.filter((p) => selectedIds.has(p.id)),
    [parcelles, selectedIds]
  );

  const handleBulkAssign = async () => {
    if (!bulkHectareId || selectedParcelles.length === 0) return;
    setBulkSubmitting(true);
    try {
      const { data: existing, error: countError } = await supabase
        .from("parcelles")
        .select("id, surface")
        .eq("hectare_id", bulkHectareId);
      if (countError) throw countError;

      const occupied = (existing || []).reduce((t, p) => t + Math.ceil(Number(p.surface || 600) / 600), 0);
      const moving = selectedParcelles.filter((p) => p.hectare_id !== bulkHectareId);
      const needed = moving.reduce((t, p) => t + Math.ceil(Number(p.surface || 600) / 600), 0);
      const capacity = hectareCapacity(hectares.find((h) => h.id === bulkHectareId));

      if (occupied + needed > capacity) {
        toast.error(
          `Capacité insuffisante : cet hectare a ${Math.max(0, capacity - occupied)} place(s) libre(s) sur ${capacity}, la sélection en demande ${needed}.`
        );
        return;
      }

      if (moving.length > 0) {
        const { error } = await supabase
          .from("parcelles")
          .update({ hectare_id: bulkHectareId })
          .in("id", moving.map((p) => p.id));
        if (error) throw error;
      }

      const hectareName = hectares.find((h) => h.id === bulkHectareId)?.name || "l'hectare";
      toast.success(`${moving.length} parcelle(s) affectée(s) à ${hectareName}`);
      setBulkAssignOpen(false);
      clearSelection();
      await refreshParcelles();
    } catch (err: any) {
      console.error("Erreur affectation groupée:", err);
      toast.error(`Erreur : ${err.message || "Erreur inconnue"}`);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkDetach = async () => {
    const attached = selectedParcelles.filter((p) => p.hectare_id);
    if (attached.length === 0) {
      toast.info("Les parcelles sélectionnées sont déjà des parcelles seules");
      return;
    }
    if (!confirm(`Détacher ${attached.length} parcelle(s) de leur hectare pour en faire des parcelles seules ?`)) return;
    setBulkSubmitting(true);
    try {
      const { error } = await supabase
        .from("parcelles")
        .update({ hectare_id: null })
        .in("id", attached.map((p) => p.id));
      if (error) throw error;
      toast.success(`${attached.length} parcelle(s) transformée(s) en parcelles seules`);
      clearSelection();
      await refreshParcelles();
    } catch (err: any) {
      console.error("Erreur détachement groupé:", err);
      toast.error(`Erreur : ${err.message || "Erreur inconnue"}`);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedParcelles.length;
    if (count === 0) return;
    const sold = selectedParcelles.filter((p) => p.status === "vendu").length;
    const warning = sold > 0 ? `

Attention : ${sold} d'entre elles sont vendues, avec leur acquéreur et leurs paiements.` : "";
    if (!confirm(`Supprimer définitivement ${count} parcelle(s) ?${warning}`)) return;
    setBulkSubmitting(true);
    try {
      const { error } = await supabase
        .from("parcelles")
        .delete()
        .in("id", selectedParcelles.map((p) => p.id));
      if (error) throw error;
      toast.success(`${count} parcelle(s) supprimée(s)`);
      clearSelection();
      await refreshParcelles();
      queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
    } catch (err: any) {
      console.error("Erreur suppression groupée:", err);
      toast.error(`Erreur : ${err.message || "Erreur inconnue"}`);
    } finally {
      setBulkSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isStandalone = formData.assignment_type === "standalone";
    const hectareIdToSave = isStandalone ? null : (formData.hectare_id || null);

    if (!isStandalone && !hectareIdToSave) {
      toast.error("Veuillez sélectionner un hectare existant, ou choisissez 'Parcelle seule'");
      return;
    }

    try {
      // Si affectée à un hectare, vérifier la limite de capacité de cet hectare
      if (!isStandalone && hectareIdToSave) {
        const { data: existingParcelles, error: countError } = await supabase
          .from("parcelles")
          .select("id, surface, merged_group_id", { count: "exact" })
          .eq("hectare_id", hectareIdToSave);

        if (countError) throw countError;

        // Calculer l'effectif occupé
        const occupiedEffectif = (existingParcelles || []).reduce((total, p) => {
          return total + Math.ceil(p.surface / 600);
        }, 0);
        
        const newParcelleEffectif = Math.ceil(parseFloat(formData.surface) / 600);

        const capacity = hectareCapacity(hectares.find(h => h.id === hectareIdToSave));
        if (occupiedEffectif + newParcelleEffectif > capacity) {
          toast.error(`Limite atteinte : cette parcelle occupe ${newParcelleEffectif} en effectif et l'hectare n'a plus assez d'espace (${capacity - occupiedEffectif} disponible sur ${capacity})`);
          return;
        }
      }

      const isOnereux = formData.sale_type === "onereux";
      const isARenseigner = formData.sale_type === "a_renseigner";
      const prix = (isOnereux || isARenseigner) ? 0 : parseFloat(formData.prix);

      const { data: newParcelleData, error } = await supabase.from("parcelles").insert([
        {
          numero: formData.numero,
          surface: parseFloat(formData.surface),
          prix: prix,
          hectare_id: hectareIdToSave,
          status: "disponible",
          rmb_number: formData.rmb_number || null,
          sale_type: isARenseigner ? null : formData.sale_type,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        },
      ]).select("id").single();

      if (error) throw error;

      if (newParcelleData && newDocs.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const uploaded = await uploadDocEntries(newDocs, newParcelleData.id, user?.id);
        if (uploaded > 0) toast.success(`${uploaded} document(s) ajouté(s)`);
      }

      toast.success(isStandalone ? "Parcelle seule créée avec succès" : "Parcelle créée et rattachée à l'hectare");
      setIsDialogOpen(false);
      setNewDocs([]);
      setFormData({ 
        assignment_type: isSpecificHectare ? "hectare" : "standalone",
        numero: "", 
        surface: "", 
        prix: "", 
        hectare_id: isSpecificHectare ? selectedHectare : "", 
        rmb_number: "",
        sale_type: "normal",
        latitude: "",
        longitude: "",
      });
      refreshParcelles();
      queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
    } catch (error: any) {
      console.error("Erreur:", error);
      toast.error(error?.message || "Erreur lors de la création de la parcelle");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette parcelle ?")) return;

    try {
      const { error } = await supabase.from("parcelles").delete().eq("id", id);
      if (error) throw error;

      toast.success("Parcelle supprimée");
      refreshParcelles();
      queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleEdit = async (parcelle: Parcelle) => {
    setSelectedParcelle(parcelle);
    setSelectedExistingBuyer(null);

    // Si la parcelle a déjà un acheteur, chercher s'il correspond à un profil existant
    if (parcelle.buyer_name) {
      const existing = findMatchingBuyers(parcelle.buyer_name);
      if (existing.length > 0 && normalizeText(existing[0].buyer_name) === normalizeText(parcelle.buyer_name)) {
        setSelectedExistingBuyer(existing[0]);
      }
    }

    setEditFormData({
      assignment_type: parcelle.hectare_id ? "hectare" : "standalone",
      status: parcelle.status || "disponible",
      buyer_name: parcelle.buyer_name || "",
      buyer_phone: parcelle.buyer_phone || "",
      buyer_email: parcelle.buyer_email || "",
      sale_date: parcelle.sale_date || "",
      payment_type: parcelle.payment_type || "total",
      amount_paid: parcelle.amount_paid?.toString() || "",
      hectare_id: parcelle.hectare_id || "",
      sale_type: parcelle.sale_type === "a_renseigner" || (parcelle.status === "vendu" && !parcelle.sale_type) ? "a_renseigner" : (parcelle.sale_type || "normal"),
      prix: parcelle.prix?.toString() || "",
      purchase_type: parcelle.purchase_type || "parcelle",
      rmb_number: parcelle.rmb_number || "",
      latitude: parcelle.latitude?.toString() || "",
      longitude: parcelle.longitude?.toString() || "",
    });
    setEditDocs([]);
    setExistingDocs([]);
    // Ouvrir tout de suite ; les documents existants arrivent ensuite
    setIsEditDialogOpen(true);
    editDocsParcelleId.current = parcelle.id;
    try {
      const { data } = await supabase
        .from("documents")
        .select("id, title, type, file_url")
        .eq("parcelle_id", parcelle.id)
        .order("created_at");
      if (editDocsParcelleId.current === parcelle.id) setExistingDocs(data || []);
    } catch {
      if (editDocsParcelleId.current === parcelle.id) setExistingDocs([]);
    }
  };

  const handleSelectExistingBuyer = (buyer: ExistingBuyer) => {
    setSelectedExistingBuyer(buyer);
    setEditFormData((prev) => ({
      ...prev,
      buyer_name: buyer.buyer_name,
      buyer_phone: buyer.buyer_phone || prev.buyer_phone,
      buyer_email: buyer.buyer_email || prev.buyer_email,
      rmb_number: buyer.primaryRmb || prev.rmb_number,
    }));
    const curQuota = Math.max(1, Math.ceil(Number(selectedParcelle?.surface || 600) / 600));
    toast.success(
      `Parcelle rattachée au quota de ${buyer.buyer_name} (${buyer.quotas} + ${curQuota} = ${buyer.quotas + curQuota} quotas)`
    );
  };

  const handleDetachExistingBuyer = () => {
    setSelectedExistingBuyer(null);
    toast.info("Acquéreur détaché du quota groupé");
  };

  const handleAddPayment = (parcelle: Parcelle) => {
    setSelectedParcelle(parcelle);
    setPaymentDialogOpen(true);
  };

  const handleUpdateParcelle = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedParcelle) return;

    try {
      const isStandalone = editFormData.assignment_type === "standalone";
      const newHectareId = isStandalone ? null : (editFormData.hectare_id || null);

      if (!isStandalone && !newHectareId) {
        toast.error("Veuillez sélectionner un hectare existant ou choisir 'Parcelle seule'");
        return;
      }

      // Vérifier la capacité uniquement si on affecte à un hectare et qu'il est différent de l'ancien
      if (newHectareId && newHectareId !== selectedParcelle.hectare_id) {
        const { data: existingParcelles, error: countError } = await supabase
          .from("parcelles")
          .select("id, surface, merged_group_id", { count: "exact" })
          .eq("hectare_id", newHectareId);

        if (countError) throw countError;

        // Calculer l'effectif occupé
        const occupiedEffectif = (existingParcelles || []).reduce((total, p) => {
          return total + Math.ceil(p.surface / 600);
        }, 0);
        
        // Calculer l'effectif que cette parcelle va ajouter
        const newParcelleEffectif = Math.ceil(selectedParcelle.surface / 600);

        const capacity = hectareCapacity(hectares.find(h => h.id === newHectareId));
        if (occupiedEffectif + newParcelleEffectif > capacity) {
          toast.error(`Limite atteinte : l'hectare sélectionné n'a pas assez d'espace (${capacity - occupiedEffectif} en effectif disponible, ${newParcelleEffectif} requis)`);
          return;
        }
      }

      const isOnereux = editFormData.sale_type === "onereux";
      const isARenseigner = editFormData.sale_type === "a_renseigner";
      const prix = (isOnereux || isARenseigner) ? 0 : (parseFloat(editFormData.prix) || selectedParcelle.prix || 0);

      const updateData: any = {
        status: editFormData.status,
        prix: prix,
        sale_type: isARenseigner ? null : editFormData.sale_type,
        purchase_type: editFormData.purchase_type,
        rmb_number: editFormData.rmb_number || null,
        hectare_id: newHectareId,
        latitude: editFormData.latitude ? parseFloat(editFormData.latitude) : selectedParcelle.latitude,
        longitude: editFormData.longitude ? parseFloat(editFormData.longitude) : selectedParcelle.longitude,
      };

      if (editFormData.status === "vendu") {
        if (!editFormData.buyer_name) {
          toast.error("Le nom de l'acheteur est requis pour une vente");
          return;
        }
        
        const amountPaid = (isOnereux || isARenseigner) ? 0 : (editFormData.payment_type === "total" ? prix : (parseFloat(editFormData.amount_paid) || 0));
        const remainingAmount = (isOnereux || isARenseigner) ? 0 : (editFormData.payment_type === "partiel" ? prix - amountPaid : 0);
        
        updateData.buyer_name = editFormData.buyer_name;
        updateData.buyer_phone = editFormData.buyer_phone || null;
        updateData.buyer_email = editFormData.buyer_email || null;
        updateData.sale_date = isARenseigner ? null : (editFormData.sale_date || new Date().toISOString());
        updateData.payment_type = (isOnereux || isARenseigner) ? "total" : editFormData.payment_type;
        updateData.amount_paid = amountPaid;
        updateData.remaining_amount = remainingAmount;

        // Liaison intelligente avec l'acquéreur existant et son quota
        if (selectedExistingBuyer) {
          updateData.merged_group_id = selectedExistingBuyer.mergedGroupId || selectedParcelle.merged_group_id || crypto.randomUUID();
          if (selectedExistingBuyer.buyer_last_name) updateData.buyer_last_name = selectedExistingBuyer.buyer_last_name;
          if (selectedExistingBuyer.buyer_first_name) updateData.buyer_first_name = selectedExistingBuyer.buyer_first_name;
          if (selectedExistingBuyer.buyer_profession) updateData.buyer_profession = selectedExistingBuyer.buyer_profession;
          if (selectedExistingBuyer.buyer_birth_place) updateData.buyer_birth_place = selectedExistingBuyer.buyer_birth_place;
          if (selectedExistingBuyer.buyer_birth_date) updateData.buyer_birth_date = selectedExistingBuyer.buyer_birth_date;
          if (selectedExistingBuyer.buyer_marital_status) updateData.buyer_marital_status = selectedExistingBuyer.buyer_marital_status;
          if (selectedExistingBuyer.buyer_children_count !== null) updateData.buyer_children_count = selectedExistingBuyer.buyer_children_count;
          if (selectedExistingBuyer.buyer_address) updateData.buyer_address = selectedExistingBuyer.buyer_address;
          if (selectedExistingBuyer.buyer_village_origin) updateData.buyer_village_origin = selectedExistingBuyer.buyer_village_origin;
          if (selectedExistingBuyer.buyer_groupement) updateData.buyer_groupement = selectedExistingBuyer.buyer_groupement;
          if (selectedExistingBuyer.buyer_secteur) updateData.buyer_secteur = selectedExistingBuyer.buyer_secteur;
          if (selectedExistingBuyer.buyer_territoire) updateData.buyer_territoire = selectedExistingBuyer.buyer_territoire;
          if (selectedExistingBuyer.buyer_province) updateData.buyer_province = selectedExistingBuyer.buyer_province;
        }
      } else {
        // Si le statut n'est pas "vendu", on enlève les infos acheteur
        updateData.buyer_name = null;
        updateData.buyer_phone = null;
        updateData.buyer_email = null;
        updateData.sale_date = null;
        updateData.payment_type = "total";
        updateData.amount_paid = 0;
        updateData.remaining_amount = 0;
        updateData.merged_group_id = null;
      }

      const { error } = await supabase
        .from("parcelles")
        .update(updateData)
        .eq("id", selectedParcelle.id);

      if (error) throw error;

      // Upload des nouveaux documents
      if (editDocs.length > 0) {
        const { data: { user } } = await supabase.auth.getUser();
        const uploaded = await uploadDocEntries(editDocs, selectedParcelle.id, user?.id);
        if (uploaded > 0) toast.success(`${uploaded} document(s) ajouté(s)`);
      }

      toast.success(
        selectedExistingBuyer
          ? `Parcelle mise à jour et ajoutée au quota de ${selectedExistingBuyer.buyer_name}`
          : "Parcelle mise à jour avec succès"
      );
      
      // Générer la facture si vendu
      if (editFormData.status === "vendu") {
        await generateInvoice(selectedParcelle, updateData);
      }
      
      setIsEditDialogOpen(false);
      setSelectedParcelle(null);
      setSelectedExistingBuyer(null);
      setEditDocs([]);
      setExistingDocs([]);
      refreshParcelles();
      refetchBuyerDetection();
      queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
      queryClient.invalidateQueries({ queryKey: ["existing-buyers-detection"] });
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleOpenReassignModal = (parcelle: Parcelle) => {
    setParcelleToReassign(parcelle);
    setReassignType(parcelle.hectare_id ? "hectare" : "standalone");
    setReassignHectareId(parcelle.hectare_id || hectares[0]?.id || "");
    setReassignModalOpen(true);
  };

  const handleSaveReassignment = async () => {
    if (!parcelleToReassign) return;

    const isStandalone = reassignType === "standalone";
    const newHectareId = isStandalone ? null : reassignHectareId;

    if (!isStandalone && !newHectareId) {
      toast.error("Veuillez sélectionner un hectare existant.");
      return;
    }

    try {
      setReassignSubmitting(true);

      // Si on affecte à un hectare différent, vérifier sa capacité (15 par ha, 8 pour un demi-ha)
      if (newHectareId && newHectareId !== parcelleToReassign.hectare_id) {
        const { data: existingParcelles, error: countError } = await supabase
          .from("parcelles")
          .select("id, surface, merged_group_id")
          .eq("hectare_id", newHectareId);

        if (countError) throw countError;

        const occupiedEffectif = (existingParcelles || []).reduce((total, p) => {
          return total + Math.ceil(p.surface / 600);
        }, 0);

        const parcelleEffectif = Math.ceil(Number(parcelleToReassign.surface || 600) / 600);

        const capacity = hectareCapacity(hectares.find(h => h.id === newHectareId));
        if (occupiedEffectif + parcelleEffectif > capacity) {
          toast.error(
            `Capacité insuffisante : cet hectare dispose de ${capacity - occupiedEffectif} effectifs disponibles (${parcelleEffectif} requis).`
          );
          setReassignSubmitting(false);
          return;
        }
      }

      const { error } = await supabase
        .from("parcelles")
        .update({ hectare_id: newHectareId })
        .eq("id", parcelleToReassign.id);

      if (error) throw error;

      const targetHectareName = isStandalone
        ? "Parcelle seule (hors hectare)"
        : hectares.find((h) => h.id === newHectareId)?.name || "l'hectare";

      toast.success(
        isStandalone
          ? `La parcelle ${parcelleToReassign.numero} a été transformée en parcelle seule avec succès !`
          : `La parcelle ${parcelleToReassign.numero} a été affectée à ${targetHectareName} avec succès !`
      );

      setReassignModalOpen(false);
      setParcelleToReassign(null);
      await refreshParcelles();
    } catch (err: any) {
      console.error("Erreur affectation parcelle:", err);
      toast.error(`Erreur : ${err.message || "Erreur inconnue"}`);
    } finally {
      setReassignSubmitting(false);
    }
  };

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [displayLimit, setDisplayLimit] = useState(36);

  useEffect(() => {
    setDisplayLimit(36);
  }, [deferredSearchTerm, selectedHectare, sortBy]);

  // Filtrage et classement strict dans la suite logique RMB (ou critère choisi)
  const filteredParcelles = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    const result = parcelles.filter((p) => {
      if (!term) return true;
      const numMatch = (p.numero || "").toLowerCase().includes(term);
      const buyerMatch = (p.buyer_name || "").toLowerCase().includes(term);
      const rmbMatch = (p.rmb_number || "").toLowerCase().includes(term);
      const hecMatch = (p.hectares?.name || "").toLowerCase().includes(term);
      const hecRmbMatch = (p.hectares?.rmb_number || "").toLowerCase().includes(term);
      return numMatch || buyerMatch || rmbMatch || hecMatch || hecRmbMatch;
    });

    return result.sort((a, b) => {
      if (sortBy === "rmb_asc") {
        return compareParcellesByRmbSuite(a, b);
      }
      if (sortBy === "numero_asc") {
        return (a.numero || "").localeCompare(b.numero || "", undefined, { numeric: true });
      }
      if (sortBy === "numero_desc") {
        return (b.numero || "").localeCompare(a.numero || "", undefined, { numeric: true });
      }
      if (sortBy === "surface_desc") {
        return Number(b.surface || 0) - Number(a.surface || 0);
      }
      if (sortBy === "status") {
        return (a.status || "").localeCompare(b.status || "");
      }
      return compareParcellesByRmbSuite(a, b);
    });
  }, [parcelles, deferredSearchTerm, sortBy]);

  const viewSummary = useMemo(() => {
    let sold = 0;
    let available = 0;
    let remaining = 0;
    filteredParcelles.forEach((p) => {
      if (p.status === "vendu") sold++;
      else if (p.status !== "reserve") available++;
      if (p.payment_type === "partiel") remaining += Number(p.remaining_amount || 0);
    });
    return { total: filteredParcelles.length, sold, available, remaining };
  }, [filteredParcelles]);

  const displayedParcelles = useMemo(() => {
    return filteredParcelles.slice(0, displayLimit);
  }, [filteredParcelles, displayLimit]);

  // Détection en temps réel d'acquéreurs existants lors de la saisie
  const buyerMatches = useMemo(() => {
    if (!editFormData.buyer_name || editFormData.buyer_name.trim().length < 2) return [];
    if (
      selectedExistingBuyer &&
      normalizeText(selectedExistingBuyer.buyer_name) === normalizeText(editFormData.buyer_name)
    ) {
      return [];
    }
    return findMatchingBuyers(editFormData.buyer_name);
  }, [editFormData.buyer_name, selectedExistingBuyer, findMatchingBuyers]);

  const generateInvoice = async (parcelle: Parcelle, saleData: any) => {
    try {
      const pdf = new jsPDF();
      
      // Ajouter l'en-tête image
      pdf.addImage(headerImage, 'JPEG', 0, 0, 210, 30);
      
      let yPos = 40;
      
      // Titre
      pdf.setFontSize(18);
      pdf.setFont("helvetica", "bold");
      pdf.text("FACTURE DE VENTE", 105, yPos, { align: "center" });
      yPos += 15;
      
      // Informations générales
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Date: ${new Date(saleData.sale_date).toLocaleDateString()}`, 20, yPos);
      yPos += 10;
      pdf.text(`Parcelle N°: ${parcelle.numero}`, 20, yPos);
      yPos += 10;
      pdf.text(`Surface: ${parcelle.surface} m²`, 20, yPos);
      yPos += 15;
      
      // Type de vente
      const isARenseignerSale = saleData.sale_type === "a_renseigner" || (!saleData.sale_type && (saleData.status === "vendu" || Boolean(saleData.buyer_name)));
      pdf.setFont("helvetica", "bold");
      pdf.text(`Type de vente: ${saleData.sale_type === "onereux" ? "À titre gratuit" : isARenseignerSale ? "À renseigner" : "Vente normale"}`, 20, yPos);
      yPos += 15;
      
      // Informations acheteur
      pdf.setFontSize(14);
      pdf.text("INFORMATIONS ACHETEUR", 20, yPos);
      yPos += 8;
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Nom: ${saleData.buyer_name}`, 20, yPos);
      yPos += 7;
      if (saleData.buyer_phone) {
        pdf.text(`Téléphone: ${saleData.buyer_phone}`, 20, yPos);
        yPos += 7;
      }
      if (saleData.buyer_email) {
        pdf.text(`Email: ${saleData.buyer_email}`, 20, yPos);
        yPos += 7;
      }
      yPos += 10;
      
      // Détails financiers
      if (isARenseignerSale) {
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("DÉTAILS FINANCIERS", 20, yPos);
        yPos += 8;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "italic");
        pdf.text("Prix et modalités de paiement : À renseigner ultérieurement", 20, yPos);
        yPos += 10;
      } else if (saleData.sale_type !== "onéreux" && saleData.sale_type !== "onereux") {
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text("DÉTAILS FINANCIERS", 20, yPos);
        yPos += 8;
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.text(`Prix total: $${saleData.prix.toLocaleString()}`, 20, yPos);
        yPos += 7;
        pdf.text(`Type de paiement: ${saleData.payment_type === "partiel" ? "Paiement partiel" : "Paiement total"}`, 20, yPos);
        yPos += 7;
        
        if (saleData.payment_type === "partiel") {
          pdf.text(`Montant payé: $${saleData.amount_paid.toLocaleString()}`, 20, yPos);
          yPos += 7;
          pdf.setFont("helvetica", "bold");
          pdf.text(`Montant restant: $${saleData.remaining_amount.toLocaleString()}`, 20, yPos);
          pdf.setFont("helvetica", "normal");
        } else {
          pdf.setFont("helvetica", "bold");
          pdf.text("PAYÉ INTÉGRALEMENT", 20, yPos);
          pdf.setFont("helvetica", "normal");
        }
        yPos += 10;
      }
      
      // Pied de page
      yPos = 270;
      pdf.setFontSize(10);
      pdf.text("___________________________", 20, yPos);
      pdf.text("___________________________", 120, yPos);
      yPos += 5;
      pdf.text("Signature Vendeur", 20, yPos);
      pdf.text("Signature Acheteur", 120, yPos);
      
      // Sauvegarder le PDF
      pdf.save(`facture-parcelle-${parcelle.numero}-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success("Facture générée avec succès");
    } catch (error) {
      console.error("Erreur génération facture:", error);
      toast.error("Erreur lors de la génération de la facture");
    }
  };

  // Statut lisible : libellé, fond et pastille
  const getStatusStyle = (status: string) => {
    const styles = {
      vendu: { label: "Vendue", className: "bg-blue-500/10 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
      reserve: { label: "Réservée", className: "bg-amber-500/10 text-amber-800 dark:text-amber-300", dot: "bg-amber-500" },
      disponible: { label: "Disponible", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
    };
    return styles[status as keyof typeof styles] || styles.disponible;
  };

  // L'emplacement n'est utile que dans les vues qui mélangent les rattachements
  const showLocation = selectedHectare === "all" || selectedHectare === "assigned";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      <div className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
        <PageHeader
          title="Gestion des Parcelles"
          description="Parcelles vendues ou disponibles, seules ou découpées dans un hectare."
          actions={
            <Button onClick={handleOpenCreateDialog} className="gap-2 font-semibold">
              <Plus className="w-4 h-4" />
              <span>Nouvelle parcelle</span>
            </Button>
          }
        />

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          <div className="flex flex-wrap gap-1 p-1 rounded-lg border border-border bg-card shrink-0" role="tablist" aria-label="Type de parcelles">
            {([
              { scope: "all", value: "all", label: "Toutes", count: allParcelles.length },
              { scope: "standalone", value: "standalone", label: "Parcelles seules", count: allParcelles.filter(p => !p.hectare_id).length },
              { scope: "hectare", value: "assigned", label: "Sur un hectare", count: allParcelles.filter(p => p.hectare_id).length },
            ] as const).map((tab) => (
              <button
                key={tab.scope}
                type="button"
                role="tab"
                aria-selected={parcelleScope === tab.scope}
                onClick={() => {
                  if (parcelleScope !== tab.scope) setSelectedHectare(tab.value);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                  parcelleScope === tab.scope
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 tabular-nums font-medium ${parcelleScope === tab.scope ? "text-primary-foreground/75" : "text-muted-foreground/80"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {parcelleScope === "hectare" && (
            <Select value={selectedHectare} onValueChange={setSelectedHectare}>
              <SelectTrigger className="w-full sm:w-[240px] shrink-0 bg-card" aria-label="Choisir l'hectare">
                <SelectValue placeholder="Choisir un hectare" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assigned">Tous les hectares</SelectItem>
                {hectares.map((h) => {
                  const { occupied, total } = getHectareOccupancy(h.id);
                  return (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name} {h.rmb_number ? `(${h.rmb_number})` : ""} · {occupied}/{total}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}

          <div className="flex-1 relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Rechercher un numéro, un acquéreur, un RMB…"
              aria-label="Rechercher une parcelle"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sélecteur de tri / classement de la suite logique RMB */}
          <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
            <SelectTrigger className="w-full sm:w-[200px] shrink-0 bg-card" aria-label="Ordre d'affichage">
              <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-muted-foreground" aria-hidden="true" />
              <SelectValue placeholder="Ordre d'affichage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rmb_asc">Suite logique RMB</SelectItem>
              <SelectItem value="numero_asc">N° croissant</SelectItem>
              <SelectItem value="numero_desc">N° décroissant</SelectItem>
              <SelectItem value="surface_desc">Surface décroissante</SelectItem>
              <SelectItem value="status">Par statut</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Résumé de la vue : où l'on est et ce qu'elle contient */}
        <div className="mt-5 mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm" aria-live="polite">
          <h2 className="font-semibold text-foreground">
            {selectedHectare === "all"
              ? "Toutes les parcelles"
              : selectedHectare === "standalone"
              ? "Parcelles seules"
              : selectedHectare === "assigned"
              ? "Parcelles sur un hectare"
              : `Hectare ${hectares.find((h) => h.id === selectedHectare)?.name || ""}`}
          </h2>
          {listLoading ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground" role="status">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              Chargement…
            </span>
          ) : (
            <span className="text-muted-foreground tabular-nums">
              {viewSummary.total} parcelle{viewSummary.total > 1 ? "s" : ""}
              <span aria-hidden="true"> · </span>
              <span className="text-blue-700 dark:text-blue-300">{viewSummary.sold} vendue{viewSummary.sold > 1 ? "s" : ""}</span>
              <span aria-hidden="true"> · </span>
              <span className="text-emerald-700 dark:text-emerald-300">{viewSummary.available} disponible{viewSummary.available > 1 ? "s" : ""}</span>
              {viewSummary.remaining > 0 && (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="text-destructive">${viewSummary.remaining.toLocaleString("fr-FR")} restant dû</span>
                </>
              )}
              {deferredSearchTerm.trim() && <span> pour « {deferredSearchTerm.trim()} »</span>}
            </span>
          )}
        </div>

        <div
          aria-busy={listLoading}
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity ${listLoading ? "opacity-50 pointer-events-none" : ""}`}
        >
          {displayedParcelles.map((parcelle) => {
            const quotaCount = Math.ceil(Number(parcelle.surface || 600) / 600);
            const isGratuit = parcelle.sale_type === "onereux" || parcelle.sale_type === "onéreux";
            const isPriceMissing = parcelle.sale_type === "a_renseigner" || (parcelle.status === "vendu" && !parcelle.sale_type);
            const rmb = parcelle.rmb_number || parcelle.hectares?.rmb_number;
            const status = getStatusStyle(parcelle.status);

            return (
              <Card
                key={parcelle.id}
                className={`flex flex-col bg-card rounded-xl transition-shadow hover:shadow-md ${
                  selectedIds.has(parcelle.id) ? "border-primary ring-2 ring-primary/30" : "border-border/80"
                }`}
              >
                {/* Identité : sélection, numéro, statut, actions */}
                <div className="flex items-start gap-2.5 px-4 pt-4">
                  <Checkbox
                    checked={selectedIds.has(parcelle.id)}
                    onCheckedChange={() => toggleSelected(parcelle.id)}
                    aria-label={`Sélectionner la parcelle ${parcelle.numero}`}
                    className="mt-1 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base leading-tight text-foreground truncate" title={`Parcelle ${parcelle.numero}`}>
                      Parcelle {parcelle.numero}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums truncate">
                      {rmb ? `RMB ${rmb}` : "Sans RMB"}
                      <span aria-hidden="true"> · </span>
                      {Number(parcelle.surface || 0).toLocaleString("fr-FR")} m²
                      {quotaCount > 1 && (
                        <>
                          <span aria-hidden="true"> · </span>
                          {quotaCount} quotas
                        </>
                      )}
                    </p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
                    {status.label}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-2 -mt-1 h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label={`Actions pour la parcelle ${parcelle.numero}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem onClick={() => handleEdit(parcelle)} className="gap-2 cursor-pointer text-xs">
                        <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Modifier les détails</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleOpenReassignModal(parcelle)} className="gap-2 cursor-pointer text-xs">
                        <ArrowLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Changer l'affectation</span>
                      </DropdownMenuItem>
                      {parcelle.status === "vendu" && parcelle.remaining_amount > 0 && !isGratuit && (
                        <DropdownMenuItem onClick={() => handleAddPayment(parcelle)} className="gap-2 cursor-pointer text-xs">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ajouter un paiement</span>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleDelete(parcelle.id)}
                        className="gap-2 text-destructive cursor-pointer text-xs focus:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Acquéreur */}
                <div className="px-4 pt-4 pl-11 flex items-center gap-2 min-w-0">
                  <User className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {parcelle.buyer_name ? (
                    <span className="text-sm font-medium text-foreground truncate" title={parcelle.buyer_name}>
                      {parcelle.buyer_name}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Aucun acquéreur</span>
                  )}
                </div>

                {/* Emplacement : seulement quand la vue ne le dit pas déjà */}
                {showLocation && (
                  <button
                    type="button"
                    onClick={() => handleOpenReassignModal(parcelle)}
                    className="mx-4 mt-2 ml-11 self-start max-w-[calc(100%-3.75rem)] inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Changer l'affectation"
                  >
                    {parcelle.hectares?.name ? (
                      <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span className="truncate">{parcelle.hectares?.name || "Parcelle seule"}</span>
                  </button>
                )}

                {/* Montant */}
                <div className="mt-auto pt-4">
                  <div className="mx-4 flex items-baseline justify-between gap-2 border-t border-border/60 py-3 text-sm">
                    {isGratuit ? (
                      <span className="text-muted-foreground">À titre gratuit</span>
                    ) : isPriceMissing ? (
                      <span className="font-medium text-amber-700 dark:text-amber-400">
                        Prix à renseigner
                        {Number(parcelle.prix) > 0 && (
                          <span className="tabular-nums"> · ${Number(parcelle.prix).toLocaleString("fr-FR")}</span>
                        )}
                      </span>
                    ) : (
                      <span className="font-semibold text-foreground tabular-nums">
                        ${Number(parcelle.prix || 0).toLocaleString("fr-FR")}
                      </span>
                    )}
                    {parcelle.payment_type === "partiel" && !isGratuit && Number(parcelle.remaining_amount) > 0 && (
                      <span className="text-xs font-medium text-destructive tabular-nums">
                        Reste ${Number(parcelle.remaining_amount).toLocaleString("fr-FR")}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
        
        {selectedIds.size > 0 && (
          <div
            className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/95 backdrop-blur px-3 py-2.5 shadow-lg"
            role="region"
            aria-label="Actions sur la sélection"
          >
            <span className="text-sm font-semibold text-foreground mr-1">
              {selectedIds.size} sélectionnée{selectedIds.size > 1 ? "s" : ""}
            </span>
            {selectedIds.size < filteredParcelles.length && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setSelectedIds(new Set(filteredParcelles.map((p) => p.id)))}
              >
                Tout sélectionner ({filteredParcelles.length})
              </Button>
            )}
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={bulkSubmitting || hectares.length === 0}
                onClick={() => {
                  setBulkHectareId(isSpecificHectare ? selectedHectare : hectares[0]?.id || "");
                  setBulkAssignOpen(true);
                }}
              >
                <MapPin className="w-3.5 h-3.5" />
                Affecter à un hectare
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                disabled={bulkSubmitting}
                onClick={handleBulkDetach}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Rendre parcelles seules
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                disabled={bulkSubmitting}
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={clearSelection}
                aria-label="Annuler la sélection"
                title="Annuler la sélection"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {filteredParcelles.length > displayLimit && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Affichage de <span className="font-semibold text-foreground">{Math.min(displayLimit, filteredParcelles.length)}</span> sur{" "}
              <span className="font-semibold text-foreground">{filteredParcelles.length}</span> parcelles
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisplayLimit((prev) => prev + 36)}
                className="font-medium"
              >
                Afficher plus (+36)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDisplayLimit(filteredParcelles.length)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Tout afficher ({filteredParcelles.length})
              </Button>
            </div>
          </div>
        )}

        {filteredParcelles.length === 0 && !listLoading && (
          <div className="text-center py-16 px-4 rounded-xl border border-dashed border-border">
            <Grid3x3 className="w-10 h-10 text-muted-foreground mx-auto mb-3" aria-hidden="true" />
            {deferredSearchTerm.trim() ? (
              <>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  Aucune parcelle ne correspond à « {deferredSearchTerm.trim()} »
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Vérifiez l'orthographe ou cherchez dans toutes les parcelles.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSearchTerm("")}>
                    Effacer la recherche
                  </Button>
                  {selectedHectare !== "all" && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedHectare("all")}>
                      Chercher dans toutes les parcelles
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 className="text-base font-semibold text-foreground mb-1">
                  Aucune parcelle dans cette vue
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {isSpecificHectare
                    ? "Cet hectare n'a pas encore de parcelle."
                    : "Créez une parcelle ou changez d'onglet."}
                </p>
                <Button size="sm" onClick={handleOpenCreateDialog} className="gap-1.5">
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Nouvelle parcelle
                </Button>
              </>
            )}
          </div>
        )}

        {/* Dialog Création Nouvelle Parcelle */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                <span>Créer une nouvelle parcelle</span>
              </DialogTitle>
              <DialogDescription>
                Créez une parcelle autonome pour la liste principale ou une sous-parcelle rattachée à un hectare racine.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5 pt-3">
              {/* Type d'affectation */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border/40 space-y-3">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                  Affectation de la parcelle *
                </Label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        assignment_type: "standalone",
                        hectare_id: "",
                        numero: nextRmbProposal.nextFormatted,
                        rmb_number: nextRmbProposal.nextFormatted,
                      }));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      formData.assignment_type === "standalone"
                        ? "border-amber-500 bg-amber-500/10 ring-1 ring-amber-500 shadow-xs"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Parcelle seule (Liste principale)</div>
                      <div className="text-[10px] text-muted-foreground">Autonome, hors hectare racine</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const firstHec = isSpecificHectare
                        ? hectares.find(h => h.id === selectedHectare) 
                        : hectares[0];
                      const hParcelles = allParcelles.filter(p => p.hectare_id === firstHec?.id);
                      const prop = getNextParcelleInHectareRmb(firstHec, hParcelles);
                      setFormData(prev => ({
                        ...prev,
                        assignment_type: "hectare",
                        hectare_id: firstHec?.id || "",
                        numero: prop.formattedNumero,
                        rmb_number: prop.formattedRmb,
                      }));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      formData.assignment_type === "hectare"
                        ? "border-primary bg-primary/10 ring-1 ring-primary shadow-xs"
                        : "border-border bg-background hover:bg-muted/50"
                    }`}
                  >
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-foreground">Sous-parcelle d'un Hectare</div>
                      <div className="text-[10px] text-muted-foreground">Indexée ex: RMB 223/01</div>
                    </div>
                  </button>
                </div>

                {formData.assignment_type === "hectare" && (
                  <div className="pt-2">
                    <Label className="text-xs font-medium">Sélectionner l'hectare racine *</Label>
                    <Select
                      value={formData.hectare_id}
                      onValueChange={handleHectareChange}
                    >
                      <SelectTrigger className="mt-1 bg-background">
                        <SelectValue placeholder="Choisir un hectare racine" />
                      </SelectTrigger>
                      <SelectContent>
                        {hectares.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.name} {h.rmb_number ? `(${h.rmb_number})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-1.5 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Numérotation automatique dérivée : <strong>{formData.rmb_number}</strong> (reste confinée dans cet hectare)
                    </p>
                  </div>
                )}
              </div>

              {/* Numéro, RMB et surface */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium">N° de la parcelle *</Label>
                  <Input
                    value={formData.numero}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                    placeholder="Ex: 223/01 ou RMB 012"
                    required
                    className="mt-1 h-9 text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Numéro RMB</Label>
                    {formData.assignment_type === "standalone" && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, rmb_number: nextRmbProposal.nextFormatted }))}
                        className="text-[10px] text-purple-600 hover:underline font-semibold"
                      >
                        Suite {nextRmbProposal.nextFormatted}
                      </button>
                    )}
                  </div>
                  <Input
                    value={formData.rmb_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, rmb_number: e.target.value }))}
                    placeholder="Ex: RMB 223/01"
                    className="mt-1 h-9 text-xs font-mono font-semibold"
                  />
                </div>

                <div>
                  <Label className="text-xs font-medium">Surface (m²) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.surface}
                    onChange={(e) => setFormData(prev => ({ ...prev, surface: e.target.value }))}
                    placeholder="600"
                    required
                    className="mt-1 h-9 text-xs"
                  />
                </div>
              </div>

              {/* Prix et type de vente */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Type de vente</Label>
                  <Select
                    value={formData.sale_type}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, sale_type: val }))}
                  >
                    <SelectTrigger className="mt-1 h-9 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Vente normale</SelectItem>
                      <SelectItem value="onereux">À titre gratuit</SelectItem>
                      <SelectItem value="a_renseigner">À renseigner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.sale_type !== "onereux" && formData.sale_type !== "a_renseigner" && (
                  <div>
                    <Label className="text-xs font-medium">Prix (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.prix}
                      onChange={(e) => setFormData(prev => ({ ...prev, prix: e.target.value }))}
                      placeholder="0"
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Upload de documents */}
              <div className="border-t border-border pt-3">
                <MultiDocumentUploader
                  docs={newDocs}
                  onChange={setNewDocs}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="text-xs"
                >
                  Annuler
                </Button>
                <Button type="submit" className="text-xs font-semibold">
                  Créer la parcelle
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog Édition Parcelle */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Modifier Parcelle {selectedParcelle?.numero}
              </DialogTitle>
              <DialogDescription>
                Modifiez les informations de la parcelle et de la vente
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateParcelle} className="space-y-5 pt-3">
              {/* Section: Informations de base */}
              <div className="bg-muted/40 p-4 rounded-xl border border-border/40 space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-border/30">
                  <Grid3x3 className="w-4.5 h-4.5 text-muted-foreground" />
                  <h3 className="font-semibold text-foreground text-sm">Informations de base</h3>
                </div>
                
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                    Rattachement de la parcelle
                  </Label>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, assignment_type: "standalone", hectare_id: "" })}
                      className={`p-2.5 rounded-lg border text-left transition-all flex items-center gap-2 ${
                        editFormData.assignment_type === "standalone"
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <div className="text-xs font-semibold">Parcelle seule</div>
                        <div className="text-[10px] text-muted-foreground">Hors hectare</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditFormData({ ...editFormData, assignment_type: "hectare", hectare_id: editFormData.hectare_id || hectares[0]?.id || "" })}
                      className={`p-2.5 rounded-lg border text-left transition-all flex items-center gap-2 ${
                        editFormData.assignment_type === "hectare"
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border bg-background hover:bg-muted/50"
                      }`}
                    >
                      <MapPin className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <div className="text-xs font-semibold">Affectée à un hectare</div>
                        <div className="text-[10px] text-muted-foreground">Hectare existant</div>
                      </div>
                    </button>
                  </div>

                  {editFormData.assignment_type === "hectare" && (
                    <Select
                      value={editFormData.hectare_id}
                      onValueChange={(value) =>
                        setEditFormData({ ...editFormData, hectare_id: value })
                      }
                    >
                      <SelectTrigger className="mt-1 bg-background">
                        <SelectValue placeholder="Sélectionner un hectare" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        {hectares.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Statut *</Label>
                    <Select
                      value={editFormData.status}
                      onValueChange={(value) =>
                        setEditFormData({ ...editFormData, status: value })
                      }
                    >
                      <SelectTrigger className="mt-1 bg-background">
                        <SelectValue placeholder="Sélectionner un statut" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="disponible">Disponible</SelectItem>
                        <SelectItem value="reserve">Réservé</SelectItem>
                        <SelectItem value="vendu">Vendu</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {editFormData.sale_type === "a_renseigner" ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                      <Clock className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-semibold">Informations de vente à renseigner ultérieurement</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Le montant et les modalités financières sont en attente.
                        </p>
                      </div>
                    </div>
                  ) : editFormData.sale_type !== "onereux" ? (
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5" />
                        Prix (USD) *
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={editFormData.prix}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, prix: e.target.value })
                        }
                        placeholder="Modifier le prix"
                        className="mt-1 bg-background"
                      />
                    </div>
                  ) : null}
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Type de vente</Label>
                    <Select
                      value={editFormData.sale_type}
                      onValueChange={(value) =>
                        setEditFormData({ ...editFormData, sale_type: value })
                      }
                    >
                      <SelectTrigger className="mt-1 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-popover">
                        <SelectItem value="normal">Vente normale</SelectItem>
                        <SelectItem value="onereux">À titre gratuit</SelectItem>
                        <SelectItem value="a_renseigner">À renseigner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">Numéro RMB</Label>
                      <button
                        type="button"
                        onClick={() =>
                          setEditFormData({ ...editFormData, rmb_number: nextRmbProposal.nextFormatted })
                        }
                        className="text-[10px] text-purple-700 dark:text-purple-300 hover:underline font-semibold flex items-center gap-1"
                        title="Attribuer le numéro suivant dans la suite logique RMB"
                      >
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Suite {nextRmbProposal.nextFormatted}</span>
                      </button>
                    </div>
                    <Input
                      value={editFormData.rmb_number}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, rmb_number: e.target.value })
                      }
                      placeholder="Ex: RMB 001"
                      className="mt-1 bg-background"
                    />
                  </div>
                </div>
              </div>

              {editFormData.status === "vendu" && (
                <>
                  {/* Section: Informations Acheteur */}
                  <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 space-y-4">
                    <div className="flex items-center gap-2 pb-1 border-b border-emerald-500/10">
                      <User className="w-4.5 h-4.5 text-emerald-600" />
                      <h3 className="font-semibold text-foreground text-sm">Informations Acheteur</h3>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium flex items-center gap-2">
                        Nom complet *
                      </Label>
                      <Input
                        value={editFormData.buyer_name}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, buyer_name: e.target.value })
                        }
                        placeholder="Ex: Jean Dupont"
                        required
                        className="mt-1 bg-background"
                      />
                      <BuyerQuotaSuggestion
                        matches={buyerMatches}
                        selectedBuyer={selectedExistingBuyer}
                        onSelectBuyer={handleSelectExistingBuyer}
                        onDetachBuyer={handleDetachExistingBuyer}
                        itemSurface={Number(selectedParcelle?.surface || 600)}
                        itemLabel="cette parcelle"
                        className="mt-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Phone className="w-3 h-3" />
                          Téléphone
                        </Label>
                        <Input
                          value={editFormData.buyer_phone}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, buyer_phone: e.target.value })
                          }
                          placeholder="+243 123 456 789"
                          className="mt-1 bg-background"
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Mail className="w-3 h-3" />
                          Email
                        </Label>
                        <Input
                          type="email"
                          value={editFormData.buyer_email}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, buyer_email: e.target.value })
                          }
                          placeholder="email@exemple.com"
                          className="mt-1 bg-background"
                        />
                      </div>
                    </div>

                    {editFormData.sale_type !== "a_renseigner" && (
                      <div>
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Calendar className="w-3 h-3" />
                          Date de vente
                        </Label>
                        <Input
                          type="date"
                          value={editFormData.sale_date ? new Date(editFormData.sale_date).toISOString().split('T')[0] : ""}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, sale_date: e.target.value })
                          }
                          className="mt-1 bg-background"
                        />
                      </div>
                    )}
                  </div>

                  {/* Section: Détails de paiement */}
                  {editFormData.sale_type !== "onereux" && editFormData.sale_type !== "a_renseigner" && (
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/20 space-y-4">
                      <div className="flex items-center gap-2 pb-1 border-b border-primary/10">
                        <CreditCard className="w-4.5 h-4.5 text-primary" />
                        <h3 className="font-semibold text-foreground text-sm">Détails de paiement</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Type de paiement *</Label>
                          <Select
                            value={editFormData.payment_type}
                            onValueChange={(value) =>
                              setEditFormData({ ...editFormData, payment_type: value })
                            }
                          >
                            <SelectTrigger className="mt-1 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="total">Paiement total</SelectItem>
                              <SelectItem value="partiel">Paiement partiel</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Package className="w-3 h-3" />
                            Type d'achat *
                          </Label>
                          <Select
                            value={editFormData.purchase_type}
                            onValueChange={(value) =>
                              setEditFormData({ ...editFormData, purchase_type: value })
                            }
                          >
                            <SelectTrigger className="mt-1 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover">
                              <SelectItem value="parcelle">Parcelle</SelectItem>
                              <SelectItem value="hectare">Hectare</SelectItem>
                              <SelectItem value="demi-hectare">Demi-hectare</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {editFormData.payment_type === "partiel" && (
                        <div>
                          <Label className="text-sm font-medium">Montant payé (USD) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={editFormData.amount_paid}
                            onChange={(e) =>
                              setEditFormData({ ...editFormData, amount_paid: e.target.value })
                            }
                            placeholder="Montant déjà payé"
                            required
                            className="mt-1 bg-background"
                          />
                          {editFormData.amount_paid && editFormData.prix && (
                            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                              Restant à payer : <span className="font-semibold text-orange-600">${(parseFloat(editFormData.prix) - parseFloat(editFormData.amount_paid)).toLocaleString()} USD</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-border pt-4">
                <MultiDocumentUploader
                  existingDocs={existingDocs}
                  onDeleteExisting={async (docId) => {
                    await supabase.from("documents").delete().eq("id", docId);
                    setExistingDocs(prev => prev.filter(d => d.id !== docId));
                    toast.success("Document supprimé");
                  }}
                  docs={editDocs}
                  onChange={setEditDocs}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" className="flex-1">
                  Enregistrer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modale de réaffectation rapide : Affecter à un hectare OU Transformer en parcelle seule */}
        <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
          <DialogContent className="max-w-md bg-card">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                Affecter {selectedParcelles.length} parcelle{selectedParcelles.length > 1 ? "s" : ""} à un hectare
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Elles occuperont{" "}
                {selectedParcelles
                  .filter((p) => p.hectare_id !== bulkHectareId)
                  .reduce((t, p) => t + Math.ceil(Number(p.surface || 600) / 600), 0)}{" "}
                place(s) dans l'hectare choisi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Hectare d'accueil *
              </Label>
              <HectareSelector
                hectares={hectares}
                selectedId={bulkHectareId}
                onSelect={setBulkHectareId}
                getOccupancy={getHectareOccupancy}
                requiredQuota={selectedParcelles
                  .filter((p) => p.hectare_id !== bulkHectareId)
                  .reduce((t, p) => t + Math.ceil(Number(p.surface || 600) / 600), 0)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setBulkAssignOpen(false)} disabled={bulkSubmitting}>
                Annuler
              </Button>
              <Button onClick={handleBulkAssign} disabled={bulkSubmitting || !bulkHectareId} className="gap-1.5">
                {bulkSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Affecter
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={reassignModalOpen} onOpenChange={setReassignModalOpen}>
          <DialogContent className="max-w-md bg-card">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <span>Affectation Parcelle {parcelleToReassign?.numero}</span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Modifiez en un clic l'affectation cadastrale de cette parcelle.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* État actuel */}
              <div className="p-3 rounded-lg border bg-muted/30 flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Statut actuel :</span>
                {parcelleToReassign?.hectare_id ? (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1 font-semibold">
                    <MapPin className="w-3 h-3" />
                    <span>Hectare {parcelleToReassign.hectares?.name || "Assigné"}</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 flex items-center gap-1 font-semibold">
                    <Sparkles className="w-3 h-3" />
                    <span>Parcelle seule (hors hectare)</span>
                  </Badge>
                )}
              </div>

              {/* Sélection des deux chemins */}
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Nouvelle affectation souhaitée *
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setReassignType("standalone");
                      setReassignHectareId("");
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                      reassignType === "standalone"
                        ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/30 shadow-xs"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles
                        className={`w-4 h-4 ${
                          reassignType === "standalone"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="font-semibold text-xs text-foreground">
                        Parcelle seule
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Détacher de tout hectare (autonome)
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReassignType("hectare");
                      setReassignHectareId(parcelleToReassign?.hectare_id || hectares[0]?.id || "");
                    }}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                      reassignType === "hectare"
                        ? "border-primary bg-primary/10 ring-2 ring-primary/30 shadow-xs"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Layers
                        className={`w-4 h-4 ${
                          reassignType === "hectare"
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="font-semibold text-xs text-foreground">
                        Affecter à un hectare
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-tight">
                      Rattacher à un hectare existant
                    </p>
                  </button>
                </div>
              </div>

              {/* Si choix Affecter à un hectare : Sélecteur d'hectare */}
              {reassignType === "hectare" && (
                <div className="space-y-2 pt-1 border-t border-border/60">
                  <Label className="text-xs font-medium">Sélectionner l'hectare d'accueil *</Label>
                  <HectareSelector
                    hectares={hectares}
                    selectedId={reassignHectareId}
                    onSelect={(id) => setReassignHectareId(id)}
                    getOccupancy={getHectareOccupancy}
                    requiredQuota={Math.ceil(Number(parcelleToReassign?.surface || 600) / 600)}
                  />
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => setReassignModalOpen(false)}
                  disabled={reassignSubmitting}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  className="flex-1 text-xs gap-1.5"
                  onClick={handleSaveReassignment}
                  disabled={reassignSubmitting || (reassignType === "hectare" && !reassignHectareId)}
                >
                  {reassignSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {reassignType === "standalone"
                          ? "Transformer en parcelle seule"
                          : "Confirmer l'affectation"}
                      </span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        
        {selectedParcelle && (
          <PaymentDialog
            open={paymentDialogOpen}
            onOpenChange={setPaymentDialogOpen}
            itemId={selectedParcelle.id}
            itemType="parcelle"
            itemName={`Parcelle ${selectedParcelle.numero}`}
            totalPrice={selectedParcelle.prix}
            remainingAmount={selectedParcelle.remaining_amount}
            buyerName={selectedParcelle.buyer_name || undefined}
            rmbNumber={selectedParcelle.rmb_number || selectedParcelle.hectares?.rmb_number || undefined}
            onPaymentComplete={() => {
              fetchParcelles();
              queryClient.invalidateQueries({ queryKey: ["acheteurs"] });
            }}
          />
        )}

      </div>
    </div>
  );
};

export default Parcelles;
