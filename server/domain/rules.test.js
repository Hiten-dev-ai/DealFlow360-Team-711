import { describe, expect, it } from 'vitest';
import { allocateInventory } from './allocation.js';
import { calculateQuote, invoiceStatus, prorateMinor } from './rules.js';

const settings = {
  managerScore: 40, financeScore: 70, financeValueMinor: 100_000_000, marginFloorBps: 2000,
  discountWeight: 45, marginWeight: 30, valueWeight: 15, overdueWeight: 10,
};

describe('deal rules', () => {
  it('routes ceiling breaches and high-value deals through deterministic stages', () => {
    const manager = calculateQuote([{ quantity: 1, unitPriceMinor: 5_000_000, unitCostMinor: 2_000_000, discountBps: 1600, ceilingBps: 1000 }], { overdueRisk: 0 }, settings);
    expect(manager.approvalRoute).toContain('manager');
    const finance = calculateQuote([{ quantity: 2, unitPriceMinor: 60_000_000, unitCostMinor: 35_000_000, discountBps: 0, ceilingBps: 1000 }], { overdueRisk: 0 }, settings);
    expect(finance.approvalRoute).toEqual(['manager', 'finance']);
  });

  it('allocates maximum stock with the fewest shipments and then lowest cost', () => {
    const result = allocateInventory([{ productId: 'p1', quantity: 5 }], [
      { id: 'expensive', shippingCostMinor: 500, stock: { p1: 5 } },
      { id: 'cheap', shippingCostMinor: 100, stock: { p1: 5 } },
      { id: 'partial', shippingCostMinor: 10, stock: { p1: 2 } },
    ]);
    expect(result.backorderUnits).toBe(0);
    expect(result.shipments).toEqual([{ warehouseId: 'cheap', shippingCostMinor: 100, lines: [{ productId: 'p1', quantity: 5 }] }]);
  });

  it('prorates integer money and derives invoice state', () => {
    expect(prorateMinor(31_000, 10, 31)).toBe(10_000);
    expect(invoiceStatus(1000, 400, '2099-01-01')).toBe('partially_paid');
    expect(invoiceStatus(1000, 1000, '2020-01-01')).toBe('paid');
  });
});
