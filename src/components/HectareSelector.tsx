import { useState, useMemo, useRef, useEffect } from "react";
import { Check, ChevronDown, Search, AlertTriangle, Layers, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Hectare {
  id: string;
  name: string;
  rmb_number?: string | null;
  location?: string | null;
}

interface HectareSelectorProps {
  hectares: Hectare[];
  selectedId: string;
  onSelect: (id: string) => void;
  getOccupancy?: (id: string) => { occupied: number; remaining: number; total: number };
  placeholder?: string;
  disabled?: boolean;
}

export function HectareSelector({
  hectares,
  selectedId,
  onSelect,
  getOccupancy,
  placeholder = "Sélectionner un hectare",
  disabled = false,
}: HectareSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = hectares.find((h) => h.id === selectedId);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return hectares;
    return hectares.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        h.rmb_number?.toLowerCase().includes(q) ||
        h.location?.toLowerCase().includes(q)
    );
  }, [hectares, search]);

  const getQuota = (id: string) => {
    if (!getOccupancy) return null;
    const { remaining, total } = getOccupancy(id);
    const pct = Math.round(((total - remaining) / total) * 100);
    if (remaining === 0) return { label: "Complet", barColor: "bg-red-500", textColor: "text-red-600 dark:text-red-400", pct };
    if (remaining <= 3) return { label: `${remaining}/${total} libres`, barColor: "bg-orange-400", textColor: "text-orange-600 dark:text-orange-400", pct };
    return { label: `${remaining}/${total} libres`, barColor: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400", pct };
  };

  const selectedQuota = selected && getOccupancy ? getOccupancy(selected.id) : null;

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setSearch("");
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setOpen((prev) => !prev);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-md border border-input bg-background text-sm text-left transition-colors",
          "hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          disabled && "opacity-50 cursor-not-allowed",
          open && "border-primary ring-2 ring-primary/20"
        )}
      >
        {selected ? (
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <span className="font-semibold text-sm text-foreground truncate leading-tight">
              {selected.name}
            </span>
            {(selected.rmb_number || selected.location) && (
              <span className="text-xs text-muted-foreground truncate leading-tight">
                {[selected.rmb_number && `RMB ${selected.rmb_number}`, selected.location]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground flex-1">{placeholder}</span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {selected && (
            <span
              role="button"
              onClick={(e) => { e.stopPropagation(); handleSelect(""); }}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>

      {/* Dropdown list */}
      {open && (
        <div
          className="absolute z-[9999] top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-2xl overflow-hidden"
          style={{ minWidth: "100%" }}
        >
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Rechercher un hectare..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground text-foreground"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Items */}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Layers className="w-7 h-7 opacity-30" />
                <p className="text-sm">Aucun hectare trouvé</p>
              </div>
            ) : (
              filtered.map((h) => {
                const quota = getQuota(h.id);
                const isSelected = h.id === selectedId;
                const isFull = quota?.label === "Complet";

                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!isFull) handleSelect(h.id);
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "bg-primary/10"
                        : isFull
                        ? "opacity-40 cursor-not-allowed"
                        : "hover:bg-muted/60 cursor-pointer"
                    )}
                  >
                    {/* Icon */}
                    <div className="shrink-0 mt-0.5 w-4 flex items-center justify-center">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : isFull ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-semibold truncate leading-tight", isSelected ? "text-primary" : "text-foreground")}>
                        {h.name}
                      </p>
                      {(h.rmb_number || h.location) && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {[h.rmb_number && `RMB ${h.rmb_number}`, h.location].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      {/* Quota bar */}
                      {quota && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", quota.barColor)}
                              style={{ width: `${quota.pct}%` }}
                            />
                          </div>
                          <span className={cn("text-[10px] font-bold shrink-0", quota.textColor)}>
                            {quota.label}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-3 py-1.5 bg-muted/20">
            <p className="text-[10px] text-muted-foreground">
              {filtered.length} hectare{filtered.length > 1 ? "s" : ""} · Cliquez pour sélectionner
            </p>
          </div>
        </div>
      )}

      {/* Quota summary after selection */}
      {selectedQuota && selected && (
        <div
          className={cn(
            "flex items-center gap-3 mt-2 px-3 py-2 rounded-lg border text-sm",
            selectedQuota.remaining === 0
              ? "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
              : selectedQuota.remaining <= 3
              ? "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
          )}
        >
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                selectedQuota.remaining === 0 ? "bg-red-500" : selectedQuota.remaining <= 3 ? "bg-orange-400" : "bg-emerald-500"
              )}
              style={{ width: `${Math.round(((selectedQuota.total - selectedQuota.remaining) / selectedQuota.total) * 100)}%` }}
            />
          </div>
          <span className="font-semibold shrink-0 text-xs">
            {selectedQuota.remaining === 0 ? (
              "Hectare complet !"
            ) : (
              <>{selectedQuota.remaining} parcelle{selectedQuota.remaining > 1 ? "s" : ""} libre{selectedQuota.remaining > 1 ? "s" : ""} sur {selectedQuota.total}</>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
