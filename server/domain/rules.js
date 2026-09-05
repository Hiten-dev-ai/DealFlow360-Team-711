function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function calculateQuote(lines, customer, settings) {
  let subtotalMinor = 0;
  let discountMinor = 0;
  let totalMinor = 0;
  let costMinor = 0;
  let worstDiscountPressure = 0;
  let ceilingBreached = false;

  for (const line of lines) {
    const gross = line.unitPriceMinor * line.quantity;
    const discount = Math.round(gross * line.discountBps / 10_000);
    subtotalMinor += gross;
    discountMinor += discount;
    totalMinor += gross - discount;
    costMinor += line.unitCostMinor * line.quantity;
    const ceiling = line.ceilingBps ?? 0;
    if (line.discountBps > ceiling) {
      ceilingBreached = true;
      worstDiscountPressure = Math.max(worstDiscountPressure, clamp((line.discountBps - ceiling) / Math.max(500, 10_000 - ceiling), 0, 1));
    }
  }

  const marginBps = totalMinor > 0 ? Math.round(((totalMinor - costMinor) / totalMinor) * 10_000) : 0;
  const marginPressure = clamp((settings.marginFloorBps - marginBps) / Math.max(settings.marginFloorBps, 1), 0, 1);
  const valuePressure = clamp(totalMinor / Math.max(settings.financeValueMinor, 1), 0, 1);
  const overduePressure = clamp((customer.overdueRisk ?? 0) / 100, 0, 1);
  let riskScore = Math.round(
    worstDiscountPressure * settings.discountWeight
      + marginPressure * settings.marginWeight
      + valuePressure * settings.valueWeight
      + overduePressure * settings.overdueWeight,
  );
  if (ceilingBreached) riskScore = Math.max(riskScore, settings.managerScore);
  riskScore = clamp(riskScore, 0, 100);

  const needsFinance = riskScore >= settings.financeScore
    || totalMinor >= settings.financeValueMinor
    || marginBps < settings.marginFloorBps;
  const needsManager = ceilingBreached || riskScore >= settings.managerScore || needsFinance;
  const approvalRoute = [...(needsManager ? ['manager'] : []), ...(needsFinance ? ['finance'] : [])];

  return { subtotalMinor, discountMinor, totalMinor, costMinor, marginBps, riskScore, approvalRoute, ceilingBreached };
}

export function prorateMinor(amountMinor, activeDays, periodDays) {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) throw new Error('Amount must be a non-negative integer.');
  if (!Number.isInteger(activeDays) || !Number.isInteger(periodDays) || activeDays < 0 || periodDays <= 0 || activeDays > periodDays) {
    throw new Error('Invalid proration period.');
  }
  return Math.round(amountMinor * activeDays / periodDays);
}

export function invoiceStatus(totalMinor, paidMinor, dueOn, today = new Date()) {
  if (paidMinor >= totalMinor) return 'paid';
  if (paidMinor > 0) return 'partially_paid';
  const due = new Date(`${dueOn}T23:59:59.999Z`);
  return due < today ? 'overdue' : 'due';
}
