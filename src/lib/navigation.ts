import {
  Home,
  Building2,
  Map,
  Grid3x3,
  ShoppingCart,
  FileText,
  BarChart3,
  Navigation,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  shortLabel?: string;
  path: string;
  icon: LucideIcon;
  hint?: string;
}

/** Accueil */
export const homeItem: NavItem = {
  label: "Tableau de bord",
  path: "/dashboard",
  icon: Home,
  hint: "Vue d'ensemble",
};

/** Parcours de vente : l'ordre reflète le processus réel */
export const processSteps: NavItem[] = [
  { label: "Sites", path: "/sites", icon: Building2, hint: "Créer les zones foncières" },
  { label: "Hectares", path: "/hectares", icon: Map, hint: "Découper chaque site" },
  { label: "Parcelles", path: "/parcelles", icon: Grid3x3, hint: "Attribuer les emplacements" },
  { label: "Acheteurs & paiements", shortLabel: "Acheteurs", path: "/acheteurs", icon: ShoppingCart, hint: "Suivre clients et versements" },
  { label: "Documents", path: "/documents", icon: FileText, hint: "Archiver les pièces" },
  { label: "Rapports", path: "/rapports", icon: BarChart3, hint: "Analyser les ventes" },
];

export const toolItems: NavItem[] = [
  { label: "Localisation & GPS", path: "/localisation", icon: Navigation, hint: "Carte et levé de terrain" },
];

export const adminItems: NavItem[] = [
  { label: "Utilisateurs", path: "/utilisateurs", icon: Users },
  { label: "Paramètres", path: "/parametres", icon: Settings },
];

export type Section = "home" | "process" | "tools" | "admin";

export const findRoute = (
  pathname: string
): { item: NavItem; section: Section; stepIndex: number } | null => {
  if (pathname === homeItem.path) return { item: homeItem, section: "home", stepIndex: -1 };
  const stepIndex = processSteps.findIndex((s) => s.path === pathname);
  if (stepIndex >= 0) return { item: processSteps[stepIndex], section: "process", stepIndex };
  const tool = toolItems.find((s) => s.path === pathname);
  if (tool) return { item: tool, section: "tools", stepIndex: -1 };
  const admin = adminItems.find((s) => s.path === pathname);
  if (admin) return { item: admin, section: "admin", stepIndex: -1 };
  return null;
};

export const sectionLabels: Record<Section, string> = {
  home: "Accueil",
  process: "Parcours de vente",
  tools: "Outils terrain",
  admin: "Administration",
};
