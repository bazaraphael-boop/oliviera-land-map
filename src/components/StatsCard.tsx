import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StatsCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  colorClass: string;
}

const StatsCard = ({ title, value, subtitle, icon: Icon, colorClass }: StatsCardProps) => {
  return (
    <Card className={`p-3 sm:p-6 border-0 ${colorClass}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-white/80 text-[10px] sm:text-sm font-medium mb-1 sm:mb-2 truncate">{title}</p>
          <h3 className="text-white text-lg sm:text-3xl font-bold mb-0.5 sm:mb-1 truncate">{value}</h3>
          <p className="text-white/70 text-[9px] sm:text-xs truncate">{subtitle}</p>
        </div>
        <div className="bg-white/10 p-2 sm:p-3 rounded-lg shrink-0 ml-2">
          <Icon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;
