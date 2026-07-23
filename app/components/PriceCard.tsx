interface PriceCardProps {
  title: string;
  usdPrice?: number;
  pkrPrice?: number;
  change?: number;
  changePercent?: number;
  lastUpdated: string;
  isLoading?: boolean;
  error?: string;
  currency?: 'PKR' | 'USD';
}

export default function PriceCard({
  title,
  usdPrice,
  pkrPrice,
  change = 0,
  changePercent = 0,
  lastUpdated,
  isLoading = false,
  error,
  currency = 'PKR',
}: PriceCardProps) {
  const isPositive = (changePercent || 0) >= 0;
  const exchangeRate = (pkrPrice && usdPrice) ? pkrPrice / usdPrice : 280;
  const displayPrice = currency === 'PKR' ? pkrPrice : usdPrice;
  const displayChange = currency === 'PKR' ? change * exchangeRate : change;
  const currencySymbol = currency === 'PKR' ? 'Rs.' : '$';

  return (
    <div className="group h-full flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-[2rem] p-4 sm:p-6 shadow-sm hover:shadow-2xl transition-all duration-500 relative overflow-hidden">
      {/* Decorative background element */}
      <div className={`absolute top-0 right-0 w-32 h-32 opacity-[0.03] dark:opacity-[0.05] rounded-bl-full translate-x-12 -translate-y-12 transition-transform duration-700 group-hover:scale-150 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}></div>

      <div className="relative z-10 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-3 sm:mb-6">
          <div className="space-y-1">
            <h3 className="text-sm sm:text-xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter uppercase italic leading-tight">
              {title}
            </h3>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full animate-pulse ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Live</span>
            </div>
          </div>
          {!isLoading && !error && (
            <div className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-tighter ${isPositive ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(changePercent).toFixed(2)}%
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-12 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-2xl w-full"></div>
            <div className="h-4 bg-zinc-100 dark:bg-zinc-800 animate-pulse rounded-lg w-2/3"></div>
          </div>
        ) : error ? (
          <div className="py-8 text-center bg-red-50/50 dark:bg-red-900/10 rounded-3xl border border-red-100/50 dark:border-red-900/20">
            <p className="text-red-500 text-xs font-black uppercase tracking-widest">Connection Interrupted</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4 flex-1 flex flex-col">
            <div>
              <div className="flex items-baseline gap-1.5 sm:gap-2">
                <span className="text-base sm:text-xl font-medium text-zinc-400 shrink-0">{currencySymbol}</span>
                <span className="text-xl sm:text-2xl lg:text-3xl font-black text-zinc-900 dark:text-zinc-50 tracking-tighter font-mono tabular-nums break-words min-w-0">
                  {(displayPrice || 0).toLocaleString(undefined, {
                    minimumFractionDigits: (displayPrice || 0) < 10 ? 4 : 2,
                    maximumFractionDigits: (displayPrice || 0) < 10 ? 4 : 2
                  })}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <p className={`text-sm font-black italic tracking-tight ${displayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {displayChange >= 0 ? '+' : ''}
                  {(displayChange || 0).toLocaleString(undefined, {
                    minimumFractionDigits: (displayPrice || 0) < 10 ? 4 : 2,
                    maximumFractionDigits: (displayPrice || 0) < 10 ? 4 : 2
                  })}
                </p>
                {/* <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Since Open</span> */}
              </div>
            </div>

            {/* Footer hidden on mobile to keep cards short (time is in the page header) */}
            <div className="mt-auto pt-3 sm:pt-6 border-t border-zinc-100 dark:border-zinc-800 hidden sm:flex justify-between items-center">
              <div className="space-y-0.5">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">Market Refresh</p>
                <p className="text-[10px] font-bold text-zinc-900 dark:text-zinc-50">{lastUpdated}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
