/**
 * portfolioMath.ts
 *
 * Single-source-of-truth mathematical core for stock portfolio and tax-lot accounting.
 * Per AGENTS.md Rule 7 ("One Derivation, One Place"):
 * Both SQLite and Mock adapters delegate to this module to ensure perfect parity
 * with Odoo 18 moneta_core (investment.py and tax_lot.py).
 */

import type {
  TaxLot,
  TaxLotDisposal,
  TaxLotStrategy,
  TaxLotTermType,
  PortfolioHolding,
} from '../types/moneta';

export interface LotDisposalResult {
  disposals: TaxLotDisposal[];
  updatedLots: TaxLot[];
  totalRealizedGain: number;
  totalProceeds: number;
  totalCostBasisSold: number;
}

/**
 * Computes live market valuation, gain, holding duration, and term type for a tax lot
 */
export function computeLotMetrics(
  lot: Partial<TaxLot>,
  currentPrice: number,
  asOfDate: string = new Date().toISOString().split('T')[0]
): Partial<TaxLot> {
  const rem = Math.max(0, Number(lot.remaining_quantity ?? lot.initial_quantity ?? 0));
  const price = Number(lot.purchase_price ?? 0);
  const mktPrice = Number(currentPrice || 0);

  const cost = Math.round(rem * price * 100) / 100;
  const mktVal = Math.round(rem * mktPrice * 100) / 100;
  const gain = Math.round((mktVal - cost) * 100) / 100;
  const gainPct = cost > 0 ? Math.round(((mktVal - cost) / cost) * 10000) / 100 : 0.0;

  const todayMs = new Date(asOfDate).getTime();
  const purchaseMs = lot.purchase_date ? new Date(lot.purchase_date).getTime() : todayMs;
  const diffDays = Math.max(0, Math.floor((todayMs - purchaseMs) / 86400000));
  const termType: TaxLotTermType = diffDays >= 365 ? 'long_term' : 'short_term';
  const state: 'open' | 'closed' = rem > 1e-6 ? 'open' : 'closed';

  return {
    ...lot,
    remaining_quantity: rem,
    total_cost_basis: cost,
    current_market_value: mktVal,
    unrealized_gain: gain,
    unrealized_gain_percent: gainPct,
    holding_days: diffDays,
    term_type: termType,
    state,
  };
}

/**
 * Automated lot disposal engine implementing FIFO, LIFO, HIFO, and SpecID
 * Mirroring Odoo 18 moneta.security.lot disposal mechanics
 */
