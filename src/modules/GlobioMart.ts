import { GlobioClient } from '../GlobioClient';
import { GlobioResult } from '../types';

export interface WalletBalance {
  currency_id: string;
  currency_code: string;
  balance: number;
}

export interface InventoryItem {
  item_id: string;
  sku: string;
  name: string;
  quantity: number;
  acquired_at: number;
}

export class GlobioMart {
  constructor(private client: GlobioClient) {}

  async getWallet(): Promise<GlobioResult<WalletBalance[]>> {
    return this.client.request<WalletBalance[]>({
      service: 'mart',
      path: '/wallet',
      auth: true,
    });
  }

  async getWalletByCurrency(currencyCode: string): Promise<GlobioResult<WalletBalance>> {
    return this.client.request<WalletBalance>({
      service: 'mart',
      path: `/wallet/${currencyCode}`,
      auth: true,
    });
  }

  async purchase(sku: string, currencyCode: string): Promise<GlobioResult<{ success: boolean }>> {
    return this.client.request<{ success: boolean }>({
      service: 'mart',
      path: '/purchase',
      method: 'POST',
      body: { item_sku: sku, currency_code: currencyCode },
      auth: true,
    });
  }

  async getInventory(): Promise<GlobioResult<InventoryItem[]>> {
    return this.client.request<InventoryItem[]>({
      service: 'mart',
      path: '/inventory',
      auth: true,
    });
  }

  async listCurrencies(): Promise<GlobioResult<Array<{ id: string; name: string; code: string; type: string }>>> {
    return this.client.request<Array<{ id: string; name: string; code: string; type: string }>>({
      service: 'mart',
      path: '/currencies',
      auth: true,
    });
  }

  async listItems(catalogId?: string): Promise<GlobioResult<Array<{ id: string; name: string; sku: string; type: string; prices: Array<{ currency_code: string; amount: number }> }>>> {
    const qs = catalogId ? `?catalog_id=${catalogId}` : '';
    return this.client.request<Array<{ id: string; name: string; sku: string; type: string; prices: Array<{ currency_code: string; amount: number }> }>>({
      service: 'mart',
      path: `/items${qs}`,
      auth: true,
    });
  }
}
