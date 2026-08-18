import FitText from "./FitText";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  change?: number;
  changeLabel?: string;
  href?: string;
  compact?: boolean;
}

export default function StatCard({
  label,
  value,
  icon,
  change,
  changeLabel,
  href,
  compact = false,
}: StatCardProps) {
  const isPositive = change !== undefined ? change >= 0 : true;

  const card = (
    <div className={`group h-full bg-white dark:bg-zinc-900/50 backdrop-blur-xl ${compact ? "rounded-2xl p-3 sm:rounded-3xl sm:p-6" : "rounded-3xl p-4 sm:p-6"} border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300`}>
      <div className={`flex items-center justify-between gap-2 ${compact ? "mb-2 sm:mb-4" : "mb-4"}`}>
        <div className={`${compact ? "w-8 h-8 rounded-xl sm:w-12 sm:h-12 sm:rounded-2xl" : "w-10 h-10 sm:w-12 sm:h-12 rounded-2xl"} bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={`${compact ? "px-2 py-0.5 text-[9px] sm:px-3 sm:py-1 sm:text-xs" : "px-3 py-1 text-xs"} rounded-full font-black tracking-tighter ${isPositive
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
          >
            {isPositive ? "↑" : "↓"} {Math.abs(change).toFixed(2)}%
          </div>
        )}
      </div>
      <div>
        <p className={`${compact ? "text-[8px] sm:text-[10px] tracking-[0.12em]" : "text-[10px] tracking-[0.2em]"} text-zinc-500 dark:text-zinc-400 font-black uppercase mb-1 truncate`}>
          {label}
        </p>
        <FitText
          className={`${compact ? "text-lg sm:text-3xl" : "text-2xl sm:text-3xl"} font-black text-zinc-900 dark:text-zinc-50 tracking-tighter font-mono italic`}
          title={String(value)}
        >
          {value}
        </FitText>
        {changeLabel && (
          <p className={`${compact ? "text-[8px] sm:text-[10px] mt-1 sm:mt-2" : "text-[10px] mt-2"} font-bold text-zinc-400 flex items-center gap-1.5 truncate`}>
            <span className="w-1 h-1 rounded-full bg-blue-500"></span>
            {changeLabel}
          </p>
        )}
      </div>
    </div>
  );

  return href ? <Link href={href} className="block h-full min-w-0" aria-label={`Open ${label}`}>{card}</Link> : card;
}
