import {
  computeLotMetrics,
  disposeTaxLots,
  computeModifiedDietz,
  computeXIRR,
} from '../src/lib/data/portfolioMath.ts';
import type { TaxLot } from '../src/lib/types/moneta.ts';

let pass = 0;
let fail = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  ✅ ${label}: ${a}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}: got ${a}, expected ${e}`);
  }
}

console.log('\n--- 1. Tax-Lot Metrics & Holding Classification ---');
{
  const lot = computeLotMetrics(
    {
      symbol: 'NVDA',
      purchase_date: '2025-01-15',
      initial_quantity: 50,
      remaining_quantity: 50,
      purchase_price: 120.0,
    },
    180.0,
    '2026-09-18'
  );
  check('total_cost_basis', lot.total_cost_basis, 6000);
  check('current_market_value', lot.current_market_value, 9000);
  check('unrealized_gain', lot.unrealized_gain, 3000);
  check('unrealized_gain_percent', lot.unrealized_gain_percent, 50);
  check('term_type', lot.term_type, 'long_term'); // > 365 days
  check('state', lot.state, 'open');
}

console.log('\n--- 2. Short-Term Classification (< 365 days) ---');
{
  const lot = computeLotMetrics(
    {
      symbol: 'MSFT',
      purchase_date: '2026-06-01',
      initial_quantity: 10,
      remaining_quantity: 10,
      purchase_price: 400.0,
    },
    450.0,
    '2026-09-18'
  );
  check('term_type', lot.term_type, 'short_term');
  check('unrealized_gain', lot.unrealized_gain, 500);
}

// Sample lots for disposal testing
const sampleLots: TaxLot[] = [
  {
    id: 'lot-1',
    account_id: 'acc-ibkr',
    symbol: 'NVDA',
    purchase_date: '2025-01-10',
    initial_quantity: 20,
    remaining_quantity: 20,
    purchase_price: 100.0,
    total_cost_basis: 2000,
    current_market_value: 3600,
    unrealized_gain: 1600,
    unrealized_gain_percent: 80,
    holding_days: 616,
    term_type: 'long_term',
    state: 'open',
  },
  {
    id: 'lot-2',
    account_id: 'acc-ibkr',
    symbol: 'NVDA',
    purchase_date: '2025-08-15',
    initial_quantity: 30,
    remaining_quantity: 30,
    purchase_price: 150.0,
    total_cost_basis: 4500,
    current_market_value: 5400,
    unrealized_gain: 900,
    unrealized_gain_percent: 20,
    holding_days: 399,
    term_type: 'long_term',
    state: 'open',
  },
  {
    id: 'lot-3',
    account_id: 'acc-ibkr',
    symbol: 'NVDA',
    purchase_date: '2026-05-20',
    initial_quantity: 15,
    remaining_quantity: 15,
    purchase_price: 180.0,
    total_cost_basis: 2700,
    current_market_value: 2700,
    unrealized_gain: 0,
    unrealized_gain_percent: 0,
    holding_days: 121,
    term_type: 'short_term',
    state: 'open',
  },
];

console.log('\n--- 3. FIFO Disposal Strategy (Sell 25 shares @ $200) ---');
{
  // Sells 20 shares from lot-1 ($100), 5 shares from lot-2 ($150)
  // Proceeds = 25 * 200 = 5000. Cost = 20*100 + 5*150 = 2000 + 750 = 2750. Gain = 2250.
  const res = disposeTaxLots(sampleLots, 25, 200.0, '2026-09-18', 'FIFO');
  check('disposals count', res.disposals.length, 2);
  check('first lot disposed', res.disposals[0].lot_id, 'lot-1');
  check('first lot qty', res.disposals[0].quantity_sold, 20);
  check('second lot qty', res.disposals[1].quantity_sold, 5);
  check('total realized gain', res.totalRealizedGain, 2250);
  check('total proceeds', res.totalProceeds, 5000);
  check('total cost basis sold', res.totalCostBasisSold, 2750);
}

console.log('\n--- 4. LIFO Disposal Strategy (Sell 20 shares @ $200) ---');
{
  // Sells 15 shares from lot-3 ($180), 5 shares from lot-2 ($150)
  // Proceeds = 20 * 200 = 4000. Cost = 15*180 + 5*150 = 2700 + 750 = 3450. Gain = 550.
  const res = disposeTaxLots(sampleLots, 20, 200.0, '2026-09-18', 'LIFO');
  check('first lot disposed', res.disposals[0].lot_id, 'lot-3');
  check('first lot qty', res.disposals[0].quantity_sold, 15);
  check('second lot qty', res.disposals[1].quantity_sold, 5);
  check('total realized gain', res.totalRealizedGain, 550);
}

console.log('\n--- 5. HIFO Disposal Strategy (Tax Minimization: Sell 20 shares @ $200) ---');
{
  // Highest cost first: 15 shares from lot-3 ($180), then 5 shares from lot-2 ($150)
  const res = disposeTaxLots(sampleLots, 20, 200.0, '2026-09-18', 'HIFO');
  check('first lot disposed', res.disposals[0].lot_id, 'lot-3'); // $180
  check('first lot cost sold', res.disposals[0].cost_basis_sold, 2700);
  check('second lot disposed', res.disposals[1].lot_id, 'lot-2'); // $150
  check('total realized gain', res.totalRealizedGain, 550);
}

console.log('\n--- 6. Specific Lot Identification (SpecID: Sell 10 shares from lot-2) ---');
{
  const res = disposeTaxLots(sampleLots, 10, 200.0, '2026-09-18', 'SpecID', ['lot-2']);
  check('disposals count', res.disposals.length, 1);
  check('lot disposed', res.disposals[0].lot_id, 'lot-2');
  check('qty sold', res.disposals[0].quantity_sold, 10);
  check('realized gain (200 - 150)*10', res.totalRealizedGain, 500);
}

console.log('\n--- 7. Modified Dietz Time-Weighted Return (TWR) ---');
{
  // Contributed 10,000 on day 0, 5,000 on day 30, portfolio value is 16,500 on day 60.
  const cfs = [
    { date: '2026-01-01', amount: 10000 },
    { date: '2026-01-31', amount: 5000 },
  ];
  const twr = computeModifiedDietz(cfs, 16500, '2026-03-02');
  // Total Days = 60. Weight for cf 1 = 60/60 = 1.0. Weight for cf 2 = 30/60 = 0.5.
  // Weighted capital = 10000*1 + 5000*0.5 = 12500. Gain = 16500 - 15000 = 1500.
  // TWR = 1500 / 12500 = 0.12 (12%)
  check('TWR rate', twr, 0.12);
}

console.log('\n--- 8. Money-Weighted Return (XIRR) ---');
{
  // -1000 on 2025-01-01, +1100 on 2026-01-01 -> exact 10% annual return
  const cfs = [
    { date: '2025-01-01', amount: -1000 },
    { date: '2026-01-01', amount: 1100 },
  ];
  const irr = computeXIRR(cfs);
  check('XIRR 10% annual return', irr, 0.1);
}

console.log(`\nResults: ${pass} passed, ${fail} failed.`);
if (fail > 0) {
  process.exit(1);
}
