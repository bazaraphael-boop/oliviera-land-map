import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DollarSign, TrendingUp, BarChart2, Calendar, Bell, Search, LogOut, Download } from "lucide-react";
import { toast } from "sonner";
import DashboardSidebar from "@/components/DashboardSidebar";
import StatsCard from "@/components/StatsCard";
import { jsPDF } from "jspdf";
import headerImage from "@/assets/en_tete_concession_manuel.jpg";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    salesRate: 0,
    averagePrice: 0,
    available: 0,
    totalParcelles: 0,
    soldParcelles: 0,
  });

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        navigate("/login");
        return;
      }

      setUser(user);

      // Récupérer le profil
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profileError && profileData) {
        setProfile(profileData);
      }

      // Charger les statistiques
      await loadStats();
    } catch (error) {
      console.error("Erreur:", error);
      navigate("/login");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: parcelles, error } = await supabase
        .from("parcelles")
        .select("*");

      if (error) throw error;

      const totalParcelles = parcelles?.length || 0;
      const soldParcelles = parcelles?.filter((p) => p.status === "vendue").length || 0;
      const totalRevenue = parcelles
        ?.filter((p) => p.status === "vendue")
        .reduce((sum, p) => sum + Number(p.prix), 0) || 0;
      const averagePrice = totalParcelles > 0
        ? parcelles.reduce((sum, p) => sum + Number(p.prix), 0) / totalParcelles
        : 0;
      const available = parcelles?.filter((p) => p.status === "disponible").length || 0;
      const salesRate = totalParcelles > 0 ? (soldParcelles / totalParcelles) * 100 : 0;

      setStats({
        totalRevenue,
        salesRate,
        averagePrice,
        available,
        totalParcelles,
        soldParcelles,
      });
    } catch (error) {
      console.error("Erreur stats:", error);
    }
  };

  const handleExportReport = () => {
    try {
      const pdf = new jsPDF();
      
      // Ajouter l'en-tête image avec proportions préservées
      pdf.addImage(headerImage, 'JPEG', 0, 0, 210, 40);
      
      let yPos = 50;
      
      // Titre
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      pdf.text("RAPPORT TABLEAU DE BORD", 105, yPos, { align: "center" });
      yPos += 10;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 105, yPos, { align: "center" });
      yPos += 15;
      
      // Statistiques
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("STATISTIQUES", 20, yPos);
      yPos += 8;
      
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      const statsData = [
        `Revenus Total: ${stats.totalRevenue.toFixed(0)} USD`,
        `Ventes réalisées: ${stats.soldParcelles}`,
        `Taux de Vente: ${stats.salesRate.toFixed(1)}%`,
        `Prix Moyen: ${stats.averagePrice.toFixed(0)} USD`,
        `Parcelles disponibles: ${stats.available}`,
        `Total parcelles: ${stats.totalParcelles}`,
      ];
      
      statsData.forEach(stat => {
        pdf.text(`• ${stat}`, 25, yPos);
        yPos += 6;
      });
      
      // Footer
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "italic");
      pdf.text("Rapport généré automatiquement", 105, 285, { align: "center" });
      
      pdf.save(`tableau-bord-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast.success("Rapport PDF téléchargé avec succès");
    } catch (error) {
      console.error("Erreur export:", error);
      toast.error("Erreur lors de l'export du rapport");
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Déconnexion réussie");
      navigate("/");
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
      toast.error("Erreur lors de la déconnexion");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Search */}
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher hectares, parcelles..."
                  className="pl-10 bg-background"
                />
              </div>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
              </Button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold">
                    {profile?.full_name?.charAt(0) || "A"}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {profile?.full_name || "Admin Principal"}
                  </p>
                  <p className="text-xs text-muted-foreground">Admin</p>
                </div>
              </div>

              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-8 overflow-auto">
          {/* Page Header */}
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
              <select className="px-4 py-2 rounded-lg border border-border bg-background text-sm">
                <option>Ce mois</option>
                <option>Ce trimestre</option>
                <option>Cette année</option>
              </select>
              <Button className="bg-primary hover:bg-primary/90" onClick={handleExportReport}>
                <Download className="w-4 h-4 mr-2" />
                Exporter PDF
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
              title="Revenus Total"
              value={`${stats.totalRevenue.toFixed(0)} USD`}
              subtitle={`${stats.soldParcelles} ventes réalisées`}
              icon={DollarSign}
              colorClass="bg-[hsl(160,84%,39%)]"
            />
            <StatsCard
              title="Taux de Vente"
              value={`${stats.salesRate.toFixed(1)}%`}
              subtitle={`${stats.soldParcelles}/${stats.totalParcelles} parcelles`}
              icon={TrendingUp}
              colorClass="bg-[hsl(217,91%,60%)]"
            />
            <StatsCard
              title="Prix Moyen"
              value={`${stats.averagePrice.toFixed(0)} USD`}
              subtitle="par parcelle"
              icon={BarChart2}
              colorClass="bg-[hsl(24,95%,53%)]"
            />
            <StatsCard
              title="Disponibles"
              value={stats.available.toString()}
              subtitle="à vendre"
              icon={Calendar}
              colorClass="bg-[hsl(271,91%,65%)]"
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Évolution des Ventes */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Évolution des Ventes Mensuelles
              </h3>
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            </Card>

            {/* Performance par Hectare */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">
                  Performance par Hectare
                </h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">issetech</p>
                    <p className="text-sm text-muted-foreground">0/15 parcelles</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">0.0%</p>
                    <p className="text-sm text-muted-foreground">0k USD</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
