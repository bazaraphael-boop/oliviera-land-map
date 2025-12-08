import { Card } from "@/components/ui/card";
import { Users, DollarSign, MapPin, TrendingUp } from "lucide-react";

interface BuyerStatsCardsProps {
  totalAcheteurs: number;
  totalRevenu: number;
  totalParcelles: number;
  totalHectares: number;
}

export function BuyerStatsCards({ totalAcheteurs, totalRevenu, totalParcelles, totalHectares }: BuyerStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card className="p-4 sm:p-5 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {totalAcheteurs}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Acheteurs</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-5 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <p className="text-lg sm:text-2xl font-bold text-foreground">
              <span className="hidden sm:inline">{totalRevenu.toLocaleString()}</span>
              <span className="sm:hidden">{(totalRevenu / 1000).toFixed(0)}K</span>
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              <span className="hidden sm:inline">USD Revenus</span>
              <span className="sm:hidden">USD</span>
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-5 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {totalParcelles}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Parcelles</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 sm:p-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/20 hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-foreground">
              {totalHectares}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">Hectares</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
