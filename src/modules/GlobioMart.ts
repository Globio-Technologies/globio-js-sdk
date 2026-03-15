import { GlobioClient } from '../GlobioClient';
import {
  GlobioResult,
  MartCatalog,
  MartCurrency,
  MartInventoryItem,
  MartItem,
  MartItemPrice,
  MartTransaction,
  MartWallet,
} from '../types';

type RawMartItem = Omit<MartItem, 'prices' | 'metadata' | 'active'> & {
  prices: MartItemPrice[] | string;
  metadata: Record<string, unknown> | string | null;
  active: boolean | number;
};

type RawMartInventoryItem = Omit<MartInventoryItem, 'instance_data'> & {
  instance_data: Record<string, unknown> | string | null;
};

type RawMartWallet = Partial<MartWallet> & {
  project_id?: string;
  user_id?: string;
};

type RawValidateReceiptResponse = {
  success?: boolean;
  receipt_id: string;
  status: string;
};

export class GlobioMart {
  constructor(private client: GlobioClient) {}

  async listCurrencies(): Promise<GlobioResult<MartCurrency[]>> {
    return this.client.request<MartCurrency[]>({
      service: 'mart',
      path: '/currencies',
      auth: true,
    });
  }

  async createCurrency(options: {
    name: string;
    code: string;
    type?: 'soft' | 'hard' | 'premium';
    purchasable?: boolean;
  }): Promise<GlobioResult<MartCurrency>> {
    return this.client.request<MartCurrency>({
      service: 'mart',
      path: '/currencies',
      method: 'POST',
      body: options,
      auth: true,
    });
  }

  async deleteCurrency(currencyId: string): Promise<GlobioResult<void>> {
    const result = await this.client.request<void>({
      service: 'mart',
      path: `/currencies/${encodeURIComponent(currencyId)}`,
      method: 'DELETE',
      auth: true,
    });
    return result.success ? { success: true, data: undefined } : result;
  }

  async listCatalogs(): Promise<GlobioResult<MartCatalog[]>> {
    const result = await this.client.request<Array<MartCatalog & { active: boolean | number }>>({
      service: 'mart',
      path: '/catalogs',
      auth: true,
    });

    return result.success
      ? { success: true, data: result.data.map((catalog) => this.normalizeCatalog(catalog)) }
      : result;
  }

  async createCatalog(name: string, version?: string): Promise<GlobioResult<MartCatalog>> {
    const result = await this.client.request<MartCatalog & { active: boolean | number }>({
      service: 'mart',
      path: '/catalogs',
      method: 'POST',
      body: { name, version },
      auth: true,
    });

    return result.success
      ? { success: true, data: this.normalizeCatalog(result.data) }
      : result;
  }

  async listItems(catalogId?: string): Promise<GlobioResult<MartItem[]>> {
    const params = new URLSearchParams();
    if (catalogId) {
      params.set('catalog_id', catalogId);
    }

    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    const result = await this.client.request<RawMartItem[]>({
      service: 'mart',
      path: `/items${suffix}`,
      auth: true,
    });

    return result.success
      ? { success: true, data: result.data.map((item) => this.normalizeItem(item)) }
      : result;
  }

  async createItem(options: {
    catalog_id: string;
    name: string;
    sku: string;
    type?: 'consumable' | 'durable' | 'subscription';
    prices?: MartItemPrice[];
    metadata?: Record<string, unknown>;
  }): Promise<GlobioResult<MartItem>> {
    const result = await this.client.request<RawMartItem>({
      service: 'mart',
      path: '/items',
      method: 'POST',
      body: options,
      auth: true,
    });

    return result.success
      ? { success: true, data: this.normalizeItem(result.data) }
      : result;
  }

  async getItem(itemId: string): Promise<GlobioResult<MartItem>> {
    const result = await this.client.request<RawMartItem>({
      service: 'mart',
      path: `/items/${encodeURIComponent(itemId)}`,
      auth: true,
    });

    return result.success
      ? { success: true, data: this.normalizeItem(result.data) }
      : result;
  }

  async getWallet(): Promise<GlobioResult<MartWallet[]>> {
    const result = await this.client.request<RawMartWallet[]>({
      service: 'mart',
      path: '/wallet',
      auth: true,
    });

    return result.success
      ? { success: true, data: result.data.map((wallet) => this.normalizeWallet(wallet)) }
      : result;
  }

