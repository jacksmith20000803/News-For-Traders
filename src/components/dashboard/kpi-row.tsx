import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  label: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  icon?: React.ReactNode;
}

function KPICard({ label, value, change, changePositive, icon }: KPICardProps) {
  return (
    <div className="dash-panel p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <span className="text-xs sm:text-sm text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
          {icon && <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 text-primary shadow-lg shadow-primary/20">{icon}</div>}
        </div>
        <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">{value}</p>
        {change && (
          <div className={cn(
            "flex items-center gap-1 mt-2 text-xs sm:text-sm font-medium",
            changePositive ? "text-success" : "text-error"
          )}>
            {changePositive ? <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4" />}
            {change}
          </div>
        )}
      </div>
    </div>
  );
}

export function KPIRow() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
      <KPICard
        label="Portfolio Value"
        value="$124,532.00"
        change="+2.4%"
        changePositive={true}
        icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
      />
      <KPICard
        label="Daily P&L"
        value="+$2,891.00"
        change="+2.4%"
        changePositive={true}
        icon={<TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-success" />}
      />
      <KPICard
        label="Total Gain"
        value="+$24,532.00"
        change="+24.5%"
        changePositive={true}
        icon={<Activity className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />}
      />
      <KPICard
        label="Available Balance"
        value="$15,000.00"
        icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />}
      />
      <KPICard
        label="Market Status"
        value="LIVE"
        icon={<div className="h-2 w-2 rounded-full bg-success animate-pulse" />}
      />
    </div>
  );
}
