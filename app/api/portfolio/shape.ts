// Validation shared by the single-trade POST and the bulk import route.

const ASSET_TYPES = ['PSX', 'NASDAQ', 'CRYPTO', 'FOREX', 'COMMODITY'];
const CURRENCIES = ['PKR', 'USD'];

export interface NormalizedTxn {
    date: string;
    type: 'BUY' | 'SELL';
    assetType: string;
    symbol: string;
    name?: string;
    quantity: number;
    price: number;
    currency: string;
    note?: string;
}

export function normalizeTxn(body: any): NormalizedTxn | { error: string } {
    const symbol = String(body?.symbol || '').trim().toUpperCase();
    const quantity = Number(body?.quantity);
    const price = Number(body?.price);
    const date = String(body?.date || '');
    const type = body?.type === 'SELL' ? 'SELL' : 'BUY';

    if (!symbol) return { error: 'A symbol is required' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'Date must be YYYY-MM-DD' };
    if (!ASSET_TYPES.includes(body?.assetType)) return { error: 'Unknown asset type' };
    if (!CURRENCIES.includes(body?.currency)) return { error: 'Currency must be PKR or USD' };
    if (!Number.isFinite(quantity) || quantity <= 0) return { error: 'Quantity must be a positive number' };
    if (!Number.isFinite(price) || price <= 0) return { error: 'Price must be a positive number' };

    return {
        date,
        type,
        assetType: body.assetType,
        symbol,
        name: body?.name ? String(body.name).slice(0, 120) : undefined,
        quantity,
        price,
        currency: body.currency,
        note: body?.note ? String(body.note).slice(0, 300) : undefined,
    };
}
