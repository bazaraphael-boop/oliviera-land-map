interface BuyerStatsCardsProps {
  totalAcheteurs: number;
  totalRevenu: number;
  totalParcelles: number;
  totalHectares: number;
  missingDocsCount?: number;
  onFilterMissingDocs?: () => void;
}

/**
 * Bandeau de statistiques compact et sobre (une seule ligne, sans couleurs vives).
 * Le compteur "sans document" est géré par les filtres, il n'est donc plus dupliqué ici.
 */
export function BuyerStatsCards({
  totalAcheteurs,
  totalRevenu,
  totalParcelles,
  totalHectares,
}: BuyerStatsCardsProps) {
  const stats = [
    { label: "Acheteurs", value: totalAcheteurs.toLocaleString("fr-FR") },
    { label: "Revenus", value: `${totalRevenu.toLocaleString("fr-FR")} USD` },
    { label: "Parcelles", value: totalParcelles.toLocaleString("fr-FR") },
    { label: "Hectares", value: Number(totalHectares.toFixed(2)).toLocaleString("fr-FR") },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-border bg-card divide-y sm:divide-y-0 sm:divide-x divide-border">
      {stats.map((stat) => (
        <div key={stat.label} className="px-4 py-3 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{stat.label}</p>
          <p className="text-lg font-semibold text-foreground truncate" title={stat.value}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}