  async getWalletByCurrency(currencyCode: string): Promise<GlobioResult<MartWallet>> {
    const result = await this.client.request<RawMartWallet>({
      service: 'mart',
      path: `/wallet/${encodeURIComponent(currencyCode)}`,
      auth: true,
    });

    return result.success
      ? { success: true, data: this.normalizeWallet(result.data, currencyCode) }
      : result;
  }

  async purchase(sku: string, currencyCode: string): Promise<GlobioResult<void>> {
    const result = await this.client.request<{ success?: boolean }>({
      service: 'mart',
      path: '/purchase',
      method: 'POST',
      body: { item_sku: sku, currency_code: currencyCode },
      auth: true,
    });

    return result.success ? { success: true, data: undefined } : result;
  }

  async getInventory(): Promise<GlobioResult<MartInventoryItem[]>> {
    const result = await this.client.request<RawMartInventoryItem[]>({
      service: 'mart',
      path: '/inventory',
      auth: true,
    });

    return result.success
      ? { success: true, data: result.data.map((item) => this.normalizeInventoryItem(item)) }
      : result;
  }

  async listTransactions(): Promise<GlobioResult<MartTransaction[]>> {
    return this.client.request<MartTransaction[]>({
      service: 'mart',
      path: '/transactions',
      auth: true,
    });
  }

  async createPaymentIntent(options: {
    currency: string;
    amount: number;
    item_sku: string;
  }): Promise<GlobioResult<{ client_secret: string }>> {
    return this.client.request<{ client_secret: string }>({
      service: 'mart',
      path: '/payment/intent',
      method: 'POST',
      body: options,
      auth: true,
    });
  }

  async validateReceipt(options: {
    store: 'apple' | 'google' | 'steam';
    receipt_data: string;
    product_id: string;
  }): Promise<GlobioResult<{ receipt_id: string; status: string }>> {
    const result = await this.client.request<RawValidateReceiptResponse>({
      service: 'mart',
      path: '/iap/validate',
      method: 'POST',
      body: options,
      auth: true,
    });

    return result.success
      ? {
          success: true,
          data: {
            receipt_id: result.data.receipt_id,
            status: result.data.status,
          },
        }
      : result;
  }

  private normalizeCatalog(catalog: MartCatalog & { active: boolean | number }): MartCatalog {
    return {
      ...catalog,
      active: Boolean(catalog.active),
    };
  }

  private normalizeItem(item: RawMartItem): MartItem {
    return {
      id: item.id,
      catalog_id: item.catalog_id,
      name: item.name,
      sku: item.sku,
      type: item.type,
      prices: this.parseJson(item.prices, [] as MartItemPrice[]),
      metadata: this.parseJson(item.metadata, {} as Record<string, unknown>),
      active: Boolean(item.active),
      created_at: item.created_at,
    };
  }

  private normalizeWallet(wallet: RawMartWallet, fallbackCode = ''): MartWallet {
    return {
      id: typeof wallet.id === 'string' ? wallet.id : '',
      currency_id: typeof wallet.currency_id === 'string' ? wallet.currency_id : '',
      currency_code: typeof wallet.currency_code === 'string' ? wallet.currency_code : fallbackCode,
      currency_name: typeof wallet.currency_name === 'string'
        ? wallet.currency_name
        : (typeof wallet.currency_code === 'string' ? wallet.currency_code : fallbackCode),
      balance: typeof wallet.balance === 'number' ? wallet.balance : 0,
      updated_at: typeof wallet.updated_at === 'number' ? wallet.updated_at : 0,
      created_at: typeof wallet.created_at === 'number' ? wallet.created_at : 0,
    };
  }

  private normalizeInventoryItem(item: RawMartInventoryItem): MartInventoryItem {
    return {
      id: item.id,
      item_id: item.item_id,
      sku: item.sku,
      name: item.name,
      type: item.type,
      quantity: item.quantity,
      instance_data: this.parseJson(item.instance_data, null as Record<string, unknown> | null),
      acquired_at: item.acquired_at,
      expires_at: item.expires_at,
    };
  }

  private parseJson<T>(value: T | string | null | undefined, fallback: T): T {
    if (value === null || value === undefined) {
      return fallback;
    }
    if (typeof value !== 'string') {
      return value;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
}
