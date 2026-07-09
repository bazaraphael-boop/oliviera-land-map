import { useState, useMemo } from "react";
import { Check, ChevronDown, Search, AlertTriangle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
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
  /** Function to get occupancy data for a given hectare */
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

  const selected = hectares.find((h) => h.id === selectedId);

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

  const handleSelect = (id: string) => {
    onSelect(id);
    setOpen(false);
    setSearch("");
  };

  const getQuotaBadge = (id: string) => {
    if (!getOccupancy) return null;
    const { remaining, total } = getOccupancy(id);
    const pct = Math.round(((total - remaining) / total) * 100);
    if (remaining === 0)
      return { label: "Complet", color: "bg-red-500", text: "text-red-600", pct: 100 };
    if (remaining <= 3)
      return { label: `${remaining}/${total}`, color: "bg-orange-400", text: "text-orange-600", pct };
    return { label: `${remaining}/${total}`, color: "bg-emerald-500", text: "text-emerald-600", pct };
  };

  const selectedOcc = selected && getOccupancy ? getOccupancy(selected.id) : null;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-auto min-h-[44px] px-3 py-2 text-left font-normal",
              !selected && "text-muted-foreground"
            )}
          >
            {selected ? (
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-semibold text-sm text-foreground truncate">
                  {selected.name}
                </span>
                {selected.rmb_number && (
                  <span className="text-xs text-muted-foreground">
                    RMB {selected.rmb_number}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronDown
              className={cn(
                "ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                open && "rotate-180"
              )}
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 shadow-xl border border-border"
          align="start"
          sideOffset={4}
        >
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/30">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              placeholder="Rechercher un hectare..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 bg-transparent h-7 p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              autoFocus
            />
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Layers className="w-8 h-8 opacity-30" />
                <p className="text-sm">Aucun hectare trouvé</p>
              </div>
            ) : (
              filtered.map((h) => {
                const quota = getQuotaBadge(h.id);
                const isSelected = h.id === selectedId;
                const isFull = quota?.label === "Complet";

                return (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => !isFull && handleSelect(h.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : isFull
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-muted/60 cursor-pointer"
                    )}
                  >
                    {/* Left: check or icon */}
                    <div className="shrink-0 w-5 flex items-center justify-center">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : isFull ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : (
                        <Layers className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Center: name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {h.name}
                      </p>
                      {(h.rmb_number || h.location) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {[h.rmb_number && `RMB ${h.rmb_number}`, h.location]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}

                      {/* Quota bar */}
                      {quota && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full rounded-full transition-all", quota.color)}
                              style={{ width: `${quota.pct}%` }}
                            />
                          </div>
                          <span className={cn("text-[10px] font-bold shrink-0", quota.text)}>
                            {quota.label} libre{quota.label !== "Complet" ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer count */}
          <div className="border-t border-border px-3 py-1.5 bg-muted/20">
            <p className="text-[10px] text-muted-foreground">
              {filtered.length} hectare{filtered.length > 1 ? "s" : ""} affiché
              {filtered.length > 1 ? "s" : ""}
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Quota summary after selection */}
      {selectedOcc && (
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm",
            selectedOcc.remaining === 0
              ? "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400"
              : selectedOcc.remaining <= 3
              ? "bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
          )}
        >
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                selectedOcc.remaining === 0
                  ? "bg-red-500"
                  : selectedOcc.remaining <= 3
                  ? "bg-orange-400"
                  : "bg-emerald-500"
              )}
              style={{
                width: `${Math.round(
                  ((selectedOcc.total - selectedOcc.remaining) / selectedOcc.total) * 100
                )}%`,
              }}
            />
          </div>
          <span className="font-semibold shrink-0">
            {selectedOcc.remaining === 0 ? (
              "Hectare complet"
            ) : (
              <>
                {selectedOcc.remaining}{" "}
                <span className="font-normal">
                  parcelle{selectedOcc.remaining > 1 ? "s" : ""} disponible
                  {selectedOcc.remaining > 1 ? "s" : ""} sur {selectedOcc.total}
                </span>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
