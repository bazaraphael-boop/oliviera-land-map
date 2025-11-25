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
  const [selectedPeriod, setSelectedPeriod] = useState("all");
  const [duplicatesReportOpen, setDuplicatesReportOpen] = useState(false);
  const [allParcelles, setAllParcelles] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
    loadStats();
  }, [selectedPeriod]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/login");
    }
  };

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

      // Calculer les statistiques globales
      const soldParcelles = parcelles?.filter(p => p.status === "vendu") || [];
      const availableParcelles = parcelles?.filter(p => p.status === "disponible") || [];
      const soldHectares = hectares?.filter(h => h.status === "sold" || h.status === "vendu") || [];
      
      const totalRevenue = soldParcelles.reduce((sum, p) => {
        return sum + (p.sale_type === 'onereux' ? 0 : Number(p.amount_paid || p.prix));
      }, 0) + soldHectares.reduce((sum, h) => {
        return sum + (h.sale_type === 'onereux' ? 0 : Number(h.amount_paid || h.prix));
      }, 0);
      const averagePrice = parcelles && parcelles.length > 0 
        ? parcelles.reduce((sum, p) => sum + Number(p.prix), 0) / parcelles.length 
        : 0;
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

      // Calculer les statistiques par hectare
      const hectareStatsData = hectares?.map(hectare => {
        const hectareParcelles = parcelles?.filter(p => p.hectare_id === hectare.id) || [];
        const soldInHectare = hectareParcelles.filter(p => p.status === "vendu");
        const revenueInHectare = soldInHectare.reduce((sum, p) => sum + Number(p.amount_paid || p.prix), 0);
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
          amount: h.sale_type === "onereux" ? 0 : Number(h.amount_paid || h.prix)
        });
      });
      
      if (buyers.length === 0) {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.text("Aucun acheteur enregistré", 25, yPos);
        yPos += 10;
      } else {
        // Tableau des acheteurs
        pdf.setFontSize(8);
        
        buyers.forEach((buyer, index) => {
          if (yPos > 260) {
            pdf.addPage();
            yPos = 20;
          }
          
          const isEven = index % 2 === 0;
          if (isEven) {
            pdf.setFillColor(250, 250, 250);
          } else {
            pdf.setFillColor(255, 255, 255);
          }
          
          // Carte d'acheteur
          pdf.rect(20, yPos, 170, 25, 'FD');
          pdf.setDrawColor(200, 200, 200);
          pdf.rect(20, yPos, 170, 25, 'S');
          
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.text(buyer.name, 25, yPos + 6);
          
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.text(`Tel: ${buyer.phone}`, 25, yPos + 12);
          pdf.text(`Email: ${buyer.email}`, 25, yPos + 18);
          
          pdf.setFont("helvetica", "bold");
          pdf.text(`${buyer.type}:`, 110, yPos + 6);
          pdf.setFont("helvetica", "normal");
          pdf.text(buyer.property.substring(0, 30), 110, yPos + 12);
          
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.text(`${formatPrice(buyer.amount)} USD`, 110, yPos + 20);
          
          yPos += 28;
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

      <div className="flex-1 p-8 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">
              Rapports & Analyses
            </h1>
            <p className="text-muted-foreground text-sm">
              Analysez les performances de vos terrains - Données mises à jour automatiquement
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select 
              className="px-4 py-2 rounded-lg border border-border bg-background text-sm"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
            >
              <option value="all">Toute la période</option>
              <option value="month">Ce mois</option>
              <option value="quarter">Ce trimestre</option>
              <option value="year">Cette année</option>
            </select>
            <Button onClick={exportToPDF} className="bg-primary hover:bg-primary/90">
              <Download className="w-4 h-4 mr-2" />
              Exporter PDF
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Évolution des Ventes */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Évolution des Ventes Mensuelles
            </h3>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <BarChart2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm">Graphique en cours de développement</p>
                <p className="text-xs mt-1">Les données seront disponibles prochainement</p>
              </div>
            </div>
          </Card>

          {/* Performance par Hectare */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Performance par Hectare
              </h3>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {hectareStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Aucune donnée disponible
                </div>
              ) : (
                hectareStats.map((hectare) => (
                  <div
                    key={hectare.id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div>
                      <p className="font-medium text-foreground">{hectare.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {hectare.soldParcelles}/{hectare.totalParcelles} parcelles
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {hectare.salesRate.toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {hectare.revenue.toLocaleString()} USD
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Rapport des Doublons RMB */}
        {duplicateRMBs.length > 0 && (
          <Card className="p-6 mb-8 border-red-200 bg-red-50/50">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    Doublons RMB Détectés
                  </h3>
                  <Alert variant="destructive" className="mb-3">
                    <AlertDescription>
                      {duplicateRMBs.length} numéro(s) RMB utilisé(s) plusieurs fois : {duplicateRMBs.join(", ")}
                    </AlertDescription>
                  </Alert>
                  <p className="text-sm text-muted-foreground">
                    Ces numéros RMB apparaissent sur plusieurs parcelles. Cliquez sur le bouton pour voir le détail complet.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={exportDuplicatesPDF}
                  className="whitespace-nowrap"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exporter PDF
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => setDuplicatesReportOpen(true)}
                  className="whitespace-nowrap"
                >
                  Voir le rapport complet
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Détails par Statut */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Répartition par Statut
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Disponibles</span>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.availableCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {((stats.availableCount / (stats.availableCount + stats.soldCount)) * 100).toFixed(1)}% du total
              </p>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Vendues</span>
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.soldCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.salesRate.toFixed(1)}% de taux de vente
              </p>
            </div>

            <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Réservées</span>
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
              </div>
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-xs text-muted-foreground mt-1">
                0% du total
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Dialog pour le rapport des doublons RMB */}
      <Dialog open={duplicatesReportOpen} onOpenChange={setDuplicatesReportOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Rapport des Doublons RMB
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <Alert variant="destructive">
              <AlertDescription>
                {duplicateRMBs.length} numéro(s) RMB sont utilisés plusieurs fois. Chaque numéro RMB devrait être unique.
              </AlertDescription>
            </Alert>

            {Array.from(duplicateRMBDetails.entries()).map(([rmb, parcelles]) => (
              <Card key={rmb} className="p-4 border-red-200">
                <div className="mb-3 pb-3 border-b">
                  <h3 className="font-semibold text-lg text-red-600">
                    RMB: {rmb}
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({parcelles.length} parcelles)
                    </span>
                  </h3>
                </div>
                
                <div className="space-y-4">
                  {parcelles.map((parcelle) => (
                    <div key={parcelle.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium">
                            Parcelle: {parcelle.numero}
                            <span className="ml-2 text-sm text-muted-foreground">
                              Hectare: {parcelle.hectares?.name || "N/A"}
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {parcelle.surface} m² • {parcelle.prix?.toLocaleString()} USD
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          parcelle.status === "vendu" 
                            ? "bg-green-500/20 text-green-700" 
                            : "bg-blue-500/20 text-blue-700"
                        }`}>
                          {parcelle.status === "vendu" ? "Vendu" : "Disponible"}
                        </span>
                      </div>
                      
                      {parcelle.status === "vendu" && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <p className="text-sm font-medium text-foreground">
                            Acheteur: {parcelle.buyer_name || "Non renseigné"}
                          </p>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-xs text-muted-foreground">
                            <p>📞 {parcelle.buyer_phone || "N/A"}</p>
                            <p>📧 {parcelle.buyer_email || "N/A"}</p>
                            <p>📅 {parcelle.sale_date ? new Date(parcelle.sale_date).toLocaleDateString() : "N/A"}</p>
                            <p>
                              💰 {parcelle.amount_paid?.toLocaleString() || 0} USD payés
                              {parcelle.remaining_amount && parcelle.remaining_amount > 0 && (
                                <span className="text-orange-600"> • {parcelle.remaining_amount.toLocaleString()} USD restants</span>
                              )}
                            </p>
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
