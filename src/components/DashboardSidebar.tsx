import { useState } from "react";
import { MapPin, Home, Map, Grid3x3, Navigation, BarChart3, FileText, Settings, Users, ShoppingCart, Building2, Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import NotificationBell from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const menuItems = [
  { icon: Home, label: "Tableau de Bord", path: "/dashboard" },
  { icon: Building2, label: "Sites", path: "/sites" },
  { icon: Map, label: "Hectares", path: "/hectares" },
  { icon: Grid3x3, label: "Parcelles", path: "/parcelles" },
  { icon: ShoppingCart, label: "Acheteurs", path: "/acheteurs" },
  { icon: BarChart3, label: "Rapports", path: "/rapports" },
  { icon: FileText, label: "Documents", path: "/documents" },
  { icon: Settings, label: "Paramètres", path: "/parametres" },
  { icon: Users, label: "Utilisateurs", path: "/utilisateurs" },
];

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full">
      {/* Logo and Notification */}
      <div className="p-4 sm:p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
              <MapPin className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-foreground font-bold text-sm sm:text-base leading-tight truncate">Concession</h1>
              <h2 className="text-foreground font-bold text-sm sm:text-base leading-tight truncate">d'Oliveira</h2>
              <p className="text-muted-foreground text-xs mt-0.5">Gestion Pro</p>
            </div>
          </div>
          <NotificationBell />
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-3 sm:p-4 overflow-y-auto">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <li key={item.path}>
                <Link
                  to={item.path}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
};

const DashboardSidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile: Sheet drawer */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-0">
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary">
            <MapPin className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm text-foreground">Concession MJO</span>
        </div>

        <NotificationBell />
      </div>

      {/* Mobile: spacer for fixed header */}
      <div className="lg:hidden h-[60px]" />

      {/* Desktop: fixed sidebar */}
      <aside className="hidden lg:flex w-64 bg-card min-h-screen flex-col border-r border-border sticky top-0">
        <SidebarContent />
      </aside>
    </>
  );
};

export default DashboardSidebar;
