export type Tone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export interface Quotation {
  id: string;
  customer: string;
  owner: string;
  amount: number;
  margin: number;
  discount: number;
  status: 'Draft' | 'Pending approval' | 'Approved' | 'Negotiation';
  updated: string;
}

export const initialQuotations: Quotation[] = [
  { id: 'Q-1048', customer: 'Acme Corp', owner: 'Hiten', amount: 1240000, margin: 28, discount: 12, status: 'Draft', updated: '10 min ago' },
  { id: 'Q-1047', customer: 'Beta Industries', owner: 'Sujith Kumar', amount: 860000, margin: 19, discount: 18, status: 'Pending approval', updated: '32 min ago' },
  { id: 'Q-1046', customer: 'Northstar Labs', owner: 'Hiten', amount: 495000, margin: 31, discount: 8, status: 'Approved', updated: 'Today, 09:42' },
  { id: 'Q-1045', customer: 'Delta Retail', owner: 'Sujith Kumar', amount: 320000, margin: 24, discount: 10, status: 'Negotiation', updated: 'Yesterday' },
  { id: 'Q-1044', customer: 'Meridian Systems', owner: 'Hiten', amount: 2180000, margin: 22, discount: 15, status: 'Pending approval', updated: 'Yesterday' },
];

export const approvalRecords = [
  { id: 'Q-1047', customer: 'Beta Industries', amount: 860000, risk: 78, step: 'Sales Manager', reason: 'Service line is 8% over its ceiling' },
  { id: 'Q-1044', customer: 'Meridian Systems', amount: 2180000, risk: 64, step: 'Finance', reason: 'Blended discount requires second review' },
  { id: 'Q-1039', customer: 'Vertex Foods', amount: 710000, risk: 42, step: 'Sales Manager', reason: 'Category threshold exceeded' },
];

export const fulfillmentRecords = [
  { id: 'O-2291', customer: 'Acme Corp', status: 'Ready', units: 42, warehouses: 'Main + East', shipments: 2, cost: 18400 },
  { id: 'O-2289', customer: 'Northstar Labs', status: 'Picking', units: 18, warehouses: 'Main', shipments: 1, cost: 6200 },
  { id: 'O-2287', customer: 'Delta Retail', status: 'Backorder', units: 64, warehouses: 'East + South', shipments: 3, cost: 27100 },
];

export const initialSubscriptions = [
  { id: 'SUB-304', customer: 'Northstar Labs', plan: 'Operations Pro', cadence: 'Monthly', nextBill: '12 Sep 2026', amount: 48000, status: 'Active' },
  { id: 'SUB-303', customer: 'Acme Corp', plan: 'Support Plus', cadence: 'Quarterly', nextBill: '01 Oct 2026', amount: 126000, status: 'Active' },
  { id: 'SUB-298', customer: 'Delta Retail', plan: 'Analytics Core', cadence: 'Yearly', nextBill: '18 Dec 2026', amount: 240000, status: 'Paused' },
] as const;

export const initialInvoices = [
  { id: 'INV-8821', customer: 'Acme Corp', amount: 620000, due: '08 Sep 2026', status: 'Due' },
  { id: 'INV-8818', customer: 'Northstar Labs', amount: 495000, due: 'Paid 03 Sep', status: 'Paid' },
  { id: 'INV-8812', customer: 'Delta Retail', amount: 160000, due: '01 Sep 2026', status: 'Overdue' },
  { id: 'INV-8809', customer: 'Meridian Systems', amount: 1090000, due: '15 Sep 2026', status: 'Due' },
] as const;

export const initialHealthAlerts = [
  { id: 'A-19', title: 'Discount anomaly', detail: 'Beta Industries is 11% above the rep average.', severity: 'High', age: '18 min' },
  { id: 'A-18', title: 'Stalled quotation', detail: 'Delta Retail has had no activity for four days.', severity: 'Medium', age: '1 hr' },
  { id: 'A-17', title: 'Delivery promise risk', detail: 'Order O-2287 depends on backordered stock.', severity: 'High', age: '2 hr' },
  { id: 'A-16', title: 'Margin compression', detail: 'Meridian Systems margin dropped below 23%.', severity: 'Medium', age: 'Today' },
];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function statusTone(status: string): Tone {
  const normalized = status.toLowerCase();
  if (['approved', 'accepted', 'paid', 'active', 'ready', 'reserved', 'resolved'].includes(normalized)) return 'success';
  if (['overdue', 'rejected', 'backorder', 'high', 'cancelled'].includes(normalized)) return 'danger';
  if (['pending approval', 'pending manager', 'pending finance', 'negotiation', 'due', 'medium', 'paused'].includes(normalized)) return 'warning';
  if (['picking', 'in review', 'planned', 'partially paid'].includes(normalized)) return 'info';
  return 'neutral';
}
