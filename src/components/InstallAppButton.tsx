import { useState } from "react";
import { MonitorDown } from "lucide-react";
import { InstallAppModal } from "./InstallAppModal";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { cn } from "@/lib/utils";

interface InstallAppButtonProps {
  className?: string;
  variant?: "sidebar" | "header" | "button";
}

export function InstallAppButton({ className, variant = "sidebar" }: InstallAppButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const { isInstalled } = usePwaInstall();

  if (variant === "sidebar") {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all group",
            isInstalled
              ? "text-muted-foreground bg-muted/40 hover:bg-muted/60"
              : "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 shadow-sm",
            className
          )}
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className={cn(
              "p-1.5 rounded-md text-white shrink-0 group-hover:scale-105 transition-transform",
              isInstalled ? "bg-muted-foreground" : "bg-emerald-600"
            )}>
              <MonitorDown className="w-3.5 h-3.5" />
            </div>
            <div className="flex flex-col text-left truncate">
              <span className="truncate leading-tight">
                {isInstalled ? "Appli sur le bureau" : "Ajouter sur le bureau"}
              </span>
              <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                {isInstalled ? "Déjà installée (1-clic)" : "Accès direct Windows/Mac"}
              </span>
            </div>
          </div>

          {!isInstalled && (
            <span className="flex h-2 w-2 relative shrink-0 mr-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          )}
        </button>

        <InstallAppModal open={modalOpen} onOpenChange={setModalOpen} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-sm",
          className
        )}
      >
        <MonitorDown className="w-4 h-4" />
        <span>Installer sur le bureau</span>
      </button>

      <InstallAppModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
