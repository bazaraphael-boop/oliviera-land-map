import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, User, Plus, MapPin, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNotify } from "@/hooks/useNotify";
import DashboardSidebar from "@/components/DashboardSidebar";
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
    hectare_id: string;
    payment_type: string;
    amount_paid: number;
    remaining_amount: number;
    sale_type: string;
    purchase_type: string | null;
    rmb_number: string | null;
    paper_form_completed: boolean;
    hectares?: {
      name: string;
      location: string;
    };
  }[];
  hectares: {
    id: string;
    name: string;
    surface: number;
    prix: number;
    sale_date: string | null;
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
    checkAuth();
    loadAcheteurs();
  }, []);

  useEffect(() => {
    if (showNewBuyerDialog) {
      loadAvailableItems();
    }
  }, [showNewBuyerDialog, newBuyerForm.item_type]);

  useEffect(() => {
    // Charger toutes les parcelles (vendues et disponibles) de l'hectare sélectionné
    if (newBuyerForm.selected_item && newBuyerForm.item_type === "parcelle") {
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
        .select(`
          *,
          hectares (
            name,
            location
          )
        `)
        .eq("status", "vendu")
        .not("buyer_name", "is", null);

      if (parcellesError) throw parcellesError;
      
      // Récupérer tous les hectares vendus
      const { data: hectares, error: hectaresError } = await supabase
        .from("hectares")
        .select("*")
        .or("status.eq.vendu,status.eq.sold")
        .not("buyer_name", "is", null);

      if (hectaresError) throw hectaresError;

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
          });
        }

        const acheteur = acheteursMap.get(buyerKey)!;
        acheteur.parcelles.push({
          id: parcelle.id,
          numero: parcelle.numero,
          surface: parcelle.surface,
          prix: parcelle.prix,
          sale_date: parcelle.sale_date,
          hectare_id: parcelle.hectare_id,
          payment_type: parcelle.payment_type,
          amount_paid: parcelle.amount_paid || 0,
          remaining_amount: parcelle.remaining_amount || 0,
          sale_type: parcelle.sale_type,
          purchase_type: parcelle.purchase_type,
          rmb_number: parcelle.rmb_number,
          paper_form_completed: parcelle.paper_form_completed ?? false,
          hectares: parcelle.hectares,
        });
        acheteur.totalAchat += parcelle.sale_type === 'onereux' ? 0 : (parcelle.payment_type === 'partiel' ? Number(parcelle.amount_paid || 0) : Number(parcelle.prix || 0));
        acheteur.nombreParcelles += 1;
        
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
          });
        }

        const acheteur = acheteursMap.get(buyerKey)!;
        acheteur.hectares.push({
          id: hectare.id,
          name: hectare.name,
          surface: hectare.surface,
          prix: hectare.prix,
          sale_date: hectare.sale_date,
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
    } catch (error) {
      console.error("Erreur:", error);
      notify("Erreur", "Erreur lors du chargement des acheteurs", "error");
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

  const handleLocaliser = (parcelleId: string) => {
    // Rediriger vers la page de localisation avec l'ID de la parcelle
    navigate(`/localisation?parcelle=${parcelleId}`);
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

  const filteredAcheteurs = acheteurs.filter((a) =>
    a.buyer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.buyer_phone?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.buyer_email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
            Gestion des Acheteurs
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Consultez et gérez la liste des acheteurs
          </p>
        </div>

        {/* Search and Actions - Mobile optimized */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, RMB..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-muted rounded-lg">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{filteredAcheteurs.length} acheteur{filteredAcheteurs.length > 1 ? 's' : ''}</span>
            </div>

            <Button onClick={() => setShowNewBuyerDialog(true)} className="h-11 px-4">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Nouvel Acheteur</span>
              <span className="sm:hidden">Ajouter</span>
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="mb-6">
          <BuyerStatsCards 
            totalAcheteurs={acheteurs.length}
            totalRevenu={acheteurs.reduce((sum, a) => sum + a.totalAchat, 0)}
            totalParcelles={acheteurs.reduce((sum, a) => sum + a.nombreParcelles, 0)}
            totalHectares={acheteurs.reduce((sum, a) => sum + a.nombreHectares, 0)}
          />
        </div>

        {/* Acheteurs List - Scrollable vertical */}
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
          </div>
        </div>

        {filteredAcheteurs.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Aucun acheteur trouvé
            </h3>
            <p className="text-sm text-muted-foreground">
              Aucun acheteur ne correspond à votre recherche
            </p>
          </div>
        )}

        {/* Dialog Détails Acheteur */}
        <BuyerDetailsDialog
          open={showDetails}
          onOpenChange={setShowDetails}
          acheteur={selectedAcheteur}
          onLocaliser={handleLocaliser}
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
                            <Label className="text-sm font-medium">Sélectionner un hectare *</Label>
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
                                <SelectValue placeholder="Choisir un hectare" />
                              </SelectTrigger>
                              <SelectContent position="popper" sideOffset={4} className="bg-popover z-[100] max-h-[300px]">
                                {(() => {
                                  // Grouper les parcelles par hectare
                                  const hectareGroups: Record<string, { name: string; parcelles: any[] }> = availableParcelles.reduce((acc, p) => {
                                    if (!p.hectare_id) return acc;
                                    if (!acc[p.hectare_id]) {
                                      acc[p.hectare_id] = {
                                        name: p.hectares?.name || 'Hectare',
                                        parcelles: []
                                      };
                                    }
                                    acc[p.hectare_id].parcelles.push(p);
                                    return acc;
                                  }, {} as Record<string, { name: string; parcelles: any[] }>);

                                  return Object.entries(hectareGroups).length > 0 ? (
                                    Object.entries(hectareGroups).map(([hectareId, group]) => (
                                      <SelectItem key={hectareId} value={hectareId}>
                                        {group.name} ({group.parcelles.length} parcelles disponibles)
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
                            const parcellesInHectare = availableParcelles.filter(p => p.hectare_id === newBuyerForm.selected_item);
                            
                            // Calculer l'effectif déjà occupé dans l'hectare
                            const occupiedEffectif = allParcellesInSelectedHectare.reduce((total, p) => {
                              return total + Math.ceil(p.surface / 600);
                            }, 0);
                            
                            const availableEffectif = 15 - occupiedEffectif;
                            
                            // Calculer combien de parcelles on peut acheter en fonction de l'effectif disponible
                            let maxParcelles = 0;
                            let effectifUsed = 0;
                            for (const parcelle of parcellesInHectare) {
                              const effectifNeeded = Math.ceil(parcelle.surface / 600);
                              if (effectifUsed + effectifNeeded <= availableEffectif) {
                                maxParcelles++;
                                effectifUsed += effectifNeeded;
                              } else {
                                break;
                              }
                            }

                            return (
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-sm font-medium">
                                    Nombre de parcelles à acheter * 
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({availableEffectif} en effectif disponible)
                                    </span>
                                  </Label>
                                  <Select
                                    value={newBuyerForm.selected_parcelles.length.toString()}
                                    onValueChange={(value) => {
                                      const count = parseInt(value);
                                      // Sélectionner automatiquement les N premières parcelles disponibles
                                      const selectedIds = parcellesInHectare.slice(0, count).map(p => p.id);
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
                                        const parcelle = parcellesInHectare.find(p => p.id === id);
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
      </div>
    </div>
  );
};

export default Acheteurs;
