import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { findRoute, processSteps, sectionLabels, homeItem } from "@/lib/navigation";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * En-tête uniforme pour toutes les pages : fil d'Ariane, titre, description,
 * actions, et — pour les étapes du parcours de vente — un mini-stepper
 * avec liens vers l'étape précédente / suivante.
 */
const PageHeader = ({ title, description, actions, className }: PageHeaderProps) => {
  const { pathname } = useLocation();
  const route = findRoute(pathname);
  const stepIndex = route?.stepIndex ?? -1;
  const isStep = stepIndex >= 0;
  const prev = isStep && stepIndex > 0 ? processSteps[stepIndex - 1] : null;
  const next = isStep && stepIndex < processSteps.length - 1 ? processSteps[stepIndex + 1] : null;

  return (
    <header className={cn("mb-6 space-y-4", className)}>
      {/* Fil d'Ariane */}
      <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <Link to={homeItem.path} className="hover:text-foreground transition-colors">
          Accueil
        </Link>
        {route && route.section !== "home" && (
          <>
            <ChevronRight className="w-3 h-3" />
            <span>{sectionLabels[route.section]}</span>
          </>
        )}
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">
          {isStep ? `Étape ${stepIndex + 1} · ` : ""}
          {route?.item.shortLabel ?? route?.item.label ?? title}
        </span>
      </nav>

      {/* Titre + actions */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* Mini-stepper du parcours */}
      {isStep && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-2">
          {prev ? (
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 shrink-0">
              <Link to={prev.path} title={`Étape précédente : ${prev.label}`}>
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden md:inline ml-1">{prev.shortLabel ?? prev.label}</span>
              </Link>
            </Button>
          ) : (
            <span className="w-8 shrink-0" />
          )}

          <ol className="flex-1 flex items-center justify-center gap-1 overflow-x-auto">
            {processSteps.map((s, i) => {
              const active = i === stepIndex;
              const done = i < stepIndex;
              return (
                <li key={s.path} className="flex items-center gap-1 shrink-0">
                  <Link
                    to={s.path}
                    title={s.label}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : done
                        ? "text-primary hover:bg-primary/10"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold",
                        active ? "bg-primary-foreground/20" : done ? "bg-primary/15" : "bg-muted"
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className={cn(active ? "inline" : "hidden xl:inline")}>{s.shortLabel ?? s.label}</span>
                  </Link>
                  {i < processSteps.length - 1 && (
                    <span className={cn("h-px w-3 sm:w-5", done ? "bg-primary" : "bg-border")} />
                  )}
                </li>
              );
            })}
          </ol>

          {next ? (
            <Button asChild variant="ghost" size="sm" className="h-8 px-2 shrink-0">
              <Link to={next.path} title={`Étape suivante : ${next.label}`}>
                <span className="hidden md:inline mr-1">{next.shortLabel ?? next.label}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          ) : (
            <span className="w-8 shrink-0" />
          )}
        </div>
      )}
    </header>
  );
};

export default PageHeader;
