// Local, persisted price alerts for energy contracts.
// Targets are stored canonically in USD so they stay correct across PKR/USD views.

export const ALERTS_KEY = "oil-price-alerts";

export type AlertCondition = "above" | "below";

export interface OilAlert {
    id: string;
    key: string;
    name: string;
    condition: AlertCondition;
    targetUsd: number;
    createdAt: number;
    triggered: boolean;
}

export function loadAlerts(): OilAlert[] {
    try {
        const raw = localStorage.getItem(ALERTS_KEY);
        return raw ? (JSON.parse(raw) as OilAlert[]) : [];
    } catch {
        return [];
    }
}

export function persistAlerts(alerts: OilAlert[]): void {
    try {
        localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
    } catch {
        /* ignore */
    }
}

export function makeAlertId(): string {
    return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
