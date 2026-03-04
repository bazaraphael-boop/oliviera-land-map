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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canViewRevenue, setCanViewRevenue] = useState(false);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    salesRate: 0,
    averagePrice: 0,
    available: 0,
    totalParcelles: 0,
    soldParcelles: 0,
  });
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; ventes: number; revenus: number }>>([]);
  const [hectareStats, setHectareStats] = useState<Array<{ id: string; name: string; revenue: number; salesRate: number }>>([]);

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

      // Vérifier la permission de voir les revenus
      const { data: hasPermission } = await supabase.rpc("has_permission", {
        _user_id: user.id,
        _permission_code: "view_total_revenue",
      });
      setCanViewRevenue(hasPermission || false);

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
      // Récupérer toutes les parcelles
      const { data: parcelles, error: parcellesError } = await supabase
        .from("parcelles")
        .select("*");

      if (parcellesError) throw parcellesError;

      // Récupérer tous les hectares
      const { data: hectares, error: hectaresError } = await supabase
        .from("hectares")
        .select("*");

      if (hectaresError) throw hectaresError;

      // Calculer les statistiques globales (même logique que Rapports.tsx)
      const soldParcelles = parcelles?.filter(p => p.status === "vendu") || [];
      const availableParcelles = parcelles?.filter(p => p.status === "disponible") || [];
      const soldHectares = hectares?.filter(h => h.status === "sold" || h.status === "vendu") || [];
      
      // Calculer le revenu total en excluant les ventes onéreuses
      const totalRevenue = soldParcelles.reduce((sum, p) => {
        return sum + (p.sale_type === 'onereux' ? 0 : Number(p.amount_paid || p.prix));
      }, 0) + soldHectares.reduce((sum, h) => {
        return sum + (h.sale_type === 'onereux' ? 0 : Number(h.amount_paid || h.prix));
      }, 0);

      const totalParcelles = parcelles?.length || 0;
      const averagePrice = totalParcelles > 0
        ? parcelles.reduce((sum, p) => sum + Number(p.prix), 0) / totalParcelles
        : 0;
      const salesRate = totalParcelles > 0
        ? (soldParcelles.length / totalParcelles) * 100
        : 0;

      setStats({
        totalRevenue,
        salesRate,
        averagePrice,
        available: availableParcelles.length,
        totalParcelles,
        soldParcelles: soldParcelles.length + soldHectares.length,
      });

      // Calculer les données mensuelles
      const salesByMonth = new Map<string, { ventes: number; revenus: number }>();
      
      soldParcelles.forEach(p => {
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

      soldHectares.forEach(h => {
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
        .slice(-12);

      setMonthlyData(monthlyDataArray);

      // Calculer les statistiques par hectare
      const hectareStatsData = hectares?.map(hectare => {
        const hectareParcelles = parcelles?.filter(p => p.hectare_id === hectare.id) || [];
        const soldInHectare = hectareParcelles.filter(p => p.status === "vendu");
        const revenueInHectare = soldInHectare.reduce((sum, p) => sum + (p.sale_type === 'onereux' ? 0 : Number(p.amount_paid || p.prix)), 0);
        const salesRateInHectare = hectareParcelles.length > 0
          ? (soldInHectare.length / hectareParcelles.length) * 100
          : 0;

        return {
          id: hectare.id,
          name: hectare.name,
          revenue: revenueInHectare,
          salesRate: salesRateInHectare,
        };
      }) || [];

      setHectareStats(hectareStatsData.filter(h => h.revenue > 0).sort((a, b) => b.revenue - a.revenue));
    } catch (error) {
      console.error("Erreur stats:", error);
    }
  };

  const handleExportReport = () => {
    try {
      const pdf = new jsPDF();
      
      // Ajouter l'en-tête image avec proportions originales
      pdf.addImage(headerImage, 'JPEG', 0, 0, 210, 30);
      
      let yPos = 40;
      
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
      const statsData = canViewRevenue
        ? [
            `Revenus Total: ${stats.totalRevenue.toFixed(0)} USD`,
            `Taux de Vente: ${stats.salesRate.toFixed(1)}%`,
            `Prix Moyen: ${stats.averagePrice.toFixed(0)} USD`,
            `Parcelles Disponibles: ${stats.available}`,
            `Total Parcelles: ${stats.totalParcelles}`,
            `Parcelles Vendues: ${stats.soldParcelles}`,
          ]
        : [
            `Taux de Vente: ${stats.salesRate.toFixed(1)}%`,
            `Prix Moyen: ${stats.averagePrice.toFixed(0)} USD`,
            `Parcelles Disponibles: ${stats.available}`,
            `Total Parcelles: ${stats.totalParcelles}`,
            `Parcelles Vendues: ${stats.soldParcelles}`,
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

  const exportMonthlyPDF = async (monthKey: string) => {
    try {
      const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const [year, month] = monthKey.split('-');
      const monthLabel = `${monthNames[parseInt(month) - 1]} ${year}`;

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

      pdf.setDrawColor(30, 60, 110);
      pdf.setLineWidth(0.5);
      pdf.line(20, yPos, 190, yPos);
      yPos += 10;

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

      if (soldParcelles.length > 0) {
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.text("DÉTAIL DES VENTES - PARCELLES", 20, yPos);
        yPos += 8;
        const colWidths = [40, 35, 50, 45];
        const headers = ["Parcelle", "Hectare", "Acheteur", "Montant (USD)"];
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(30, 60, 110);
        pdf.setTextColor(255, 255, 255);
        let cx = 20;
        headers.forEach((h, i) => { pdf.rect(cx, yPos, colWidths[i], 8, 'F'); pdf.text(h, cx + 2, yPos + 5.5); cx += colWidths[i]; });
        yPos += 8;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");
        soldParcelles.forEach((p, idx) => {
          if (yPos > 270) { pdf.addPage(); yPos = 20; }
          pdf.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255);
          cx = 20;
          colWidths.forEach(w => { pdf.rect(cx, yPos, w, 8, 'FD'); cx += w; });
          pdf.text(p.numero.substring(0, 15), 22, yPos + 5.5);
          pdf.text(((p.hectares as any)?.name || "N/A").substring(0, 12), 62, yPos + 5.5);
          pdf.text((p.buyer_name || "N/A").substring(0, 20), 97, yPos + 5.5);
          pdf.text(formatPrice(p.sale_type === 'onereux' ? 0 : Number(p.amount_paid || p.prix)), 127, yPos + 5.5);
          yPos += 8;
        });
        yPos += 8;
      }

      if (soldHectares.length > 0) {
        if (yPos > 240) { pdf.addPage(); yPos = 20; }
        pdf.setFontSize(13);
        pdf.setFont("helvetica", "bold");
        pdf.text("DÉTAIL DES VENTES - HECTARES", 20, yPos);
        yPos += 8;
        const colWidths = [55, 50, 65];
        const headers = ["Hectare", "Acheteur", "Montant (USD)"];
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setFillColor(30, 60, 110);
        pdf.setTextColor(255, 255, 255);
        let cx = 20;
        headers.forEach((h, i) => { pdf.rect(cx, yPos, colWidths[i], 8, 'F'); pdf.text(h, cx + 2, yPos + 5.5); cx += colWidths[i]; });
        yPos += 8;
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "normal");
        soldHectares.forEach((h, idx) => {
          if (yPos > 270) { pdf.addPage(); yPos = 20; }
          pdf.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 250 : 255);
          cx = 20;
          colWidths.forEach(w => { pdf.rect(cx, yPos, w, 8, 'FD'); cx += w; });
          pdf.text(h.name.substring(0, 22), 22, yPos + 5.5);
          pdf.text((h.buyer_name || "N/A").substring(0, 20), 77, yPos + 5.5);
          pdf.text(formatPrice(h.sale_type === 'onereux' ? 0 : Number(h.amount_paid || h.prix)), 127, yPos + 5.5);
          yPos += 8;
        });
      }

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
        <header className="bg-card border-b border-border px-4 sm:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Search - hidden on small mobile */}
            <div className="hidden sm:block flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher hectares, parcelles..."
                  className="pl-10 bg-background"
                />
              </div>
            </div>

            {/* Mobile: show name */}
            <div className="sm:hidden flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-semibold text-sm">
                  {profile?.full_name?.charAt(0) || "A"}
                </span>
              </div>
              <p className="text-sm font-medium text-foreground truncate">
                {profile?.full_name || "Admin"}
              </p>
            </div>

            {/* User Profile */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <Button variant="ghost" size="icon" className="relative h-8 w-8 sm:h-10 sm:w-10">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
              </Button>

              <div className="hidden sm:flex items-center gap-3">
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

              <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 sm:h-10 sm:w-10">
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-4 sm:p-8 overflow-auto">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-foreground mb-1">
                Rapports & Analyses
              </h1>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Performances de vos terrains
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <select className="px-3 py-2 rounded-lg border border-border bg-background text-xs sm:text-sm flex-1 sm:flex-none">
                <option>Ce mois</option>
                <option>Ce trimestre</option>
                <option>Cette année</option>
              </select>
              <Button className="bg-primary hover:bg-primary/90 text-xs sm:text-sm px-3 sm:px-4" onClick={handleExportReport}>
                <Download className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Exporter PDF</span>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            {canViewRevenue && (
              <StatsCard
                title="Revenus Total"
                value={`${stats.totalRevenue.toFixed(0)} USD`}
                subtitle={`${stats.soldParcelles} ventes réalisées`}
                icon={DollarSign}
                colorClass="bg-[hsl(160,84%,39%)]"
              />
            )}
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
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
                      <BarChart2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm">Aucune vente enregistrée</p>
                      <p className="text-xs mt-1">Les données apparaîtront après les premières ventes</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} onClick={(data) => {
                      if (data && data.activePayload && data.activePayload[0]) {
                        exportMonthlyPDF(data.activePayload[0].payload.sortKey);
                      }
                    }} style={{ cursor: 'pointer' }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="month" 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === "revenus") return [`${value.toLocaleString()} USD`, "Revenus"];
                          return [value, "Ventes"];
                        }}
                      />
                      <Bar dataKey="ventes" fill="hsl(217, 91%, 60%)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Performance par Hectare */}
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm sm:text-lg font-semibold text-foreground">
                  Performance par Hectare (Top 5)
                </h3>
              </div>
              <div className="h-48 sm:h-64">
                {hectareStats.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm">Aucune donnée disponible</p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={hectareStats.slice(0, 5)}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {hectareStats.slice(0, 5).map((_, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={[
                              "hsl(217, 91%, 60%)",
                              "hsl(160, 84%, 39%)",
                              "hsl(24, 95%, 53%)",
                              "hsl(271, 91%, 65%)",
                              "hsl(210, 40%, 50%)"
                            ][index % 5]} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px"
                        }}
                        formatter={(value: number) => `${value.toLocaleString()} USD`}
                      />
                      <Legend 
                        wrapperStyle={{ fontSize: "12px" }}
                        formatter={(value) => value.length > 15 ? value.substring(0, 15) + "..." : value}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
