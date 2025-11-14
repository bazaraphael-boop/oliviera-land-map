import { MapPin, Home, Map, Grid3x3, Navigation, BarChart3, FileText, Settings, Users, ShoppingCart } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const menuItems = [
  { icon: Home, label: "Tableau de Bord", path: "/dashboard" },
  { icon: Map, label: "Hectares", path: "/hectares" },
  { icon: Grid3x3, label: "Parcelles", path: "/parcelles" },
  { icon: ShoppingCart, label: "Acheteurs", path: "/acheteurs" },
  { icon: Navigation, label: "Localisation du Terrain", path: "/localisation" },
  { icon: BarChart3, label: "Rapports", path: "/rapports" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: Settings, label: "Paramètres", path: "/parametres" },
  { icon: Users, label: "Utilisateurs", path: "/utilisateurs" },
];

const DashboardSidebar = () => {
  const location = useLocation();

  return (
    <aside className="w-64 bg-card min-h-screen flex flex-col border-r border-border">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <MapPin className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-foreground font-bold text-base leading-tight">Concession</h1>
            <h2 className="text-foreground font-bold text-base leading-tight">d'Oliveira</h2>
            <p className="text-muted-foreground text-xs mt-0.5">Gestion Pro</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
};

export default DashboardSidebar;
