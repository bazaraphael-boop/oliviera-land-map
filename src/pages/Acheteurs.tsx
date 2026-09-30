import { useEffect, useState, useMemo, useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Search, User, Plus, MapPin, DollarSign, LayoutList, LayoutGrid, Grid3x3, 
  Map as MapIcon, Phone, Mail, Download, AlertTriangle, CheckCircle2, 
  Calendar, FileSpreadsheet, FileText, Loader2, ArrowUpDown, Clock,
  SlidersHorizontal, Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNotify } from "@/hooks/useNotify";
import DashboardSidebar from "@/components/DashboardSidebar";
import PageHeader from "@/components/PageHeader";
import { jsPDF } from "jspdf";
import headerImage from "@/assets/en_tete_concession_manuel.jpg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BuyerCard } from "@/components/BuyerCard";
import { BuyerStatsCards } from "@/components/BuyerStatsCards";
import { BuyerDetailsDialog } from "@/components/BuyerDetailsDialog";
import { useBuyerDetection, type ExistingBuyer, normalizeText } from "@/hooks/useBuyerDetection";
import { BuyerQuotaSuggestion } from "@/components/BuyerQuotaSuggestion";
import { UnifiedLandSaleDialog } from "@/components/UnifiedLandSaleDialog";
import { EditBuyerQuotaDialog } from "@/components/EditBuyerQuotaDialog";
import { DeleteBuyerDialog } from "@/components/DeleteBuyerDialog";

interface Acheteur {
  id: string;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  buyer_last_name: string | null;
  buyer_first_name: string | null;
  buyer_profession: string | null;
  buyer_birth_place: string | null;
  buyer_birth_date: string | null;
  buyer_marital_status: string | null;
  buyer_children_count: number | null;
  buyer_address: string | null;
  buyer_village_origin: string | null;
  buyer_groupement: string | null;
  buyer_secteur: string | null;
  buyer_territoire: string | null;
  buyer_province: string | null;
  parcelles: {
    id: string;
    numero: string;
    surface: number;
    prix: number;
    sale_date: string | null;
    created_at?: string;
    hectare_id: string | null;
    payment_type: string;
    amount_paid: number;
    remaining_amount: number;
    sale_type: string;
    purchase_type: string | null;
    rmb_number: string | null;
    paper_form_completed: boolean;
    nombreParcelles?: number;
    hectares?: {
      name: string;
      location: string;
    } | null;
  }[];
  hectares: {
    id: string;
    name: string;
    surface: number;
    prix: number;
    sale_date: string | null;
    created_at?: string;
    location: string | null;
    payment_type: string;
    amount_paid: number;
    remaining_amount: number;
    sale_type: string;
    purchase_type: string | null;
    rmb_number: string | null;
    paper_form_completed: boolean;
  }[];
  totalAchat: number;
  nombreParcelles: number;
  nombreHectares: number;
  paper_form_completed: boolean;
  documents_count: number;
  has_documents: boolean;
  first_date: string | null;
  latest_date: string | null;
}

