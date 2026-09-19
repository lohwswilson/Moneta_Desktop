<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import {
    TrendingUp,
    ShieldCheck,
    Flame,
    PieChart,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    Percent,
    Eye,
    EyeOff,
    Gem,
    Wallet,
    CreditCard,
    Building2
  } from '@lucide/svelte';

  let hideAmounts = $state(false);

  const formatCurrency = (amount: number, currency: string = 'SGD') => {
    if (hideAmounts) return '$ ••••••••';
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  let m = $derived(financeStore.metrics);
  let totalAssets = $derived(m ? (m.liquid_cash + m.investments + (m.tangible_assets || 0)) : 0);
</script>

<div class="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
  <!-- Header Bar -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-zinc-100 tracking-tight">Wealth Command Center</h1>
      <p class="text-xs text-zinc-400 mt-1">
        Consolidated multi-account balance, cash flow savings, and 4% FIRE milestone
      </p>
    </div>

    <div class="flex items-center gap-3">
      <button
        onclick={() => (hideAmounts = !hideAmounts)}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        {#if hideAmounts}
          <Eye class="w-3.5 h-3.5 text-zinc-400" />
          <span>Show Balances</span>
        {:else}
          <EyeOff class="w-3.5 h-3.5 text-zinc-400" />
          <span>Hide Balances</span>
        {/if}
      </button>

      <button
        onclick={() => financeStore.refreshAll()}
        class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-colors"
      >
        Sync & Refresh
      </button>
    </div>
  </div>

  {#if m}
    <!-- Wealth Pillars -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 {(m.tangible_assets || 0) > 0 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-4">
      <!-- Net Worth Card -->
      <div class="p-5 rounded-xl bg-gradient-to-br from-zinc-900/90 to-zinc-900/40 border border-zinc-800/80 relative overflow-hidden flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-zinc-400 font-medium h-7">
            <span>Total Net Worth</span>
            <span class="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <TrendingUp class="w-4 h-4" />
            </span>
          </div>
          <div class="text-xl sm:text-2xl font-bold font-mono text-zinc-100 mt-2.5 tracking-tight truncate" title={formatCurrency(m.net_worth)}>
            {formatCurrency(m.net_worth)}
          </div>
        </div>
        <div class="mt-4 pt-2.5 border-t border-zinc-800/70 space-y-1 text-[11px]">
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Total Assets</span>
            <span class="font-mono font-medium text-emerald-400">
              +{formatCurrency(totalAssets)}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-zinc-500">Liabilities</span>
            <span class="font-mono font-medium text-rose-400">
              -{formatCurrency(m.total_liabilities)}
            </span>
          </div>
        </div>
      </div>

      <!-- Liquid Cash Card -->
      <div class="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-zinc-400 font-medium h-7">
            <span>Liquid Cash Buffer</span>
            <span class="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <Wallet class="w-4 h-4" />
            </span>
          </div>
          <div class="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-2.5 tracking-tight truncate" title={formatCurrency(m.liquid_cash)}>
            {formatCurrency(m.liquid_cash)}
          </div>
        </div>
        <div class="mt-4 pt-2.5 border-t border-zinc-800/70 space-y-1 text-[11px]">
          <div class="text-zinc-400 truncate">Checking, High-Yield & CPF</div>
          <div class="flex items-center justify-between text-zinc-500">
            <span>Asset Share</span>
            <span class="font-mono font-medium text-zinc-300">{totalAssets > 0 ? Math.round((m.liquid_cash / totalAssets) * 100) : 0}%</span>
          </div>
        </div>
      </div>

      <!-- Total Investments Card -->
      <div class="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-zinc-400 font-medium h-7">
            <span>Investments & Brokerage</span>
            <span class="p-1.5 rounded-md bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0">
              <PieChart class="w-4 h-4" />
            </span>
          </div>
          <div class="text-xl sm:text-2xl font-bold font-mono text-sky-400 mt-2.5 tracking-tight truncate" title={formatCurrency(m.investments)}>
            {formatCurrency(m.investments)}
          </div>
        </div>
        <div class="mt-4 pt-2.5 border-t border-zinc-800/70 space-y-1 text-[11px]">
          <div class="text-zinc-400 truncate">Equities, Index ETFs & SRS</div>
          <div class="flex items-center justify-between text-zinc-500">
            <span>Asset Share</span>
            <span class="font-mono font-medium text-zinc-300">{totalAssets > 0 ? Math.round((m.investments / totalAssets) * 100) : 0}%</span>
          </div>
        </div>
      </div>

      <!-- Tangible Assets & Property Card -->
      {#if (m.tangible_assets || 0) > 0}
        <div class="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between text-xs text-zinc-400 font-medium h-7">
              <span>Tangible Assets</span>
              <span class="p-1.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Building2 class="w-4 h-4" />
              </span>
            </div>
            <div class="text-xl sm:text-2xl font-bold font-mono text-amber-400 mt-2.5 tracking-tight truncate" title={formatCurrency(m.tangible_assets || 0)}>
              {formatCurrency(m.tangible_assets || 0)}
            </div>
          </div>
          <div class="mt-4 pt-2.5 border-t border-zinc-800/70 space-y-1 text-[11px]">
            <div class="text-zinc-400 truncate">Real Estate & Property</div>
            <div class="flex items-center justify-between text-zinc-500">
              <span>Asset Share</span>
              <span class="font-mono font-medium text-zinc-300">{totalAssets > 0 ? Math.round(((m.tangible_assets || 0) / totalAssets) * 100) : 0}%</span>
            </div>
          </div>
        </div>
      {/if}

      <!-- Liabilities Card -->
      <div class="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-xs text-zinc-400 font-medium h-7">
            <span>Total Liabilities</span>
            <span class="p-1.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
              <CreditCard class="w-4 h-4" />
            </span>
          </div>
          <div class="text-xl sm:text-2xl font-bold font-mono text-rose-400 mt-2.5 tracking-tight truncate" title={formatCurrency(m.total_liabilities)}>
            {formatCurrency(m.total_liabilities)}
          </div>
        </div>
        <div class="mt-4 pt-2.5 border-t border-zinc-800/70 space-y-1 text-[11px]">
          <div class="text-zinc-400 truncate">Mortgages & Credit Cards</div>
          <div class="flex items-center justify-between text-zinc-500">
            <span>Debt / Asset</span>
            <span class="font-mono font-medium text-zinc-300">{totalAssets > 0 ? Math.round((m.total_liabilities / totalAssets) * 100) : 0}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Secondary Row: FIRE Progress & Cash Flow Efficiency -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- 4% Rule FIRE Milestone Card -->
      <div class="lg:col-span-2 p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col justify-between">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-zinc-100">4% Rule FIRE Milestone</h3>
              <p class="text-xs text-zinc-500">Financial Independence Portfolio Target (25x annual expenses)</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-lg font-bold font-mono text-amber-400">{m.fire_progress_pct}%</div>
            <div class="text-[11px] text-zinc-500">Target: {formatCurrency(m.fire_target_amount)}</div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="w-full bg-zinc-800 rounded-full h-3 overflow-hidden p-0.5 border border-zinc-700/50">
          <div
            class="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-500"
            style="width: {Math.min(100, m.fire_progress_pct)}%"
          ></div>
        </div>

        <div class="flex items-center justify-between text-[11px] text-zinc-400 mt-3">
          <span>Current Net Worth: {formatCurrency(m.net_worth)}</span>
          <span>Remaining: {formatCurrency(Math.max(0, m.fire_target_amount - m.net_worth))}</span>
        </div>
      </div>

      <!-- Emergency Runway Card -->
      <div class="p-6 rounded-xl bg-zinc-900/40 border border-zinc-800/80 flex flex-col justify-between">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Emergency Runway</span>
          <ShieldCheck class="w-4 h-4 text-emerald-400" />
        </div>

        <div class="my-3">
          <div class="text-3xl font-extrabold font-mono text-emerald-400">
            {m.emergency_runway_months} <span class="text-sm font-medium text-zinc-400">Months</span>
          </div>
          <div class="text-xs text-zinc-500 mt-1">
            Based on monthly burn rate of {formatCurrency(m.monthly_burn_rate)}
          </div>
        </div>

        <div class="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-300">
          ✓ Healthy runway exceeds recommended 6-month safety threshold.
        </div>
      </div>
    </div>

    <!-- Monthly Cash Flow Banner -->
    <div class="p-5 rounded-xl bg-zinc-900/30 border border-zinc-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-0 sm:divide-x divide-zinc-800/80">
      <div class="flex items-center gap-3 px-2 sm:px-4">
        <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
          <ArrowUpRight class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] text-zinc-400 uppercase font-semibold">Monthly Inflow</div>
          <div class="text-base sm:text-lg font-bold font-mono text-emerald-400 truncate">{formatCurrency(m.monthly_income)}</div>
        </div>
      </div>

      <div class="flex items-center gap-3 px-2 sm:px-4">
        <div class="p-2 rounded-lg bg-rose-500/10 text-rose-400 shrink-0">
          <ArrowDownRight class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] text-zinc-400 uppercase font-semibold">Monthly Outflow</div>
          <div class="text-base sm:text-lg font-bold font-mono text-rose-400 truncate">{formatCurrency(m.monthly_expenses)}</div>
        </div>
      </div>

      <div class="flex items-center gap-3 px-2 sm:px-4">
        <div class="p-2 rounded-lg bg-sky-500/10 text-sky-400 shrink-0">
          <Percent class="w-5 h-5" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] text-zinc-400 uppercase font-semibold">Savings Rate</div>
          <div class="text-base sm:text-lg font-bold font-mono text-sky-400 truncate">{m.savings_rate_pct}%</div>
        </div>
      </div>
    </div>
  {:else}
    <div class="p-12 text-center text-zinc-500">
      Loading wealth metrics...
    </div>
  {/if}
</div>
