import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, BarChart2, Calendar, Download, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
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
  const [duplicatesReportOpen, setDuplicatesReportOpen] = useState(false);
  const [allParcelles, setAllParcelles] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);

  useEffect(() => {
    checkAuth();
    loadStats();
  }, [selectedMonth]);

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

      // Filtrer les ventes par période
      const allSoldParcelles = parcelles?.filter(p => p.status === "vendu") || [];
      const allSoldHectares = hectares?.filter(h => h.status === "sold" || h.status === "vendu") || [];
      
      // Appliquer le filtre de période
      const soldParcelles = filterByPeriod(allSoldParcelles);
      const soldHectares = filterByPeriod(allSoldHectares);
      
      const availableParcelles = parcelles?.filter(p => p.status === "disponible") || [];
      
      const totalRevenue = soldParcelles.reduce((sum, p) => {
        return sum + (p.sale_type === 'onereux' ? 0 : Number(p.amount_paid || p.prix));
      }, 0) + soldHectares.reduce((sum, h) => {
        return sum + (h.sale_type === 'onereux' ? 0 : Number(h.amount_paid || h.prix));
      }, 0);
      
      // Prix moyen basé sur toutes les parcelles (non filtré)
      const averagePrice = parcelles && parcelles.length > 0 
        ? parcelles.reduce((sum, p) => sum + Number(p.prix), 0) / parcelles.length 
        : 0;
      
      // Taux de vente basé sur la période sélectionnée
      const salesRate = parcelles && parcelles.length > 0
        ? (soldParcelles.length / parcelles.length) * 100
        : 0;

      setStats({
        totalRevenue,
        salesCount: soldParcelles.length + soldHectares.length,
        availableCount: availableParcelles.length,
        soldCount: soldParcelles.length + soldHectares.length,
        averagePrice,
        salesRate,
      });

      // Calculer les statistiques par hectare (filtré par période)
      const hectareStatsData = hectares?.map(hectare => {
        const hectareParcelles = parcelles?.filter(p => p.hectare_id === hectare.id) || [];
        const allSoldInHectare = hectareParcelles.filter(p => p.status === "vendu");
        // Appliquer le filtre de période aux parcelles vendues dans cet hectare
        const soldInHectare = filterByPeriod(allSoldInHectare);
        const revenueInHectare = soldInHectare.reduce((sum, p) => sum + (p.sale_type === 'onereux' ? 0 : Number(p.amount_paid || p.prix)), 0);
        const salesRateInHectare = hectareParcelles.length > 0
          ? (soldInHectare.length / hectareParcelles.length) * 100
          : 0;

        return {
          id: hectare.id,
          name: hectare.name,
          totalParcelles: hectareParcelles.length,
          soldParcelles: soldInHectare.length,
          revenue: revenueInHectare,
          salesRate: salesRateInHectare,
        };
      }) || [];

      setHectareStats(hectareStatsData.sort((a, b) => b.revenue - a.revenue));

      // Calculer les données mensuelles (toujours sur toutes les ventes, pas filtrées)
      const salesByMonth = new Map<string, { ventes: number; revenus: number }>();
      
      // Ajouter les ventes de parcelles (non filtrées)
      allSoldParcelles.forEach(p => {
        if (p.sale_date) {
          const date = new Date(p.sale_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const existing = salesByMonth.get(monthKey) || { ventes: 0, revenus: 0 };
          salesByMonth.set(monthKey, {
            ventes: existing.ventes + 1,
            revenus: existing.revenus + (p.sale_type === 'onereux' ? 0 : Number(p.amount_paid || p.prix))
          });
        }
      });

      // Ajouter les ventes d'hectares (non filtrées)
      allSoldHectares.forEach(h => {
        if (h.sale_date) {
          const date = new Date(h.sale_date);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const existing = salesByMonth.get(monthKey) || { ventes: 0, revenus: 0 };
          salesByMonth.set(monthKey, {
            ventes: existing.ventes + 1,
            revenus: existing.revenus + (h.sale_type === 'onereux' ? 0 : Number(h.amount_paid || h.prix))
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
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 105, yPos, { align: "center" });
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
      parcellesWithBuyers?.forEach(p => {
        const saleTypeLabel = p.sale_type === "onereux" ? " (Onéreux)" : "";
        buyers.push({
          name: p.buyer_name || "N/A",
          phone: p.buyer_phone || "N/A",
          email: p.buyer_email || "N/A",
          type: `Parcelle${saleTypeLabel}`,
          property: `${(p.hectares as any)?.name || "N/A"} - ${p.numero}`,
          prix: Number(p.prix || 0),
          amount: p.sale_type === "onereux" ? 0 : Number(p.amount_paid || p.prix)
        });
      });
      
      // Ajouter les acheteurs d'hectares
      hectaresWithBuyers?.forEach(h => {
        const saleTypeLabel = h.sale_type === "onereux" ? " (Onéreux)" : "";
        buyers.push({
          name: h.buyer_name || "N/A",
          phone: h.buyer_phone || "N/A",
          email: h.buyer_email || "N/A",
          type: `Hectare${saleTypeLabel}`,
          property: h.name,
          prix: Number(h.prix || 0),
          amount: h.sale_type === "onereux" ? 0 : Number(h.amount_paid || h.prix)
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
          
          const isOnereux = buyer.type.includes("Onéreux");
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
            pdf.text("ONÉREUX", 122, yPos + 5.5);
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

      const soldParcelles = filterMonth(parcelles?.filter(p => p.status === "vendu") || []);
      const soldHectares = filterMonth(hectares?.filter(h => h.status === "sold" || h.status === "vendu") || []);

      const totalRevenue = soldParcelles.reduce((s, p) => s + (p.sale_type === 'onereux' ? 0 : Number(p.amount_paid || p.prix)), 0)
        + soldHectares.reduce((s, h) => s + (h.sale_type === 'onereux' ? 0 : Number(h.amount_paid || h.prix)), 0);

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

      const summaryData = [
        ["Nombre de ventes (parcelles)", `${soldParcelles.length}`],
        ["Nombre de ventes (hectares)", `${soldHectares.length}`],
        ["Total ventes", `${soldParcelles.length + soldHectares.length}`],
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
            pdf.text("ONÉREUX", 112, yPos + 5.5);
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
            pdf.text("ONÉREUX", 97, yPos + 5.5);
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-1">
              Rapports & Analyses
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              Performances de vos terrains
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <select 
              className="px-3 py-2 rounded-lg border border-border bg-background text-xs sm:text-sm flex-1 sm:flex-none"
              value={selectedMonth || "all"}
              onChange={(e) => setSelectedMonth(e.target.value === "all" ? null : e.target.value)}
            >
              <option value="all">Tous les mois</option>
              {availableMonths.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
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
                <div className="mb-2 sm:mb-3 pb-2 sm:pb-3 border-b">
                  <h3 className="font-semibold text-sm sm:text-lg text-red-600">
                    RMB: {rmb}
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({parcelles.length} parcelles)
                    </span>
                  </h3>
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
    </div>
  );
};

export default Rapports;
