import { Card } from "@/components/ui/card";
import { Users, DollarSign, MapPin, LandPlot } from "lucide-react";

interface BuyerStatsCardsProps {
  totalAcheteurs: number;
  totalRevenu: number;
  totalParcelles: number;
  totalHectares: number;
}

export function BuyerStatsCards({ totalAcheteurs, totalRevenu, totalParcelles, totalHectares }: BuyerStatsCardsProps) {
  const stats = [
    { label: "Acheteurs", value: totalAcheteurs, icon: Users, color: "from-primary/20 to-primary/5", iconColor: "text-primary", bgColor: "bg-primary/10" },
    { label: "Revenus", value: `${totalRevenu.toLocaleString()}`, suffix: "USD", icon: DollarSign, color: "from-emerald-500/20 to-emerald-500/5", iconColor: "text-emerald-600", bgColor: "bg-emerald-500/10" },
    { label: "Parcelles", value: totalParcelles, icon: MapPin, color: "from-blue-500/20 to-blue-500/5", iconColor: "text-blue-600", bgColor: "bg-blue-500/10" },
    { label: "Hectares", value: totalHectares, icon: LandPlot, color: "from-amber-500/20 to-amber-500/5", iconColor: "text-amber-600", bgColor: "bg-amber-500/10" }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className={`p-2.5 sm:p-4 bg-gradient-to-br ${stat.color} border-0 shadow-sm`}>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl ${stat.bgColor} flex items-center justify-center shrink-0`}>
              <stat.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${stat.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base sm:text-xl lg:text-2xl font-bold text-foreground truncate">
                {stat.value}
                {stat.suffix && <span className="text-[10px] sm:text-sm font-normal text-muted-foreground ml-0.5 sm:ml-1">{stat.suffix}</span>}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{stat.label}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}