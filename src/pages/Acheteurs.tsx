import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Search, User, Plus, MapPin, DollarSign, LayoutList, LayoutGrid, Grid3x3, 
  Map as MapIcon, Phone, Mail, Download, AlertTriangle, CheckCircle2, 
  Calendar, FileSpreadsheet, FileText, Loader2, ArrowUpDown
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
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  // Filtre par statut des documents ("all" | "missing" | "with")
  const [docFilter, setDocFilter] = useState<"all" | "missing" | "with">("all");

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
          sale_type: parcelle.sale_type,
          purchase_type: parcelle.purchase_type,
          rmb_number: parcelle.rmb_number,
          paper_form_completed: parcelle.paper_form_completed ?? false,
          hectares: parcelle.hectares,
          nombreParcelles: parcelleCount,
        });
        acheteur.totalAchat += parcelle.sale_type === 'onereux' ? 0 : (parcelle.payment_type === 'partiel' ? Number(parcelle.amount_paid || 0) : Number(parcelle.prix || 0));
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
        acheteur.hectares.push({
          id: hectare.id,
          name: hectare.name,
          surface: hectare.surface,
          prix: hectare.prix,
          sale_date: hectare.sale_date,
          created_at: hectare.created_at,
          location: hectare.location,
          payment_type: hectare.payment_type,
          amount_paid: hectare.amount_paid || 0,
          remaining_amount: hectare.remaining_amount || 0,
          sale_type: hectare.sale_type,
          purchase_type: hectare.purchase_type,
          rmb_number: hectare.rmb_number,
          paper_form_completed: hectare.paper_form_completed ?? false,
        });
        acheteur.totalAchat += hectare.sale_type === 'onereux' ? 0 : (hectare.payment_type === 'partiel' ? Number(hectare.amount_paid || 0) : Number(hectare.prix || 0));
        acheteur.nombreHectares += 1;
        
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

      if (newBuyerForm.item_type === "hectare") {
        const selectedItem = availableHectares.find(h => h.id === newBuyerForm.selected_item);
        
        if (!selectedItem) {
          notify("Erreur", "Hectare sélectionné introuvable", "error");
          return;
        }

        const prix = isOnereux ? 0 : (newBuyerForm.prix ? parseFloat(newBuyerForm.prix) : (selectedItem.prix || 0));
        const amountPaid = isOnereux ? 0 : (newBuyerForm.payment_type === "total" 
          ? prix 
          : Number(newBuyerForm.amount_paid));
        const remainingAmount = isOnereux ? 0 : (prix - amountPaid);

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
          sale_date: new Date().toISOString(),
          sale_type: newBuyerForm.sale_type,
          purchase_type: newBuyerForm.purchase_type,
          payment_type: isOnereux ? "total" : newBuyerForm.payment_type,
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
        const prix = isOnereux ? 0 : (newBuyerForm.prix ? parseFloat(newBuyerForm.prix) : prixTotal);
        const amountPaid = isOnereux ? 0 : (newBuyerForm.payment_type === "total" 
          ? prix 
          : Number(newBuyerForm.amount_paid));
        const remainingAmount = isOnereux ? 0 : (prix - amountPaid);

        // Créer un ID de groupe si fusion demandée et plusieurs parcelles sélectionnées
        const mergeGroupId = (newBuyerForm.merge_parcelles && selectedParcelles.length > 1) 
          ? crypto.randomUUID() 
          : null;

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
            sale_date: new Date().toISOString(),
            sale_type: newBuyerForm.sale_type,
            purchase_type: newBuyerForm.purchase_type,
            payment_type: isOnereux ? "total" : newBuyerForm.payment_type,
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

      notify("Succès", "Acheteur enregistré avec succès", "success");
      setShowNewBuyerDialog(false);
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

  const filteredAcheteurs = useMemo(() => {
    return acheteurs.filter((a) => {
      // Filtre de documents
      if (docFilter === "missing" && a.has_documents) return false;
      if (docFilter === "with" && !a.has_documents) return false;

      // Filtre de recherche
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
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
  }, [acheteurs, docFilter, searchTerm]);

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
      "Date d'ajout / vente",
      "Nom complet",
      "Téléphone",
      "Email",
      "Profession",
      "Adresse",
      "Parcelles & RMB",
      "Hectares & RMB",
      "Surface Totale (m2)",
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
        .map((p) => `P.${p.numero}${p.rmb_number ? ` [${p.rmb_number}]` : ""}`)
        .join(", ");

      const hectaresList = a.hectares
        .map((h) => `${h.name}${h.rmb_number ? ` [${h.rmb_number}]` : ""}`)
        .join(", ");

      const totalSurface =
        a.parcelles.reduce((sum, p) => sum + (p.surface || 0), 0) +
        a.hectares.reduce((sum, h) => sum + (h.surface || 0), 0);

      const docStatus = a.has_documents
        ? `Document joint (${a.documents_count})`
        : "NON AJOUTÉ (MANQUANT)";

      return [
        dateDisplay,
        `"${(a.buyer_name || "").replace(/"/g, '""')}"`,
        `"${(a.buyer_phone || "").replace(/"/g, '""')}"`,
        `"${(a.buyer_email || "").replace(/"/g, '""')}"`,
        `"${(a.buyer_profession || "").replace(/"/g, '""')}"`,
        `"${(a.buyer_address || "").replace(/"/g, '""')}"`,
        `"${parcellesList.replace(/"/g, '""')}"`,
        `"${hectaresList.replace(/"/g, '""')}"`,
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

  // Exportation PDF officiel avec mise en page soignée et en-tête de la concession
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
      const imgRatio = img.height / img.width;
      const headerHeight = Math.min(pdfWidth * imgRatio, 32);
      const imgWidth = headerHeight / imgRatio;
      const imgX = (pdfWidth - imgWidth) / 2;
      pdf.addImage(headerImage, "JPEG", imgX, 4, imgWidth, headerHeight);

      let yPos = headerHeight + 10;

      // Titre
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 41, 59);
      pdf.text(
        "LISTE DES CONCESSIONNAIRES & SUIVI DES PIÈCES JUSTIFICATIVES",
        pdfWidth / 2,
        yPos,
        { align: "center" }
      );
      yPos += 6;

      // Sous-titre Période et Date
      pdf.setFontSize(9);
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
      yPos += 8;

      // Cadre de synthèse
      const totalSelected = buyersForExport.length;
      const missingCount = buyersForExport.filter((b) => !b.has_documents).length;
      const withDocsCountInExport = totalSelected - missingCount;
      const totalAmount = buyersForExport.reduce((sum, b) => sum + b.totalAchat, 0);

      pdf.setFillColor(248, 250, 252);
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(15, yPos, 267, 10, 1.5, 1.5, "FD");

      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(15, 23, 42);
      pdf.text(`Total concessionnaires : ${totalSelected}`, 20, yPos + 6.5);

      if (missingCount > 0) {
        pdf.setTextColor(220, 38, 38);
        pdf.text(`⚠ Documents manquants : ${missingCount}`, 85, yPos + 6.5);
      } else {
        pdf.setTextColor(22, 101, 52);
        pdf.text(`✓ Tous les dossiers ont des documents`, 85, yPos + 6.5);
      }

      pdf.setTextColor(22, 101, 52);
      pdf.text(`Dossiers avec pièces : ${withDocsCountInExport}`, 160, yPos + 6.5);

      pdf.setTextColor(30, 41, 59);
      pdf.text(`Montant total : ${totalAmount.toLocaleString()} USD`, 225, yPos + 6.5);

      yPos += 14;

      // En-têtes du tableau
      const drawTableHeader = () => {
        pdf.setFillColor(241, 245, 249);
        pdf.setDrawColor(203, 213, 225);
        pdf.rect(15, yPos, 267, 7, "FD");
        pdf.setFontSize(7.5);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(51, 65, 85);

        pdf.text("N°", 17, yPos + 4.5);
        pdf.text("Date", 25, yPos + 4.5);
        pdf.text("Nom du concessionnaire", 48, yPos + 4.5);
        pdf.text("Contact (Tél / Email)", 115, yPos + 4.5);
        pdf.text("Biens acquis (Parcelles & Hectares)", 165, yPos + 4.5);
        pdf.text("Total Payé", 225, yPos + 4.5);
        pdf.text("Statut Document", 250, yPos + 4.5);
        yPos += 7;
      };

      drawTableHeader();

      // Lignes du tableau
      buyersForExport.forEach((b, idx) => {
        if (yPos > 190) {
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
        pdf.text(`${idx + 1}`, 17, yPos + 5.5);

        // Date
        const dateStr = b.latest_date || b.first_date;
        pdf.text(formatDateDisplay(dateStr), 25, yPos + 5.5);

        // Nom
        pdf.setFont("helvetica", "bold");
        const truncatedName =
          b.buyer_name.length > 32 ? b.buyer_name.slice(0, 30) + "…" : b.buyer_name;
        pdf.text(truncatedName, 48, yPos + 5.5);

        // Contact
        pdf.setFont("helvetica", "normal");
        const contactStr = b.buyer_phone || b.buyer_email || "—";
        const truncatedContact =
          contactStr.length > 25 ? contactStr.slice(0, 23) + "…" : contactStr;
        pdf.text(truncatedContact, 115, yPos + 5.5);

        // Biens
        const parcelsStr = b.parcelles
          .map((p) => `P.${p.numero}${p.rmb_number ? ` (${p.rmb_number})` : ""}`)
          .join(", ");
        const hectStr = b.hectares
          .map((h) => `${h.name}${h.rmb_number ? ` (${h.rmb_number})` : ""}`)
          .join(", ");
        const biensText = [parcelsStr, hectStr].filter(Boolean).join(" · ") || "—";
        const truncatedBiens = biensText.length > 36 ? biensText.slice(0, 34) + "…" : biensText;
        pdf.text(truncatedBiens, 165, yPos + 5.5);

        // Montant
        pdf.setFont("helvetica", "bold");
        pdf.text(`${b.totalAchat.toLocaleString()} $`, 225, yPos + 5.5);

        // Statut Document
        if (!b.has_documents) {
          pdf.setTextColor(220, 38, 38);
          pdf.setFont("helvetica", "bold");
          pdf.text("⚠ NON AJOUTÉ", 250, yPos + 5.5);
        } else {
          pdf.setTextColor(22, 101, 52);
          pdf.setFont("helvetica", "normal");
          pdf.text(`✓ Joint (${b.documents_count})`, 250, yPos + 5.5);
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

            <Button onClick={() => setShowNewBuyerDialog(true)} className="h-11 px-4">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Nouvel Acheteur</span>
              <span className="sm:hidden">Ajouter</span>
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
              {filteredAcheteurs.map((acheteur) => (
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
                />
              ))}
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
                {filteredAcheteurs.map((acheteur, idx) => {
                  const isPinned = !acheteur.paper_form_completed;
                  return (
                    <tr
                      key={acheteur.id}
                      className={`transition-colors ${
                        isPinned
                          ? "bg-orange-500/5 hover:bg-orange-500/10"
                          : idx % 2 === 0
                          ? "bg-background hover:bg-muted/40"
                          : "bg-muted/20 hover:bg-muted/40"
                      }`}
                    >
                      {/* Nom */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {isPinned && <div className="w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Formulaire à compléter" />}
                          <span className="font-semibold text-foreground">{acheteur.buyer_name}</span>
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
                              return (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-medium whitespace-nowrap"
                                >
                                  {p.numero}
                                  {p.rmb_number && p.rmb_number !== p.numero && (
                                    <span className="ml-1 opacity-60">· {p.rmb_number}</span>
                                  )}
                                  {pCount > 1 && (
                                    <span className="ml-1 font-bold text-emerald-800 dark:text-emerald-300">({pCount} p.)</span>
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
                            {acheteur.hectares.map((h, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-medium whitespace-nowrap"
                              >
                                {h.name}
                                {h.rmb_number && (
                                  <span className="ml-1 opacity-60">· {h.rmb_number}</span>
                                )}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Total */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className="font-bold text-foreground">
                          {acheteur.totalAchat.toLocaleString()}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground ml-1">USD</span>
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => handleShowDetails(acheteur)}
                        >
                          Détails
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

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

        {/* Dialog Nouvel Acheteur */}
        <Dialog open={showNewBuyerDialog} onOpenChange={setShowNewBuyerDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card">
            <DialogHeader className="border-b border-border pb-4">
              <DialogTitle className="text-xl">Enregistrer un nouvel acheteur</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleNewBuyerSubmit} className="space-y-6 pt-4">
              <Accordion type="multiple" defaultValue={["acheteur", "achat", "paiement"]} className="space-y-2">
                {/* Section 1: Informations acheteur */}
                <AccordionItem value="acheteur" className="border rounded-lg bg-muted/30 px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-2 text-base font-semibold">
                      <User className="w-5 h-5 text-primary" />
                      Informations de l'acheteur
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Nom *</Label>
                          <Input
                            value={newBuyerForm.nom}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, nom: e.target.value })}
                            placeholder="Nom"
                            className="mt-1.5 bg-background"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Post Nom *</Label>
                          <Input
                            value={newBuyerForm.post_nom}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, post_nom: e.target.value })}
                            placeholder="Post Nom"
                            className="mt-1.5 bg-background"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Prénom *</Label>
                          <Input
                            value={newBuyerForm.prenom}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, prenom: e.target.value })}
                            placeholder="Prénom"
                            className="mt-1.5 bg-background"
                            required
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Profession (facultatif)</Label>
                          <Input
                            value={newBuyerForm.profession}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, profession: e.target.value })}
                            placeholder="Profession"
                            className="mt-1.5 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">État civil (facultatif)</Label>
                          <Select
                            value={newBuyerForm.marital_status}
                            onValueChange={(value) => setNewBuyerForm({ ...newBuyerForm, marital_status: value })}
                          >
                            <SelectTrigger className="mt-1.5 bg-background">
                              <SelectValue placeholder="Sélectionner" />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100]">
                              <SelectItem value="celibataire">Célibataire</SelectItem>
                              <SelectItem value="marie">Marié(e)</SelectItem>
                              <SelectItem value="divorce">Divorcé(e)</SelectItem>
                              <SelectItem value="veuf">Veuf/Veuve</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Lieu de naissance (facultatif)</Label>
                          <Input
                            value={newBuyerForm.birth_place}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, birth_place: e.target.value })}
                            placeholder="Ville, Pays"
                            className="mt-1.5 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Date de naissance (facultatif)</Label>
                          <Input
                            type="date"
                            value={newBuyerForm.birth_date}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, birth_date: e.target.value })}
                            className="mt-1.5 bg-background"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Nombre d'enfants (facultatif)</Label>
                          <Input
                            type="number"
                            min="0"
                            value={newBuyerForm.children_count}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, children_count: e.target.value })}
                            placeholder="0"
                            className="mt-1.5 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Téléphone (facultatif)</Label>
                          <Input
                            value={newBuyerForm.buyer_phone}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, buyer_phone: e.target.value })}
                            placeholder="+243 XXX XXX XXX"
                            className="mt-1.5 bg-background"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Email (facultatif)</Label>
                          <Input
                            type="email"
                            value={newBuyerForm.buyer_email}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, buyer_email: e.target.value })}
                            placeholder="email@example.com"
                            className="mt-1.5 bg-background"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium">Adresse (facultatif)</Label>
                          <Input
                            value={newBuyerForm.address}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, address: e.target.value })}
                            placeholder="Adresse complète"
                            className="mt-1.5 bg-background"
                          />
                        </div>
                      </div>

                      {/* Section Origine */}
                      <div className="pt-4 border-t border-border">
                        <p className="text-sm font-semibold text-foreground mb-3">Origine</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Village d'origine (facultatif)</Label>
                            <Input
                              value={newBuyerForm.village_origin}
                              onChange={(e) => setNewBuyerForm({ ...newBuyerForm, village_origin: e.target.value })}
                              placeholder="Village d'origine"
                              className="mt-1.5 bg-background"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Groupement (facultatif)</Label>
                            <Input
                              value={newBuyerForm.groupement}
                              onChange={(e) => setNewBuyerForm({ ...newBuyerForm, groupement: e.target.value })}
                              placeholder="Groupement"
                              className="mt-1.5 bg-background"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                          <div>
                            <Label className="text-sm font-medium">Secteur (facultatif)</Label>
                            <Input
                              value={newBuyerForm.secteur}
                              onChange={(e) => setNewBuyerForm({ ...newBuyerForm, secteur: e.target.value })}
                              placeholder="Secteur"
                              className="mt-1.5 bg-background"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Territoire (facultatif)</Label>
                            <Input
                              value={newBuyerForm.territoire}
                              onChange={(e) => setNewBuyerForm({ ...newBuyerForm, territoire: e.target.value })}
                              placeholder="Territoire"
                              className="mt-1.5 bg-background"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Province (facultatif)</Label>
                            <Input
                              value={newBuyerForm.province}
                              onChange={(e) => setNewBuyerForm({ ...newBuyerForm, province: e.target.value })}
                              placeholder="Province"
                              className="mt-1.5 bg-background"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 2: Détails de l'achat */}
                <AccordionItem value="achat" className="border rounded-lg bg-muted/30 px-4">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-2 text-base font-semibold">
                      <MapPin className="w-5 h-5 text-primary" />
                      Détails de l'achat
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Type d'item *</Label>
                        <Select
                          value={newBuyerForm.item_type}
                          onValueChange={(value: "hectare" | "parcelle") => 
                            setNewBuyerForm({ 
                              ...newBuyerForm, 
                              item_type: value, 
                              selected_item: "",
                              selected_parcelles: [],
                              merge_parcelles: false,
                              purchase_type: value // Définir automatiquement le type d'achat
                            })
                          }
                        >
                          <SelectTrigger className="mt-1.5 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100]">
                            <SelectItem value="hectare">Hectare</SelectItem>
                            <SelectItem value="parcelle">Parcelle</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Sélection de l'hectare ou parcelles */}
                      {newBuyerForm.item_type === "hectare" ? (
                        <div>
                          <Label className="text-sm font-medium">Sélectionner un hectare *</Label>
                          <Select
                            value={newBuyerForm.selected_item}
                            onValueChange={(value) => setNewBuyerForm({ ...newBuyerForm, selected_item: value })}
                          >
                            <SelectTrigger className="mt-1.5 bg-background">
                              <SelectValue placeholder="Choisir un hectare" />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100] max-h-[300px]">
                              {availableHectares.length > 0 ? (
                                availableHectares.map((h) => (
                                  <SelectItem key={h.id} value={h.id}>
                                    {h.name} - {h.surface} ha - ${h.prix.toLocaleString()}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="none" disabled>Aucun hectare disponible</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">Sélectionner l'emplacement *</Label>
                            <Select
                              value={newBuyerForm.selected_item}
                              onValueChange={(value) => {
                                setNewBuyerForm({ 
                                  ...newBuyerForm, 
                                  selected_item: value,
                                  selected_parcelles: [] // Réinitialiser la sélection
                                });
                              }}
                            >
                              <SelectTrigger className="mt-1.5 bg-background">
                                <SelectValue placeholder="Choisir un hectare ou parcelles seules" />
                              </SelectTrigger>
                              <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100] max-h-[300px]">
                                {(() => {
                                  // Grouper les parcelles par hectare ou groupe "standalone"
                                  const hectareGroups: Record<string, { name: string; parcelles: any[] }> = availableParcelles.reduce((acc, p) => {
                                    const key = p.hectare_id || "standalone";
                                    if (!acc[key]) {
                                      acc[key] = {
                                        name: key === "standalone" ? "🏷️ Parcelles seules (hors hectare)" : (p.hectares?.name || 'Hectare'),
                                        parcelles: []
                                      };
                                    }
                                    acc[key].parcelles.push(p);
                                    return acc;
                                  }, {} as Record<string, { name: string; parcelles: any[] }>);

                                  return Object.entries(hectareGroups).length > 0 ? (
                                    Object.entries(hectareGroups).map(([key, group]) => (
                                      <SelectItem key={key} value={key}>
                                        {group.name} ({group.parcelles.length} parcelle{group.parcelles.length > 1 ? 's' : ''} disponible{group.parcelles.length > 1 ? 's' : ''})
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="none" disabled>Aucune parcelle disponible</SelectItem>
                                  );
                                })()}
                              </SelectContent>
                            </Select>
                          </div>

                          {newBuyerForm.selected_item && (() => {
                            const isStandalone = newBuyerForm.selected_item === "standalone";
                            const parcellesInGroup = availableParcelles.filter(p => 
                              isStandalone ? !p.hectare_id : p.hectare_id === newBuyerForm.selected_item
                            );
                            
                            let maxParcelles = 0;
                            let availableEffectif = 0;

                            if (isStandalone) {
                              maxParcelles = parcellesInGroup.length;
                            } else {
                              // Calculer l'effectif déjà occupé dans l'hectare
                              const occupiedEffectif = allParcellesInSelectedHectare.reduce((total, p) => {
                                return total + Math.ceil(p.surface / 600);
                              }, 0);
                              
                              availableEffectif = Math.max(0, 15 - occupiedEffectif);
                              
                              let effectifUsed = 0;
                              for (const parcelle of parcellesInGroup) {
                                const effectifNeeded = Math.ceil(parcelle.surface / 600);
                                if (effectifUsed + effectifNeeded <= availableEffectif) {
                                  maxParcelles++;
                                  effectifUsed += effectifNeeded;
                                } else {
                                  break;
                                }
                              }
                            }

                            return (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-sm font-medium">
                                    Nombre de parcelles à acheter * 
                                    {!isStandalone && (
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({availableEffectif} en effectif disponible)
                                      </span>
                                    )}
                                  </Label>
                                  <Select
                                    value={newBuyerForm.selected_parcelles.length.toString()}
                                    onValueChange={(value) => {
                                      const count = parseInt(value);
                                      // Sélectionner automatiquement les N premières parcelles disponibles
                                      const selectedIds = parcellesInGroup.slice(0, count).map(p => p.id);
                                      setNewBuyerForm({ 
                                        ...newBuyerForm, 
                                        selected_parcelles: selectedIds,
                                        merge_parcelles: count > 1 // Fusionner automatiquement si plus d'une parcelle
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="mt-1.5 bg-background">
                                      <SelectValue placeholder="Sélectionner" />
                                    </SelectTrigger>
                                    <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100]">
                                      {maxParcelles === 0 ? (
                                        <SelectItem value="0" disabled>Aucune parcelle disponible</SelectItem>
                                      ) : (
                                        Array.from({ length: maxParcelles }, (_, i) => i + 1).map(num => (
                                          <SelectItem key={num} value={num.toString()}>
                                            {num} parcelle{num > 1 ? 's' : ''}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>

                                {newBuyerForm.selected_parcelles.length > 0 && (
                                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
                                    <p className="text-sm font-medium text-primary">
                                      ✓ {newBuyerForm.selected_parcelles.length} parcelle(s) sélectionnée(s)
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {newBuyerForm.selected_parcelles.map(id => {
                                        const parcelle = parcellesInGroup.find(p => p.id === id);
                                        return parcelle ? (
                                          <Badge key={id} variant="outline" className="text-xs">
                                            Parcelle {parcelle.numero}
                                          </Badge>
                                        ) : null;
                                      })}
                                    </div>
                                    {newBuyerForm.selected_parcelles.length > 1 && (
                                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <span className="inline-block w-2 h-2 bg-primary rounded-full"></span>
                                        Les parcelles seront fusionnées visuellement avec le même numéro RMB
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Type d'achat (hectare/demi-hectare/parcelle) - Automatique selon le type d'item */}

                      <div>
                        <Label className="text-sm font-medium">Type de vente</Label>
                        <Select
                          value={newBuyerForm.sale_type}
                          onValueChange={(value) => setNewBuyerForm({ ...newBuyerForm, sale_type: value })}
                        >
                          <SelectTrigger className="mt-1.5 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100]">
                            <SelectItem value="normal">Vente normale</SelectItem>
                            <SelectItem value="onereux">À titre gratuit</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium">Numéro RMB</Label>
                          <Input
                            value={newBuyerForm.rmb_number}
                            onChange={(e) => setNewBuyerForm({ ...newBuyerForm, rmb_number: e.target.value })}
                            placeholder="ex: RMB-001"
                            className="mt-1.5 bg-background"
                          />
                        </div>
                        {newBuyerForm.sale_type !== "onereux" && (
                          <div>
                            <Label className="text-sm font-medium">Montant d'achat (USD) *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={newBuyerForm.prix}
                              onChange={(e) => setNewBuyerForm({ ...newBuyerForm, prix: e.target.value })}
                              placeholder="Montant en USD"
                              className="mt-1.5 bg-background"
                              required={newBuyerForm.sale_type !== "onereux"}
                            />
                            {newBuyerForm.item_type === "parcelle" && newBuyerForm.selected_parcelles.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Prix total des parcelles sélectionnées: ${
                                  availableParcelles
                                    .filter(p => newBuyerForm.selected_parcelles.includes(p.id))
                                    .reduce((sum, p) => sum + (p.prix || 0), 0)
                                    .toLocaleString()
                                }
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Section 3: Paiement */}
                {newBuyerForm.sale_type !== "onereux" && (
                  <AccordionItem value="paiement" className="border rounded-lg bg-muted/30 px-4">
                    <AccordionTrigger className="hover:no-underline py-4">
                      <div className="flex items-center gap-2 text-base font-semibold">
                        <DollarSign className="w-5 h-5 text-primary" />
                        Paiement
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">Type de paiement *</Label>
                          <Select
                            value={newBuyerForm.payment_type}
                            onValueChange={(value) => setNewBuyerForm({ ...newBuyerForm, payment_type: value })}
                          >
                            <SelectTrigger className="mt-1.5 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100]">
                              <SelectItem value="total">Paiement total</SelectItem>
                              <SelectItem value="partiel">Paiement partiel</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {newBuyerForm.payment_type === "partiel" && (
                          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-3">
                            <Label className="text-sm font-medium">Montant de l'acompte *</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={newBuyerForm.amount_paid}
                              onChange={(e) => setNewBuyerForm({ ...newBuyerForm, amount_paid: e.target.value })}
                              placeholder="Montant payé en USD"
                              className="bg-background"
                              required
                            />
                            <p className="text-xs text-muted-foreground flex items-start gap-2">
                              <span className="text-amber-600">ℹ️</span>
                              Le montant restant sera calculé automatiquement
                            </p>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>

              <div className="flex gap-3 pt-4 border-t border-border">
                <Button type="button" variant="outline" onClick={() => setShowNewBuyerDialog(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" className="flex-1">
                  <User className="w-4 h-4 mr-2" />
                  Enregistrer l'acheteur
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

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
