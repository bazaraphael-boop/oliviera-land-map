import { useState } from "react";
import { MapPin, Menu, LogOut } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import NotificationBell from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { homeItem, processSteps, toolItems, adminItems, type NavItem } from "@/lib/navigation";
import { InstallAppButton } from "./InstallAppButton";

const SimpleLink = ({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) => (
  <Link
    to={item.path}
    onClick={onNavigate}
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
      active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
    )}
  >
    <item.icon className="w-4 h-4 shrink-0" />
    <span className="truncate">{item.label}</span>
  </Link>
);

const GroupLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
    {children}
  </p>
);

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const currentStep = processSteps.findIndex((s) => s.path === pathname);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    onNavigate?.();
    navigate("/");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 sm:p-5 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary shrink-0">
              <MapPin className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-foreground font-bold text-sm leading-tight truncate">Concession d'Oliveira</h1>
              <p className="text-muted-foreground text-xs mt-0.5">Gestion foncière · Muanda</p>
            </div>
          </div>
          <div className="hidden lg:block">
            <NotificationBell />
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto space-y-5">
        {/* Accueil */}
        <SimpleLink item={homeItem} active={pathname === homeItem.path} onNavigate={onNavigate} />

        {/* Parcours de vente */}
        <div>
          <GroupLabel>Parcours de vente</GroupLabel>
          <ol className="relative">
            {processSteps.map((step, i) => {
              const active = i === currentStep;
              const done = currentStep > i;
              const isLast = i === processSteps.length - 1;
              return (
                <li key={step.path} className="relative">
                  {!isLast && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-[1.45rem] top-9 bottom-[-0.25rem] w-px",
                        done ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                  <Link
                    to={step.path}
                    onClick={onNavigate}
                    className={cn(
                      "relative flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                      active ? "bg-primary/10" : "hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "relative z-10 flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold shrink-0 border",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : done
                          ? "bg-primary/15 text-primary border-primary/40"
                          : "bg-card text-muted-foreground border-border"
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-sm font-medium truncate",
                          active ? "text-primary" : "text-foreground"
                        )}
                      >
                        {step.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground truncate">{step.hint}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Outils terrain */}
        <div>
          <GroupLabel>Outils terrain</GroupLabel>
          <div className="space-y-1">
            {toolItems.map((item) => (
              <SimpleLink key={item.path} item={item} active={pathname === item.path} onNavigate={onNavigate} />
            ))}
          </div>
        </div>

        {/* Administration */}
        <div>
          <GroupLabel>Administration</GroupLabel>
          <div className="space-y-1">
            {adminItems.map((item) => (
              <SimpleLink key={item.path} item={item} active={pathname === item.path} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <InstallAppButton />
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </div>
  );
};

const DashboardSidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile: top bar + drawer */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[290px] p-0">
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

      <div className="lg:hidden h-[60px]" />

      {/* Desktop */}
      <aside className="hidden lg:flex w-64 bg-card h-screen flex-col border-r border-border sticky top-0 shrink-0">
        <SidebarContent />
      </aside>
    </>
  );
};

export default DashboardSidebar;
