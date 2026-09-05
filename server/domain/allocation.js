function combinations(items) {
  const result = [];
  const count = 1 << items.length;
  for (let mask = 1; mask < count; mask += 1) {
    const subset = items.filter((_, index) => (mask & (1 << index)) !== 0);
    result.push(subset);
  }
  return result;
}

function evaluate(lines, subset) {
  const remaining = new Map(lines.map((line) => [line.productId, line.quantity]));
  const shipments = [];
  for (const warehouse of subset) {
    const shipmentLines = [];
    for (const line of lines) {
      const needed = remaining.get(line.productId) ?? 0;
      const available = warehouse.stock[line.productId] ?? 0;
      const quantity = Math.min(needed, available);
      if (quantity > 0) {
        shipmentLines.push({ productId: line.productId, quantity });
        remaining.set(line.productId, needed - quantity);
      }
    }
    if (shipmentLines.length) shipments.push({ warehouseId: warehouse.id, shippingCostMinor: warehouse.shippingCostMinor, lines: shipmentLines });
  }
  const backorders = [...remaining.entries()].filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity }));
  return {
    shipments,
    backorders,
    backorderUnits: backorders.reduce((sum, line) => sum + line.quantity, 0),
    shippingCostMinor: shipments.reduce((sum, item) => sum + item.shippingCostMinor, 0),
  };
}

export function allocateInventory(lines, warehouses) {
  if (warehouses.length > 12) throw new Error('Automatic allocation supports up to 12 warehouses.');
  const candidates = combinations(warehouses).map((subset) => evaluate(lines, subset));
  candidates.sort((a, b) => a.backorderUnits - b.backorderUnits
    || a.shipments.length - b.shipments.length
    || a.shippingCostMinor - b.shippingCostMinor);
  return candidates[0] ?? { shipments: [], backorders: lines.map((line) => ({ ...line })), backorderUnits: lines.reduce((sum, line) => sum + line.quantity, 0), shippingCostMinor: 0 };
}
