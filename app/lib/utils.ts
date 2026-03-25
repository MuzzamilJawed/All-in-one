// Utility functions for the app

export function formatPrice(price: number, currency: string = "Rs."): string {
  return `${currency} ${price.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function getPriceChangeColor(change: number): string {
  return change >= 0 ? "text-green-600" : "text-red-600";
}

export function getBackgroundColor(change: number): string {
  return change >= 0
    ? "bg-green-100 dark:bg-green-900"
    : "bg-red-100 dark:bg-red-900";
}

export function getTextColor(change: number): string {
  return change >= 0
    ? "text-green-800 dark:text-green-200"
    : "text-red-800 dark:text-red-200";
}

export function truncateString(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + "..." : str;
}

export function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
