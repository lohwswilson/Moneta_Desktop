<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type {
    PortfolioHolding,
    TaxLot,
    TaxLotDisposal,
    TaxLotStrategy,
  } from '../types/moneta';
  import {
    TrendingUp,
    DollarSign,
    Layers,
    PieChart,
    ArrowUpRight,
    ArrowDownRight,
    Clock,
    Search,
    Plus,
    X,
    CheckCircle2,
    AlertCircle,
    Scale,
    Briefcase,
    RefreshCw,
    History,
    Sparkles,
    Shield,
  } from '@lucide/svelte';

  // Sub-view Tab: 'holdings' | 'lots' | 'realized' | 'allocation'
  let activeTab = $state<'holdings' | 'lots' | 'realized' | 'allocation'>('holdings');

  // Filter states
  let searchQuery = $state<string>('');
  let selectedSecurityType = $state<string>('all');
  let selectedLotStatus = $state<'all' | 'open' | 'partially_disposed'>('all');
  let selectedDisposalYear = $state<string>('all');

  // Trade Modal State
  let tradeAction = $state<'buy' | 'sell'>('buy');
  let tradeAccountId = $state<string | number>('');
  let tradeSymbol = $state<string>('');
  let tradeQuantity = $state<number | ''>('');
  let tradePrice = $state<number | ''>('');
  let tradeDate = $state<string>(new Date().toISOString().split('T')[0]);
  let tradeCommission = $state<number | ''>(0);
  let tradeStrategy = $state<TaxLotStrategy>('FIFO');
  let tradeSelectedLotId = $state<string | number | ''>('');
  let tradeMemo = $state<string>('');
  let tradeError = $state<string | null>(null);
  let isSubmittingTrade = $state<boolean>(false);

  // Formatting helpers
  const formatCurrency = (amount: number, currency: string = 'SGD') => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || financeStore.settings?.base_currency || 'SGD',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatCurrencyExact = (amount: number, currency: string = 'SGD') => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || financeStore.settings?.base_currency || 'SGD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  const formatPercent = (val: number) => {
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  // Investment accounts
  let investmentAccounts = $derived.by(() => {
    return financeStore.accounts.filter((a) =>
      ['brokerage', 'retirement', 'crypto'].includes(a.account_type)
    );
  });

  // Filtered Holdings
  let filteredHoldings = $derived.by(() => {
    return financeStore.holdings.filter((h) => {
      const matchesSearch =
        !searchQuery ||
        h.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        selectedSecurityType === 'all' || h.security_type === selectedSecurityType;
      const matchesAccount =
        !financeStore.selectedPortfolioAccountId ||
        String(h.account_id) === String(financeStore.selectedPortfolioAccountId);
      return matchesSearch && matchesType && matchesAccount;
    });
  });

  // Filtered Tax Lots
  let filteredTaxLots = $derived.by(() => {
    return financeStore.taxLots.filter((lot) => {
      const matchesSearch =
        !searchQuery || lot.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        selectedLotStatus === 'all' ||
        (selectedLotStatus === 'open' && lot.remaining_quantity === lot.initial_quantity) ||
        (selectedLotStatus === 'partially_disposed' &&
          lot.remaining_quantity < lot.initial_quantity &&
          lot.remaining_quantity > 0);
      const matchesAccount =
        !financeStore.selectedPortfolioAccountId ||
        String(lot.account_id) === String(financeStore.selectedPortfolioAccountId);
      return matchesSearch && matchesStatus && matchesAccount;
    });
  });

  // Available lots for selected trade symbol (for Specific ID sell strategy)
  let availableLotsForTrade = $derived.by(() => {
    if (!tradeSymbol) return [];
    return financeStore.taxLots.filter(
      (lot) =>
        lot.symbol.toUpperCase() === tradeSymbol.toUpperCase() &&
        lot.remaining_quantity > 0 &&
        (!tradeAccountId || String(lot.account_id) === String(tradeAccountId))
    );
  });

  // Filtered Realized Disposals
  let filteredDisposals = $derived.by(() => {
    return financeStore.taxLotDisposals.filter((disp) => {
      const matchesYear =
        selectedDisposalYear === 'all' ||
        disp.disposal_date.startsWith(selectedDisposalYear);
      const matchesSearch =
        !searchQuery || disp.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesYear && matchesSearch;
    });
  });

  // Derived Summary & Metrics
  let summary = $derived(financeStore.portfolioSummary);

  let shortTermLotsCount = $derived.by(() => {
    return financeStore.taxLots.filter((l) => l.term_type === 'short_term').length;
  });

  let longTermLotsCount = $derived.by(() => {
    return financeStore.taxLots.filter((l) => l.term_type === 'long_term').length;
  });

  let shortTermRealizedGain = $derived.by(() => {
    return financeStore.taxLotDisposals
      .filter((d) => d.term_type === 'short_term')
      .reduce((sum, d) => sum + d.realized_gain, 0);
  });

  let longTermRealizedGain = $derived.by(() => {
    return financeStore.taxLotDisposals
      .filter((d) => d.term_type === 'long_term')
      .reduce((sum, d) => sum + d.realized_gain, 0);
  });

  let totalDayChange = $derived.by(() => {
    return financeStore.holdings.reduce((sum, h) => sum + (h.day_change || 0), 0);
  });

  let totalDayChangePercent = $derived.by(() => {
    const val = summary?.total_portfolio_value || 0;
    if (val <= 0) return 0;
    const prev = val - totalDayChange;
    return prev > 0 ? (totalDayChange / prev) * 100 : 0;
  });

  // Asset class distribution
  let assetClassDistribution = $derived.by(() => {
    if (summary?.asset_allocation && summary.asset_allocation.length > 0) {
      return summary.asset_allocation;
    }
    const map: Record<string, number> = {
      stock: 0,
      etf: 0,
      crypto: 0,
      mutual_fund: 0,
      bond: 0,
    };
    let totalVal = 0;
    for (const h of financeStore.holdings) {
      const type = h.security_type || 'stock';
      map[type] = (map[type] || 0) + h.current_market_value;
      totalVal += h.current_market_value;
    }
    return Object.entries(map)
      .filter(([_, val]) => val > 0)
      .map(([type, val]) => ({
        category: type.toUpperCase(),
        value: val,
        percentage: totalVal > 0 ? (val / totalVal) * 100 : 0,
        color: type === 'stock' ? '#10b981' : type === 'etf' ? '#38bdf8' : '#a855f7',
      }))
      .sort((a, b) => b.value - a.value);
  });

  // Brokerage distribution
  let brokerageDistribution = $derived.by(() => {
    const map: Record<string, { name: string; value: number }> = {};
    let totalVal = 0;
    for (const h of financeStore.holdings) {
      const accId = String(h.account_id);
      if (!map[accId]) {
        map[accId] = { name: h.account_name, value: 0 };
      }
      map[accId].value += h.current_market_value;
      totalVal += h.current_market_value;
    }
    return Object.values(map)
      .map((item) => ({
        name: item.name,
        value: item.value,
        percentage: totalVal > 0 ? (item.value / totalVal) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  });

  // Trade Modal Helpers
  function openTradeModal(holding?: PortfolioHolding, action: 'buy' | 'sell' = 'buy', specificLotId?: string | number) {
    tradeError = null;
    tradeAction = action;
    tradeStrategy = specificLotId ? 'SpecID' : 'FIFO';
    tradeSelectedLotId = specificLotId || '';
    tradeDate = new Date().toISOString().split('T')[0];
    tradeCommission = 0;
    tradeMemo = '';

    if (holding) {
      tradeSymbol = holding.symbol;
      tradeAccountId = holding.account_id;
      tradePrice = holding.current_price;
      tradeQuantity = action === 'sell' ? holding.total_quantity : '';
    } else if (investmentAccounts.length > 0) {
      tradeAccountId = investmentAccounts[0].id;
      tradeSymbol = '';
      tradePrice = '';
      tradeQuantity = '';
    }

    if (specificLotId) {
      const lot = financeStore.taxLots.find((l) => String(l.id) === String(specificLotId));
      if (lot) {
        tradeSymbol = lot.symbol;
        tradeAccountId = lot.account_id;
        tradeQuantity = lot.remaining_quantity;
        tradePrice = lot.purchase_price;
      }
    }

    financeStore.isTradeModalOpen = true;
  }

  function closeTradeModal() {
    financeStore.isTradeModalOpen = false;
    tradeError = null;
  }

  async function handleExecuteTrade() {
    if (!tradeAccountId) {
      tradeError = 'Please select a brokerage account';
      return;
    }
    if (!tradeSymbol.trim()) {
      tradeError = 'Please enter a ticker symbol';
      return;
    }
    if (!tradeQuantity || Number(tradeQuantity) <= 0) {
      tradeError = 'Please enter a valid quantity';
      return;
    }
    if (!tradePrice || Number(tradePrice) <= 0) {
      tradeError = 'Please enter a valid price';
      return;
    }

    isSubmittingTrade = true;
    tradeError = null;

    try {
      const res = await financeStore.executeTrade({
        accountId: tradeAccountId,
        symbol: tradeSymbol.trim().toUpperCase(),
        action: tradeAction,
        quantity: Number(tradeQuantity),
        price: Number(tradePrice),
        tradeDate: tradeDate,
        commission: Number(tradeCommission) || 0,
        strategy: tradeAction === 'sell' ? tradeStrategy : undefined,
        selectedLotId: tradeAction === 'sell' && tradeStrategy === 'SpecID' ? tradeSelectedLotId : undefined,
        memo: tradeMemo.trim() || undefined,
      });

      if (!res.success) {
        tradeError = res.message || 'Failed to execute trade';
      } else {
        closeTradeModal();
      }
    } catch (err: any) {
      tradeError = err?.message || 'Error executing trade';
    } finally {
      isSubmittingTrade = false;
    }
  }

  // Handle switching account filter
  async function handleAccountFilterChange(accId: string) {
    financeStore.selectedPortfolioAccountId = accId ? accId : null;
    await financeStore.loadPortfolio(accId ? accId : undefined);
  }

  function jumpToLotsForSymbol(sym: string) {
    searchQuery = sym;
    activeTab = 'lots';
  }
</script>

<div class="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
  <!-- Top Navigation Header -->
  <header class="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/50 backdrop-blur flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
        <Briefcase class="w-5 h-5" />
      </div>
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-lg font-bold text-zinc-100 tracking-tight">Portfolio & Tax-Lot Accounting</h1>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
            <Shield class="w-2.5 h-2.5" />
            Phase 4 Parity
          </span>
        </div>
        <p class="text-xs text-zinc-400">
          Multi-brokerage tracking, Singapore & US equities, lot disposal engine & performance analytics
        </p>
      </div>
    </div>

    <!-- Actions & Account Filter -->
    <div class="flex items-center gap-3">
      <!-- Brokerage Account Dropdown -->
      <select
        value={financeStore.selectedPortfolioAccountId || ''}
        onchange={(e) => handleAccountFilterChange(e.currentTarget.value)}
        class="bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
      >
        <option value="">All Investment Accounts</option>
        {#each investmentAccounts as acc}
          <option value={acc.id}>{acc.name} ({acc.currency_code})</option>
        {/each}
      </select>

      <!-- Refresh Button -->
      <button
        onclick={() => financeStore.loadPortfolio()}
        class="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/60 transition-colors"
        title="Refresh Portfolio"
      >
        <RefreshCw class="w-4 h-4 {financeStore.isLoading ? 'animate-spin text-emerald-400' : ''}" />
      </button>

      <!-- Trade Action Button -->
      <button
        onclick={() => openTradeModal(undefined, 'buy')}
        class="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-sm transition-colors"
      >
        <Plus class="w-4 h-4" />
        Record Trade
      </button>
    </div>
  </header>

  <!-- Scrollable Dashboard Content -->
  <div class="flex-1 overflow-y-auto px-6 py-5 space-y-6">
    <!-- Hero Performance & Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Card 1: Total Portfolio Value -->
      <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm flex flex-col justify-between">
        <div class="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span class="font-medium flex items-center gap-1.5">
            <DollarSign class="w-3.5 h-3.5 text-emerald-400" />
            Total Portfolio Value
          </span>
          <span class="text-[10px] text-zinc-500 font-mono">
            {financeStore.holdings.length} holdings
          </span>
        </div>
        <div class="mt-1">
          <div class="text-2xl font-bold font-mono text-zinc-100">
            {formatCurrencyExact(summary?.total_portfolio_value || 0)}
          </div>
          <div class="mt-2 flex items-center justify-between text-xs">
            <span class="text-zinc-500">Day Change:</span>
            <span class="font-mono font-medium {totalDayChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
              {totalDayChange >= 0 ? '+' : ''}{formatCurrencyExact(totalDayChange)}
              <span class="text-[11px] ml-0.5">({formatPercent(totalDayChangePercent)})</span>
            </span>
          </div>
        </div>
      </div>

      <!-- Card 2: Unrealized Gain / Loss -->
      <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm flex flex-col justify-between">
        <div class="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span class="font-medium flex items-center gap-1.5">
            <TrendingUp class="w-3.5 h-3.5 text-sky-400" />
            Unrealized Gain / Loss
          </span>
          <span class="text-[10px] text-zinc-500 font-mono">
            {summary?.open_lots_count || financeStore.taxLots.length} Open Lots
          </span>
        </div>
        <div class="mt-1">
          <div class="text-2xl font-bold font-mono {(summary?.total_unrealized_gain || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            {(summary?.total_unrealized_gain || 0) >= 0 ? '+' : ''}{formatCurrencyExact(summary?.total_unrealized_gain || 0)}
          </div>
          <div class="mt-2 flex items-center justify-between text-xs">
            <span class="text-zinc-500">Cost Basis:</span>
            <span class="font-mono text-zinc-300">
              {formatCurrencyExact(summary?.total_cost_basis || 0)}
              <span class="ml-1 text-[11px] font-semibold {(summary?.total_unrealized_gain_percent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                ({formatPercent(summary?.total_unrealized_gain_percent || 0)})
              </span>
            </span>
          </div>
        </div>
      </div>

      <!-- Card 3: Realized Capital Gains -->
      <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm flex flex-col justify-between">
        <div class="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span class="font-medium flex items-center gap-1.5">
            <Scale class="w-3.5 h-3.5 text-amber-400" />
            Realized Gains YTD
          </span>
          <span class="text-[10px] text-zinc-500 font-mono">
            {financeStore.taxLotDisposals.length} Disposals
          </span>
        </div>
        <div class="mt-1">
          <div class="text-2xl font-bold font-mono {(summary?.total_realized_gain_ytd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            {(summary?.total_realized_gain_ytd || 0) >= 0 ? '+' : ''}{formatCurrencyExact(summary?.total_realized_gain_ytd || 0)}
          </div>
          <div class="mt-2 flex items-center justify-between text-[11px] pt-0.5 border-t border-zinc-800/60">
            <span class="text-zinc-400">
              ST: <span class="font-mono font-medium {shortTermRealizedGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                {shortTermRealizedGain >= 0 ? '+' : ''}{formatCurrencyExact(shortTermRealizedGain)}
              </span>
            </span>
            <span class="text-zinc-400">
              LT: <span class="font-mono font-medium {longTermRealizedGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                {longTermRealizedGain >= 0 ? '+' : ''}{formatCurrencyExact(longTermRealizedGain)}
              </span>
            </span>
          </div>
        </div>
      </div>

      <!-- Card 4: Returns (TWR & XIRR) -->
      <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm flex flex-col justify-between">
        <div class="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span class="font-medium flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-purple-400" />
            Performance Returns
          </span>
          <span class="text-[10px] text-zinc-500 font-mono">
            Modified Dietz / XIRR
          </span>
        </div>
        <div class="mt-1 flex items-baseline justify-between">
          <div>
            <div class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">TWR</div>
            <div class="text-xl font-bold font-mono {(summary?.time_weighted_return || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
              {formatPercent(summary?.time_weighted_return || 0)}
            </div>
          </div>
          <div class="text-right">
            <div class="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">XIRR (MWR)</div>
            <div class="text-xl font-bold font-mono {(summary?.money_weighted_return || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
              {formatPercent(summary?.money_weighted_return || 0)}
            </div>
          </div>
        </div>
        <div class="mt-2 text-[10px] text-zinc-500 flex items-center gap-1">
          <Clock class="w-3 h-3 text-zinc-600" />
          Time-weighted vs Money-weighted
        </div>
      </div>
    </div>

    <!-- Navigation Tabs & View Controls -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
      <div class="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
        <button
          onclick={() => (activeTab = 'holdings')}
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 {activeTab === 'holdings' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
        >
          <Layers class="w-3.5 h-3.5" />
          Holdings ({financeStore.holdings.length})
        </button>
        <button
          onclick={() => (activeTab = 'lots')}
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 {activeTab === 'lots' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
        >
          <Scale class="w-3.5 h-3.5" />
          Tax-Lots Inventory ({financeStore.taxLots.length})
        </button>
        <button
          onclick={() => (activeTab = 'realized')}
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 {activeTab === 'realized' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
        >
          <History class="w-3.5 h-3.5" />
          Realized Gains ({financeStore.taxLotDisposals.length})
        </button>
        <button
          onclick={() => (activeTab = 'allocation')}
          class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 {activeTab === 'allocation' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
        >
          <PieChart class="w-3.5 h-3.5" />
          Asset Allocation
        </button>
      </div>

      <!-- Filters depending on active tab -->
      <div class="flex items-center gap-2">
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter ticker / name..."
            bind:value={searchQuery}
            class="bg-zinc-900 border border-zinc-800 text-xs rounded-lg pl-8 pr-3 py-1.5 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 w-44 transition-all"
          />
        </div>

        {#if activeTab === 'holdings'}
          <select
            bind:value={selectedSecurityType}
            class="bg-zinc-900 border border-zinc-800 text-xs rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Asset Types</option>
            <option value="stock">Equities</option>
            <option value="etf">ETFs</option>
            <option value="crypto">Crypto</option>
            <option value="mutual_fund">Mutual Funds</option>
            <option value="bond">Bonds</option>
          </select>
        {:else if activeTab === 'lots'}
          <select
            bind:value={selectedLotStatus}
            class="bg-zinc-900 border border-zinc-800 text-xs rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Lots</option>
            <option value="open">Open (Untouched)</option>
            <option value="partially_disposed">Partially Sold</option>
          </select>
        {:else if activeTab === 'realized'}
          <select
            bind:value={selectedDisposalYear}
            class="bg-zinc-900 border border-zinc-800 text-xs rounded-lg px-2.5 py-1.5 text-zinc-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Years</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        {/if}
      </div>
    </div>

    <!-- TAB 1: HOLDINGS & POSITIONS -->
    {#if activeTab === 'holdings'}
      <div class="bg-zinc-900/60 rounded-xl border border-zinc-800/80 overflow-hidden shadow-sm">
        {#if filteredHoldings.length === 0}
          <div class="py-16 text-center text-zinc-500 space-y-3">
            <Briefcase class="w-10 h-10 mx-auto text-zinc-600 stroke-1" />
            <div class="text-sm font-medium">No investment holdings found</div>
            <p class="text-xs max-w-sm mx-auto text-zinc-500">
              Record a buy trade or switch accounts to see your active stock and ETF positions.
            </p>
            <button
              onclick={() => openTradeModal(undefined, 'buy')}
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
            >
              <Plus class="w-3.5 h-3.5" />
              Record First Trade
            </button>
          </div>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs text-zinc-300 border-collapse">
              <thead>
                <tr class="border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-900/80">
                  <th class="py-3 px-4">Security</th>
                  <th class="py-3 px-4">Account</th>
                  <th class="py-3 px-4 text-right">Shares</th>
                  <th class="py-3 px-4 text-right">Avg Cost</th>
                  <th class="py-3 px-4 text-right">Current Price</th>
                  <th class="py-3 px-4 text-right">Market Value</th>
                  <th class="py-3 px-4 text-right">Day Change</th>
                  <th class="py-3 px-4 text-right">Unrealized Gain</th>
                  <th class="py-3 px-4 text-right">Weight</th>
                  <th class="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-zinc-800/60">
                {#each filteredHoldings as holding}
                  <tr class="hover:bg-zinc-800/40 transition-colors group">
                    <td class="py-3.5 px-4">
                      <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/60 flex items-center justify-center font-mono font-bold text-zinc-200 text-xs">
                          {holding.symbol.slice(0, 4)}
                        </div>
                        <div>
                          <div class="font-bold text-zinc-100 flex items-center gap-1.5 font-mono">
                            {holding.symbol}
                            <span class="text-[9px] uppercase font-sans font-semibold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/40">
                              {holding.security_type || 'stock'}
                            </span>
                          </div>
                          <div class="text-[11px] text-zinc-400 truncate max-w-[160px]">
                            {holding.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td class="py-3.5 px-4 text-zinc-400">
                      <span class="px-2 py-0.5 rounded bg-zinc-800/80 text-[11px] border border-zinc-700/40">
                        {holding.account_name}
                      </span>
                    </td>
                    <td class="py-3.5 px-4 text-right font-mono font-medium text-zinc-200">
                      {holding.total_quantity.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                    </td>
                    <td class="py-3.5 px-4 text-right font-mono text-zinc-400">
                      {formatCurrencyExact(holding.average_cost, holding.currency)}
                    </td>
                    <td class="py-3.5 px-4 text-right font-mono font-medium text-zinc-100">
                      {formatCurrencyExact(holding.current_price, holding.currency)}
                    </td>
                    <td class="py-3.5 px-4 text-right font-mono font-bold text-zinc-100">
                      {formatCurrencyExact(holding.current_market_value, holding.currency)}
                    </td>
                    <td class="py-3.5 px-4 text-right font-mono {(holding.day_change || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                      <div>{(holding.day_change || 0) >= 0 ? '+' : ''}{formatCurrencyExact(holding.day_change || 0, holding.currency)}</div>
                      <div class="text-[10px]">{formatPercent(holding.day_change_percent || 0)}</div>
                    </td>
                    <td class="py-3.5 px-4 text-right font-mono {holding.unrealized_gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                      <div class="font-bold">{holding.unrealized_gain >= 0 ? '+' : ''}{formatCurrencyExact(holding.unrealized_gain, holding.currency)}</div>
                      <div class="text-[10px]">{formatPercent(holding.unrealized_gain_percent)}</div>
                    </td>
                    <td class="py-3.5 px-4 text-right">
                      <div class="font-mono text-zinc-300 font-semibold">{holding.weight_in_portfolio.toFixed(1)}%</div>
                      <div class="w-16 h-1 bg-zinc-800 rounded-full ml-auto mt-1 overflow-hidden">
                        <div class="h-full bg-emerald-500 rounded-full" style="width: {Math.min(100, holding.weight_in_portfolio)}%"></div>
                      </div>
                    </td>
                    <td class="py-3.5 px-4 text-center">
                      <div class="flex items-center justify-center gap-1.5">
                        <button
                          onclick={() => openTradeModal(holding, 'sell')}
                          class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors"
                          title="Sell or Rebalance"
                        >
                          Trade
                        </button>
                        <button
                          onclick={() => jumpToLotsForSymbol(holding.symbol)}
                          class="px-2 py-1 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-[11px] transition-colors"
                          title="View Tax-Lots"
                        >
                          Lots
                        </button>
                      </div>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}

    <!-- TAB 2: TAX-LOTS INVENTORY -->
    {#if activeTab === 'lots'}
      <div class="space-y-4">
        <!-- Tax Lot Overview Banners -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <div>
              <div class="text-[11px] text-zinc-500 uppercase font-semibold">Total Tax Lots</div>
              <div class="text-xl font-bold font-mono text-zinc-200 mt-0.5">{financeStore.taxLots.length}</div>
            </div>
            <Scale class="w-6 h-6 text-zinc-600 stroke-1" />
          </div>
          <div class="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 flex items-center justify-between">
            <div>
              <div class="text-[11px] text-amber-400 uppercase font-semibold">Short-Term Lots (&lt; 365 Days)</div>
              <div class="text-xl font-bold font-mono text-amber-300 mt-0.5">{shortTermLotsCount}</div>
            </div>
            <Clock class="w-6 h-6 text-amber-500/60 stroke-1" />
          </div>
          <div class="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between">
            <div>
              <div class="text-[11px] text-emerald-400 uppercase font-semibold">Long-Term Lots (≥ 365 Days)</div>
              <div class="text-xl font-bold font-mono text-emerald-300 mt-0.5">{longTermLotsCount}</div>
            </div>
            <CheckCircle2 class="w-6 h-6 text-emerald-500/60 stroke-1" />
          </div>
        </div>

        <div class="bg-zinc-900/60 rounded-xl border border-zinc-800/80 overflow-hidden shadow-sm">
          {#if filteredTaxLots.length === 0}
            <div class="py-16 text-center text-zinc-500 space-y-2">
              <Scale class="w-10 h-10 mx-auto text-zinc-600 stroke-1" />
              <div class="text-sm font-medium">No tax lots found</div>
              <p class="text-xs text-zinc-500">Tax lots are automatically created on buy trades and tracked until sold.</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-zinc-300 border-collapse">
                <thead>
                  <tr class="border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-900/80">
                    <th class="py-3 px-4">Lot ID / Symbol</th>
                    <th class="py-3 px-4">Account</th>
                    <th class="py-3 px-4">Acquired Date</th>
                    <th class="py-3 px-4 text-center">Holding Period</th>
                    <th class="py-3 px-4 text-center">Term Type</th>
                    <th class="py-3 px-4 text-right">Shares (Rem / Init)</th>
                    <th class="py-3 px-4 text-right">Cost Basis</th>
                    <th class="py-3 px-4 text-right">Market Value</th>
                    <th class="py-3 px-4 text-right">Unrealized Gain</th>
                    <th class="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800/60">
                  {#each filteredTaxLots as lot}
                    <tr class="hover:bg-zinc-800/40 transition-colors">
                      <td class="py-3.5 px-4 font-mono">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-zinc-100">{lot.symbol}</span>
                          <span class="text-[10px] text-zinc-500">#{lot.id}</span>
                        </div>
                      </td>
                      <td class="py-3.5 px-4 text-zinc-400 text-[11px]">
                        {lot.account_name || 'Brokerage'}
                      </td>
                      <td class="py-3.5 px-4 font-mono text-zinc-300">
                        {lot.purchase_date}
                      </td>
                      <td class="py-3.5 px-4 text-center font-mono text-zinc-300">
                        {lot.holding_days} days
                        <span class="text-[10px] text-zinc-500 block">({(lot.holding_days / 365).toFixed(1)} yrs)</span>
                      </td>
                      <td class="py-3.5 px-4 text-center">
                        {#if lot.term_type === 'short_term'}
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60 inline-flex items-center gap-1">
                            <Clock class="w-2.5 h-2.5" />
                            Short-Term (&lt;365d)
                          </span>
                        {:else}
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 inline-flex items-center gap-1">
                            <CheckCircle2 class="w-2.5 h-2.5" />
                            Long-Term (≥365d)
                          </span>
                        {/if}
                      </td>
                      <td class="py-3.5 px-4 text-right font-mono">
                        <div class="font-bold text-zinc-100">{lot.remaining_quantity}</div>
                        <div class="text-[10px] text-zinc-500">of {lot.initial_quantity} shs</div>
                      </td>
                      <td class="py-3.5 px-4 text-right font-mono">
                        <div>{formatCurrencyExact(lot.total_cost_basis)}</div>
                        <div class="text-[10px] text-zinc-500">@{formatCurrencyExact(lot.purchase_price)}</div>
                      </td>
                      <td class="py-3.5 px-4 text-right font-mono font-bold text-zinc-100">
                        {formatCurrencyExact(lot.current_market_value)}
                      </td>
                      <td class="py-3.5 px-4 text-right font-mono {lot.unrealized_gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                        <div class="font-bold">{lot.unrealized_gain >= 0 ? '+' : ''}{formatCurrencyExact(lot.unrealized_gain)}</div>
                        <div class="text-[10px]">{formatPercent(lot.unrealized_gain_percent)}</div>
                      </td>
                      <td class="py-3.5 px-4 text-center">
                        <button
                          onclick={() => openTradeModal(undefined, 'sell', lot.id)}
                          class="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold transition-colors"
                          title="Sell this specific lot"
                        >
                          Specific Sell
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- TAB 3: REALIZED CAPITAL GAINS -->
    {#if activeTab === 'realized'}
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
            <div>
              <div class="text-[11px] text-zinc-500 uppercase font-semibold">Total Realized Gain (YTD)</div>
              <div class="text-xl font-bold font-mono {(summary?.total_realized_gain_ytd || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-0.5">
                {(summary?.total_realized_gain_ytd || 0) >= 0 ? '+' : ''}{formatCurrencyExact(summary?.total_realized_gain_ytd || 0)}
              </div>
            </div>
            <History class="w-6 h-6 text-zinc-600 stroke-1" />
          </div>
          <div class="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/40 flex items-center justify-between">
            <div>
              <div class="text-[11px] text-amber-400 uppercase font-semibold">Short-Term Realized Gain</div>
              <div class="text-xl font-bold font-mono {shortTermRealizedGain >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-0.5">
                {shortTermRealizedGain >= 0 ? '+' : ''}{formatCurrencyExact(shortTermRealizedGain)}
              </div>
            </div>
            <Clock class="w-6 h-6 text-amber-500/60 stroke-1" />
          </div>
          <div class="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 flex items-center justify-between">
            <div>
              <div class="text-[11px] text-emerald-400 uppercase font-semibold">Long-Term Realized Gain</div>
              <div class="text-xl font-bold font-mono {longTermRealizedGain >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-0.5">
                {longTermRealizedGain >= 0 ? '+' : ''}{formatCurrencyExact(longTermRealizedGain)}
              </div>
            </div>
            <CheckCircle2 class="w-6 h-6 text-emerald-500/60 stroke-1" />
          </div>
        </div>

        <div class="bg-zinc-900/60 rounded-xl border border-zinc-800/80 overflow-hidden shadow-sm">
          {#if filteredDisposals.length === 0}
            <div class="py-16 text-center text-zinc-500 space-y-2">
              <History class="w-10 h-10 mx-auto text-zinc-600 stroke-1" />
              <div class="text-sm font-medium">No realized disposals recorded</div>
              <p class="text-xs text-zinc-500">When you sell holdings, tax-lot matching strategies allocate cost basis and compute realized gains here.</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-zinc-300 border-collapse">
                <thead>
                  <tr class="border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-900/80">
                    <th class="py-3 px-4">Disposal Date</th>
                    <th class="py-3 px-4">Symbol</th>
                    <th class="py-3 px-4 text-center">Lot ID</th>
                    <th class="py-3 px-4 text-center">Term</th>
                    <th class="py-3 px-4 text-right">Shares Sold</th>
                    <th class="py-3 px-4 text-right">Gross Proceeds</th>
                    <th class="py-3 px-4 text-right">Cost Basis Sold</th>
                    <th class="py-3 px-4 text-right">Realized P/L</th>
                    <th class="py-3 px-4 text-center">Strategy</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800/60">
                  {#each filteredDisposals as disp}
                    <tr class="hover:bg-zinc-800/40 transition-colors">
                      <td class="py-3.5 px-4 font-mono text-zinc-200">
                        {disp.disposal_date}
                      </td>
                      <td class="py-3.5 px-4 font-mono font-bold text-zinc-100">
                        {disp.symbol}
                      </td>
                      <td class="py-3.5 px-4 text-center font-mono text-zinc-400">
                        #{disp.lot_id}
                      </td>
                      <td class="py-3.5 px-4 text-center">
                        {#if disp.term_type === 'short_term'}
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/60">
                            Short-Term
                          </span>
                        {:else}
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                            Long-Term
                          </span>
                        {/if}
                      </td>
                      <td class="py-3.5 px-4 text-right font-mono font-bold text-zinc-100">
                        {disp.quantity_sold}
                      </td>
                      <td class="py-3.5 px-4 text-right font-mono font-medium text-zinc-200">
                        {formatCurrencyExact(disp.proceeds)}
                      </td>
                      <td class="py-3.5 px-4 text-right font-mono text-zinc-400">
                        {formatCurrencyExact(disp.cost_basis_sold)}
                      </td>
                      <td class="py-3.5 px-4 text-right font-mono {disp.realized_gain >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                        <div class="font-bold">{disp.realized_gain >= 0 ? '+' : ''}{formatCurrencyExact(disp.realized_gain)}</div>
                        <div class="text-[10px]">
                          ({disp.cost_basis_sold > 0 ? formatPercent((disp.realized_gain / disp.cost_basis_sold) * 100) : '0.00%'})
                        </div>
                      </td>
                      <td class="py-3.5 px-4 text-center font-mono">
                        <span class="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] uppercase font-semibold border border-zinc-700/60">
                          {disp.disposal_strategy}
                        </span>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- TAB 4: ASSET ALLOCATION & BROKERAGES -->
    {#if activeTab === 'allocation'}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Asset Class Breakdown -->
        <div class="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <PieChart class="w-4 h-4 text-emerald-400" />
              Asset Class Allocation
            </h3>
            <span class="text-xs text-zinc-400 font-mono">
              Total {formatCurrencyExact(summary?.total_portfolio_value || 0)}
            </span>
          </div>

          <div class="space-y-3">
            {#each assetClassDistribution as item}
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-semibold text-zinc-200 capitalize">{item.category}</span>
                  <div class="text-right font-mono">
                    <span class="font-bold text-zinc-100">{formatCurrencyExact(item.value)}</span>
                    <span class="text-zinc-400 ml-1.5 font-sans">({item.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <div class="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div class="h-full rounded-full" style="width: {item.percentage}%; background-color: {item.color || '#10b981'}"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>

        <!-- Brokerage Account Allocation -->
        <div class="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
          <div class="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Briefcase class="w-4 h-4 text-sky-400" />
              Brokerage Account Distribution
            </h3>
            <span class="text-xs text-zinc-400 font-mono">
              {brokerageDistribution.length} Brokers
            </span>
          </div>

          <div class="space-y-3">
            {#each brokerageDistribution as broker}
              <div class="space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-semibold text-zinc-200">{broker.name}</span>
                  <div class="text-right font-mono">
                    <span class="font-bold text-zinc-100">{formatCurrencyExact(broker.value)}</span>
                    <span class="text-zinc-400 ml-1.5 font-sans">({broker.percentage.toFixed(1)}%)</span>
                  </div>
                </div>
                <div class="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div class="h-full bg-sky-500 rounded-full" style="width: {broker.percentage}%"></div>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- TRADE EXECUTION MODAL -->
{#if financeStore.isTradeModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg {tradeAction === 'buy' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'} flex items-center justify-center">
            {#if tradeAction === 'buy'}
              <ArrowDownRight class="w-4 h-4" />
            {:else}
              <ArrowUpRight class="w-4 h-4" />
            {/if}
          </div>
          <div>
            <h2 class="text-sm font-bold text-zinc-100">
              {tradeAction === 'buy' ? 'Buy Security' : 'Sell Security / Tax-Lot'}
            </h2>
            <p class="text-[11px] text-zinc-400">Record investment transaction with automated lot accounting</p>
          </div>
        </div>
        <button
          onclick={closeTradeModal}
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body Form -->
      <form onsubmit={(e) => { e.preventDefault(); handleExecuteTrade(); }} class="p-6 space-y-4">
        {#if tradeError}
          <div class="p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle class="w-4 h-4 shrink-0" />
            <span>{tradeError}</span>
          </div>
        {/if}

        <!-- Buy vs Sell Action Toggle -->
        <div class="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onclick={() => (tradeAction = 'buy')}
            class="py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 {tradeAction === 'buy' ? 'bg-emerald-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            <ArrowDownRight class="w-3.5 h-3.5" />
            BUY (Acquire Lot)
          </button>
          <button
            type="button"
            onclick={() => (tradeAction = 'sell')}
            class="py-2 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 {tradeAction === 'sell' ? 'bg-rose-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            <ArrowUpRight class="w-3.5 h-3.5" />
            SELL (Dispose Lot)
          </button>
        </div>

        <!-- Brokerage Account & Symbol -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="trade-account-id" class="block text-[11px] font-medium text-zinc-400 mb-1">Brokerage Account</label>
            <select
              id="trade-account-id"
              bind:value={tradeAccountId}
              class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
              required
            >
              {#each investmentAccounts as acc}
                <option value={acc.id}>{acc.name} ({acc.currency_code})</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="trade-symbol-input" class="block text-[11px] font-medium text-zinc-400 mb-1">Ticker Symbol</label>
            <input
              id="trade-symbol-input"
              type="text"
              placeholder="e.g. NVDA, MSFT, D05.SI"
              bind:value={tradeSymbol}
              class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono uppercase text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
        </div>

        <!-- Quantity & Price -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="trade-shares-quantity" class="block text-[11px] font-medium text-zinc-400 mb-1">Quantity (Shares)</label>
            <input
              id="trade-shares-quantity"
              type="number"
              step="any"
              min="0.0001"
              placeholder="0.00"
              bind:value={tradeQuantity}
              class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
          <div>
            <label for="trade-price-per-share" class="block text-[11px] font-medium text-zinc-400 mb-1">Price per Share</label>
            <input
              id="trade-price-per-share"
              type="number"
              step="any"
              min="0.0001"
              placeholder="0.00"
              bind:value={tradePrice}
              class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
        </div>

        <!-- Date & Commission -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="trade-date-input" class="block text-[11px] font-medium text-zinc-400 mb-1">Trade Date</label>
            <input
              id="trade-date-input"
              type="date"
              bind:value={tradeDate}
              class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
              required
            />
          </div>
          <div>
            <label for="trade-commission-fees" class="block text-[11px] font-medium text-zinc-400 mb-1">Commission / Fees</label>
            <input
              id="trade-commission-fees"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              bind:value={tradeCommission}
              class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <!-- SELL ONLY: Strategy Selector -->
        {#if tradeAction === 'sell'}
          <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
            <div class="flex items-center justify-between">
              <label for="trade-disposal-strategy" class="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Scale class="w-3.5 h-3.5 text-amber-400" />
                Tax-Lot Matching Strategy
              </label>
              <span class="text-[10px] text-zinc-500">Tax Optimization</span>
            </div>
            <select
              id="trade-disposal-strategy"
              bind:value={tradeStrategy}
              class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
            >
              <option value="FIFO">FIFO (First In, First Out) — Standard</option>
              <option value="LIFO">LIFO (Last In, First Out) — Recent Lots First</option>
              <option value="HIFO">HIFO (Highest In, First Out) — Maximize Cost Basis / Minimize Gain</option>
              <option value="SpecID">Specific Lot Identification (SpecID)</option>
            </select>

            {#if tradeStrategy === 'SpecID'}
              <div class="mt-2 space-y-1.5">
                <label for="trade-specific-lot-select" class="block text-[10px] text-zinc-400 font-semibold uppercase">Select Lot to Dispose</label>
                {#if availableLotsForTrade.length === 0}
                  <div class="text-[11px] text-zinc-500 italic">No open lots available for {tradeSymbol || 'this ticker'}</div>
                {:else}
                  <select
                    id="trade-specific-lot-select"
                    bind:value={tradeSelectedLotId}
                    class="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                  >
                    <option value="">Choose a specific lot...</option>
                    {#each availableLotsForTrade as lot}
                      <option value={lot.id}>
                        Lot #{lot.id}: {lot.purchase_date} | {lot.remaining_quantity} shs @ ${lot.purchase_price.toFixed(2)} ({lot.term_type === 'short_term' ? 'ST' : 'LT'})
                      </option>
                    {/each}
                  </select>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Total Calculation Preview -->
        <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
          <span class="text-xs text-zinc-400">
            {tradeAction === 'buy' ? 'Estimated Total Outflow:' : 'Estimated Net Proceeds:'}
          </span>
          <span class="font-mono font-bold text-sm text-zinc-100">
            {#if tradeQuantity && tradePrice}
              {@const gross = Number(tradeQuantity) * Number(tradePrice)}
              {@const comm = Number(tradeCommission) || 0}
              {@const net = tradeAction === 'buy' ? gross + comm : gross - comm}
              {formatCurrencyExact(net)}
            {:else}
              $0.00
            {/if}
          </span>
        </div>

        <!-- Notes / Memo -->
        <div>
          <label for="trade-notes-memo" class="block text-[11px] font-medium text-zinc-400 mb-1">Notes / Broker Reference</label>
          <input
            id="trade-notes-memo"
            type="text"
            placeholder="e.g. IBKR Order #847291, DCA Tranche"
            bind:value={tradeMemo}
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <!-- Form Submit & Cancel -->
        <div class="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onclick={closeTradeModal}
            class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmittingTrade}
            class="px-4 py-2 rounded-lg {tradeAction === 'buy' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-rose-500 hover:bg-rose-600'} text-white text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {#if isSubmittingTrade}
              <RefreshCw class="w-3.5 h-3.5 animate-spin" />
              Recording...
            {:else}
              <CheckCircle2 class="w-3.5 h-3.5" />
              Confirm {tradeAction === 'buy' ? 'Purchase' : 'Disposal'}
            {/if}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
