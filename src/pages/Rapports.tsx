import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DollarSign, TrendingUp, BarChart2, Calendar, Download } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import StatsCard from "@/components/StatsCard";
import { jsPDF } from "jspdf";
import headerImage from "@/assets/en_tete_concession_manuel.jpg";

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

      // Calculer les statistiques globales
      const soldParcelles = parcelles?.filter(p => p.status === "vendu") || [];
      const availableParcelles = parcelles?.filter(p => p.status === "disponible") || [];
      
      const totalRevenue = soldParcelles.reduce((sum, p) => sum + Number(p.amount_paid || p.prix), 0);
      const averagePrice = parcelles && parcelles.length > 0 
        ? parcelles.reduce((sum, p) => sum + Number(p.prix), 0) / parcelles.length 
        : 0;
      const salesRate = parcelles && parcelles.length > 0
        ? (soldParcelles.length / parcelles.length) * 100
        : 0;

      setStats({
        totalRevenue,
        salesCount: soldParcelles.length,
        availableCount: availableParcelles.length,
        soldCount: soldParcelles.length,
        averagePrice,
        salesRate,
      });

      // Calculer les statistiques par hectare
      const { data: hectares, error: hectaresError } = await supabase
        .from("hectares")
        .select("*");

      if (hectaresError) throw hectaresError;

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

  const exportToPDF = async () => {
    try {
      const pdf = new jsPDF();
      
      // Ajouter l'en-tête image avec proportions originales
      pdf.addImage(headerImage, 'JPEG', 0, 0, 210, 30);
      
      let yPos = 40;
      
      // Titre du rapport
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("RAPPORT D'ANALYSES", 105, yPos, { align: "center" });
      yPos += 10;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 105, yPos, { align: "center" });
      yPos += 15;
      
      // Statistiques globales
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("STATISTIQUES GLOBALES", 20, yPos);
      yPos += 8;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const globalStats = [
        `Revenus Total: ${stats.totalRevenue.toLocaleString()} USD`,
        `Ventes réalisées: ${stats.salesCount}`,
        `Taux de vente: ${stats.salesRate.toFixed(1)}%`,
        `Prix moyen par parcelle: ${Math.round(stats.averagePrice).toLocaleString()} USD`,
        `Parcelles disponibles: ${stats.availableCount}`,
        `Parcelles vendues: ${stats.soldCount}`,
      ];
      
      globalStats.forEach(stat => {
        pdf.text(`• ${stat}`, 25, yPos);
        yPos += 6;
      });
      
      yPos += 5;
      
      // Performance par hectare
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("PERFORMANCE PAR HECTARE", 20, yPos);
      yPos += 8;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      
      if (hectareStats.length === 0) {
        pdf.text("Aucune donnée disponible", 25, yPos);
        yPos += 6;
      } else {
        hectareStats.forEach(hectare => {
          if (yPos > 270) {
            pdf.addPage();
            yPos = 20;
          }
          
          pdf.setFont("helvetica", "bold");
          pdf.text(hectare.name, 25, yPos);
          yPos += 6;
          
          pdf.setFont("helvetica", "normal");
          pdf.text(`  Parcelles: ${hectare.soldParcelles}/${hectare.totalParcelles}`, 25, yPos);
          yPos += 5;
          pdf.text(`  Taux de vente: ${hectare.salesRate.toFixed(1)}%`, 25, yPos);
          yPos += 5;
          pdf.text(`  Revenus: ${hectare.revenue.toLocaleString()} USD`, 25, yPos);
          yPos += 8;
        });
      }
      
      yPos += 5;
      
      // Répartition par statut
      if (yPos > 240) {
        pdf.addPage();
        yPos = 20;
      }
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("RÉPARTITION PAR STATUT", 20, yPos);
      yPos += 8;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const statusStats = [
        `Disponibles: ${stats.availableCount} (${((stats.availableCount / (stats.availableCount + stats.soldCount)) * 100).toFixed(1)}%)`,
        `Vendues: ${stats.soldCount} (${stats.salesRate.toFixed(1)}%)`,
        `Réservées: 0 (0%)`,
      ];
      
      statusStats.forEach(stat => {
        pdf.text(`• ${stat}`, 25, yPos);
        yPos += 6;
      });
      
      // Footer
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "italic");
      pdf.text("Rapport généré automatiquement", 105, 285, { align: "center" });
      
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
    </div>
  );
};

export default Rapports;
