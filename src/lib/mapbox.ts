// Token public Mapbox (pk.*) : il est de toute façon visible dans le navigateur.
// Le restreindre aux domaines de l'application dans le compte Mapbox.
export const MAPBOX_TOKEN: string = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

if (!MAPBOX_TOKEN) {
  console.warn("VITE_MAPBOX_TOKEN manquant : la carte ne pourra pas s'afficher.");
}
