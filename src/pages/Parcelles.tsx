import { useEffect, useState, useMemo, useDeferredValue } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Grid3x3, DollarSign, User, Phone, Mail, Calendar, Package, CreditCard, MapPin, ListOrdered, Hash, Sparkles, Layers, ArrowLeftRight, Check, Loader2, MoreVertical, ArrowUpDown, UserCheck, Clock } from "lucide-react";
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
import { compareParcellesByRmbSuite, getNextAvailableRmb, extractRmbNumber } from "@/lib/rmbSuite";
import { useBuyerDetection, type ExistingBuyer, normalizeText } from "@/hooks/useBuyerDetection";
import { BuyerQuotaSuggestion } from "@/components/BuyerQuotaSuggestion";
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
}

const Parcelles = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [parcelles, setParcelles] = useState<Parcelle[]>([]);
  const [allParcelles, setAllParcelles] = useState<Parcelle[]>([]);
  const [hectares, setHectares] = useState<Hectare[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"rmb_asc" | "numero_asc" | "numero_desc" | "surface_desc" | "status">("rmb_asc");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedParcelle, setSelectedParcelle] = useState<Parcelle | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedHectare, setSelectedHectare] = useState<string>(
    searchParams.get("hectare") || "all"
  );

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
    return {
      occupied: occupiedEffectif,
      remaining: 16 - occupiedEffectif,
      total: 16
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

      // Exclure les hectares contenant "ISETECH"
      if (selectedHec.name.toUpperCase().includes("ISETECH")) {
        setFormData(prev => ({ ...prev, numero: "" }));
        return;
      }

      // Récupérer toutes les parcelles déjà créées pour cet hectare
      const { data: hParcelles, error } = await supabase
        .from("parcelles")
        .select("id, numero, hectare_id, status")
        .eq("hectare_id", hectareId);

      if (error) throw error;

      // Audit intelligent : détecte les trous et propose le premier numéro manquant ou le suivant
      const audit = auditHectare(selectedHec, hParcelles || [], 16);
      const autoNumero = audit.nextSuggestedNumero;

      setFormData(prev => ({
        ...prev,
        numero: autoNumero
      }));

      if (audit.hasGaps) {
        toast.info(`Trou comblé : ${autoNumero} suggéré pour rétablir l'ordre`, {
          duration: 3500,
        });
      }
    } catch (err) {
      console.error("Erreur lors du calcul automatique du numéro de parcelle:", err);
    }
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
        .select("id, name, rmb_number, latitude, longitude")
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
      } else if (selectedHectare && selectedHectare !== "all") {
        query = query.eq("hectare_id", selectedHectare);
      }

      const { data, error } = await query.order("numero");

      if (error) throw error;
      setParcelles((data as any) || []);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des parcelles");
    } finally {
      setLoading(false);
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

        if (occupiedEffectif + newParcelleEffectif > 16) {
          toast.error(`Limite atteinte : cette parcelle occupe ${newParcelleEffectif} en effectif et l'hectare n'a plus assez d'espace (${16 - occupiedEffectif} disponible)`);
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
        assignment_type: selectedHectare && selectedHectare !== "all" && selectedHectare !== "standalone" ? "hectare" : "standalone",
        numero: "", 
        surface: "", 
        prix: "", 
        hectare_id: selectedHectare && selectedHectare !== "all" && selectedHectare !== "standalone" ? selectedHectare : "", 
        rmb_number: "",
        sale_type: "normal",
        latitude: "",
        longitude: "",
      });
      fetchParcelles();
      fetchAllParcelles();
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
      fetchParcelles();
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
    // Charger les documents existants
    try {
      const { data } = await supabase
        .from("documents")
        .select("id, title, type, file_url")
        .eq("parcelle_id", parcelle.id)
        .order("created_at");
      setExistingDocs(data || []);
    } catch {
      setExistingDocs([]);
    }
    setIsEditDialogOpen(true);
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

        if (occupiedEffectif + newParcelleEffectif > 16) {
          toast.error(`Limite atteinte : l'hectare sélectionné n'a pas assez d'espace (${16 - occupiedEffectif} en effectif disponible, ${newParcelleEffectif} requis)`);
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
      fetchParcelles();
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

      // Si on affecte à un hectare différent, vérifier la capacité (16 max)
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

        if (occupiedEffectif + parcelleEffectif > 16) {
          toast.error(
            `Capacité insuffisante : cet hectare dispose de ${16 - occupiedEffectif} effectifs disponibles (${parcelleEffectif} requis).`
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
      await fetchParcelles();
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

  const getStatusBadge = (status: string) => {
    const colors = {
      disponible: "bg-green-500/10 text-green-500",
      vendu: "bg-blue-500/10 text-blue-500",
      reserve: "bg-orange-500/10 text-orange-500",
    };
    return colors[status as keyof typeof colors] || colors.disponible;
  };

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
          description="Attribuez les emplacements de chaque hectare à vos acheteurs."
        />

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <Select value={selectedHectare} onValueChange={setSelectedHectare}>
            <SelectTrigger className="w-full sm:w-[220px] shrink-0">
              <SelectValue placeholder="Tous les emplacements" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les emplacements</SelectItem>
              <SelectItem value="standalone">🏷️ Parcelles seules (hors hectare)</SelectItem>
              {hectares.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex-1 relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par N°, acquéreur, RMB..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Sélecteur de tri / classement de la suite logique RMB */}
          <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
            <SelectTrigger className="w-full sm:w-[220px] shrink-0 bg-card">
              <ArrowUpDown className="w-3.5 h-3.5 mr-2 text-primary" />
              <SelectValue placeholder="Ordre d'affichage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rmb_asc">📋 Suite logique RMB (Défaut)</SelectItem>
              <SelectItem value="numero_asc">🔢 N° parcelle croissant</SelectItem>
              <SelectItem value="numero_desc">🔢 N° parcelle décroissant</SelectItem>
              <SelectItem value="surface_desc">📐 Surface décroissante</SelectItem>
              <SelectItem value="status">🏷️ Par statut</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayedParcelles.map((parcelle) => {
            const quotaCount = Math.ceil(Number(parcelle.surface || 600) / 600);
            const isGratuit = parcelle.sale_type === "onereux" || parcelle.sale_type === "onéreux";

            return (
              <Card
                key={parcelle.id}
                className="p-4 flex flex-col justify-between hover:shadow-md transition-shadow border-border/80 bg-card rounded-xl relative group"
              >
                <div>
                  {/* En-tête : Titre, surface et menu d'actions compact */}
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-sm text-foreground tracking-tight">
                          Parcelle {parcelle.numero}
                        </h3>
                        {(parcelle.rmb_number || parcelle.hectares?.rmb_number) && (
                          <Badge variant="outline" className="text-[10px] font-mono bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30 px-1.5 py-0 font-bold">
                            Suite {parcelle.rmb_number || parcelle.hectares?.rmb_number}
                          </Badge>
                        )}
                        {quotaCount > 1 && (
                          <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-1.5 py-0">
                            {quotaCount} quotas
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                        {parcelle.surface} m²
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Badge de statut épuré */}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${getStatusBadge(parcelle.status)}`}>
                        {parcelle.status}
                      </span>

                      {/* Menu d'actions propre (évite d'entasser 3 boutons) */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            onClick={() => handleOpenReassignModal(parcelle)}
                            className="gap-2 cursor-pointer text-xs"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-primary" />
                            <span>Changer l'affectation</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEdit(parcelle)}
                            className="gap-2 cursor-pointer text-xs"
                          >
                            <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Modifier les détails</span>
                          </DropdownMenuItem>
                          {parcelle.status === "vendu" && parcelle.remaining_amount > 0 && !isGratuit && (
                            <DropdownMenuItem
                              onClick={() => handleAddPayment(parcelle)}
                              className="gap-2 cursor-pointer text-xs"
                            >
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
                  </div>

                  {/* Emplacement cadastral : Hectare d'accueil OU Parcelle seule (clic direct pour changer !) */}
                  <button
                    type="button"
                    onClick={() => handleOpenReassignModal(parcelle)}
                    className="w-full text-left p-2 rounded-lg border transition-all hover:border-primary/50 group/btn flex items-center justify-between gap-1.5 bg-muted/40 hover:bg-muted/70 mb-3"
                    title="Cliquer pour changer l'affectation ou transformer en parcelle seule"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {parcelle.hectares?.name ? (
                        <>
                          <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-xs font-medium text-foreground truncate" title={parcelle.hectares.name}>
                            {parcelle.hectares.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="text-xs font-medium text-amber-700 dark:text-amber-400 truncate">
                            Parcelle seule (hors hectare)
                          </span>
                        </>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground group-hover/btn:text-primary shrink-0 flex items-center gap-0.5 font-medium">
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>Changer</span>
                    </span>
                  </button>

                  {/* Détails alignés : RMB et Prix */}
                  <div className="space-y-1.5 text-xs pt-1 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Numéro RMB :</span>
                      {(parcelle.rmb_number || parcelle.hectares?.rmb_number) ? (
                        <span className="font-mono font-bold text-foreground bg-purple-500/10 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded text-[11px] border border-purple-500/20">
                          {parcelle.rmb_number || parcelle.hectares?.rmb_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic text-[11px]">—</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Prix :</span>
                      {isGratuit ? (
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          À titre gratuit
                        </Badge>
                      ) : (parcelle.sale_type === "a_renseigner" || (parcelle.status === "vendu" && !parcelle.sale_type)) ? (
                        <Badge variant="outline" className="text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                          {Number(parcelle.prix) > 0 ? `$${Number(parcelle.prix).toLocaleString()} (À renseigner)` : "À renseigner"}
                        </Badge>
                      ) : (
                        <span className="font-bold text-foreground">
                          ${Number(parcelle.prix || 0).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section Acquéreur (si vendu) */}
                {parcelle.buyer_name && (
                  <div className="mt-3 pt-2 border-t border-border/60 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="w-3.5 h-3.5 shrink-0 text-foreground/70" />
                      <span className="font-medium text-foreground truncate" title={parcelle.buyer_name}>
                        {parcelle.buyer_name}
                      </span>
                    </div>

                    {parcelle.payment_type === "partiel" && !isGratuit && (
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className="text-muted-foreground">Reste dû :</span>
                        <span className="font-semibold text-destructive">
                          ${Number(parcelle.remaining_amount || 0).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
        
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

        {filteredParcelles.length === 0 && (
          <div className="text-center py-12">
            <Grid3x3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucune parcelle trouvée
            </h3>
            <p className="text-muted-foreground">
              Commencez par créer votre première parcelle
            </p>
          </div>
        )}

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
                  <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/10 border-l-4 border-l-emerald-500 space-y-4">
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
                    <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 border-l-4 border-l-primary space-y-4">
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
