import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone,
  Edit2,
  ChevronRight,
  MoreHorizontal,
  SlidersHorizontal,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";

interface Acheteur {
  id: string;
  buyer_name: string;
  buyer_phone: string | null;
  buyer_email: string | null;
  parcelles: any[];
  hectares: any[];
  totalAchat: number;
  nombreParcelles: number;
  nombreHectares: number;
  paper_form_completed: boolean;
  documents_count?: number;
  has_documents?: boolean;
}

interface BuyerCardProps {
  acheteur: Acheteur;
  onShowDetails: () => void;
  onEdit: () => void;
  onTogglePaperForm: () => void;
  onEditQuota?: () => void;
  onDelete?: () => void;
}

/** Nombre maximum de lots affichés avant le "+N" */
const MAX_VISIBLE_LOTS = 4;

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function BuyerCard({
  acheteur,
  onShowDetails,
  onEdit,
  onTogglePaperForm,
  onEditQuota,
  onDelete,
}: BuyerCardProps) {
  const isItemPending = (item: { sale_type?: string | null }) =>
    item.sale_type === "a_renseigner" || !item.sale_type;

  const totalItemsCount = acheteur.parcelles.length + acheteur.hectares.length;
  const isAllPending =
    totalItemsCount > 0 &&
    (acheteur.parcelles.length === 0 || acheteur.parcelles.every(isItemPending)) &&
    (acheteur.hectares.length === 0 || acheteur.hectares.every(isItemPending));
  const hasPendingSale =
    acheteur.parcelles.some(isItemPending) || acheteur.hectares.some(isItemPending);

  // Liste unifiée des lots (parcelles + hectares), libellé court
  const lots = [
    ...acheteur.parcelles
      .filter((p) => p.numero || p.rmb_number)
      .map((p) => {
        const n = p.nombreParcelles || Math.max(1, Math.ceil(Number(p.surface || 600) / 600));
        return {
          label: p.rmb_number || p.numero,
          extra: n > 1 ? `${n} p.` : null,
          pending: isItemPending(p),
        };
      }),
    ...acheteur.hectares
      .filter((h) => h.name || h.rmb_number)
      .map((h) => ({
        label: h.rmb_number || h.name,
        extra: `${Number(h.surface || 1)} ha`,
        pending: isItemPending(h),
      })),
  ];
  const visibleLots = lots.slice(0, MAX_VISIBLE_LOTS);
  const hiddenLotsCount = lots.length - visibleLots.length;

  // Un seul indicateur de statut, par ordre de priorité
  const status = !acheteur.has_documents
    ? { dot: "bg-red-500", text: "Sans document", cls: "text-red-600 dark:text-red-400" }
    : hasPendingSale
    ? { dot: "bg-amber-500", text: "Vente à renseigner", cls: "text-amber-700 dark:text-amber-400" }
    : {
        dot: "bg-emerald-500",
        text: `${acheteur.documents_count} doc${(acheteur.documents_count || 0) > 1 ? "s" : ""}`,
        cls: "text-muted-foreground",
      };

  const summary = [
    acheteur.nombreParcelles > 0
      ? `${acheteur.nombreParcelles} parcelle${acheteur.nombreParcelles > 1 ? "s" : ""}`
      : null,
    acheteur.nombreHectares > 0 ? `${acheteur.nombreHectares} ha` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card
      className="group bg-card hover:border-primary/40 transition-colors cursor-pointer"
      onClick={onShowDetails}
    >
      <div className="flex items-center gap-3 p-3 sm:px-4">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
          {getInitials(acheteur.buyer_name) || "?"}
        </div>

        {/* Identité + lots */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-sm text-foreground truncate">{acheteur.buyer_name}</h3>
            <span className={`flex items-center gap-1.5 text-xs shrink-0 ${status.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.text}
            </span>
          </div>

          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-muted-foreground">
            {acheteur.buyer_phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {acheteur.buyer_phone}
              </span>
            )}
            {visibleLots.length > 0 && (
              <span className="flex items-center gap-1 flex-wrap">
                {visibleLots.map((l, i) => (
                  <span
                    key={i}
                    className={`px-1.5 py-0.5 rounded bg-muted font-mono text-[11px] ${
                      l.pending ? "text-amber-700 dark:text-amber-400" : "text-foreground/80"
                    }`}
                  >
                    {l.label}
                    {l.extra && <span className="opacity-60"> · {l.extra}</span>}
                  </span>
                ))}
                {hiddenLotsCount > 0 && (
                  <span className="text-[11px] text-muted-foreground">+{hiddenLotsCount}</span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Résumé chiffré */}
        <div className="hidden md:block text-right shrink-0">
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {isAllPending ? "—" : `${acheteur.totalAchat.toLocaleString("fr-FR")} USD`}
          </p>
          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>

        {/* Actions : une seule icône visible + menu */}
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Actions">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="w-4 h-4 mr-2" />
                Modifier les coordonnées
              </DropdownMenuItem>
              {onEditQuota && (
                <DropdownMenuItem onClick={onEditQuota}>
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Modifier le quota
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onTogglePaperForm}>
                {acheteur.paper_form_completed ? (
                  <CheckSquare className="w-4 h-4 mr-2 text-emerald-600" />
                ) : (
                  <Square className="w-4 h-4 mr-2" />
                )}
                Fiche papier complétée
              </DropdownMenuItem>
              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </Card>
  );
}