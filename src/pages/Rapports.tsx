import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, BarChart2, Calendar, Download, AlertTriangle, User, Grid3x3, CreditCard, ListOrdered, CheckCircle2, Copy, Search, Hash, Edit, Check, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import DashboardSidebar from "@/components/DashboardSidebar";
import PageHeader from "@/components/PageHeader";
import StatsCard from "@/components/StatsCard";
import { jsPDF } from "jspdf";
import headerImage from "@/assets/en_tete_concession_manuel.jpg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface Stats {
  totalRevenue: number;
  salesCount: number;
  availableCount: number;
  soldCount: number;
  averagePrice: number;
  salesRate: number;
}

interface HectareStats {
  id: string;
  name: string;
  totalParcelles: number;
  soldParcelles: number;
  revenue: number;
  salesRate: number;
}

interface MonthlyData {
  month: string;
  ventes: number;
  revenus: number;
  sortKey: string;
}

const Rapports = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    salesCount: 0,
    availableCount: 0,
    soldCount: 0,
    averagePrice: 0,
    salesRate: 0,
  });
  const [hectareStats, setHectareStats] = useState<HectareStats[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null); // format: "YYYY-MM" or null for all
  const [selectedSaleType, setSelectedSaleType] = useState<string>("all"); // "all", "normal", "onereux"
  const [soldParcellesList, setSoldParcellesList] = useState<any[]>([]);
  const [soldHectaresList, setSoldHectaresList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"parcelles" | "hectares">("parcelles");
  const [duplicatesReportOpen, setDuplicatesReportOpen] = useState(false);
  const [allParcelles, setAllParcelles] = useState<any[]>([]);
  const [allHectares, setAllHectares] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [rmbFilterMode, setRmbFilterMode] = useState<"all" | "missing" | "assigned">("all");
  const [rmbSearchTerm, setRmbSearchTerm] = useState("");
  const [selectedDuplicateEntry, setSelectedDuplicateEntry] = useState<any | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [editedRmbValues, setEditedRmbValues] = useState<{ [id: string]: string }>({});
  const [savingRmbId, setSavingRmbId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    loadStats();
  }, [selectedMonth, selectedSaleType]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };

  // Fonction pour filtrer par mois sélectionné
  const filterByPeriod = <T extends { sale_date?: string | null }>(items: T[]): T[] => {
    if (!selectedMonth) return items;
    return items.filter(item => {
      if (!item.sale_date) return false;
      const date = new Date(item.sale_date);
      const itemMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return itemMonth === selectedMonth;
    });
  };

  // Fonction pour filtrer par type de transaction / statut de paiement
  const filterBySaleType = <T extends { sale_type?: string | null; payment_type?: string | null; amount_paid?: number | null; prix?: number | null; remaining_amount?: number | null }>(items: T[]): T[] => {
    if (selectedSaleType === "all") return items;
    
    return items.filter(item => {
      const isFree = item.sale_type === "onereux";
      
      if (selectedSaleType === "onereux") {
        return isFree;
      }
      
      if (isFree) return false;
      
      const price = Number(item.prix || 0);
      const paid = Number(item.amount_paid || 0);
      const remaining = Number(item.remaining_amount || 0);
      
      if (selectedSaleType === "total") {
        return item.payment_type === "total" || (paid === price && price > 0);
      }
      
      if (selectedSaleType === "partiel") {
        return item.payment_type === "partiel" && paid > 0 && remaining > 0;
      }
      
      if (selectedSaleType === "impaye") {
        return paid === 0 || !paid;
      }
      
      return true;
    });
  };

  // Générer la liste des mois disponibles (12 derniers mois)
  const getAvailableMonths = () => {
    const months: { value: string; label: string }[] = [];
    const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      months.push({ value, label });
    }
    return months;
  };

  const availableMonths = getAvailableMonths();

  const loadStats = async () => {
    try {
      setLoading(true);

      // Récupérer toutes les parcelles
      const { data: parcelles, error: parcellesError } = await supabase
        .from("parcelles")
        .select("*, hectares(id, name)");

      if (parcellesError) throw parcellesError;
      
      setAllParcelles(parcelles || []);

      // Récupérer tous les hectares vendus
      const { data: hectares, error: hectaresError } = await supabase
        .from("hectares")
        .select("*");

      if (hectaresError) throw hectaresError;
      
      setAllHectares(hectares || []);

      // Filtrer les ventes par période
      const allSoldParcelles = parcelles?.filter(p => p.status === "vendu") || [];
      const allSoldHectares = hectares?.filter(h => h.status === "sold" || h.status === "vendu") || [];
      
      // Appliquer le filtre de période et de type de vente
      const soldParcelles = filterBySaleType(filterByPeriod(allSoldParcelles));
      const soldHectares = filterBySaleType(filterByPeriod(allSoldHectares));
      
      // Trier par ordre croissant (alphanumérique)
      const sortedParcelles = [...soldParcelles].sort((a, b) => 
        (a.numero || "").localeCompare(b.numero || "", undefined, { numeric: true, sensitivity: 'base' })
      );
      const sortedHectares = [...soldHectares].sort((a, b) => 
        (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: 'base' })
      );
      
      setSoldParcellesList(sortedParcelles);
      setSoldHectaresList(sortedHectares);
      
      const availableParcelles = parcelles?.filter(p => p.status === "disponible") || [];
      
      const totalRevenue = soldParcelles.reduce((sum, p) => {
        return sum + (p.sale_type === 'onereux' ? 0 : (p.payment_type === 'partiel' ? Number(p.amount_paid || 0) : Number(p.prix || 0)));
      }, 0) + soldHectares.reduce((sum, h) => {
        return sum + (h.sale_type === 'onereux' ? 0 : (h.payment_type === 'partiel' ? Number(h.amount_paid || 0) : Number(h.prix || 0)));
      }, 0);
      
      const allParcellesCount = parcelles?.reduce((sum, p) => sum + Math.max(1, Math.ceil(Number(p.surface || 600) / 600)), 0) || 0;
      const soldParcellesCount = soldParcelles.reduce((sum, p) => sum + Math.max(1, Math.ceil(Number(p.surface || 600) / 600)), 0);
      const availableCount = availableParcelles.reduce((sum, p) => sum + Math.max(1, Math.ceil(Number(p.surface || 600) / 600)), 0);
      
      // Prix moyen basé sur toutes les parcelles (non filtré)
      const averagePrice = allParcellesCount > 0 
        ? parcelles.reduce((sum, p) => sum + Number(p.prix), 0) / allParcellesCount 
        : 0;
      
      // Taux de vente basé sur la période sélectionnée
      const salesRate = allParcellesCount > 0
        ? (soldParcellesCount / allParcellesCount) * 100
        : 0;

      setStats({
        totalRevenue,
        salesCount: soldParcellesCount + soldHectares.length,
        availableCount: availableCount,
        soldCount: soldParcellesCount + soldHectares.length,
        averagePrice,
        salesRate,
      });

      // Calculer les statistiques par hectare (filtré par période et type de vente)
      const hectareStatsData = hectares?.map(hectare => {
        const hectareParcelles = parcelles?.filter(p => p.hectare_id === hectare.id) || [];
        const allSoldInHectare = hectareParcelles.filter(p => p.status === "vendu");
        // Appliquer le filtre de période et de type de vente aux parcelles vendues dans cet hectare
        const soldInHectare = filterBySaleType(filterByPeriod(allSoldInHectare));
        const totalParcellesInHectare = hectareParcelles.reduce((sum, p) => sum + Math.max(1, Math.ceil(Number(p.surface || 600) / 600)), 0);
        const soldCountInHectare = soldInHectare.reduce((sum, p) => sum + Math.max(1, Math.ceil(Number(p.surface || 600) / 600)), 0);
        const revenueInHectare = soldInHectare.reduce((sum, p) => sum + (p.sale_type === 'onereux' ? 0 : (p.payment_type === 'partiel' ? Number(p.amount_paid || 0) : Number(p.prix || 0))), 0);
        const salesRateInHectare = totalParcellesInHectare > 0
          ? (soldCountInHectare / totalParcellesInHectare) * 100
          : 0;

        return {
          id: hectare.id,
          name: hectare.name,
          totalParcelles: totalParcellesInHectare,
          soldParcelles: soldCountInHectare,
          revenue: revenueInHectare,
          salesRate: salesRateInHectare,
        };
      }) || [];

      setHectareStats(hectareStatsData.sort((a, b) => b.revenue - a.revenue));

      // Calculer les données mensuelles (filtrées par type de vente)
      const salesByMonth = new Map<string, { ventes: number; revenus: number }>();
      
      // Ajouter les ventes de parcelles (filtrées par type de vente)
      filterBySaleType(allSoldParcelles).forEach(p => {
        if (p.sale_date) {
          const date = new Date(p.sale_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const existing = salesByMonth.get(monthKey) || { ventes: 0, revenus: 0 };
          salesByMonth.set(monthKey, {
            ventes: existing.ventes + 1,
            revenus: existing.revenus + (p.sale_type === 'onereux' ? 0 : (p.payment_type === 'partiel' ? Number(p.amount_paid || 0) : Number(p.prix || 0)))
          });
        }
      });

      // Ajouter les ventes d'hectares (filtrées par type de vente)
      filterBySaleType(allSoldHectares).forEach(h => {
        if (h.sale_date) {
          const date = new Date(h.sale_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const existing = salesByMonth.get(monthKey) || { ventes: 0, revenus: 0 };
          salesByMonth.set(monthKey, {
            ventes: existing.ventes + 1,
            revenus: existing.revenus + (h.sale_type === 'onereux' ? 0 : (h.payment_type === 'partiel' ? Number(h.amount_paid || 0) : Number(h.prix || 0)))
          });
        }
      });

      // Convertir en tableau et trier par date
      const monthlyDataArray = Array.from(salesByMonth.entries())
        .map(([monthKey, data]) => {
          const [year, month] = monthKey.split('-');
          const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
          return {
            month: `${monthNames[parseInt(month) - 1]} ${year}`,
            ventes: data.ventes,
            revenus: data.revenus,
            sortKey: monthKey
          };
        })
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .slice(-12); // Garder les 12 derniers mois

      setMonthlyData(monthlyDataArray);
    } catch (error) {
      console.error("Erreur:", error);
      toast.error("Erreur lors du chargement des statistiques");
    } finally {
      setLoading(false);
    }
  };

  const getDuplicateRMBs = () => {
    const rmbCounts = new Map<string, number>();
    
    allParcelles.forEach(parcelle => {
      if (parcelle.rmb_number) {
        const count = rmbCounts.get(parcelle.rmb_number) || 0;
        rmbCounts.set(parcelle.rmb_number, count + 1);
      }
    });
    
    return Array.from(rmbCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([rmb]) => rmb);
  };

  const getDuplicateRMBDetails = () => {
    const duplicateRMBs = getDuplicateRMBs();
    const details = new Map<string, any[]>();
    
    duplicateRMBs.forEach(rmb => {
      const parcelles = allParcelles.filter(p => p.rmb_number === rmb);
      details.set(rmb, parcelles);
    });
    
    return details;
  };

  const duplicateRMBs = getDuplicateRMBs();
  const duplicateRMBDetails = getDuplicateRMBDetails();

  const exportDuplicatesPDF = async () => {
    try {
      const pdf = new jsPDF();
      
      // Charger l'image pour obtenir ses dimensions réelles
      const img = new Image();
      img.src = headerImage;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Calculer les dimensions pour garder les proportions originales
      const pdfWidth = 210;
      const imgRatio = img.height / img.width;
      const headerHeight = pdfWidth * imgRatio;
      
      // Ajouter l'en-tête avec proportions originales
      pdf.addImage(headerImage, 'JPEG', 0, 0, pdfWidth, headerHeight);
      
      let yPos = headerHeight + 10;
      
      // Titre du rapport
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("RAPPORT DES DOUBLONS RMB", 105, yPos, { align: "center" });
      yPos += 10;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 105, yPos, { align: "center" });
      yPos += 15;

      // Alerte
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(220, 38, 38);
      pdf.text(`⚠ ${duplicateRMBs.length} numéro(s) RMB utilisé(s) plusieurs fois`, 20, yPos);
      pdf.setTextColor(0, 0, 0);
      yPos += 10;

      // Parcourir chaque doublon
      Array.from(duplicateRMBDetails.entries()).forEach(([rmb, parcelles]) => {
        if (yPos > 240) {
          pdf.addPage();
          yPos = 20;
        }

        // En-tête du groupe RMB
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(254, 202, 202);
        pdf.rect(20, yPos, 170, 8, 'F');
        pdf.text(`RMB: ${rmb} (${parcelles.length} parcelles)`, 22, yPos + 5.5);
        yPos += 10;

        // Détails de chaque parcelle
        parcelles.forEach((parcelle) => {
          if (yPos > 260) {
            pdf.addPage();
            yPos = 20;
          }

          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setFillColor(250, 250, 250);
          pdf.rect(25, yPos, 160, 25, 'FD');

          // Infos de la parcelle
          pdf.setFont("helvetica", "bold");
          pdf.text(`Parcelle: ${parcelle.numero}`, 28, yPos + 5);
          
          pdf.setFont("helvetica", "normal");
          pdf.text(`Hectare: ${parcelle.hectares?.name || "N/A"}`, 28, yPos + 10);
          pdf.text(`Surface: ${parcelle.surface} m² | Prix: ${parcelle.prix?.toLocaleString()} USD`, 28, yPos + 15);
          
          // Statut
          const statusText = parcelle.status === "vendu" ? "Vendu" : "Disponible";
          pdf.setFont("helvetica", "bold");
          pdf.text(`Statut: ${statusText}`, 28, yPos + 20);

          // Si vendu, afficher les infos acheteur
          if (parcelle.status === "vendu" && parcelle.buyer_name) {
            pdf.setFont("helvetica", "italic");
            pdf.setFontSize(8);
            pdf.text(`Acheteur: ${parcelle.buyer_name}`, 100, yPos + 5);
            pdf.text(`Tel: ${parcelle.buyer_phone || "N/A"}`, 100, yPos + 10);
            pdf.text(`Email: ${parcelle.buyer_email || "N/A"}`, 100, yPos + 15);
            pdf.text(`Payé: ${parcelle.amount_paid?.toLocaleString() || 0} USD`, 100, yPos + 20);
          }

          yPos += 28;
        });

        yPos += 5;
      });

      // Footer
      const pageCount = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(100, 100, 100);
        pdf.text("Rapport de doublons RMB généré automatiquement", 105, 285, { align: "center" });
      }

      pdf.save(`rapport-doublons-rmb-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Rapport des doublons exporté avec succès");
    } catch (error) {
      console.error("Erreur export doublons:", error);
      toast.error("Erreur lors de l'export du rapport des doublons");
    }
  };

  // Suite logique des numéros RMB (de RMB 001 à ...)
  const rmbSequence = useMemo(() => {
    const rmbMap = new Map<number, any[]>();
    let maxFound = 0;

    const extractNum = (rmb?: string | null) => {
      if (!rmb) return null;
      const digits = rmb.replace(/\D/g, "");
      if (!digits) return null;
      const val = parseInt(digits, 10);
      return isNaN(val) || val <= 0 ? null : val;
    };

    allParcelles.forEach((p) => {
      const num = extractNum(p.rmb_number);
      if (num !== null) {
        if (num > maxFound) maxFound = num;
        const list = rmbMap.get(num) || [];
        list.push({ ...p, _entityType: "parcelle" });
        rmbMap.set(num, list);
      }
    });

    allHectares.forEach((h) => {
      const num = extractNum(h.rmb_number);
      if (num !== null) {
        if (num > maxFound) maxFound = num;
        const list = rmbMap.get(num) || [];
        list.push({ ...h, _entityType: "hectare" });
        rmbMap.set(num, list);
      }
    });

    if (maxFound === 0) return [];

    const limit = Math.min(maxFound, 1000);
    const seq: Array<{
      num: number;
      rmbFormatted: string;
      isMissing: boolean;
      items: any[];
    }> = [];

    for (let i = 1; i <= limit; i++) {
      const rmbFormatted = `RMB ${String(i).padStart(3, "0")}`;
      const items = rmbMap.get(i) || [];
      seq.push({
        num: i,
        rmbFormatted,
        isMissing: items.length === 0,
        items,
      });
    }

    return seq;
  }, [allParcelles, allHectares]);

  const filteredRmbSequence = useMemo(() => {
    return rmbSequence.filter((entry) => {
      if (rmbFilterMode === "missing" && !entry.isMissing) return false;
      if (rmbFilterMode === "assigned" && entry.isMissing) return false;

      if (rmbSearchTerm.trim()) {
        const term = rmbSearchTerm.toLowerCase();
        const matchNum =
          entry.rmbFormatted.toLowerCase().includes(term) ||
          String(entry.num).includes(term);
        const matchItems = entry.items?.some((it: any) =>
          (it.buyer_name || "").toLowerCase().includes(term) ||
          (it.numero || "").toLowerCase().includes(term) ||
          (it.name || "").toLowerCase().includes(term)
        );
        return matchNum || Boolean(matchItems);
      }

      return true;
    });
  }, [rmbSequence, rmbFilterMode, rmbSearchTerm]);

  const totalMissingRmb = useMemo(() => {
    return rmbSequence.filter((i) => i.isMissing).length;
  }, [rmbSequence]);

  const missingRmbSuggestions = useMemo(() => {
    return rmbSequence
      .filter((i) => i.isMissing)
      .map((i) => i.rmbFormatted)
      .slice(0, 15);
  }, [rmbSequence]);

  const handleOpenDuplicateModal = (entry: any) => {
    setSelectedDuplicateEntry(entry);
    const initialVals: { [id: string]: string } = {};
    entry.items?.forEach((it: any) => {
      initialVals[it.id] = it.rmb_number || entry.rmbFormatted;
    });
    setEditedRmbValues(initialVals);
    setDuplicateModalOpen(true);
  };

  const handleSaveRmbChange = async (item: any, newRmb: string) => {
    if (!newRmb || !newRmb.trim()) {
      toast.error("Le numéro RMB ne peut pas être vide");
      return;
    }

    try {
      setSavingRmbId(item.id);
      const isParcelle = item._entityType === "parcelle" || item.hectare_id !== undefined;
      const targetTable = isParcelle ? "parcelles" : "hectares";

      const { error } = await supabase
        .from(targetTable)
        .update({ rmb_number: newRmb.trim() })
        .eq("id", item.id);

      if (error) throw error;

      toast.success(`Numéro RMB mis à jour avec succès : ${newRmb.trim()}`);
      await loadStats();

      setSelectedDuplicateEntry((prev: any) => {
        if (!prev) return null;
        const updatedItems = prev.items.map((it: any) =>
          it.id === item.id ? { ...it, rmb_number: newRmb.trim() } : it
        );
        const currentNumStr = String(prev.num);
        const stillMatching = updatedItems.filter(
          (it: any) =>
            it.rmb_number?.trim() === prev.rmbFormatted ||
            it.rmb_number?.replace(/\D/g, "") === currentNumStr
        );
        if (stillMatching.length <= 1) {
          toast.success("Doublon résolu !");
          setDuplicateModalOpen(false);
          return null;
        }
        return { ...prev, items: updatedItems };
      });
    } catch (err: any) {
      console.error("Erreur mise à jour RMB:", err);
      toast.error(`Erreur lors de la modification : ${err.message || "Erreur inconnue"}`);
    } finally {
      setSavingRmbId(null);
    }
  };

  const exportRmbSequencePDF = async () => {
    try {
      const pdf = new jsPDF();
      const img = new Image();
      img.src = headerImage;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      const pdfWidth = 210;
      const imgRatio = img.height / img.width;
      const headerHeight = Math.min(pdfWidth * imgRatio, 38);
      const imgWidth = headerHeight / imgRatio;
      const imgX = (pdfWidth - imgWidth) / 2;
      pdf.addImage(headerImage, "JPEG", imgX, 5, imgWidth, headerHeight);

      let yPos = headerHeight + 15;

      // Titre
      pdf.setFontSize(15);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 60, 110);
      const maxNum = rmbSequence.length > 0 ? rmbSequence[rmbSequence.length - 1].num : 0;
      pdf.text(
        `RAPPORT DE CONTINUITÉ RMB - SUITE LOGIQUE (RMB 001 À RMB ${String(maxNum).padStart(3, "0")})`,
        105,
        yPos,
        { align: "center" }
      );
      yPos += 7;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(
        `Généré le ${new Date().toLocaleDateString("fr-FR")} · Concession Manuel Joaquim d'Oliveira`,
        105,
        yPos,
        { align: "center" }
      );
      pdf.setTextColor(0, 0, 0);
      yPos += 10;

      // Résumé
      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(20, yPos, 170, 16, 2, 2, "F");
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Total numéros dans la suite : ${rmbSequence.length}`, 25, yPos + 6);
      pdf.text(`Numéros attribués : ${rmbSequence.length - totalMissingRmb}`, 25, yPos + 12);

      if (totalMissingRmb > 0) {
        pdf.setTextColor(194, 65, 12);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Trous détectés : ${totalMissingRmb} numéro(s) manquant(s)`, 110, yPos + 6);
      } else {
        pdf.setTextColor(22, 101, 52);
        pdf.setFont("helvetica", "bold");
        pdf.text(`Continuité parfaite : Aucun trou`, 110, yPos + 6);
      }
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `Taux de continuité : ${
          rmbSequence.length > 0
            ? (((rmbSequence.length - totalMissingRmb) / rmbSequence.length) * 100).toFixed(1)
            : 0
        }%`,
        110,
        yPos + 12
      );

      yPos += 22;

      // Tableau des numéros
      const colWidths = [30, 45, 55, 40];
      const headers = ["Numéro", "Statut séquence", "Détail de l'emplacement", "Concessionnaire"];

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setFillColor(30, 60, 110);
      pdf.setTextColor(255, 255, 255);
      let cx = 20;
      headers.forEach((h, i) => {
        pdf.rect(cx, yPos, colWidths[i], 7, "F");
        pdf.text(h, cx + 2, yPos + 4.8);
        cx += colWidths[i];
      });
      yPos += 7;
      pdf.setTextColor(0, 0, 0);

      rmbSequence.forEach((item, idx) => {
        if (yPos > 275) {
          pdf.addPage();
          yPos = 20;
          pdf.setFontSize(8);
          pdf.setFont("helvetica", "bold");
          pdf.setFillColor(30, 60, 110);
          pdf.setTextColor(255, 255, 255);
          let rcx = 20;
          headers.forEach((h, i) => {
            pdf.rect(rcx, yPos, colWidths[i], 7, "F");
            pdf.text(h, rcx + 2, yPos + 4.8);
            rcx += colWidths[i];
          });
          yPos += 7;
          pdf.setTextColor(0, 0, 0);
        }

        cx = 20;
        if (item.isMissing) {
          pdf.setFillColor(255, 237, 213);
          colWidths.forEach((w) => {
            pdf.rect(cx, yPos, w, 7, "FD");
            cx += w;
          });

          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(194, 65, 12);
          pdf.text(item.rmbFormatted, 22, yPos + 4.8);
          pdf.text(`MANQUANT ${item.rmbFormatted}`, 52, yPos + 4.8);

          pdf.setFont("helvetica", "italic");
          pdf.setTextColor(120, 120, 120);
          pdf.text("Emplacement non attribué", 97, yPos + 4.8);
          pdf.text("—", 152, yPos + 4.8);
          pdf.setTextColor(0, 0, 0);
        } else {
          pdf.setFillColor(
            idx % 2 === 0 ? 250 : 255,
            idx % 2 === 0 ? 250 : 255,
            idx % 2 === 0 ? 250 : 255
          );
          colWidths.forEach((w) => {
            pdf.rect(cx, yPos, w, 7, "FD");
            cx += w;
          });

          const primaryItem = item.items[0];
          const itemName =
            primaryItem._entityType === "parcelle"
              ? `Parcelle ${primaryItem.numero}`
              : primaryItem.name;
          const buyer = primaryItem.buyer_name || "Disponible";

          pdf.setFont("helvetica", "bold");
          pdf.text(item.rmbFormatted, 22, yPos + 4.8);

          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(22, 101, 52);
          pdf.text("Attribué", 52, yPos + 4.8);
          pdf.setTextColor(0, 0, 0);

          pdf.text((itemName || "").substring(0, 24), 97, yPos + 4.8);
          pdf.text((buyer || "").substring(0, 18), 152, yPos + 4.8);
        }

        yPos += 7;
      });

      pdf.save(`rapport-suite-logique-rmb-${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("Rapport de suite logique RMB téléchargé");
    } catch (error) {
      console.error("Erreur export suite logique RMB:", error);
      toast.error("Erreur lors de la génération du rapport RMB");
    }
  };

  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF();
      
      // Charger l'image pour obtenir ses dimensions réelles
      const img = new Image();
      img.src = headerImage;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      // Calculer les dimensions pour garder les proportions originales
      const pdfWidth = 210; // largeur A4 en mm
      const imgRatio = img.height / img.width;
      const headerHeight = pdfWidth * imgRatio;
      
      // Ajouter l'en-tête avec proportions originales
      pdf.addImage(headerImage, 'JPEG', 0, 0, pdfWidth, headerHeight);
      
      let yPos = headerHeight + 10;
      
      // Titre du rapport
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("RAPPORT D'ANALYSES", 105, yPos, { align: "center" });
      yPos += 10;
      
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 105, yPos, { align: "center" });
      yPos += 5;
      const periodLabel = selectedMonth ? `Période : ${selectedMonth}` : "Période : Toutes";
      const filterLabel = `Filtre : ${selectedSaleType === "all" ? "Toutes les transactions" : selectedSaleType === "onereux" ? "À titre gratuit" : selectedSaleType === "total" ? "Payé totalement" : selectedSaleType === "partiel" ? "Payé partiellement" : "Impayé"}`;
      pdf.text(`${periodLabel} | ${filterLabel}`, 105, yPos, { align: "center" });
      yPos += 15;
      
      // Statistiques globales - Grille
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("STATISTIQUES GLOBALES", 20, yPos);
      yPos += 10;
      
      // Dessiner le tableau des statistiques globales
      const colWidth = 85;
      const rowHeight = 10;
      const startX = 20;
      
      // Données du tableau 3x2
      const formatPrice = (price: number) => {
        return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      };
      
      const statsData = [
        [
          { label: "Revenus Total", value: `${formatPrice(stats.totalRevenue)} USD` },
          { label: "Ventes réalisées", value: `${stats.salesCount}` }
        ],
        [
          { label: "Taux de vente", value: `${stats.salesRate.toFixed(1)}%` },
          { label: "Prix moyen", value: `${formatPrice(Math.round(stats.averagePrice))} USD` }
        ],
        [
          { label: "Parcelles disponibles", value: `${stats.availableCount}` },
          { label: "Parcelles vendues", value: `${stats.soldCount}` }
        ]
      ];
      
      pdf.setFontSize(9);
      
      statsData.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
          const x = startX + (colIndex * colWidth);
          const y = yPos + (rowIndex * rowHeight * 2);
          
          // Bordure de la cellule
          pdf.setDrawColor(200, 200, 200);
          pdf.setFillColor(245, 247, 250);
          pdf.rect(x, y, colWidth, rowHeight * 2, 'FD');
          
          // Label
          pdf.setFont("helvetica", "bold");
          pdf.text(cell.label, x + 3, y + 5);
          
          // Valeur
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(11);
          pdf.text(cell.value, x + 3, y + 12);
          pdf.setFontSize(9);
        });
      });
      
      yPos += (statsData.length * rowHeight * 2) + 15;
      
      // Performance par hectare - Grille
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("PERFORMANCE PAR HECTARE", 20, yPos);
      yPos += 10;
      
      if (hectareStats.length === 0) {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text("Aucune donnée disponible", 25, yPos);
        yPos += 10;
      } else {
        // En-tête du tableau
        const tableStartX = 20;
        const colWidths = [50, 35, 30, 45];
        const headers = ["Hectare", "Parcelles", "Taux", "Revenus (USD)"];
        
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(66, 135, 245);
        pdf.setTextColor(255, 255, 255);
        
        let currentX = tableStartX;
        headers.forEach((header, i) => {
          pdf.rect(currentX, yPos, colWidths[i], 8, 'F');
          pdf.text(header, currentX + 2, yPos + 5.5);
          currentX += colWidths[i];
        });
        
        yPos += 8;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");
        
        // Lignes de données
        hectareStats.forEach((hectare, index) => {
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
          }
          
          const isEven = index % 2 === 0;
          if (isEven) {
            pdf.setFillColor(250, 250, 250);
          } else {
            pdf.setFillColor(255, 255, 255);
          }
          
          currentX = tableStartX;
          
          // Dessiner les cellules
          colWidths.forEach((width) => {
            pdf.rect(currentX, yPos, width, 8, 'FD');
            currentX += width;
          });
          
          // Ajouter les données
          pdf.text(hectare.name.substring(0, 20), tableStartX + 2, yPos + 5.5);
          pdf.text(`${hectare.soldParcelles}/${hectare.totalParcelles}`, tableStartX + colWidths[0] + 2, yPos + 5.5);
          pdf.text(`${hectare.salesRate.toFixed(1)}%`, tableStartX + colWidths[0] + colWidths[1] + 2, yPos + 5.5);
          pdf.text(formatPrice(hectare.revenue), tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + 2, yPos + 5.5);
          
          yPos += 8;
        });
      }
      
      yPos += 10;
      
      // Répartition par statut - Grille
      if (yPos > 240) {
        pdf.addPage();
        yPos = 20;
      }
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("RÉPARTITION PAR STATUT", 20, yPos);
      yPos += 10;
      
      // Tableau de répartition
      const statusTableStartX = 20;
      const statusColWidth = 60;
      const statusData = [
        { label: "Disponibles", count: stats.availableCount, percent: ((stats.availableCount / (stats.availableCount + stats.soldCount)) * 100).toFixed(1) },
        { label: "Vendues", count: stats.soldCount, percent: stats.salesRate.toFixed(1) },
        { label: "Réservées", count: 0, percent: "0" }
      ];
      
      pdf.setFontSize(9);
      
      // En-tête
      pdf.setFont("helvetica", "bold");
      pdf.setFillColor(66, 135, 245);
      pdf.setTextColor(255, 255, 255);
      
      pdf.rect(statusTableStartX, yPos, statusColWidth, 8, 'F');
      pdf.text("Statut", statusTableStartX + 2, yPos + 5.5);
      
      pdf.rect(statusTableStartX + statusColWidth, yPos, statusColWidth, 8, 'F');
      pdf.text("Nombre", statusTableStartX + statusColWidth + 2, yPos + 5.5);
      
      pdf.rect(statusTableStartX + statusColWidth * 2, yPos, statusColWidth, 8, 'F');
      pdf.text("Pourcentage", statusTableStartX + statusColWidth * 2 + 2, yPos + 5.5);
      
      yPos += 8;
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      
      // Lignes de données
      statusData.forEach((status, index) => {
        const isEven = index % 2 === 0;
        if (isEven) {
          pdf.setFillColor(250, 250, 250);
        } else {
          pdf.setFillColor(255, 255, 255);
        }
        
        pdf.rect(statusTableStartX, yPos, statusColWidth, 8, 'FD');
        pdf.rect(statusTableStartX + statusColWidth, yPos, statusColWidth, 8, 'FD');
        pdf.rect(statusTableStartX + statusColWidth * 2, yPos, statusColWidth, 8, 'FD');
        
        pdf.text(status.label, statusTableStartX + 2, yPos + 5.5);
        pdf.text(status.count.toString(), statusTableStartX + statusColWidth + 2, yPos + 5.5);
        pdf.text(`${status.percent}%`, statusTableStartX + statusColWidth * 2 + 2, yPos + 5.5);
        
      yPos += 8;
      });
      
      yPos += 10;
      
      // Liste des acheteurs
      if (yPos > 220) {
        pdf.addPage();
        yPos = 20;
      }
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("LISTE DES ACHETEURS", 20, yPos);
      yPos += 10;
      
      // Récupérer les acheteurs depuis les parcelles et hectares (vendus + onéreux)
      const { data: parcellesWithBuyers } = await supabase
        .from("parcelles")
        .select("*, hectares(name)")
        .or("status.eq.vendu,sale_type.eq.onereux")
        .not("buyer_name", "is", null);
      
      const { data: hectaresWithBuyers } = await supabase
        .from("hectares")
        .select("*")
        .or("status.eq.sold,sale_type.eq.onereux")
        .not("buyer_name", "is", null);
      
      const parcellesFiltered = [...filterBySaleType(filterByPeriod(parcellesWithBuyers || []))].sort((a, b) => 
        (a.numero || "").localeCompare(b.numero || "", undefined, { numeric: true, sensitivity: 'base' })
      );
      const hectaresFiltered = [...filterBySaleType(filterByPeriod(hectaresWithBuyers || []))].sort((a, b) => 
        (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: 'base' })
      );

      const buyers: Array<{
        name: string;
        phone: string;
        email: string;
        type: string;
        property: string;
        prix: number;
        amount: number;
      }> = [];
      
      // Ajouter les acheteurs de parcelles
      parcellesFiltered.forEach(p => {
        const saleTypeLabel = p.sale_type === "onereux" ? " (Gratuit)" : "";
        buyers.push({
          name: p.buyer_name || "N/A",
          phone: p.buyer_phone || "N/A",
          email: p.buyer_email || "N/A",
          type: `Parcelle${saleTypeLabel}`,
          property: `${(p.hectares as any)?.name || "N/A"} - ${p.numero}`,
          prix: Number(p.prix || 0),
          amount: p.sale_type === "onereux" ? 0 : (p.payment_type === 'partiel' ? Number(p.amount_paid || 0) : Number(p.prix || 0))
        });
      });
      
      // Ajouter les acheteurs d'hectares
      hectaresFiltered.forEach(h => {
        const saleTypeLabel = h.sale_type === "onereux" ? " (Gratuit)" : "";
        buyers.push({
          name: h.buyer_name || "N/A",
          phone: h.buyer_phone || "N/A",
          email: h.buyer_email || "N/A",
          type: `Hectare${saleTypeLabel}`,
          property: h.name,
          prix: Number(h.prix || 0),
          amount: h.sale_type === "onereux" ? 0 : (h.payment_type === 'partiel' ? Number(h.amount_paid || 0) : Number(h.prix || 0))
        });
      });
      
      if (buyers.length === 0) {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text("Aucun acheteur enregistré", 25, yPos);
        yPos += 10;
      } else {
        // En-tête du tableau des acheteurs
        const buyerColWidths = [40, 30, 30, 25, 25, 20];
        const buyerHeaders = ["Nom", "Propriété", "Tel", "Type", "Prix", "Payé"];
        
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(66, 135, 245);
        pdf.setTextColor(255, 255, 255);
        let bx = 20;
        buyerHeaders.forEach((h, i) => {
          pdf.rect(bx, yPos, buyerColWidths[i], 8, 'F');
          pdf.text(h, bx + 2, yPos + 5.5);
          bx += buyerColWidths[i];
        });
        yPos += 8;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");

        buyers.forEach((buyer, index) => {
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
          }
          
          const isOnereux = buyer.type.includes("Gratuit");
          if (isOnereux) {
            pdf.setFillColor(255, 243, 224);
          } else {
            pdf.setFillColor(index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 250 : 255);
          }
          
          bx = 20;
          buyerColWidths.forEach(w => { pdf.rect(bx, yPos, w, 8, 'FD'); bx += w; });
          
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.text(buyer.name.substring(0, 18), 22, yPos + 5.5);
          pdf.text(buyer.property.substring(0, 14), 62, yPos + 5.5);
          pdf.text(buyer.phone.substring(0, 14), 92, yPos + 5.5);
          
          if (isOnereux) {
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(180, 90, 0);
            pdf.text("GRATUIT", 122, yPos + 5.5);
            pdf.setTextColor(0, 0, 0);
            pdf.setFont("helvetica", "normal");
            pdf.text("-", 147, yPos + 5.5);
            pdf.text("-", 167, yPos + 5.5);
          } else {
            pdf.text(buyer.type.substring(0, 10), 122, yPos + 5.5);
            pdf.text(formatPrice(buyer.prix), 147, yPos + 5.5);
            pdf.text(formatPrice(buyer.amount), 167, yPos + 5.5);
          }
          pdf.setFontSize(8);
          
          yPos += 8;
        });
      }
      
      // Footer
      const pageCount = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "italic");
        pdf.text("Rapport généré automatiquement", 105, 285, { align: "center" });
      }
      
      // Télécharger le PDF
      pdf.save(`rapport-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success("Rapport PDF téléchargé avec succès");
    } catch (error) {
      console.error("Erreur export:", error);
      toast.error("Erreur lors de la génération du PDF");
    }
  };

  const exportMonthlyPDF = async (monthKey: string) => {
    try {
      const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const [year, month] = monthKey.split('-');
      const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;

      // Filtrer les données pour ce mois
      const filterMonth = <T extends { sale_date?: string | null }>(items: T[]): T[] => {
        return items.filter(item => {
          if (!item.sale_date) return false;
          const d = new Date(item.sale_date);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` === monthKey;
        });
      };

      const { data: parcelles } = await supabase.from("parcelles").select("*, hectares(id, name)");
      const { data: hectares } = await supabase.from("hectares").select("*");

      const soldParcelles = [...filterBySaleType(filterMonth(parcelles?.filter(p => p.status === "vendu") || []))].sort((a, b) => 
        (a.numero || "").localeCompare(b.numero || "", undefined, { numeric: true, sensitivity: 'base' })
      );
      const soldHectares = [...filterBySaleType(filterMonth(hectares?.filter(h => h.status === "sold" || h.status === "vendu") || []))].sort((a, b) => 
        (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: 'base' })
      );

      const totalRevenue = soldParcelles.reduce((s, p) => s + (p.sale_type === 'onereux' ? 0 : (p.payment_type === 'partiel' ? Number(p.amount_paid || 0) : Number(p.prix || 0))), 0)
        + soldHectares.reduce((s, h) => s + (h.sale_type === 'onereux' ? 0 : (h.payment_type === 'partiel' ? Number(h.amount_paid || 0) : Number(h.prix || 0))), 0);

      const formatPrice = (price: number) => price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

      const pdf = new jsPDF();

      // Header image
      const img = new Image();
      img.src = headerImage;
      await new Promise((resolve) => { img.onload = resolve; });
      const pdfWidth = 210;
      const imgRatio = img.height / img.width;
      const headerHeight = Math.min(pdfWidth * imgRatio, 40);
      const imgWidth = headerHeight / imgRatio;
      const imgX = (pdfWidth - imgWidth) / 2;
      pdf.addImage(headerImage, 'JPEG', imgX, 5, imgWidth, headerHeight);

      let yPos = headerHeight + 15;

      // Titre
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 60, 110);
      pdf.text(`RAPPORT DES VENTES - ${monthLabel.toUpperCase()}`, 105, yPos, { align: "center" });
      yPos += 8;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, 105, yPos, { align: "center" });
      pdf.setTextColor(0, 0, 0);
      yPos += 12;

      // Ligne séparatrice
      pdf.setDrawColor(30, 60, 110);
      pdf.setLineWidth(0.5);
      pdf.line(20, yPos, 190, yPos);
      yPos += 10;

      // Résumé statistiques
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text("RÉSUMÉ DU MOIS", 20, yPos);
      yPos += 10;

      const soldParcellesUnits = soldParcelles.reduce((sum, p) => sum + Math.max(1, Math.ceil(Number(p.surface || 600) / 600)), 0);
      const summaryData = [
        ["Nombre de parcelles vendues", `${soldParcellesUnits}`],
        ["Nombre d'hectares vendus", `${soldHectares.length}`],
        ["Total acquisitions", `${soldParcellesUnits + soldHectares.length}`],
        ["Revenus total", `${formatPrice(totalRevenue)} USD`],
      ];

      pdf.setFontSize(10);
      summaryData.forEach(([label, value]) => {
        pdf.setFillColor(245, 247, 250);
        pdf.roundedRect(20, yPos - 4, 170, 10, 2, 2, 'F');
        pdf.setFont("helvetica", "normal");
        pdf.text(label, 25, yPos + 2);
        pdf.setFont("helvetica", "bold");
        pdf.text(value, 185, yPos + 2, { align: "right" });
        yPos += 12;
      });

      yPos += 5;

      // Détail des ventes parcelles
      if (soldParcelles.length > 0) {
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.text("DÉTAIL DES VENTES - PARCELLES", 20, yPos);
        yPos += 8;

        const colWidths = [30, 25, 35, 25, 25, 30];
        const headers = ["Parcelle", "Hectare", "Acheteur", "Type", "Prix (USD)", "Payé (USD)"];

        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(30, 60, 110);
        pdf.setTextColor(255, 255, 255);
        let cx = 20;
        headers.forEach((h, i) => {
          pdf.rect(cx, yPos, colWidths[i], 8, 'F');
          pdf.text(h, cx + 2, yPos + 5.5);
          cx += colWidths[i];
        });
        yPos += 8;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");

        soldParcelles.forEach((p, idx) => {
          if (yPos > 270) { pdf.addPage(); yPos = 20; }
          const isOnereux = p.sale_type === 'onereux';
          if (isOnereux) {
            pdf.setFillColor(255, 243, 224);
          } else {
            pdf.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255);
          }
          cx = 20;
          colWidths.forEach(w => { pdf.rect(cx, yPos, w, 8, 'FD'); cx += w; });
          pdf.setFont("helvetica", "normal");
          pdf.text(p.numero.substring(0, 12), 22, yPos + 5.5);
          pdf.text(((p.hectares as any)?.name || "N/A").substring(0, 10), 52, yPos + 5.5);
          pdf.text((p.buyer_name || "N/A").substring(0, 14), 77, yPos + 5.5);
          if (isOnereux) {
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(180, 90, 0);
            pdf.text("GRATUIT", 112, yPos + 5.5);
            pdf.setTextColor(0, 0, 0);
            pdf.setFont("helvetica", "normal");
            pdf.text("-", 137, yPos + 5.5);
            pdf.text("-", 162, yPos + 5.5);
          } else {
            pdf.text("Normal", 112, yPos + 5.5);
            pdf.text(formatPrice(Number(p.prix || 0)), 137, yPos + 5.5);
            pdf.text(formatPrice(Number(p.amount_paid || 0)), 162, yPos + 5.5);
          }
          yPos += 8;
        });
        yPos += 8;
      }

      // Détail des ventes hectares
      if (soldHectares.length > 0) {
        if (yPos > 240) { pdf.addPage(); yPos = 20; }
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.text("DÉTAIL DES VENTES - HECTARES", 20, yPos);
        yPos += 8;

        const hColWidths = [40, 35, 25, 35, 35];
        const hHeaders = ["Hectare", "Acheteur", "Type", "Prix (USD)", "Payé (USD)"];

        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(30, 60, 110);
        pdf.setTextColor(255, 255, 255);
        let hcx = 20;
        hHeaders.forEach((h, i) => {
          pdf.rect(hcx, yPos, hColWidths[i], 8, 'F');
          pdf.text(h, hcx + 2, yPos + 5.5);
          hcx += hColWidths[i];
        });
        yPos += 8;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");

        soldHectares.forEach((h, idx) => {
          if (yPos > 270) { pdf.addPage(); yPos = 20; }
          const isOnereux = h.sale_type === 'onereux';
          if (isOnereux) {
            pdf.setFillColor(255, 243, 224);
          } else {
            pdf.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255);
          }
          hcx = 20;
          hColWidths.forEach(w => { pdf.rect(hcx, yPos, w, 8, 'FD'); hcx += w; });
          pdf.setFont("helvetica", "normal");
          pdf.text(h.name.substring(0, 16), 22, yPos + 5.5);
          pdf.text((h.buyer_name || "N/A").substring(0, 14), 62, yPos + 5.5);
          if (isOnereux) {
            pdf.setFont("helvetica", "bold");
            pdf.setTextColor(180, 90, 0);
            pdf.text("GRATUIT", 97, yPos + 5.5);
            pdf.setTextColor(0, 0, 0);
            pdf.setFont("helvetica", "normal");
            pdf.text("-", 122, yPos + 5.5);
            pdf.text("-", 157, yPos + 5.5);
          } else {
            pdf.text("Normal", 97, yPos + 5.5);
            pdf.text(formatPrice(Number(h.prix || 0)), 122, yPos + 5.5);
            pdf.text(formatPrice(Number(h.amount_paid || 0)), 157, yPos + 5.5);
          }
          yPos += 8;
        });
      }

      // Footer
      const pageCount = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Rapport mensuel - ${monthLabel}`, 105, 285, { align: "center" });
      }

      pdf.save(`rapport-ventes-${monthKey}.pdf`);
      toast.success(`Rapport de ${monthLabel} téléchargé`);
    } catch (error) {
      console.error("Erreur export mensuel:", error);
      toast.error("Erreur lors de la génération du rapport mensuel");
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

      <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        {/* Header */}
        <PageHeader
          title="Rapports & Analyses"
          description="Dernière étape : analysez les ventes, les revenus et l'occupation des terrains."
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 mb-6">

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-wrap">
            <select 
              className="px-3 py-2 rounded-lg border border-border bg-background text-xs sm:text-sm"
              value={selectedMonth || "all"}
              onChange={(e) => setSelectedMonth(e.target.value === "all" ? null : e.target.value)}
            >
              <option value="all">Tous les mois</option>
              {availableMonths.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            
            <select 
              className="px-3 py-2 rounded-lg border border-border bg-background text-xs sm:text-sm"
              value={selectedSaleType}
              onChange={(e) => setSelectedSaleType(e.target.value)}
            >
              <option value="all">Toutes les transactions</option>
              <option value="onereux">À titre gratuit</option>
              <option value="total">Payé totalement</option>
              <option value="partiel">Payé partiellement</option>
              <option value="impaye">Impayé</option>
            </select>

            <Button onClick={exportToPDF} className="bg-primary hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4">
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Exporter PDF</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          <StatsCard
            title="Revenus Total"
            value={`${stats.totalRevenue.toLocaleString()} USD`}
            subtitle={`${stats.salesCount} ventes réalisées`}
            icon={DollarSign}
            colorClass="bg-[hsl(160,84%,39%)]"
          />
          <StatsCard
            title="Taux de Vente"
            value={`${stats.salesRate.toFixed(1)}%`}
            subtitle={`${stats.soldCount}/${stats.soldCount + stats.availableCount} parcelles`}
            icon={TrendingUp}
            colorClass="bg-[hsl(217,91%,60%)]"
          />
          <StatsCard
            title="Prix Moyen"
            value={`${Math.round(stats.averagePrice).toLocaleString()} USD`}
            subtitle="par parcelle"
            icon={BarChart2}
            colorClass="bg-[hsl(24,95%,53%)]"
          />
          <StatsCard
            title="Disponibles"
            value={stats.availableCount.toString()}
            subtitle="à vendre"
            icon={Calendar}
            colorClass="bg-[hsl(271,91%,65%)]"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Évolution des Ventes */}
          <Card className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
              <h3 className="text-sm sm:text-lg font-semibold text-foreground">
                Évolution des Ventes
              </h3>
              <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                <Download className="w-3 h-3" /> Cliquez pour télécharger
              </span>
            </div>
            <div className="h-48 sm:h-64">
              {monthlyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-xs sm:text-sm">Aucune vente enregistrée</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} onClick={(data) => {
                    if (data && data.activePayload && data.activePayload[0]) {
                      const clickedMonth = data.activePayload[0].payload.sortKey;
                      exportMonthlyPDF(clickedMonth);
                    }
                  }} style={{ cursor: 'pointer' }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="month" 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tick={{ fontSize: 9 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      width={30}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px"
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === "revenus") return [`${value.toLocaleString()} USD`, "Revenus"];
                        return [value, "Ventes"];
                      }}
                    />
                    <Bar dataKey="ventes" radius={[6, 6, 0, 0]}>
                      {monthlyData.map((entry) => (
                        <Cell 
                          key={entry.sortKey}
                          fill={entry.sortKey === selectedMonth ? "hsl(160, 84%, 39%)" : "hsl(217, 91%, 60%)"}
                          stroke={entry.sortKey === selectedMonth ? "hsl(160, 84%, 30%)" : "none"}
                          strokeWidth={entry.sortKey === selectedMonth ? 2 : 0}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Performance par Hectare */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm sm:text-lg font-semibold text-foreground">
                Performance par Hectare
              </h3>
              <span className="text-[10px] sm:text-xs text-muted-foreground">Top 5</span>
            </div>
            <div className="space-y-3">
              {hectareStats.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <BarChart2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-xs sm:text-sm">Aucune donnée disponible</p>
                  </div>
                </div>
              ) : (
                (() => {
                  const top5 = hectareStats.slice(0, 5);
                  const maxRevenue = Math.max(...top5.map(h => h.revenue));
                  const colors = [
                    "bg-[hsl(217,91%,60%)]",
                    "bg-[hsl(160,84%,39%)]",
                    "bg-[hsl(24,95%,53%)]",
                    "bg-[hsl(271,91%,65%)]",
                    "bg-[hsl(210,40%,50%)]",
                  ];
                  return top5.map((hectare, index) => {
                    const pct = maxRevenue > 0 ? (hectare.revenue / maxRevenue) * 100 : 0;
                    return (
                      <div key={hectare.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[index % 5]}`} />
                            <span className="font-medium text-foreground truncate">{hectare.name}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-4 shrink-0 ml-2">
                            <span className="font-semibold text-foreground">{hectare.revenue.toLocaleString()} USD</span>
                            <span className="text-muted-foreground text-[10px] sm:text-xs w-10 text-right">{hectare.salesRate.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${colors[index % 5]} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>
          </Card>
        </div>

        {/* Rapport des Doublons RMB */}
        {duplicateRMBs.length > 0 && (
          <Card className="p-4 sm:p-6 mb-6 sm:mb-8 border-red-200 bg-red-50/50">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-2">
                    Doublons RMB Détectés
                  </h3>
                  <Alert variant="destructive" className="mb-2 sm:mb-3">
                    <AlertDescription className="text-xs sm:text-sm">
                      {duplicateRMBs.length} numéro(s) RMB utilisé(s) plusieurs fois
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={exportDuplicatesPDF}
                  className="text-xs"
                >
                  <Download className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button 
                  variant="destructive"
                  size="sm"
                  onClick={() => setDuplicatesReportOpen(true)}
                  className="text-xs"
                >
                  Voir détail
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Détails par Statut */}
        <Card className="p-4 sm:p-6">
          <h3 className="text-sm sm:text-lg font-semibold text-foreground mb-4">
            Répartition par Statut
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="p-3 sm:p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-[10px] sm:text-sm font-medium text-foreground">Disponibles</span>
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.availableCount}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">
                {((stats.availableCount / (stats.availableCount + stats.soldCount)) * 100).toFixed(1)}%
              </p>
            </div>

            <div className="p-3 sm:p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-[10px] sm:text-sm font-medium text-foreground">Vendues</span>
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500"></div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-foreground">{stats.soldCount}</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">
                {stats.salesRate.toFixed(1)}%
              </p>
            </div>

            <div className="p-3 sm:p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-[10px] sm:text-sm font-medium text-foreground">Réservées</span>
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-orange-500"></div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-foreground">0</p>
              <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">
                0%
              </p>
            </div>
          </div>
        </Card>

        {/* Détails des Ventes (Filtrable) */}
        <Card className="p-4 sm:p-6 mt-6 sm:mt-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-foreground">
                Détail des Transactions
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Liste des ventes et cessions selon les filtres actifs ({selectedSaleType === "all" ? "Tous" : selectedSaleType === "onereux" ? "Gratuits" : selectedSaleType === "total" ? "Payés totalement" : selectedSaleType === "partiel" ? "Payés partiellement" : "Impayés"})
              </p>
            </div>
            
            {/* Tabs Header */}
            <div className="flex gap-1.5 bg-muted/60 p-1 rounded-lg self-start sm:self-auto border border-border/20">
              <button
                type="button"
                onClick={() => setActiveTab("parcelles")}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "parcelles"
                    ? "bg-background shadow-sm text-foreground border border-border/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Grid3x3 className="w-3.5 h-3.5" />
                Parcelles ({soldParcellesList.reduce((sum, p) => sum + Math.max(1, Math.ceil(Number(p.surface || 600) / 600)), 0)})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("hectares")}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "hectares"
                    ? "bg-background shadow-sm text-foreground border border-border/10"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Hectares ({soldHectaresList.length})
              </button>
            </div>
          </div>

          {activeTab === "parcelles" ? (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-medium bg-muted/30">
                    <th className="p-3">Numéro</th>
                    <th className="p-3">Hectare</th>
                    <th className="p-3">Acheteur</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Prix</th>
                    <th className="p-3 text-right">Payé</th>
                    <th className="p-3 text-right">Reste</th>
                  </tr>
                </thead>
                <tbody>
                  {soldParcellesList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-muted-foreground">
                        Aucune parcelle vendue sur cette période avec ces filtres
                      </td>
                    </tr>
                  ) : (
                    soldParcellesList.map((p) => {
                      const isFree = p.sale_type === "onereux";
                      const remaining = isFree ? 0 : (p.prix - (p.amount_paid || 0));
                      const isDuplicateRMB = p.rmb_number && duplicateRMBs.includes(p.rmb_number);
                      const pCount = Math.max(1, Math.ceil(Number(p.surface || 600) / 600));
                      return (
                        <tr 
                          key={p.id} 
                          className={`border-b border-border/40 hover:bg-muted/10 transition-colors ${
                            isDuplicateRMB ? "bg-red-500/10 hover:bg-red-500/15 dark:bg-red-950/20" : ""
                          }`}
                        >
                          <td className="p-3 font-semibold text-foreground">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={isDuplicateRMB ? "text-red-600 font-bold" : ""}>Parcelle {p.numero}</span>
                                {pCount > 1 && (
                                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    {pCount} parcelles ({p.surface} m²)
                                  </span>
                                )}
                              </div>
                              {p.rmb_number && (
                                <span className={`text-[10px] flex items-center gap-1 mt-0.5 ${
                                  isDuplicateRMB ? "text-red-500 font-bold" : "text-muted-foreground"
                                }`}>
                                  {isDuplicateRMB && <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline shrink-0" />}
                                  <span>RMB: {p.rmb_number}</span>
                                  {isDuplicateRMB && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const num = parseInt(p.rmb_number.replace(/\D/g, ""), 10) || 0;
                                        const matchingParcelles = allParcelles.filter((item) => item.rmb_number === p.rmb_number).map((item) => ({ ...item, _entityType: "parcelle" }));
                                        const matchingHectares = allHectares.filter((item) => item.rmb_number === p.rmb_number).map((item) => ({ ...item, _entityType: "hectare" }));
                                        handleOpenDuplicateModal({
                                          num,
                                          rmbFormatted: p.rmb_number,
                                          items: [...matchingParcelles, ...matchingHectares],
                                        });
                                      }}
                                      className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer inline-flex items-center gap-0.5 shadow-sm transition-transform hover:scale-105"
                                      title="Cliquer pour voir et modifier ce doublon"
                                    >
                                      Doublon <Edit className="w-2.5 h-2.5 ml-0.5" />
                                    </button>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{p.hectares?.name || "N/A"}</td>
                          <td className="p-3 font-medium text-foreground">{p.buyer_name || "N/A"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isFree ? "bg-amber-500/15 text-amber-700 dark:text-amber-500" : "bg-blue-500/15 text-blue-700 dark:text-blue-500"
                            }`}>
                              {isFree ? "Gratuit" : "Normal"}
                            </span>
                          </td>
                          <td className="p-3 text-right font-medium text-foreground">{isFree ? "-" : `$${p.prix?.toLocaleString()}`}</td>
                          <td className="p-3 text-right text-emerald-600 font-semibold">{isFree ? "-" : `$${(p.amount_paid || 0).toLocaleString()}`}</td>
                          <td className="p-3 text-right font-medium text-orange-600">{isFree ? "-" : remaining > 0 ? `$${remaining.toLocaleString()}` : "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/40">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground font-medium bg-muted/30">
                    <th className="p-3">Hectare</th>
                    <th className="p-3">Acheteur</th>
                    <th className="p-3">Type</th>
                    <th className="p-3 text-right">Prix</th>
                    <th className="p-3 text-right">Payé</th>
                    <th className="p-3 text-right">Reste</th>
                  </tr>
                </thead>
                <tbody>
                  {soldHectaresList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center p-8 text-muted-foreground">
                        Aucun hectare vendu sur cette période avec ces filtres
                      </td>
                    </tr>
                  ) : (
                    soldHectaresList.map((h) => {
                      const isFree = h.sale_type === "onereux";
                      const remaining = isFree ? 0 : (h.prix - (h.amount_paid || 0));
                      const isDuplicateRMB = h.rmb_number && duplicateRMBs.includes(h.rmb_number);
                      return (
                        <tr 
                          key={h.id} 
                          className={`border-b border-border/40 hover:bg-muted/10 transition-colors ${
                            isDuplicateRMB ? "bg-red-500/10 hover:bg-red-500/15 dark:bg-red-950/20" : ""
                          }`}
                        >
                          <td className="p-3 font-semibold text-foreground">
                            <div className="flex flex-col">
                              <span className={isDuplicateRMB ? "text-red-600 font-bold" : ""}>{h.name}</span>
                              {h.rmb_number && (
                                <span className={`text-[10px] flex items-center gap-1 mt-0.5 ${
                                  isDuplicateRMB ? "text-red-500 font-bold" : "text-muted-foreground"
                                }`}>
                                  {isDuplicateRMB && <AlertTriangle className="w-3.5 h-3.5 text-red-500 inline shrink-0" />}
                                  <span>RMB: {h.rmb_number}</span>
                                  {isDuplicateRMB && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const num = parseInt(h.rmb_number.replace(/\D/g, ""), 10) || 0;
                                        const matchingParcelles = allParcelles.filter((item) => item.rmb_number === h.rmb_number).map((item) => ({ ...item, _entityType: "parcelle" }));
                                        const matchingHectares = allHectares.filter((item) => item.rmb_number === h.rmb_number).map((item) => ({ ...item, _entityType: "hectare" }));
                                        handleOpenDuplicateModal({
                                          num,
                                          rmbFormatted: h.rmb_number,
                                          items: [...matchingParcelles, ...matchingHectares],
                                        });
                                      }}
                                      className="ml-1 text-[9px] px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer inline-flex items-center gap-0.5 shadow-sm transition-transform hover:scale-105"
                                      title="Cliquer pour voir et modifier ce doublon"
                                    >
                                      Doublon <Edit className="w-2.5 h-2.5 ml-0.5" />
                                    </button>
                                  )}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-medium text-foreground">{h.buyer_name || "N/A"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              isFree ? "bg-amber-500/15 text-amber-700 dark:text-amber-500" : "bg-blue-500/15 text-blue-700 dark:text-blue-500"
                            }`}>
                              {isFree ? "Gratuit" : "Normal"}
                            </span>
                          </td>
                          <td className="p-3 text-right font-medium text-foreground">{isFree ? "-" : `$${h.prix?.toLocaleString()}`}</td>
                          <td className="p-3 text-right text-emerald-600 font-semibold">{isFree ? "-" : `$${(h.amount_paid || 0).toLocaleString()}`}</td>
                          <td className="p-3 text-right font-medium text-orange-600">{isFree ? "-" : remaining > 0 ? `$${remaining.toLocaleString()}` : "-"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Suite logique des numéros RMB (de RMB 001 à ...) avec détection des trous */}
        <Card className="p-4 sm:p-6 mt-6 sm:mt-8 border-border">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-4 border-b border-border">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
                <ListOrdered className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-foreground">
                    Suite Logique des Numéros RMB
                  </h3>
                  <Badge variant="outline" className="text-xs font-mono bg-muted">
                    {rmbSequence.length > 0
                      ? `RMB 001 → ${rmbSequence[rmbSequence.length - 1].rmbFormatted}`
                      : "Aucun RMB"}
                  </Badge>
                  {totalMissingRmb > 0 ? (
                    <Badge className="bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold">
                      {totalMissingRmb} trou{totalMissingRmb > 1 ? "s" : ""} détecté{totalMissingRmb > 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <Badge className="bg-emerald-600 text-white text-xs">
                      Séquence continue sans trou
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Suivi séquentiel continu de chaque numéro RMB de RMB 001 à la fin. Les trous dans la suite logique sont clairement signalés en orange.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={exportRmbSequencePDF}
                disabled={rmbSequence.length === 0}
                className="gap-2 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter PDF (Suite RMB)</span>
              </Button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="p-3 rounded-xl border border-border bg-muted/20">
              <span className="text-[11px] text-muted-foreground font-medium">Plage analysée</span>
              <p className="text-sm sm:text-base font-bold text-foreground mt-0.5">
                {rmbSequence.length > 0
                  ? `RMB 001 à ${rmbSequence[rmbSequence.length - 1].rmbFormatted}`
                  : "—"}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-muted/20">
              <span className="text-[11px] text-muted-foreground font-medium">Attribués</span>
              <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {rmbSequence.length - totalMissingRmb}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-muted/20">
              <span className="text-[11px] text-muted-foreground font-medium">Trous dans la suite</span>
              <p
                className={cn(
                  "text-sm sm:text-base font-bold mt-0.5",
                  totalMissingRmb > 0 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600"
                )}
              >
                {totalMissingRmb} manquant{totalMissingRmb > 1 ? "s" : ""}
              </p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-muted/20">
              <span className="text-[11px] text-muted-foreground font-medium">Taux d'ordre</span>
              <p className="text-sm sm:text-base font-bold text-foreground mt-0.5">
                {rmbSequence.length > 0
                  ? `${(
                      ((rmbSequence.length - totalMissingRmb) / rmbSequence.length) *
                      100
                    ).toFixed(1)}%`
                  : "100%"}
              </p>
            </div>
          </div>

          {/* Filtres et recherche */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/30 overflow-x-auto">
              <button
                type="button"
                onClick={() => setRmbFilterMode("all")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                  rmbFilterMode === "all"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Tous ({rmbSequence.length})
              </button>
              <button
                type="button"
                onClick={() => setRmbFilterMode("missing")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                  rmbFilterMode === "missing"
                    ? "bg-orange-500 text-white font-bold shadow-sm"
                    : "text-orange-600 hover:text-orange-700"
                )}
              >
                Trous manquants ({totalMissingRmb})
              </button>
              <button
                type="button"
                onClick={() => setRmbFilterMode("assigned")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap",
                  rmbFilterMode === "assigned"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Attribués ({rmbSequence.length - totalMissingRmb})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher RMB (ex: 007)..."
                value={rmbSearchTerm}
                onChange={(e) => setRmbSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Tableau de la séquence logique */}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 font-semibold text-foreground uppercase tracking-wider text-[11px] w-28">
                    Numéro RMB
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground uppercase tracking-wider text-[11px] w-48">
                    État dans la suite
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground uppercase tracking-wider text-[11px]">
                    Emplacement cadastral
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-foreground uppercase tracking-wider text-[11px]">
                    Concessionnaire / Titulaire
                  </th>
                  <th className="text-center px-4 py-3 font-semibold text-foreground uppercase tracking-wider text-[11px] w-28">
                    Statut
                  </th>
                  <th className="text-right px-4 py-3 font-semibold text-foreground uppercase tracking-wider text-[11px] w-28">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRmbSequence.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Aucun numéro correspondant aux critères sélectionnés.
                    </td>
                  </tr>
                ) : (
                  filteredRmbSequence.map((entry) => {
                    if (entry.isMissing) {
                      return (
                        <tr
                          key={entry.num}
                          className="bg-orange-500/10 hover:bg-orange-500/15 transition-colors border-l-4 border-l-orange-500"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-orange-700 dark:text-orange-400">
                            {entry.rmbFormatted}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] gap-1 px-2 py-0.5">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Manquant {entry.rmbFormatted}</span>
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground italic">
                            Numéro sauté dans la suite logique — non enregistré
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            —
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider">
                              Trou
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">
                            —
                          </td>
                        </tr>
                      );
                    }

                    const firstItem = entry.items![0];
                    const isParcelle = firstItem._entityType === "parcelle";
                    const hasDup = entry.items!.length > 1;

                    return (
                      <tr
                        key={entry.num}
                        onClick={() => {
                          if (hasDup) handleOpenDuplicateModal(entry);
                        }}
                        className={cn(
                          "transition-colors",
                          hasDup
                            ? "bg-red-500/10 hover:bg-red-500/15 cursor-pointer"
                            : "hover:bg-muted/40"
                        )}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-foreground">
                          {entry.rmbFormatted}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-medium"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                              Attribué
                            </Badge>
                            {hasDup && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenDuplicateModal(entry);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white shadow-sm transition-transform hover:scale-105 cursor-pointer ring-2 ring-red-400/30"
                                title="Cliquer pour voir et modifier ce doublon"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                <span>Doublon ({entry.items!.length})</span>
                                <Edit className="w-2.5 h-2.5 ml-0.5 opacity-80" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div>
                            {isParcelle ? `Parcelle ${firstItem.numero}` : firstItem.name}
                          </div>
                          {firstItem.hectares?.name && (
                            <span className="text-[10px] text-muted-foreground">
                              {firstItem.hectares.name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-foreground">
                            {firstItem.buyer_name || "Disponible (sans acquéreur)"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-semibold",
                              firstItem.status === "vendu" || firstItem.status === "sold"
                                ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            )}
                          >
                            {firstItem.status === "vendu" || firstItem.status === "sold"
                              ? "Vendu"
                              : "Disponible"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {hasDup ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDuplicateModal(entry);
                              }}
                              className="h-7 text-xs px-2.5 font-medium shadow-sm gap-1 hover:bg-red-700"
                              title="Voir et modifier ce doublon"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Gérer</span>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Dialog pour le rapport des doublons RMB */}
      <Dialog open={duplicatesReportOpen} onOpenChange={setDuplicatesReportOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 text-sm sm:text-base">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              Rapport des Doublons RMB
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 sm:space-y-6">
            <Alert variant="destructive">
              <AlertDescription className="text-xs sm:text-sm">
                {duplicateRMBs.length} numéro(s) RMB sont utilisés plusieurs fois.
              </AlertDescription>
            </Alert>

            {Array.from(duplicateRMBDetails.entries()).map(([rmb, parcelles]) => (
              <Card key={rmb} className="p-3 sm:p-4 border-red-200">
                <div className="mb-2 sm:mb-3 pb-2 sm:pb-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-semibold text-sm sm:text-lg text-red-600">
                    RMB: {rmb}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({parcelles.length} parcelles)
                    </span>
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs gap-1.5 w-fit"
                    onClick={() => {
                      setDuplicatesReportOpen(false);
                      handleOpenDuplicateModal({
                        num: parseInt(rmb.replace(/\D/g, ""), 10) || 0,
                        rmbFormatted: rmb,
                        items: parcelles.map((p) => ({ ...p, _entityType: "parcelle" })),
                      });
                    }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Modifier ce doublon</span>
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {parcelles.map((parcelle) => (
                    <div key={parcelle.id} className="p-2.5 sm:p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <p className="font-medium text-xs sm:text-sm">
                            Parcelle: {parcelle.numero}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {parcelle.hectares?.name || "N/A"}
                            </span>
                          </p>
                          <p className="text-[10px] sm:text-sm text-muted-foreground">
                            {parcelle.surface} m² • {parcelle.prix?.toLocaleString()} USD
                          </p>
                        </div>
                        <span className={`px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded shrink-0 ${
                          parcelle.status === "vendu" 
                            ? "bg-green-500/20 text-green-700" 
                            : "bg-blue-500/20 text-blue-700"
                        }`}>
                          {parcelle.status === "vendu" ? "Vendu" : "Disponible"}
                        </span>
                      </div>
                      
                      {parcelle.status === "vendu" && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-xs font-medium text-foreground">
                            Acheteur: {parcelle.buyer_name || "Non renseigné"}
                          </p>
                          <div className="grid grid-cols-2 gap-1 mt-1 text-[10px] sm:text-xs text-muted-foreground">
                            <p>📞 {parcelle.buyer_phone || "N/A"}</p>
                            <p>📧 {parcelle.buyer_email || "N/A"}</p>
                            <p>📅 {parcelle.sale_date ? new Date(parcelle.sale_date).toLocaleDateString() : "N/A"}</p>
                            <p>💰 {parcelle.amount_paid?.toLocaleString() || 0} USD</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal pour voir et modifier directement les doublons RMB */}
      <Dialog open={duplicateModalOpen} onOpenChange={setDuplicateModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 text-base sm:text-lg">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Gestion du Doublon {selectedDuplicateEntry?.rmbFormatted}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedDuplicateEntry && (
            <div className="space-y-4 pt-1">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs sm:text-sm text-foreground space-y-1">
                <p className="font-semibold text-red-700 dark:text-red-400">
                  {selectedDuplicateEntry.items?.length || 0} éléments partagent actuellement le numéro {selectedDuplicateEntry.rmbFormatted}.
                </p>
                <p className="text-muted-foreground text-xs">
                  Vous pouvez réattribuer un numéro distinct à l'un des éléments ci-dessous pour résoudre immédiatement le doublon.
                </p>
              </div>

              {/* Suggestions de numéros manquants pour combler les trous */}
              {missingRmbSuggestions.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <ListOrdered className="w-4 h-4 shrink-0" />
                    <span>Numéros manquants dans la suite logique (suggérés pour combler les trous) :</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Cliquez sur un numéro manquant pour l'assigner à l'élément de votre choix :
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {missingRmbSuggestions.map((sug) => (
                      <Badge
                        key={sug}
                        variant="outline"
                        className="bg-background border-amber-400/40 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer text-xs py-1 px-2.5 transition-colors font-mono font-bold"
                        title={`Pré-remplir ${sug}`}
                        onClick={() => {
                          const targetItem =
                            selectedDuplicateEntry.items?.[1] ||
                            selectedDuplicateEntry.items?.[0];
                          if (targetItem) {
                            setEditedRmbValues((prev) => ({
                              ...prev,
                              [targetItem.id]: sug,
                            }));
                            toast.info(`Numéro ${sug} pré-rempli pour ${targetItem._entityType === "parcelle" ? `Parcelle ${targetItem.numero}` : targetItem.name}`);
                          }
                        }}
                      >
                        + {sug}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Liste des éléments en doublon avec champ d'édition */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Éléments enregistrés avec {selectedDuplicateEntry.rmbFormatted}
                </h4>

                {selectedDuplicateEntry.items?.map((item: any) => {
                  const isParcelle = item._entityType === "parcelle" || item.hectare_id !== undefined || item.numero !== undefined;
                  const currentVal = editedRmbValues[item.id] ?? item.rmb_number ?? selectedDuplicateEntry.rmbFormatted;
                  const isSaving = savingRmbId === item.id;
                  const hasChanged = currentVal.trim() !== (item.rmb_number || selectedDuplicateEntry.rmbFormatted).trim();

                  return (
                    <Card key={item.id} className="p-3.5 sm:p-4 border border-border shadow-sm bg-card hover:border-primary/40 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm sm:text-base text-foreground">
                              {isParcelle ? `Parcelle ${item.numero}` : item.name}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                              {isParcelle ? "Parcelle" : "Hectare"}
                            </Badge>
                            <Badge
                              className={cn(
                                "text-[10px] font-semibold",
                                item.status === "vendu" || item.status === "sold"
                                  ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
                                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              )}
                            >
                              {item.status === "vendu" || item.status === "sold" ? "Vendu" : "Disponible"}
                            </Badge>
                          </div>
                          {item.hectares?.name && (
                            <p className="text-xs text-muted-foreground">
                              Site / Hectare : <span className="font-medium text-foreground">{item.hectares.name}</span>
                            </p>
                          )}
                        </div>

                        <div className="text-right text-xs text-muted-foreground">
                          {item.surface && <span>{item.surface} m²</span>}
                          {item.prix && <span className="ml-2 font-semibold text-foreground">• {Number(item.prix).toLocaleString()} USD</span>}
                        </div>
                      </div>

                      {/* Info acquéreur si vendu */}
                      {(item.buyer_name || item.status === "vendu") && (
                        <div className="py-2 text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 gap-1 border-b border-border/40">
                          <div>
                            <span className="font-medium text-foreground">Acquéreur :</span> {item.buyer_name || "Non renseigné"}
                          </div>
                          <div>
                            <span className="font-medium text-foreground">Téléphone :</span> {item.buyer_phone || "—"}
                          </div>
                        </div>
                      )}

                      {/* Modification et attribution du numéro RMB */}
                      <div className="pt-3 space-y-2">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <div className="flex-1 flex items-center gap-2">
                            <label className="text-xs font-semibold whitespace-nowrap text-foreground">
                              Numéro RMB :
                            </label>
                            <Input
                              value={currentVal}
                              onChange={(e) =>
                                setEditedRmbValues((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="ex: RMB 374"
                              className="h-9 font-mono text-sm font-semibold max-w-[220px]"
                            />
                          </div>

                          <Button
                            size="sm"
                            onClick={() => handleSaveRmbChange(item, currentVal)}
                            disabled={isSaving || !currentVal.trim()}
                            className="h-9 px-3 gap-1.5 shrink-0"
                            variant={hasChanged ? "default" : "outline"}
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Enregistrement...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Enregistrer</span>
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Raccourcis pour assigner un numéro manquant à cet élément précis */}
                        {missingRmbSuggestions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                            <span>Assigner un trou :</span>
                            {missingRmbSuggestions.slice(0, 6).map((sug) => (
                              <button
                                key={sug}
                                type="button"
                                onClick={() =>
                                  setEditedRmbValues((prev) => ({
                                    ...prev,
                                    [item.id]: sug,
                                  }))
                                }
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDuplicateModalOpen(false)}
                  className="text-xs"
                >
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Rapports;
