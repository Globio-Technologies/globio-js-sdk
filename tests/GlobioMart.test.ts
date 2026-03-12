import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GlobioClient } from '../src/GlobioClient';
import { GlobioMart } from '../src/modules/GlobioMart';

function response(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('GlobioMart', () => {
  let mart: GlobioMart;

  beforeEach(() => {
    const client = new GlobioClient({ apiKey: 'test-key', baseUrl: 'https://api.example.com' });
    client.session.set({
      user_id: 'user-1',
      access_token: 'access-123',
      refresh_token: 'refresh-123',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });
    mart = new GlobioMart(client);
  });

  it('listCurrencies() calls GET /mart/currencies', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await mart.listCurrencies();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/currencies',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('createCurrency() calls POST /mart/currencies with correct body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: { id: 'cur-1', project_id: 'proj-1', name: 'Gold', code: 'GLD', type: 'soft', purchasable: false, created_at: 1 },
    }));

    await mart.createCurrency({ name: 'Gold', code: 'GLD', type: 'soft', purchasable: false });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/currencies',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Gold', code: 'GLD', type: 'soft', purchasable: false }),
      }),
    );
  });

  it('listCatalogs() calls GET /mart/catalogs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: [{ id: 'cat-1', project_id: 'proj-1', name: 'Main', version: '1.0.0', active: 1, created_at: 1, updated_at: 1 }],
    }));

    const result = await mart.listCatalogs();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/catalogs',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.success && result.data[0]?.active).toBe(true);
  });

  it('createCatalog() calls POST /mart/catalogs', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: { id: 'cat-1', project_id: 'proj-1', name: 'Main', version: '1.0.0', active: 1, created_at: 1, updated_at: 1 },
    }));

    await mart.createCatalog('Main', '1.0.0');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/catalogs',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Main', version: '1.0.0' }),
      }),
    );
  });

  it('listItems() calls GET /mart/items', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await mart.listItems();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/items',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('listItems(catalogId) passes catalog_id as query param', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await mart.listItems('catalog-123');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/items?catalog_id=catalog-123',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('listItems() normalizes prices and metadata from strings to objects', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: [{
        id: 'item-1',
        catalog_id: 'cat-1',
        name: 'Sword',
        sku: 'sword_01',
        type: 'durable',
        prices: '[{\"currency_code\":\"GLD\",\"amount\":100}]',
        metadata: '{\"rarity\":\"epic\"}',
        active: 1,
        created_at: 1,
      }],
    }));

    const result = await mart.listItems();

    expect(result).toEqual({
      success: true,
      data: [{
        id: 'item-1',
        catalog_id: 'cat-1',
        name: 'Sword',
        sku: 'sword_01',
        type: 'durable',
        prices: [{ currency_code: 'GLD', amount: 100 }],
        metadata: { rarity: 'epic' },
        active: true,
        created_at: 1,
      }],
    });
  });

  it('getItem() calls GET /mart/items/:itemId', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        id: 'item-1',
        catalog_id: 'cat-1',
        name: 'Sword',
        sku: 'sword_01',
        type: 'durable',
        prices: [],
        metadata: {},
        active: 1,
        created_at: 1,
      },
    }));

    await mart.getItem('item-1');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/items/item-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('getWallet() returns MartWallet[] with currency_code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: [{
        id: 'wallet-1',
        currency_id: 'cur-1',
        currency_code: 'GLD',
        currency_name: 'Gold',
        balance: 900,
        updated_at: 10,
        created_at: 5,
      }],
    }));

    const result = await mart.getWallet();

    expect(result).toEqual({
      success: true,
      data: [{
        id: 'wallet-1',
        currency_id: 'cur-1',
        currency_code: 'GLD',
        currency_name: 'Gold',
        balance: 900,
        updated_at: 10,
        created_at: 5,
      }],
    });
  });

  it('getWalletByCurrency() calls GET /mart/wallet/:code', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: {
        id: 'wallet-1',
        currency_id: 'cur-1',
        currency_code: 'GLD',
        currency_name: 'Gold',
        balance: 900,
        updated_at: 10,
        created_at: 5,
      },
    }));

    await mart.getWalletByCurrency('GLD');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/wallet/GLD',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('purchase() calls POST /mart/purchase with { item_sku, currency_code }', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ success: true }));

    await mart.purchase('sword_01', 'GLD');

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/purchase',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ item_sku: 'sword_01', currency_code: 'GLD' }),
      }),
    );
  });

  it('getInventory() returns MartInventoryItem[] with sku and name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      data: [{
        id: 'inv-1',
        item_id: 'item-1',
        sku: 'sword_01',
        name: 'Sword',
        type: 'durable',
        quantity: 2,
        instance_data: '{\"level\":5}',
        acquired_at: 1,
        expires_at: null,
      }],
    }));

    const result = await mart.getInventory();

    expect(result).toEqual({
      success: true,
      data: [{
        id: 'inv-1',
        item_id: 'item-1',
        sku: 'sword_01',
        name: 'Sword',
        type: 'durable',
        quantity: 2,
        instance_data: { level: 5 },
        acquired_at: 1,
        expires_at: null,
      }],
    });
  });

  it('listTransactions() calls GET /mart/transactions', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: [] }));

    await mart.listTransactions();

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/transactions',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('createPaymentIntent() calls POST /mart/payment/intent', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ data: { client_secret: 'pi_secret' } }));

    await mart.createPaymentIntent({ currency: 'usd', amount: 9.99, item_sku: 'sword_01' });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/payment/intent',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ currency: 'usd', amount: 9.99, item_sku: 'sword_01' }),
      }),
    );
  });

  it('validateReceipt() calls POST /mart/iap/validate', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({
      success: true,
      receipt_id: 'receipt-1',
      status: 'pending',
    }));

    const result = await mart.validateReceipt({
      store: 'apple',
      receipt_data: 'receipt-data',
      product_id: 'com.game.sword',
    });

    expect(fetch).toHaveBeenCalledWith(
      'https://api.example.com/mart/iap/validate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          store: 'apple',
          receipt_data: 'receipt-data',
          product_id: 'com.game.sword',
        }),
      }),
    );
    expect(result).toEqual({
      success: true,
      data: { receipt_id: 'receipt-1', status: 'pending' },
    });
  });
});
