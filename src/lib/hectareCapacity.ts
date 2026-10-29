// Règle cadastrale : 1 hectare = 15 parcelles de 600 m², au prorata de la
// surface réellement vendue (un demi-hectare = 8 parcelles).
export const PARCELLES_PER_HA = 15;
export const DEMI_HECTARE_CAPACITY = 8;

type HectareLike = {
  surface?: number | string | null;
  purchase_type?: string | null;
};

// La surface d'un hectare est stockée en ha (0.5, 1) ou parfois en m² (5000).
export const hectareSurfaceHa = (surface: HectareLike["surface"]): number => {
  const raw = Number(surface ?? 1);
  if (!raw || raw <= 0) return 1;
  return raw >= 100 ? raw / 10000 : raw;
};

export const hectareCapacity = (hectare: HectareLike | null | undefined): number => {
  if (!hectare) return PARCELLES_PER_HA;
  if (hectare.purchase_type === "demi-hectare") return DEMI_HECTARE_CAPACITY;
  return Math.max(1, Math.round(hectareSurfaceHa(hectare.surface) * PARCELLES_PER_HA));
};
