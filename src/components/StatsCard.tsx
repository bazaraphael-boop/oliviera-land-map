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
    <Card className={`p-6 border-0 ${colorClass}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/80 text-sm font-medium mb-2">{title}</p>
          <h3 className="text-white text-3xl font-bold mb-1">{value}</h3>
          <p className="text-white/70 text-xs">{subtitle}</p>
        </div>
        <div className="bg-white/10 p-3 rounded-lg">
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </Card>
  );
};

export default StatsCard;
