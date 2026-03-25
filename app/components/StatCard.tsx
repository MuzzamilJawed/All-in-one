interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  change?: number;
  changeLabel?: string;
}

export default function StatCard({
  label,
  value,
  icon,
  change,
  changeLabel,
}: StatCardProps) {
  const isPositive = change ? change >= 0 : true;

  return (
    <div className="group bg-white dark:bg-zinc-900/50 backdrop-blur-xl rounded-3xl p-6 border border-zinc-200/50 dark:border-zinc-800/50 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-2xl group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={`px-3 py-1 rounded-full text-xs font-black tracking-tighter ${isPositive
                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-red-500/10 text-red-600 dark:text-red-400"
              }`}
          >
            {isPositive ? "↑" : "↓"} {Math.abs(change).toFixed(2)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
          {label}
        </p>
        <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter font-mono italic">
          {value}
        </p>
        {changeLabel && (
          <p className="text-[10px] font-bold text-zinc-400 mt-2 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-blue-500"></span>
            {changeLabel}
          </p>
        )}
      </div>
    </div>
  );
}