const Acheteurs = () => {
  const navigate = useNavigate();
  const { notify } = useNotify();
  const [acheteurs, setAcheteurs] = useState<Acheteur[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAcheteur, setSelectedAcheteur] = useState<Acheteur | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showNewBuyerDialog, setShowNewBuyerDialog] = useState(false);
  const [showEditBuyerDialog, setShowEditBuyerDialog] = useState(false);
  const [showEditIdentificationDialog, setShowEditIdentificationDialog] = useState(false);
  const [showEditQuotaDialog, setShowEditQuotaDialog] = useState(false);
  const [buyerForQuota, setBuyerForQuota] = useState<Acheteur | null>(null);
  const [showDeleteBuyerDialog, setShowDeleteBuyerDialog] = useState(false);
  const [buyerForDelete, setBuyerForDelete] = useState<Acheteur | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  // Filtre par statut des documents et ventes ("all" | "missing" | "with" | "pending_sale")
  const [docFilter, setDocFilter] = useState<"all" | "missing" | "with" | "pending_sale">("all");

  // État de l'exportation par date
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportStartDate, setExportStartDate] = useState<string>("");
  const [exportEndDate, setExportEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [exportDocStatus, setExportDocStatus] = useState<"all" | "missing" | "with">("all");
  const [exportSortOrder, setExportSortOrder] = useState<"date_desc" | "date_asc" | "name_asc">("date_desc");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [availableHectares, setAvailableHectares] = useState<any[]>([]);
  const [availableParcelles, setAvailableParcelles] = useState<any[]>([]);
  const [allParcellesInSelectedHectare, setAllParcellesInSelectedHectare] = useState<any[]>([]);
  const [newBuyerForm, setNewBuyerForm] = useState({
    nom: "",
    post_nom: "",
    prenom: "",
    profession: "",
    birth_place: "",
    birth_date: "",
    marital_status: "",
    children_count: "",
    address: "",
    buyer_phone: "",
    buyer_email: "",
    village_origin: "",
    groupement: "",
    secteur: "",
    territoire: "",
    province: "",
    purchase_type: "hectare",
    item_type: "hectare" as "hectare" | "parcelle",
    selected_item: "",
    selected_parcelles: [] as string[], // Pour la sélection multiple
    merge_parcelles: false, // Pour fusionner visuellement
    sale_type: "normal",
    payment_type: "total",
    amount_paid: "",
    rmb_number: "",
    prix: "",
  });
  const [editBuyerForm, setEditBuyerForm] = useState({
    buyer_name: "",
    buyer_phone: "",
    buyer_email: "",
  });
  const [editIdentificationForm, setEditIdentificationForm] = useState({
    buyer_name: "",
    buyer_profession: "",
    buyer_birth_place: "",
    buyer_birth_date: "",
    buyer_marital_status: "",
    buyer_children_count: "",
    buyer_address: "",
    buyer_phone: "",
    buyer_email: "",
    buyer_village_origin: "",
    buyer_groupement: "",
    buyer_secteur: "",
    buyer_territoire: "",
    buyer_province: "",
  });

  // Détection en temps réel d'acquéreurs déjà existants
  const { findMatchingBuyers, refetch: refetchBuyerDetection } = useBuyerDetection();
  const [newBuyerSelectedExisting, setNewBuyerSelectedExisting] = useState<ExistingBuyer | null>(null);

  // Surface totale des parcelles sélectionnées pour le calcul de quota supplémentaire
  const selectedParcellesSurface = useMemo(() => {
    if (newBuyerForm.item_type === "hectare") return 10000;
    const selected = availableParcelles.filter(p => newBuyerForm.selected_parcelles.includes(p.id));
    return selected.reduce((sum, p) => sum + Number(p.surface || 600), 0) || 600;
  }, [newBuyerForm.item_type, newBuyerForm.selected_parcelles, availableParcelles]);

  // Acquéreurs similaires détectés pour le formulaire de nouvel acheteur
  const matchingBuyersForNew = useMemo(() => {
    const fullName = `${newBuyerForm.nom} ${newBuyerForm.post_nom} ${newBuyerForm.prenom}`.trim();
    if (fullName.length < 2) return [];
    if (newBuyerSelectedExisting && normalizeText(newBuyerSelectedExisting.buyer_name) === normalizeText(fullName)) {
      return [];
    }
    return findMatchingBuyers(fullName);
  }, [newBuyerForm.nom, newBuyerForm.post_nom, newBuyerForm.prenom, newBuyerSelectedExisting, findMatchingBuyers]);

  const handleSelectBuyerForNew = (buyer: ExistingBuyer) => {
    setNewBuyerSelectedExisting(buyer);
    const parts = buyer.buyer_name.split(" ");
    setNewBuyerForm((prev) => ({
      ...prev,
      nom: parts[0] || buyer.buyer_name,
      post_nom: buyer.buyer_last_name || parts[1] || "",
      prenom: buyer.buyer_first_name || (parts.length > 2 ? parts.slice(2).join(" ") : ""),
      profession: buyer.buyer_profession || prev.profession,
      birth_place: buyer.buyer_birth_place || prev.birth_place,
      birth_date: buyer.buyer_birth_date ? new Date(buyer.buyer_birth_date).toISOString().split('T')[0] : prev.birth_date,
      marital_status: buyer.buyer_marital_status || prev.marital_status,
      children_count: buyer.buyer_children_count !== null ? String(buyer.buyer_children_count) : prev.children_count,
      address: buyer.buyer_address || prev.address,
      buyer_phone: buyer.buyer_phone || prev.buyer_phone,
      buyer_email: buyer.buyer_email || prev.buyer_email,
      village_origin: buyer.buyer_village_origin || prev.village_origin,
      groupement: buyer.buyer_groupement || prev.groupement,
      secteur: buyer.buyer_secteur || prev.secteur,
      territoire: buyer.buyer_territoire || prev.territoire,
      province: buyer.buyer_province || prev.province,
      rmb_number: buyer.primaryRmb || prev.rmb_number,
      merge_parcelles: true,
    }));
    notify(
      "Acquéreur sélectionné",
      `Cette acquisition sera ajoutée au quota de ${buyer.buyer_name} (${buyer.quotas} quotas actuels)`,
      "info"
    );
  };

  const handleDetachBuyerForNew = () => {
    setNewBuyerSelectedExisting(null);
    notify("Acquéreur détaché", "L'acquéreur sera enregistré comme un nouveau profil distinct", "info");
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      await loadAcheteurs();
    };
    init();
  }, []);

  useEffect(() => {
    if (showNewBuyerDialog) {
      loadAvailableItems();
    }
  }, [showNewBuyerDialog, newBuyerForm.item_type]);

  useEffect(() => {
    // Charger toutes les parcelles (vendues et disponibles) de l'hectare sélectionné
    if (newBuyerForm.selected_item && newBuyerForm.selected_item !== "standalone" && newBuyerForm.item_type === "parcelle") {
      supabase
        .from("parcelles")
        .select("id, surface")
        .eq("hectare_id", newBuyerForm.selected_item)
        .then(({ data }) => {
          if (data) setAllParcellesInSelectedHectare(data);
        });
    } else {
      setAllParcellesInSelectedHectare([]);
    }
  }, [newBuyerForm.selected_item, newBuyerForm.item_type]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };


  const loadAcheteurs = async () => {
    try {
      // Récupérer toutes les parcelles vendues
      const { data: parcelles, error: parcellesError } = await supabase
        .from("parcelles")
        .select(`*, hectares ( name, location )`)
        .eq("status", "vendu")
        .not("buyer_name", "is", null);

      if (parcellesError) {
        console.error("Erreur parcelles:", parcellesError);
        throw parcellesError;
      }
      
      // Récupérer tous les hectares vendus
      const { data: hectares, error: hectaresError } = await supabase
        .from("hectares")
        .select("*")
        .or("status.eq.vendu,status.eq.sold")
        .not("buyer_name", "is", null);

      if (hectaresError) {
        console.error("Erreur hectares:", hectaresError);
        throw hectaresError;
      }

      // Regrouper par acheteur
      const acheteursMap = new Map<string, Acheteur>();

      // Traiter les parcelles
      parcelles?.forEach((parcelle) => {
        const buyerKey = parcelle.buyer_name.toLowerCase().trim();
        
        if (!acheteursMap.has(buyerKey)) {
          acheteursMap.set(buyerKey, {
            id: buyerKey,
            buyer_name: parcelle.buyer_name,
            buyer_phone: parcelle.buyer_phone,
            buyer_email: parcelle.buyer_email,
            buyer_last_name: parcelle.buyer_last_name,
            buyer_first_name: parcelle.buyer_first_name,
            buyer_profession: parcelle.buyer_profession,
            buyer_birth_place: parcelle.buyer_birth_place,
            buyer_birth_date: parcelle.buyer_birth_date,
            buyer_marital_status: parcelle.buyer_marital_status,
            buyer_children_count: parcelle.buyer_children_count,
            buyer_address: parcelle.buyer_address,
            buyer_village_origin: parcelle.buyer_village_origin,
            buyer_groupement: parcelle.buyer_groupement,
            buyer_secteur: parcelle.buyer_secteur,
            buyer_territoire: parcelle.buyer_territoire,
            buyer_province: parcelle.buyer_province,
            parcelles: [],
            hectares: [],
            totalAchat: 0,
            nombreParcelles: 0,
            nombreHectares: 0,
            paper_form_completed: true,
            documents_count: 0,
            has_documents: false,
            first_date: null,
            latest_date: null,
          });
        }

        const acheteur = acheteursMap.get(buyerKey)!;
        const parcelleCount = Math.max(1, Math.ceil(Number(parcelle.surface || 600) / 600));
        acheteur.parcelles.push({
          id: parcelle.id,
          numero: parcelle.numero,
          surface: parcelle.surface,
          prix: parcelle.prix,
          sale_date: parcelle.sale_date,
          created_at: parcelle.created_at,
          hectare_id: parcelle.hectare_id,
          payment_type: parcelle.payment_type,
          amount_paid: parcelle.amount_paid || 0,
          remaining_amount: parcelle.remaining_amount || 0,
          sale_type: parcelle.sale_type || 'a_renseigner',
          purchase_type: parcelle.purchase_type,
          rmb_number: parcelle.rmb_number,
          paper_form_completed: parcelle.paper_form_completed ?? false,
          hectares: parcelle.hectares,
          nombreParcelles: parcelleCount,
        });
        acheteur.totalAchat += (parcelle.sale_type === 'onereux' || parcelle.sale_type === 'a_renseigner') ? 0 : (parcelle.payment_type === 'partiel' ? Number(parcelle.amount_paid || 0) : Number(parcelle.prix || 0));
        acheteur.nombreParcelles += parcelleCount;
        
        // Si une parcelle n'est pas complétée, l'acheteur n'est pas complété
        if (!parcelle.paper_form_completed) {
          acheteur.paper_form_completed = false;
        }

        if (parcelle.buyer_phone && !acheteur.buyer_phone) {
          acheteur.buyer_phone = parcelle.buyer_phone;
        }
        if (parcelle.buyer_email && !acheteur.buyer_email) {
          acheteur.buyer_email = parcelle.buyer_email;
        }
      });
      
      // Traiter les hectares
      hectares?.forEach((hectare) => {
        const buyerKey = hectare.buyer_name.toLowerCase().trim();
        
        if (!acheteursMap.has(buyerKey)) {
          acheteursMap.set(buyerKey, {
            id: buyerKey,
            buyer_name: hectare.buyer_name,
            buyer_phone: hectare.buyer_phone,
            buyer_email: hectare.buyer_email,
            buyer_last_name: hectare.buyer_last_name,
            buyer_first_name: hectare.buyer_first_name,
            buyer_profession: hectare.buyer_profession,
            buyer_birth_place: hectare.buyer_birth_place,
            buyer_birth_date: hectare.buyer_birth_date,
            buyer_marital_status: hectare.buyer_marital_status,
            buyer_children_count: hectare.buyer_children_count,
            buyer_address: hectare.buyer_address,
            buyer_village_origin: hectare.buyer_village_origin,
            buyer_groupement: hectare.buyer_groupement,
            buyer_secteur: hectare.buyer_secteur,
            buyer_territoire: hectare.buyer_territoire,
            buyer_province: hectare.buyer_province,
            parcelles: [],
            hectares: [],
            totalAchat: 0,
            nombreParcelles: 0,
            nombreHectares: 0,
            paper_form_completed: true,
            documents_count: 0,
            has_documents: false,
            first_date: null,
            latest_date: null,
          });
        }

        const acheteur = acheteursMap.get(buyerKey)!;
        const rawSurf = Number(hectare.surface || 1);
        const hSurfHa = rawSurf >= 100 ? rawSurf / 10000 : rawSurf;

        acheteur.hectares.push({
          id: hectare.id,
          name: hectare.name,
          surface: hSurfHa,
          prix: hectare.prix,
          sale_date: hectare.sale_date,
          created_at: hectare.created_at,
          location: hectare.location,
          payment_type: hectare.payment_type,
          amount_paid: hectare.amount_paid || 0,
          remaining_amount: hectare.remaining_amount || 0,
          sale_type: hectare.sale_type || 'a_renseigner',
          purchase_type: hectare.purchase_type,
          rmb_number: hectare.rmb_number,
          paper_form_completed: hectare.paper_form_completed ?? false,
        });
        acheteur.totalAchat += (hectare.sale_type === 'onereux' || hectare.sale_type === 'a_renseigner') ? 0 : (hectare.payment_type === 'partiel' ? Number(hectare.amount_paid || 0) : Number(hectare.prix || 0));
        acheteur.nombreHectares = Math.round((acheteur.nombreHectares + hSurfHa) * 1000) / 1000;
        
        // Si un hectare n'est pas complété, l'acheteur n'est pas complété
        if (!hectare.paper_form_completed) {
          acheteur.paper_form_completed = false;
        }

        if (hectare.buyer_phone && !acheteur.buyer_phone) {
          acheteur.buyer_phone = hectare.buyer_phone;
        }
        if (hectare.buyer_email && !acheteur.buyer_email) {
          acheteur.buyer_email = hectare.buyer_email;
        }
      });

      // Récupérer les documents parcelles et documents acheteurs pour détecter les dossiers complets/incomplets
      const [{ data: allParcelDocs }, { data: allBuyerDocs }] = await Promise.all([
        supabase.from("documents").select("id, parcelle_id"),
        supabase.from("buyer_documents").select("id, buyer_id")
      ]);

      const parcelDocsCount = new Map<string, number>();
      allParcelDocs?.forEach((doc) => {
        if (doc.parcelle_id) {
          parcelDocsCount.set(doc.parcelle_id, (parcelDocsCount.get(doc.parcelle_id) || 0) + 1);
        }
      });

      const buyerDocsCount = new Map<string, number>();
      allBuyerDocs?.forEach((doc) => {
        if (doc.buyer_id) {
          const k = doc.buyer_id.toLowerCase().trim();
          buyerDocsCount.set(k, (buyerDocsCount.get(k) || 0) + 1);
        }
      });

      // Associer documents et dates à chaque concessionnaire
      acheteursMap.forEach((acheteur) => {
        let pDocs = 0;
        const allDates: string[] = [];

        acheteur.parcelles.forEach((p) => {
          pDocs += (parcelDocsCount.get(p.id) || 0);
          if (p.sale_date) allDates.push(p.sale_date);
          else if (p.created_at) allDates.push(p.created_at);
        });

        let bDocs = 0;
        const bId = acheteur.id;
        const bName = acheteur.buyer_name.toLowerCase().trim();

        if (buyerDocsCount.has(bId)) {
          bDocs += buyerDocsCount.get(bId) || 0;
        }
        if (bName !== bId && buyerDocsCount.has(bName)) {
          bDocs += buyerDocsCount.get(bName) || 0;
        }
        buyerDocsCount.forEach((cnt, docBuyerKey) => {
          if (docBuyerKey !== bId && docBuyerKey !== bName && docBuyerKey.startsWith(bName)) {
            bDocs += cnt;
          }
        });

        acheteur.hectares.forEach((h) => {
          if (h.sale_date) allDates.push(h.sale_date);
          else if (h.created_at) allDates.push(h.created_at);
        });

        allDates.sort();
        acheteur.first_date = allDates[0] || null;
        acheteur.latest_date = allDates[allDates.length - 1] || null;

        const totalDocs = pDocs + bDocs;
        acheteur.documents_count = totalDocs;
        acheteur.has_documents = totalDocs > 0;
      });

      const acheteursArray = Array.from(acheteursMap.values()).sort((a, b) => {
        // D'abord trier par statut paper_form_completed (non complétés en premier = épinglés)
        if (!a.paper_form_completed && b.paper_form_completed) return -1;
        if (a.paper_form_completed && !b.paper_form_completed) return 1;
        
        // Ensuite trier par numéro RMB
        const getRmbNumbers = (acheteur: Acheteur) => {
          const rmbNumbers: number[] = [];
          acheteur.parcelles.forEach(p => {
            if (p.rmb_number) {
              const num = parseInt(p.rmb_number.replace(/\D/g, '')) || 0;
              rmbNumbers.push(num);
            }
          });
          acheteur.hectares.forEach(h => {
            if (h.rmb_number) {
              const num = parseInt(h.rmb_number.replace(/\D/g, '')) || 0;
              rmbNumbers.push(num);
            }
          });
          return rmbNumbers.length > 0 ? Math.min(...rmbNumbers) : Infinity;
        };

        const rmbA = getRmbNumbers(a);
        const rmbB = getRmbNumbers(b);
        
        return rmbA - rmbB;
      });

      setAcheteurs(acheteursArray);
    } catch (error: any) {
      const msg = error?.message || error?.details || JSON.stringify(error) || "Erreur inconnue";
      console.error("Erreur loadAcheteurs:", error);
      notify("Erreur", `Chargement acheteurs : ${msg}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleShowDetails = (acheteur: Acheteur) => {
    setSelectedAcheteur(acheteur);
    setShowDetails(true);
  };

  const handleOpenEditQuota = (acheteur: Acheteur) => {
    setBuyerForQuota(acheteur);
    setShowEditQuotaDialog(true);
  };

  const handleOpenDelete = (acheteur: Acheteur) => {
    setBuyerForDelete(acheteur);
    setShowDeleteBuyerDialog(true);
  };

  const handleTogglePaperForm = async (acheteur: Acheteur) => {
    try {
      const newValue = !acheteur.paper_form_completed;
      
      // Mettre à jour toutes les parcelles de cet acheteur
      const parcelleIds = acheteur.parcelles.map(p => p.id);
      if (parcelleIds.length > 0) {
        const { error: parcellesError } = await supabase
          .from("parcelles")
          .update({ paper_form_completed: newValue })
          .in("id", parcelleIds);

        if (parcellesError) throw parcellesError;
      }

      // Mettre à jour tous les hectares de cet acheteur
      const hectareIds = acheteur.hectares.map(h => h.id);
      if (hectareIds.length > 0) {
        const { error: hectaresError } = await supabase
          .from("hectares")
          .update({ paper_form_completed: newValue })
          .in("id", hectareIds);

        if (hectaresError) throw hectaresError;
      }

      notify("Succès", newValue ? "Formulaire marqué comme rempli" : "Formulaire marqué comme à remplir", "success");
      loadAcheteurs(); // Recharger la liste
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors de la mise à jour du statut", "error");
    }
  };

  const handleEditBuyer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAcheteur) return;
    
    try {
      // Mettre à jour toutes les parcelles de cet acheteur
      const parcelleIds = selectedAcheteur.parcelles.map(p => p.id);
      if (parcelleIds.length > 0) {
        const { error: parcellesError } = await supabase
          .from("parcelles")
          .update({
            buyer_name: editBuyerForm.buyer_name,
            buyer_phone: editBuyerForm.buyer_phone || null,
            buyer_email: editBuyerForm.buyer_email || null,
          })
          .in("id", parcelleIds);

        if (parcellesError) throw parcellesError;
      }

      // Mettre à jour tous les hectares de cet acheteur
      const hectareIds = selectedAcheteur.hectares.map(h => h.id);
      if (hectareIds.length > 0) {
        const { error: hectaresError } = await supabase
          .from("hectares")
          .update({
            buyer_name: editBuyerForm.buyer_name,
            buyer_phone: editBuyerForm.buyer_phone || null,
            buyer_email: editBuyerForm.buyer_email || null,
          })
          .in("id", hectareIds);

        if (hectaresError) throw hectaresError;
      }

      notify("Succès", "Acheteur modifié avec succès", "success");
      setShowEditBuyerDialog(false);
      loadAcheteurs(); // Recharger la liste
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors de la modification de l'acheteur", "error");
    }
  };

  const handleOpenEditIdentification = (acheteur: Acheteur) => {
    setSelectedAcheteur(acheteur);
    setEditIdentificationForm({
      buyer_name: acheteur.buyer_name,
      buyer_profession: acheteur.buyer_profession || "",
      buyer_birth_place: acheteur.buyer_birth_place || "",
      buyer_birth_date: acheteur.buyer_birth_date || "",
      buyer_marital_status: acheteur.buyer_marital_status || "",
      buyer_children_count: acheteur.buyer_children_count?.toString() || "",
      buyer_address: acheteur.buyer_address || "",
      buyer_phone: acheteur.buyer_phone || "",
      buyer_email: acheteur.buyer_email || "",
      buyer_village_origin: acheteur.buyer_village_origin || "",
      buyer_groupement: acheteur.buyer_groupement || "",
      buyer_secteur: acheteur.buyer_secteur || "",
      buyer_territoire: acheteur.buyer_territoire || "",
      buyer_province: acheteur.buyer_province || "",
    });
    setShowEditIdentificationDialog(true);
  };

  const handleEditIdentification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAcheteur) return;
    
    try {
      const updateData = {
        buyer_name: editIdentificationForm.buyer_name,
        buyer_profession: editIdentificationForm.buyer_profession || null,
        buyer_birth_place: editIdentificationForm.buyer_birth_place || null,
        buyer_birth_date: editIdentificationForm.buyer_birth_date || null,
        buyer_marital_status: editIdentificationForm.buyer_marital_status || null,
        buyer_children_count: editIdentificationForm.buyer_children_count ? parseInt(editIdentificationForm.buyer_children_count) : null,
        buyer_address: editIdentificationForm.buyer_address || null,
        buyer_phone: editIdentificationForm.buyer_phone || null,
        buyer_email: editIdentificationForm.buyer_email || null,
        buyer_village_origin: editIdentificationForm.buyer_village_origin || null,
        buyer_groupement: editIdentificationForm.buyer_groupement || null,
        buyer_secteur: editIdentificationForm.buyer_secteur || null,
        buyer_territoire: editIdentificationForm.buyer_territoire || null,
        buyer_province: editIdentificationForm.buyer_province || null,
      };

      // Mettre à jour toutes les parcelles de cet acheteur
      const parcelleIds = selectedAcheteur.parcelles.map(p => p.id);
      if (parcelleIds.length > 0) {
        const { error: parcellesError } = await supabase
          .from("parcelles")
          .update(updateData)
          .in("id", parcelleIds);

        if (parcellesError) throw parcellesError;
      }

      // Mettre à jour tous les hectares de cet acheteur
      const hectareIds = selectedAcheteur.hectares.map(h => h.id);
      if (hectareIds.length > 0) {
        const { error: hectaresError } = await supabase
          .from("hectares")
          .update(updateData)
          .in("id", hectareIds);

        if (hectaresError) throw hectaresError;
      }

      notify("Succès", "Fiche d'identification modifiée avec succès", "success");
      setShowEditIdentificationDialog(false);
      loadAcheteurs(); // Recharger la liste
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors de la modification de la fiche", "error");
    }
  };



  const loadAvailableItems = async () => {
    try {
      if (newBuyerForm.item_type === "hectare") {
        const { data, error } = await supabase
          .from("hectares")
          .select("*")
          .eq("status", "available")
          .order("name");
        
        if (error) throw error;
        setAvailableHectares(data || []);
      } else {
        const { data, error } = await supabase
          .from("parcelles")
          .select(`
            *,
            hectares (
              name,
              location
            )
          `)
          .eq("status", "disponible")
          .order("numero");
        
        if (error) throw error;
        setAvailableParcelles(data || []);
      }
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors du chargement des items disponibles", "error");
    }
  };

  const handleNewBuyerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Vérifier les champs obligatoires
    if (!newBuyerForm.nom.trim() || !newBuyerForm.post_nom.trim() || !newBuyerForm.prenom.trim()) {
      notify("Erreur", "Le nom, post-nom et prénom sont obligatoires", "error");
      return;
    }
    
    // Vérifier si des items sont sélectionnés
    const hasSelection = newBuyerForm.item_type === "hectare" 
      ? newBuyerForm.selected_item 
      : newBuyerForm.selected_parcelles.length > 0;

    if (!hasSelection) {
      notify("Erreur", "Veuillez sélectionner au moins un hectare ou une parcelle", "error");
      return;
    }

    try {
      // Concaténer les trois parties du nom
      const fullName = `${newBuyerForm.nom} ${newBuyerForm.post_nom} ${newBuyerForm.prenom}`.trim();

      // Pour les ventes à titre onéreux, pas de prix ni de paiements
      const isOnereux = newBuyerForm.sale_type === "onereux";
      const isARenseigner = newBuyerForm.sale_type === "a_renseigner";

      if (newBuyerForm.item_type === "hectare") {
        const selectedItem = availableHectares.find(h => h.id === newBuyerForm.selected_item);
        
        if (!selectedItem) {
          notify("Erreur", "Hectare sélectionné introuvable", "error");
          return;
        }

        const prix = (isOnereux || isARenseigner) ? 0 : (newBuyerForm.prix ? parseFloat(newBuyerForm.prix) : (selectedItem.prix || 0));
        const amountPaid = (isOnereux || isARenseigner) ? 0 : (newBuyerForm.payment_type === "total" 
          ? prix 
          : Number(newBuyerForm.amount_paid));
        const remainingAmount = (isOnereux || isARenseigner) ? 0 : (prix - amountPaid);

        const updateData = {
          buyer_name: fullName,
          buyer_last_name: newBuyerForm.post_nom || null,
          buyer_first_name: newBuyerForm.prenom || null,
          buyer_profession: newBuyerForm.profession || null,
          buyer_birth_place: newBuyerForm.birth_place || null,
          buyer_birth_date: newBuyerForm.birth_date || null,
          buyer_marital_status: newBuyerForm.marital_status || null,
          buyer_children_count: newBuyerForm.children_count ? parseInt(newBuyerForm.children_count) : null,
          buyer_address: newBuyerForm.address || null,
          buyer_phone: newBuyerForm.buyer_phone || null,
          buyer_email: newBuyerForm.buyer_email || null,
          buyer_village_origin: newBuyerForm.village_origin || null,
          buyer_groupement: newBuyerForm.groupement || null,
          buyer_secteur: newBuyerForm.secteur || null,
          buyer_territoire: newBuyerForm.territoire || null,
          buyer_province: newBuyerForm.province || null,
          status: "vendu",
          sale_date: isARenseigner ? null : new Date().toISOString(),
          sale_type: isARenseigner ? null : newBuyerForm.sale_type,
          purchase_type: newBuyerForm.purchase_type,
          payment_type: (isOnereux || isARenseigner) ? "total" : newBuyerForm.payment_type,
          amount_paid: amountPaid,
          remaining_amount: remainingAmount,
          rmb_number: newBuyerForm.rmb_number || null,
          prix: prix,
        };

        const { error } = await supabase
          .from("hectares")
          .update(updateData)
          .eq("id", newBuyerForm.selected_item);

        if (error) throw error;
      } else {
        // Traiter plusieurs parcelles
        const selectedParcelles = availableParcelles.filter(p => 
          newBuyerForm.selected_parcelles.includes(p.id)
        );

        if (selectedParcelles.length === 0) {
          notify("Erreur", "Parcelles sélectionnées introuvables", "error");
          return;
        }

        // Calculer le prix total
        const prixTotal = selectedParcelles.reduce((sum, p) => sum + (p.prix || 0), 0);
        const prix = (isOnereux || isARenseigner) ? 0 : (newBuyerForm.prix ? parseFloat(newBuyerForm.prix) : prixTotal);
        const amountPaid = (isOnereux || isARenseigner) ? 0 : (newBuyerForm.payment_type === "total" 
          ? prix 
          : Number(newBuyerForm.amount_paid));
        const remainingAmount = (isOnereux || isARenseigner) ? 0 : (prix - amountPaid);

        // Créer un ID de groupe si fusion demandée ou si rattaché à un acquéreur existant
        const mergeGroupId = newBuyerSelectedExisting?.mergedGroupId
          ? newBuyerSelectedExisting.mergedGroupId
          : ((newBuyerForm.merge_parcelles && selectedParcelles.length > 1) 
            ? crypto.randomUUID() 
            : null);

        // Mettre à jour toutes les parcelles sélectionnées
        for (let i = 0; i < selectedParcelles.length; i++) {
          const parcelle = selectedParcelles[i];
          const updateData = {
            buyer_name: fullName,
            buyer_last_name: newBuyerForm.post_nom || null,
            buyer_first_name: newBuyerForm.prenom || null,
            buyer_profession: newBuyerForm.profession || null,
            buyer_birth_place: newBuyerForm.birth_place || null,
            buyer_birth_date: newBuyerForm.birth_date || null,
            buyer_marital_status: newBuyerForm.marital_status || null,
            buyer_children_count: newBuyerForm.children_count ? parseInt(newBuyerForm.children_count) : null,
            buyer_address: newBuyerForm.address || null,
            buyer_phone: newBuyerForm.buyer_phone || null,
            buyer_email: newBuyerForm.buyer_email || null,
            buyer_village_origin: newBuyerForm.village_origin || null,
            buyer_groupement: newBuyerForm.groupement || null,
            buyer_secteur: newBuyerForm.secteur || null,
            buyer_territoire: newBuyerForm.territoire || null,
            buyer_province: newBuyerForm.province || null,
            status: "vendu",
            sale_date: isARenseigner ? null : new Date().toISOString(),
            sale_type: isARenseigner ? null : newBuyerForm.sale_type,
            purchase_type: newBuyerForm.purchase_type,
            payment_type: (isOnereux || isARenseigner) ? "total" : newBuyerForm.payment_type,
            amount_paid: amountPaid / selectedParcelles.length,
            remaining_amount: remainingAmount / selectedParcelles.length,
            rmb_number: newBuyerForm.rmb_number || null,
            prix: prix / selectedParcelles.length,
            merged_group_id: mergeGroupId,
            is_merge_primary: i === 0,
          };

          const { error } = await supabase
            .from("parcelles")
            .update(updateData)
            .eq("id", parcelle.id);

          if (error) throw error;
        }
      }

      notify(
        "Succès",
        newBuyerSelectedExisting
          ? `Acquisition enregistrée et ajoutée au quota existant de ${newBuyerSelectedExisting.buyer_name} !`
          : "Acheteur enregistré avec succès",
        "success"
      );
      setShowNewBuyerDialog(false);
      setNewBuyerSelectedExisting(null);
      refetchBuyerDetection();
      setNewBuyerForm({
        nom: "",
        post_nom: "",
        prenom: "",
        profession: "",
        birth_place: "",
        birth_date: "",
        marital_status: "",
        children_count: "",
        address: "",
        buyer_phone: "",
        buyer_email: "",
        village_origin: "",
        groupement: "",
        secteur: "",
        territoire: "",
        province: "",
        purchase_type: "hectare",
        item_type: "hectare",
        selected_item: "",
        selected_parcelles: [],
        merge_parcelles: false,
        sale_type: "normal",
        payment_type: "total",
        amount_paid: "",
        rmb_number: "",
        prix: "",
      });
      loadAcheteurs();
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors de l'enregistrement de l'acheteur", "error");
    }
  };

  const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const missingDocsCount = useMemo(() => {
    return acheteurs.filter((a) => !a.has_documents).length;
  }, [acheteurs]);

  const withDocsCount = useMemo(() => {
    return acheteurs.filter((a) => a.has_documents).length;
  }, [acheteurs]);

  const pendingSalesCount = useMemo(() => {
    return acheteurs.filter(
      (a) =>
        a.parcelles.some((p: any) => p.sale_type === "a_renseigner") ||
        a.hectares.some((h: any) => h.sale_type === "a_renseigner")
    ).length;
  }, [acheteurs]);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [displayLimit, setDisplayLimit] = useState(25);

  useEffect(() => {
    setDisplayLimit(25);
  }, [deferredSearchTerm, docFilter]);

  const filteredAcheteurs = useMemo(() => {
    const term = deferredSearchTerm.toLowerCase().trim();
    return acheteurs.filter((a) => {
      // Filtre de documents et ventes en attente
      if (docFilter === "missing" && a.has_documents) return false;
      if (docFilter === "with" && !a.has_documents) return false;
      if (docFilter === "pending_sale") {
        const hasPending =
          a.parcelles.some((p: any) => p.sale_type === "a_renseigner") ||
          a.hectares.some((h: any) => h.sale_type === "a_renseigner");
        if (!hasPending) return false;
      }

      // Filtre de recherche
      if (term) {
        const matchName = a.buyer_name.toLowerCase().includes(term);
        const matchPhone = a.buyer_phone?.toLowerCase().includes(term);
        const matchEmail = a.buyer_email?.toLowerCase().includes(term);
        const matchParcelles = a.parcelles.some(
          (p) =>
            p.numero.toLowerCase().includes(term) ||
            (p.rmb_number && p.rmb_number.toLowerCase().includes(term))
        );
        const matchHectares = a.hectares.some(
          (h) =>
            h.name.toLowerCase().includes(term) ||
            (h.rmb_number && h.rmb_number.toLowerCase().includes(term))
        );
        return matchName || matchPhone || matchEmail || matchParcelles || matchHectares;
      }

      return true;
    });
  }, [acheteurs, docFilter, deferredSearchTerm]);

  const displayedAcheteurs = useMemo(() => {
    return filteredAcheteurs.slice(0, displayLimit);
  }, [filteredAcheteurs, displayLimit]);

  // Raccourcis de sélection de date pour l'export
  const handleSetDatePreset = (preset: "all" | "today" | "this_month" | "last_30" | "this_year") => {
    const todayStr = new Date().toISOString().split("T")[0];
    if (preset === "all") {
      setExportStartDate("");
      setExportEndDate("");
    } else if (preset === "today") {
      setExportStartDate(todayStr);
      setExportEndDate(todayStr);
    } else if (preset === "this_month") {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      setExportStartDate(firstDay);
      setExportEndDate(todayStr);
    } else if (preset === "last_30") {
      const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setExportStartDate(d.toISOString().split("T")[0]);
      setExportEndDate(todayStr);
    } else if (preset === "this_year") {
      const now = new Date();
      setExportStartDate(`${now.getFullYear()}-01-01`);
      setExportEndDate(todayStr);
    }
  };

  // Liste des concessionnaires filtrée et triée pour l'exportation
  const buyersForExport = useMemo(() => {
    let list = acheteurs.filter((a) => {
      // Filtre statut document
      if (exportDocStatus === "missing" && a.has_documents) return false;
      if (exportDocStatus === "with" && !a.has_documents) return false;

      // Filtre date
      if (exportStartDate || exportEndDate) {
        const dates = [
          ...a.parcelles.map((p) => p.sale_date || p.created_at),
          ...a.hectares.map((h) => h.sale_date || h.created_at),
        ].filter(Boolean) as string[];

        if (dates.length === 0) {
          return false;
        }

        const matchesRange = dates.some((dStr) => {
          const d = new Date(dStr);
          if (isNaN(d.getTime())) return false;
          const ymd = d.toISOString().split("T")[0];
          if (exportStartDate && ymd < exportStartDate) return false;
          if (exportEndDate && ymd > exportEndDate) return false;
          return true;
        });

        if (!matchesRange) return false;
      }

      return true;
    });

    // Tri
    list = [...list].sort((a, b) => {
      if (exportSortOrder === "name_asc") {
        return a.buyer_name.localeCompare(b.buyer_name, "fr", { sensitivity: "base" });
      }

      const dateA = a.latest_date || a.first_date || "";
      const dateB = b.latest_date || b.first_date || "";

      if (exportSortOrder === "date_asc") {
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateA.localeCompare(dateB);
      } else {
        // date_desc
        if (!dateA) return 1;
        if (!dateB) return -1;
        return dateB.localeCompare(dateA);
      }
    });

    return list;
  }, [acheteurs, exportStartDate, exportEndDate, exportDocStatus, exportSortOrder]);

  // Exportation CSV (compatible Excel avec BOM UTF-8)
  const handleExportCSV = () => {
    if (buyersForExport.length === 0) {
      notify("Attention", "Aucun concessionnaire à exporter avec ces critères.", "error");
      return;
    }

    const headers = [
      "Date",
      "Nom du concessionnaire",
      "Téléphone",
      "Email",
      "Profession",
      "Adresse",
      "Parcelles & RMB",
      "Hectares & RMB",
      "Quantité & Détails",
      "Superficie Totale (m2)",
      "Montant Total (USD)",
      "Statut Document",
      "Nombre Documents",
    ];

    const rows = buyersForExport.map((a) => {
      const dateDisplay = a.latest_date
        ? new Date(a.latest_date).toLocaleDateString("fr-FR")
        : a.first_date
        ? new Date(a.first_date).toLocaleDateString("fr-FR")
        : "N/A";

      const parcellesList = a.parcelles
        .map((p) => `P.${p.numero}${p.rmb_number ? ` [${p.rmb_number}]` : ""} (${p.surface || 600} m²)`)
        .join(", ");

      const hectaresList = a.hectares
        .map((h) => {
          const ha = Number(h.surface || 1);
          const m2 = Math.round(ha * 10000);
          return `${h.name}${h.rmb_number ? ` [${h.rmb_number}]` : ""} (${ha} ha · ${m2} m²)`;
        })
        .join(", ");

      const parcellesM2 = a.parcelles.reduce((sum, p) => sum + Number(p.surface || 600), 0);
      const hectaresM2 = a.hectares.reduce((sum, h) => {
        const ha = Number(h.surface || 1);
        return sum + (ha >= 100 ? ha : Math.round(ha * 10000));
      }, 0);
      const totalSurface = parcellesM2 + hectaresM2;

      const pCount = a.parcelles.reduce((sum, p) => sum + (p.nombreParcelles || Math.max(1, Math.ceil(Number(p.surface || 600) / 600))), 0);
      const qtyDisplay = [
        a.parcelles.length > 0 ? `${pCount} parcelle(s) (${parcellesM2} m²)` : null,
        a.hectares.length > 0 ? `${a.nombreHectares} ha (${hectaresM2} m²)` : null,
      ].filter(Boolean).join(" + ") || "—";

      const docStatus = a.has_documents
        ? `Document joint (${a.documents_count})`
        : "NON AJOUTE (MANQUANT)";

      return [
        dateDisplay,
        `"${(a.buyer_name || "").replace(/"/g, '""')}"`,
        `"${(a.buyer_phone || "").replace(/"/g, '""')}"`,
        `"${(a.buyer_email || "").replace(/"/g, '""')}"`,
        `"${(a.buyer_profession || "").replace(/"/g, '""')}"`,
        `"${(a.buyer_address || "").replace(/"/g, '""')}"`,
        `"${parcellesList.replace(/"/g, '""')}"`,
        `"${hectaresList.replace(/"/g, '""')}"`,
        `"${qtyDisplay.replace(/"/g, '""')}"`,
        totalSurface,
        a.totalAchat,
        `"${docStatus}"`,
        a.documents_count || 0,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `liste-concessionnaires-${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify("Succès", `Export CSV téléchargé (${buyersForExport.length} concessionnaires)`, "success");
  };

  // Exportation PDF officiel avec mise en page soignée, en-tête bien proportionné et quantité
  const handleExportPDF = async () => {
    if (buyersForExport.length === 0) {
      notify("Attention", "Aucun concessionnaire à exporter avec ces critères.", "error");
      return;
    }

    try {
      setIsExportingPdf(true);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const img = new Image();
      img.src = headerImage;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pdfWidth = 297;
      const pdfHeight = 210;
      const imgRatio = img.height / img.width; // 0.409375
      // En-tête bien proportionné et centré (140mm de large)
      const imgWidth = 140;
      const headerHeight = Math.round(imgWidth * imgRatio * 10) / 10; // ~57.3mm
      const imgX = (pdfWidth - imgWidth) / 2;
      pdf.addImage(headerImage, "JPEG", imgX, 4, imgWidth, headerHeight);

      let yPos = 4 + headerHeight + 5;

      // Titre
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 41, 59);
      pdf.text(
        "LISTE DES CONCESSIONNAIRES & SUIVI DES PIÈCES JUSTIFICATIVES",
        pdfWidth / 2,
        yPos,
        { align: "center" }
      );
      yPos += 5.5;

      // Sous-titre Période et Date
      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 116, 139);
      const periodeLabel =
        exportStartDate || exportEndDate
          ? `Période : Du ${formatDateDisplay(exportStartDate || "le début")} au ${formatDateDisplay(
              exportEndDate || new Date().toISOString()
            )}`
          : "Période : Toutes dates confondues";
      pdf.text(
        `${periodeLabel} · Généré le ${new Date().toLocaleDateString("fr-FR")} à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
        pdfWidth / 2,
        yPos,
        { align: "center" }
      );
      yPos += 6.5;

      // Cadre de synthèse
      const totalSelected = buyersForExport.length;
      const missingCount = buyersForExport.filter((b) => !b.has_documents).length;
      const withDocsCountInExport = totalSelected - missingCount;
      const totalAmount = buyersForExport.reduce((sum, b) => sum + b.totalAchat, 0);

      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(15, yPos, 267, 8.5, 1.5, 1.5, "FD");

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text(`Total concessionnaires : ${totalSelected}`, 20, yPos + 5.5);

      if (missingCount > 0) {
        pdf.setTextColor(220, 38, 38);
        pdf.text(`! Documents manquants : ${missingCount}`, 85, yPos + 5.5);
      } else {
        pdf.setTextColor(22, 101, 52);
        pdf.text(`Dossiers complets : ${totalSelected}`, 85, yPos + 5.5);
      }

      pdf.setTextColor(22, 101, 52);
      pdf.text(`Dossiers avec pièces : ${withDocsCountInExport}`, 160, yPos + 5.5);

      pdf.setTextColor(30, 41, 59);
      pdf.text(`Montant total : ${totalAmount.toLocaleString()} USD`, 225, yPos + 5.5);

      yPos += 12;

      // En-têtes du tableau (Largeur totale = 267mm de 15 à 282)
      const drawTableHeader = () => {
        pdf.setFillColor(241, 245, 249);
        pdf.setDrawColor(203, 213, 225);
        pdf.rect(15, yPos, 267, 7, "FD");
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(51, 65, 85);

        pdf.text("N°", 17, yPos + 4.5);
        pdf.text("Date", 25, yPos + 4.5);
        pdf.text("Nom du concessionnaire", 44, yPos + 4.5);
        pdf.text("Contact (Tél / Email)", 92, yPos + 4.5);
        pdf.text("Biens acquis (RMB / N°)", 124, yPos + 4.5);
        pdf.text("Quantité & Superficie", 168, yPos + 4.5);
        pdf.text("Total Payé", 216, yPos + 4.5);
        pdf.text("Statut Document", 242, yPos + 4.5);
        yPos += 7;
      };

      drawTableHeader();

      // Lignes du tableau
      buyersForExport.forEach((b, idx) => {
        if (yPos > 192) {
          pdf.addPage();
          yPos = 15;
          drawTableHeader();
        }

        // Alternance de fond
        if (idx % 2 === 1) {
          pdf.setFillColor(248, 250, 252);
          pdf.rect(15, yPos, 267, 8, "F");
        }

        // Fond spécifique si document manquant
        if (!b.has_documents) {
          pdf.setFillColor(254, 242, 242);
          pdf.rect(15, yPos, 267, 8, "F");
        }

        pdf.setDrawColor(241, 245, 249);
        pdf.line(15, yPos + 8, 282, yPos + 8);

        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(30, 41, 59);

        // N°
        pdf.text(`${idx + 1}`, 17, yPos + 5.2);

        // Date
        const dateStr = b.latest_date || b.first_date;
        pdf.text(formatDateDisplay(dateStr), 25, yPos + 5.2);

        // Nom
        pdf.setFont("helvetica", "bold");
        const truncatedName =
          b.buyer_name.length > 28 ? b.buyer_name.slice(0, 26) + "…" : b.buyer_name;
        pdf.text(truncatedName, 44, yPos + 5.2);

        // Contact
        pdf.setFont("helvetica", "normal");
        const contactStr = b.buyer_phone || b.buyer_email || "—";
        const truncatedContact =
          contactStr.length > 20 ? contactStr.slice(0, 18) + "…" : contactStr;
        pdf.text(truncatedContact, 92, yPos + 5.2);

        // Biens (N° et RMB)
        const parcelsStr = b.parcelles
          .map((p) => `P.${p.numero}${p.rmb_number ? ` (${p.rmb_number})` : ""}`)
          .join(", ");
        const hectStr = b.hectares
          .map((h) => `${h.name}${h.rmb_number ? ` (${h.rmb_number})` : ""}`)
          .join(", ");
        const biensText = [parcelsStr, hectStr].filter(Boolean).join(" · ") || "—";
        const truncatedBiens = biensText.length > 26 ? biensText.slice(0, 24) + "…" : biensText;
        pdf.text(truncatedBiens, 124, yPos + 5.2);

        // Quantité & Superficie
        const pCount = b.parcelles.reduce((sum, p) => sum + (p.nombreParcelles || Math.max(1, Math.ceil(Number(p.surface || 600) / 600))), 0);
        const pSurf = b.parcelles.reduce((sum, p) => sum + Number(p.surface || 600), 0);
        const hSurfHa = Math.round(b.hectares.reduce((sum, h) => sum + (Number(h.surface || 1) >= 100 ? Number(h.surface) / 10000 : Number(h.surface || 1)), 0) * 1000) / 1000;
        const hSurfM2 = Math.round(hSurfHa * 10000);

        let qtyDisplay = "";
        if (b.parcelles.length > 0 && b.hectares.length > 0) {
          qtyDisplay = `${pCount} p. (${pSurf}m²) + ${hSurfHa}ha (${hSurfM2}m²)`;
        } else if (b.hectares.length > 0) {
          qtyDisplay = `${hSurfHa} ha (${hSurfM2.toLocaleString("fr-FR")} m²)`;
        } else if (b.parcelles.length > 0) {
          qtyDisplay = `${pCount} parcelle${pCount > 1 ? "s" : ""} (${pSurf.toLocaleString("fr-FR")} m²)`;
        } else {
          qtyDisplay = "—";
        }
        const truncatedQty = qtyDisplay.length > 28 ? qtyDisplay.slice(0, 26) + "…" : qtyDisplay;
        pdf.text(truncatedQty, 168, yPos + 5.2);

        // Montant
        pdf.setFont("helvetica", "bold");
        pdf.text(`${b.totalAchat.toLocaleString()} $`, 216, yPos + 5.2);

        // Statut Document
        if (!b.has_documents) {
          pdf.setTextColor(220, 38, 38);
          pdf.setFont("helvetica", "bold");
          pdf.text("NON AJOUTE", 242, yPos + 5.2);
        } else {
          pdf.setTextColor(22, 101, 52);
          pdf.setFont("helvetica", "normal");
          pdf.text(`Joint (${b.documents_count} doc${b.documents_count > 1 ? "s" : ""})`, 242, yPos + 5.2);
        }

        yPos += 8;
      });

      // Pagination
      const pageCount = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(148, 163, 184);
        pdf.text(
          `Page ${i} sur ${pageCount} · Concession Manuel Joaquim d'Oliveira · Document administratif officiel`,
          pdfWidth / 2,
          204,
          { align: "center" }
        );
      }

      pdf.save(`liste-concessionnaires-${new Date().toISOString().split("T")[0]}.pdf`);
      notify(
        "Succès",
        `Rapport PDF téléchargé avec succès (${buyersForExport.length} concessionnaires)`,
        "success"
      );
    } catch (err: any) {
      console.error("Erreur génération PDF acheteurs:", err);
      notify("Erreur", `Génération PDF : ${err.message || "Erreur inconnue"}`, "error");
    } finally {
      setIsExportingPdf(false);
    }
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

      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
        {/* Header */}
        <PageHeader
          title="Acheteurs & paiements"
          description="Suivez chaque client, ses achats et l'état de ses versements."
        />

        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, téléphone, RMB..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Switch vue cartes / tableau */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  viewMode === "cards"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Cartes</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  viewMode === "table"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tableau</span>
              </button>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowExportDialog(true)}
              className="h-11 px-3 sm:px-4 border-primary/30 hover:bg-primary/10 text-foreground flex items-center gap-2"
              title="Télécharger la liste des concessionnaires par date (PDF ou Excel)"
            >
              <Download className="w-4 h-4 text-primary" />
              <span className="hidden md:inline">Télécharger liste</span>
              <span className="md:hidden">Export</span>
            </Button>

            <div className="hidden lg:flex items-center gap-2 px-3 py-2.5 bg-muted rounded-lg">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{filteredAcheteurs.length} concessionnaire{filteredAcheteurs.length > 1 ? 's' : ''}</span>
            </div>

            <Button onClick={() => setShowNewBuyerDialog(true)} className="h-11 px-4 gap-2 font-semibold">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouvelle Inscription Foncière</span>
              <span className="sm:hidden">Inscrire</span>
            </Button>
          </div>
        </div>

        {/* Filtres rapides par statut des documents justificatifs */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setDocFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              docFilter === "all"
                ? "bg-foreground text-background shadow-xs"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Tous les concessionnaires ({acheteurs.length})
          </button>
          <button
            type="button"
            onClick={() => setDocFilter("missing")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              docFilter === "missing"
                ? "bg-red-600 text-white shadow-xs"
                : "bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 border border-red-500/30"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            ⚠️ Documents non ajoutés ({missingDocsCount})
          </button>
          <button
            type="button"
            onClick={() => setDocFilter("with")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              docFilter === "with"
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            ✓ Avec documents ({withDocsCount})
          </button>
          <button
            type="button"
            onClick={() => setDocFilter("pending_sale")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              docFilter === "pending_sale"
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/30"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            ⏳ Ventes à renseigner ({pendingSalesCount})
          </button>
        </div>

        {/* Statistics Cards */}
        <div className="mb-6">
          <BuyerStatsCards 
            totalAcheteurs={acheteurs.length}
            totalRevenu={acheteurs.reduce((sum, a) => sum + a.totalAchat, 0)}
            totalParcelles={acheteurs.reduce((sum, a) => sum + a.nombreParcelles, 0)}
            totalHectares={acheteurs.reduce((sum, a) => sum + a.nombreHectares, 0)}
            missingDocsCount={missingDocsCount}
            onFilterMissingDocs={() => setDocFilter(docFilter === "missing" ? "all" : "missing")}
          />
        </div>

        {/* Vue CARTES */}
        {viewMode === "cards" && (
          <div className="flex-1 overflow-y-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex flex-col gap-3">
              {displayedAcheteurs.map((acheteur) => (
                <BuyerCard
                  key={acheteur.id}
                  acheteur={acheteur}
                  onShowDetails={() => handleShowDetails(acheteur)}
                  onEdit={() => {
                    setSelectedAcheteur(acheteur);
                    setEditBuyerForm({
                      buyer_name: acheteur.buyer_name,
                      buyer_phone: acheteur.buyer_phone || "",
                      buyer_email: acheteur.buyer_email || "",
                    });
                    setShowEditBuyerDialog(true);
                  }}
                  onTogglePaperForm={() => handleTogglePaperForm(acheteur)}
                  onEditQuota={() => handleOpenEditQuota(acheteur)}
                  onDelete={() => handleOpenDelete(acheteur)}
                />
              ))}

              {filteredAcheteurs.length > displayLimit && (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Affichage de <span className="font-semibold text-foreground">{Math.min(displayLimit, filteredAcheteurs.length)}</span> sur{" "}
                    <span className="font-semibold text-foreground">{filteredAcheteurs.length}</span> concessionnaires
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisplayLimit((prev) => prev + 25)}
                      className="font-medium"
                    >
                      Afficher plus (+25)
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDisplayLimit(filteredAcheteurs.length)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Tout afficher ({filteredAcheteurs.length})
                    </Button>
                  </div>
                </div>
              )}

              {filteredAcheteurs.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">Aucun concessionnaire trouvé</h3>
                  <p className="text-sm text-muted-foreground">Aucun résultat ne correspond à votre recherche</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Vue TABLEAU */}
        {viewMode === "table" && (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider whitespace-nowrap">Concessionnaire</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider whitespace-nowrap">Contact</th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider whitespace-nowrap">
                    <span className="flex items-center gap-1"><Grid3x3 className="w-3.5 h-3.5" /> Parcelles</span>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider whitespace-nowrap">
                    <span className="flex items-center gap-1"><MapIcon className="w-3.5 h-3.5" /> Hectares</span>
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider whitespace-nowrap">Total payé</th>
                  <th className="text-center px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider whitespace-nowrap">
                    <span className="flex items-center justify-center gap-1"><FileText className="w-3.5 h-3.5" /> Documents</span>
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground text-xs uppercase tracking-wider whitespace-nowrap">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Date</span>
                  </th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedAcheteurs.map((acheteur, idx) => {
                  const isPinned = !acheteur.paper_form_completed;
                  const totalItemsCount = acheteur.parcelles.length + acheteur.hectares.length;
                  const isAllPending = totalItemsCount > 0 &&
                    (acheteur.parcelles.length === 0 || acheteur.parcelles.every((p) => p.sale_type === 'a_renseigner')) &&
                    (acheteur.hectares.length === 0 || acheteur.hectares.every((h) => h.sale_type === 'a_renseigner'));
                  const hasPendingSale = acheteur.parcelles.some((p) => p.sale_type === 'a_renseigner') ||
                    acheteur.hectares.some((h) => h.sale_type === 'a_renseigner');

                  return (
                    <tr
                      key={acheteur.id}
                      className={`transition-colors ${
                        isAllPending
                          ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : isPinned
                          ? "bg-orange-500/5 hover:bg-orange-500/10"
                          : idx % 2 === 0
                          ? "bg-background hover:bg-muted/40"
                          : "bg-muted/20 hover:bg-muted/40"
                      }`}
                    >
                      {/* Nom */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {isAllPending ? (
                            <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Vente en attente d'informations" />
                          ) : isPinned ? (
                            <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Formulaire à compléter" />
                          ) : null}
                          <span className="font-semibold text-foreground">{acheteur.buyer_name}</span>
                          {isAllPending ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-bold px-1.5 py-0">
                              À renseigner
                            </Badge>
                          ) : hasPendingSale ? (
                            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[9px] px-1 py-0">
                              À régulariser
                            </Badge>
                          ) : null}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {acheteur.buyer_phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                              <Phone className="w-3 h-3 shrink-0" />{acheteur.buyer_phone}
                            </span>
                          )}
                          {acheteur.buyer_email && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="w-3 h-3 shrink-0" /><span className="max-w-[160px] truncate">{acheteur.buyer_email}</span>
                            </span>
                          )}
                          {!acheteur.buyer_phone && !acheteur.buyer_email && (
                            <span className="text-xs text-muted-foreground italic">—</span>
                          )}
                        </div>
                      </td>

                      {/* Parcelles */}
                      <td className="px-4 py-3">
                        {acheteur.parcelles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {acheteur.parcelles.map((p, i) => {
                              const pCount = p.nombreParcelles || Math.max(1, Math.ceil(Number(p.surface || 600) / 600));
                              const isPending = p.sale_type === "a_renseigner";
                              return (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className={`text-[10px] px-1.5 py-0.5 font-medium whitespace-nowrap ${
                                    isPending
                                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                  }`}
                                >
                                  {p.numero}
                                  {p.rmb_number && p.rmb_number !== p.numero && (
                                    <span className="ml-1 opacity-60">· {p.rmb_number}</span>
                                  )}
                                  <span className="ml-1 font-semibold text-emerald-800 dark:text-emerald-300">
                                    ({p.surface || 600} m²)
                                  </span>
                                  {pCount > 1 && (
                                    <span className="ml-1 font-bold text-emerald-800 dark:text-emerald-300">({pCount} p.)</span>
                                  )}
                                  {isPending && (
                                    <span className="ml-1 text-[9px] font-bold text-amber-700 dark:text-amber-300">· À renseigner</span>
                                  )}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Hectares */}
                      <td className="px-4 py-3">
                        {acheteur.hectares.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {acheteur.hectares.map((h, i) => {
                              const isPending = h.sale_type === "a_renseigner";
                              const surfHa = Number(h.surface || 1);
                              const surfDisplay =
                                surfHa < 1
                                  ? `${surfHa} ha (${Math.round(surfHa * 10000).toLocaleString("fr-FR")} m²)`
                                  : `${surfHa} ha`;
                              return (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className={`text-[10px] px-1.5 py-0.5 font-medium whitespace-nowrap ${
                                    isPending
                                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30"
                                      : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
                                  }`}
                                >
                                  {h.name}
                                  {h.rmb_number && (
                                    <span className="ml-1 opacity-60">· {h.rmb_number}</span>
                                  )}
                                  <span className="ml-1 font-semibold text-blue-800 dark:text-blue-300">
                                    ({surfDisplay})
                                  </span>
                                  {isPending && (
                                    <span className="ml-1 text-[9px] font-bold text-amber-700 dark:text-amber-300">· À renseigner</span>
                                  )}
                                </Badge>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {isAllPending ? (
                          <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 font-semibold px-2 py-0.5">
                            À renseigner
                          </Badge>
                        ) : (
                          <>
                            <span className="font-bold text-foreground">
                              {acheteur.totalAchat.toLocaleString()}
                            </span>
                            <span className="text-xs font-normal text-muted-foreground ml-1">USD</span>
                            {hasPendingSale && (
                              <span className="block text-[9px] text-amber-600 dark:text-amber-400 font-medium">+ vente en attente</span>
                            )}
                          </>
                        )}
                      </td>

                      {/* Statut Documents */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {!acheteur.has_documents ? (
                          <Badge
                            variant="outline"
                            className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-[10px] font-bold gap-1 px-2 py-0.5 inline-flex"
                          >
                            <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                            <span>Non ajouté</span>
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-medium gap-1 px-2 py-0.5 inline-flex"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{acheteur.documents_count} doc{(acheteur.documents_count || 0) > 1 ? 's' : ''}</span>
                          </Badge>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateDisplay(acheteur.latest_date || acheteur.first_date)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs font-medium"
                            onClick={() => handleShowDetails(acheteur)}
                            title="Voir la fiche détaillée"
                          >
                            Détails
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 gap-1"
                            onClick={() => handleOpenEditQuota(acheteur)}
                            title="Modifier le quota de parcelles"
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            <span className="hidden xl:inline">Quota</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleOpenDelete(acheteur)}
                            title="Supprimer ce concessionnaire"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredAcheteurs.length > displayLimit && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Affichage de <span className="font-semibold text-foreground">{Math.min(displayLimit, filteredAcheteurs.length)}</span> sur{" "}
                  <span className="font-semibold text-foreground">{filteredAcheteurs.length}</span> concessionnaires
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisplayLimit((prev) => prev + 25)}
                    className="font-medium"
                  >
                    Afficher plus (+25)
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDisplayLimit(filteredAcheteurs.length)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Tout afficher ({filteredAcheteurs.length})
                  </Button>
                </div>
              </div>
            )}

            {filteredAcheteurs.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Aucun concessionnaire trouvé</p>
              </div>
            )}
          </div>
        )}

        {/* Dialog Détails Acheteur */}
        <BuyerDetailsDialog
          open={showDetails}
          onOpenChange={setShowDetails}
          acheteur={selectedAcheteur}
          onEditIdentification={handleOpenEditIdentification}
          onEditQuota={handleOpenEditQuota}
          onDeleteBuyer={handleOpenDelete}
        />

        {/* Dialog Modifier Acheteur */}
        <Dialog open={showEditBuyerDialog} onOpenChange={setShowEditBuyerDialog}>
          <DialogContent className="max-w-md bg-card">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-xl">Modifier l'acheteur</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEditBuyer} className="space-y-4 pt-4">
              <div>
                <Label className="text-sm font-medium">Nom complet *</Label>
                <Input
                  value={editBuyerForm.buyer_name}
                  onChange={(e) => setEditBuyerForm({ ...editBuyerForm, buyer_name: e.target.value })}
                  placeholder="Nom complet"
                  className="mt-1.5 bg-background"
                  required
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Téléphone</Label>
                <Input
                  value={editBuyerForm.buyer_phone}
                  onChange={(e) => setEditBuyerForm({ ...editBuyerForm, buyer_phone: e.target.value })}
                  placeholder="Numéro de téléphone"
                  className="mt-1.5 bg-background"
                />
              </div>

              <div>
                <Label className="text-sm font-medium">Email</Label>
                <Input
                  type="email"
                  value={editBuyerForm.buyer_email}
                  onChange={(e) => setEditBuyerForm({ ...editBuyerForm, buyer_email: e.target.value })}
                  placeholder="Adresse email"
                  className="mt-1.5 bg-background"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowEditBuyerDialog(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" className="flex-1">
                  Enregistrer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog Modifier Fiche d'Identification */}
        <Dialog open={showEditIdentificationDialog} onOpenChange={setShowEditIdentificationDialog}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-xl">Modifier la fiche d'identification</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleEditIdentification} className="space-y-4 pt-4">
              {/* Identité */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Identité</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Nom complet *</Label>
                    <Input
                      value={editIdentificationForm.buyer_name}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_name: e.target.value })}
                      placeholder="Nom complet"
                      className="mt-1.5 bg-background"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Profession</Label>
                    <Input
                      value={editIdentificationForm.buyer_profession}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_profession: e.target.value })}
                      placeholder="Profession"
                      className="mt-1.5 bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Naissance */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Naissance</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Lieu de naissance</Label>
                    <Input
                      value={editIdentificationForm.buyer_birth_place}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_birth_place: e.target.value })}
                      placeholder="Lieu de naissance"
                      className="mt-1.5 bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Date de naissance</Label>
                    <Input
                      type="date"
                      value={editIdentificationForm.buyer_birth_date}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_birth_date: e.target.value })}
                      className="mt-1.5 bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* État civil */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">État civil</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Situation matrimoniale</Label>
                    <Select
                      value={editIdentificationForm.buyer_marital_status}
                      onValueChange={(value) => setEditIdentificationForm({ ...editIdentificationForm, buyer_marital_status: value })}
                    >
                      <SelectTrigger className="mt-1.5 bg-background">
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="celibataire">Célibataire</SelectItem>
                        <SelectItem value="marie">Marié(e)</SelectItem>
                        <SelectItem value="divorce">Divorcé(e)</SelectItem>
                        <SelectItem value="veuf">Veuf/Veuve</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Nombre d'enfants</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editIdentificationForm.buyer_children_count}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_children_count: e.target.value })}
                      placeholder="0"
                      className="mt-1.5 bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</p>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">Adresse</Label>
                    <Input
                      value={editIdentificationForm.buyer_address}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_address: e.target.value })}
                      placeholder="Adresse"
                      className="mt-1.5 bg-background"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Téléphone</Label>
                      <Input
                        value={editIdentificationForm.buyer_phone}
                        onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_phone: e.target.value })}
                        placeholder="Numéro de téléphone"
                        className="mt-1.5 bg-background"
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Email</Label>
                      <Input
                        type="email"
                        value={editIdentificationForm.buyer_email}
                        onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_email: e.target.value })}
                        placeholder="Adresse email"
                        className="mt-1.5 bg-background"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Origine */}
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Origine</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Village d'origine</Label>
                    <Input
                      value={editIdentificationForm.buyer_village_origin}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_village_origin: e.target.value })}
                      placeholder="Village d'origine"
                      className="mt-1.5 bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Groupement</Label>
                    <Input
                      value={editIdentificationForm.buyer_groupement}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_groupement: e.target.value })}
                      placeholder="Groupement"
                      className="mt-1.5 bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Secteur</Label>
                    <Input
                      value={editIdentificationForm.buyer_secteur}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_secteur: e.target.value })}
                      placeholder="Secteur"
                      className="mt-1.5 bg-background"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Territoire</Label>
                    <Input
                      value={editIdentificationForm.buyer_territoire}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_territoire: e.target.value })}
                      placeholder="Territoire"
                      className="mt-1.5 bg-background"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-sm font-medium">Province</Label>
                    <Input
                      value={editIdentificationForm.buyer_province}
                      onChange={(e) => setEditIdentificationForm({ ...editIdentificationForm, buyer_province: e.target.value })}
                      placeholder="Province"
                      className="mt-1.5 bg-background"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowEditIdentificationDialog(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" className="flex-1">
                  Enregistrer
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Guichet unique d'inscription foncière & acquéreur */}
        <UnifiedLandSaleDialog
          open={showNewBuyerDialog}
          onOpenChange={setShowNewBuyerDialog}
          onSuccess={loadAcheteurs}
        />

        {/* Modal de Modification du Quota de Parcelles */}
        <EditBuyerQuotaDialog
          open={showEditQuotaDialog}
          onOpenChange={setShowEditQuotaDialog}
          acheteur={buyerForQuota}
          onSuccess={async () => {
            await loadAcheteurs();
          }}
        />

        {/* Modal de Suppression / Libération d'un Concessionnaire */}
        <DeleteBuyerDialog
          open={showDeleteBuyerDialog}
          onOpenChange={setShowDeleteBuyerDialog}
          acheteur={buyerForDelete}
          onSuccess={async () => {
            setShowDetails(false);
            setSelectedAcheteur(null);
            await loadAcheteurs();
          }}
        />

        {/* Dialog Télécharger la liste des concessionnaires (Export par date & documents) */}
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="max-w-xl bg-card border-border shadow-2xl">
            <DialogHeader className="border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">Télécharger la liste des concessionnaires</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Filtrez par date d'enregistrement/vente et statut des documents justificatifs.
                  </p>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 py-4">
              {/* Presets rapides de date */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Sélection rapide de période
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    variant={!exportStartDate && !exportEndDate ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => handleSetDatePreset("all")}
                  >
                    Toutes dates
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => handleSetDatePreset("today")}
                  >
                    Aujourd'hui
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => handleSetDatePreset("last_30")}
                  >
                    30 derniers jours
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => handleSetDatePreset("this_month")}
                  >
                    Ce mois-ci
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => handleSetDatePreset("this_year")}
                  >
                    Cette année
                  </Button>
                </div>
              </div>

              {/* Plage personnalisée de dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    Date de début
                  </Label>
                  <Input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="bg-background h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Laisser vide pour remonter au début</p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    Date de fin
                  </Label>
                  <Input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="bg-background h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Date d'échéance de la liste</p>
                </div>
              </div>

              {/* Filtre statut documents & Ordre de tri */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium text-foreground mb-1.5 block">
                    Statut des pièces justificatives
                  </Label>
                  <Select
                    value={exportDocStatus}
                    onValueChange={(val: "all" | "missing" | "with") => setExportDocStatus(val)}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Tous les dossiers" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les concessionnaires</SelectItem>
                      <SelectItem value="missing" className="text-red-600 font-medium">
                        ⚠️ Documents non ajoutés uniquement
                      </SelectItem>
                      <SelectItem value="with" className="text-emerald-600 font-medium">
                        ✓ Avec documents uniquement
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-medium text-foreground mb-1.5 block">
                    Ordre de tri
                  </Label>
                  <Select
                    value={exportSortOrder}
                    onValueChange={(val: "date_desc" | "date_asc" | "name_asc") => setExportSortOrder(val)}
                  >
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date_desc">Date la plus récente d'abord</SelectItem>
                      <SelectItem value="date_asc">Date la plus ancienne d'abord</SelectItem>
                      <SelectItem value="name_asc">Nom alphabétique (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cadre de synthèse en direct */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/40 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Concessionnaires sélectionnés :</span>
                  <span className="font-bold text-foreground bg-background px-2 py-0.5 rounded border border-border">
                    {buyersForExport.length} / {acheteurs.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Dossiers sans document :</span>
                  {buyersForExport.filter((b) => !b.has_documents).length > 0 ? (
                    <span className="font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                      ⚠️ {buyersForExport.filter((b) => !b.has_documents).length} dossier(s) incomplet(s)
                    </span>
                  ) : (
                    <span className="font-medium text-emerald-600">✓ Tous ont des documents</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-medium">Montant cumulé :</span>
                  <span className="font-bold text-foreground">
                    {buyersForExport.reduce((sum, b) => sum + b.totalAchat, 0).toLocaleString()} USD
                  </span>
                </div>
              </div>

              {/* Boutons d'exportation */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  onClick={handleExportPDF}
                  disabled={isExportingPdf || buyersForExport.length === 0}
                  className="flex-1 h-10 font-semibold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Génération du PDF...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Télécharger PDF officiel
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportCSV}
                  disabled={buyersForExport.length === 0}
                  className="flex-1 h-10 font-semibold gap-2 border-border hover:bg-muted"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Télécharger Excel (CSV)
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Acheteurs;