export function disposeTaxLots(
  openLots: TaxLot[],
  quantityToSell: number,
  salePrice: number,
  disposalDate: string = new Date().toISOString().split('T')[0],
  strategy: TaxLotStrategy = 'FIFO',
  selectedLotIds?: (string | number)[]
): LotDisposalResult {
  if (quantityToSell <= 0) {
    return {
      disposals: [],
      updatedLots: openLots,
      totalRealizedGain: 0,
      totalProceeds: 0,
      totalCostBasisSold: 0,
    };
  }

  // Clone lots to avoid mutating input array directly
  const lots = openLots.map((l) => ({ ...l }));

  // Order candidates based on chosen strategy
  let sortedLots: TaxLot[] = [];

  if (strategy === 'FIFO') {
    sortedLots = lots.sort((a, b) => {
      const da = new Date(a.purchase_date).getTime();
      const db = new Date(b.purchase_date).getTime();
      return da !== db ? da - db : String(a.id).localeCompare(String(b.id));
    });
  } else if (strategy === 'LIFO') {
    sortedLots = lots.sort((a, b) => {
      const da = new Date(a.purchase_date).getTime();
      const db = new Date(b.purchase_date).getTime();
      return da !== db ? db - da : String(b.id).localeCompare(String(a.id));
    });
  } else if (strategy === 'HIFO') {
    // Highest In First Out: prioritize highest purchase price to maximize cost basis and minimize taxable gain
    sortedLots = lots.sort((a, b) => {
      const pa = a.purchase_price;
      const pb = b.purchase_price;
      return pb !== pa ? pb - pa : new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime();
    });
  } else if (strategy === 'SpecID' && selectedLotIds && selectedLotIds.length > 0) {
    const idSet = new Set(selectedLotIds.map(String));
    const selected = lots.filter((l) => idSet.has(String(l.id)));
    const others = lots.filter((l) => !idSet.has(String(l.id)));
    sortedLots = [...selected, ...others];
  } else {
    sortedLots = lots;
  }

  let remainingToSell = quantityToSell;
  const disposals: TaxLotDisposal[] = [];
  let totalRealizedGain = 0;
  let totalProceeds = 0;
  let totalCostBasisSold = 0;

  for (const lot of sortedLots) {
    if (remainingToSell <= 1e-6) break;
    if (lot.remaining_quantity <= 1e-6) continue;

    const qtyFromLot = Math.min(lot.remaining_quantity, remainingToSell);
    const costSold = Math.round(qtyFromLot * lot.purchase_price * 100) / 100;
    const proceeds = Math.round(qtyFromLot * salePrice * 100) / 100;
    const realized = Math.round((proceeds - costSold) * 100) / 100;

    const dispMs = new Date(disposalDate).getTime();
    const purchMs = new Date(lot.purchase_date).getTime();
    const holdingDays = Math.max(0, Math.floor((dispMs - purchMs) / 86400000));
    const termType: TaxLotTermType = holdingDays >= 365 ? 'long_term' : 'short_term';

    lot.remaining_quantity = Math.round((lot.remaining_quantity - qtyFromLot) * 10000) / 10000;
    lot.state = lot.remaining_quantity > 1e-6 ? 'open' : 'closed';
    lot.total_cost_basis = Math.round(lot.remaining_quantity * lot.purchase_price * 100) / 100;

    disposals.push({
      id: `disp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      lot_id: lot.id,
      symbol: lot.symbol,
      account_id: lot.account_id,
      disposal_date: disposalDate,
      quantity_sold: qtyFromLot,
      cost_basis_sold: costSold,
      proceeds,
      realized_gain: realized,
      term_type: termType,
      disposal_strategy: strategy,
    });

    totalRealizedGain += realized;
    totalProceeds += proceeds;
    totalCostBasisSold += costSold;
    remainingToSell -= qtyFromLot;
  }

  return {
    disposals,
    updatedLots: sortedLots,
    totalRealizedGain: Math.round(totalRealizedGain * 100) / 100,
    totalProceeds: Math.round(totalProceeds * 100) / 100,
    totalCostBasisSold: Math.round(totalCostBasisSold * 100) / 100,
  };
}

/**
 * Time-Weighted Return (Modified Dietz) matching Odoo _modified_dietz
 *
 * cashflows: contributions (buys) positive, withdrawals (sells/dividends) negative.
 * endValue: current portfolio market value.
 */
export function computeModifiedDietz(
  cashflows: Array<{ date: string; amount: number }>,
  endValue: number,
  endDate: string = new Date().toISOString().split('T')[0]
): number | null {
  if (!cashflows || cashflows.length === 0) return null;

  const dates = cashflows.map((cf) => new Date(cf.date).getTime());
  const d0 = Math.min(...dates);
  const endMs = new Date(endDate).getTime();
  const totalDays = Math.floor((endMs - d0) / 86400000);

  if (totalDays <= 0) {
    const totalContributed = cashflows.reduce((sum, cf) => sum + cf.amount, 0);
    return totalContributed > 0 ? (endValue - totalContributed) / totalContributed : 0.0;
  }

  let netCashflow = 0.0;
  let weightedCapital = 0.0;

  for (const cf of cashflows) {
    const cfMs = new Date(cf.date).getTime();
    const daysSinceStart = Math.floor((cfMs - d0) / 86400000);
    const weight = (totalDays - daysSinceStart) / totalDays;
    netCashflow += cf.amount;
    weightedCapital += cf.amount * weight;
  }

  if (Math.abs(weightedCapital) < 1e-6) return null;
  const gain = endValue - netCashflow;
  return Math.round((gain / weightedCapital) * 10000) / 10000;
}

/**
 * Annualized Money-Weighted Return (XIRR) solver matching Odoo _xirr bisection
 *
 * cashflows: outflows negative (buys), inflows positive (sells, dividends, terminal value).
 */
export function computeXIRR(
  cashflows: Array<{ date: string; amount: number }>,
  maxRate: number = 10.0,
  tol: number = 1e-6,
  iters: number = 200
): number | null {
  if (!cashflows || cashflows.length < 2) return null;

  const amounts = cashflows.map((c) => c.amount);
  if (amounts.every((a) => a >= 0) || amounts.every((a) => a <= 0)) {
    return null;
  }

  const dates = cashflows.map((c) => new Date(c.date).getTime());
  const d0 = Math.min(...dates);

  const npv = (rate: number): number => {
    let total = 0.0;
    for (const cf of cashflows) {
      const years = (new Date(cf.date).getTime() - d0) / (365.0 * 86400000);
      total += cf.amount / Math.pow(1.0 + rate, years);
    }
    return total;
  };

  let lo = -0.9999;
  let hi = maxRate;
  let fLo = npv(lo);
  let fHi = npv(hi);

  while (fHi > 0 && hi < 1e5) {
    hi *= 3.0;
    fHi = npv(hi);
  }

  if (fLo * fHi > 0) return null;

  for (let i = 0; i < iters; i++) {
    const mid = (lo + hi) / 2.0;
    const fMid = npv(mid);
    if (Math.abs(fMid) < tol || (hi - lo) < tol) {
      return Math.round(mid * 10000) / 10000;
    }
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  return Math.round(((lo + hi) / 2.0) * 10000) / 10000;
}
