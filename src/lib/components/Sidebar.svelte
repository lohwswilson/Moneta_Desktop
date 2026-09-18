<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { AccountType } from '../types/moneta';
  import {
    Wallet,
    TrendingUp,
    CreditCard,
    Home,
    Shield,
    Settings,
    Server,
    CheckCircle2,
    AlertCircle,
    LayoutDashboard,
    Gem,
    PiggyBank,
    CalendarClock,
    Workflow,
    Store,
    Target,
    Briefcase,
    Building2,
    Landmark,
    KeyRound
  } from '@lucide/svelte';

  const formatCurrency = (amount: number, currency: string = 'SGD') => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getAccountBadge = (type: AccountType) => {
    if (['checking', 'chequing', 'savings', 'cash', 'cpf_oa', 'cpf_sa', 'cpf_ma', 'cpf_ra', 'srs', 'epf_akaun_persaraan', 'epf_akaun_sejahtera', 'epf_akaun_fleksibel'].includes(type)) {
      return { color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60', icon: Wallet };
    }
    if (['brokerage', 'retirement', 'crypto'].includes(type)) {
      return { color: 'text-sky-400 bg-sky-950/60 border-sky-800/60', icon: TrendingUp };
    }
    if (['credit', 'credit_card', 'loc'].includes(type)) {
      return { color: 'text-purple-400 bg-purple-950/60 border-purple-800/60', icon: CreditCard };
    }
    if (['asset', 'property', 'other'].includes(type)) {
      return { color: 'text-amber-400 bg-amber-950/60 border-amber-800/60', icon: Gem };
    }
    return { color: 'text-rose-400 bg-rose-950/60 border-rose-800/60', icon: Home };
  };

  // Group accounts
  let bankAccounts = $derived(
    financeStore.accounts.filter((a) =>
      ['checking', 'chequing', 'savings', 'cash', 'cpf_oa', 'cpf_sa', 'cpf_ma', 'cpf_ra', 'srs', 'epf_akaun_persaraan', 'epf_akaun_sejahtera', 'epf_akaun_fleksibel'].includes(a.account_type)
    )
  );

  let investmentAccounts = $derived(
    financeStore.accounts.filter((a) =>
      ['brokerage', 'retirement', 'crypto'].includes(a.account_type)
    )
  );

  let assetAccounts = $derived(
    financeStore.accounts.filter((a) =>
      ['asset', 'property', 'other'].includes(a.account_type)
    )
  );

  let creditAccounts = $derived(
    financeStore.accounts.filter((a) =>
      ['credit', 'credit_card', 'loc'].includes(a.account_type)
    )
  );

  let loanAccounts = $derived(
    financeStore.accounts.filter((a) =>
      ['loan', 'mortgage'].includes(a.account_type)
    )
  );
</script>

<aside class="w-72 bg-zinc-950 border-r border-zinc-800/80 flex flex-col h-screen select-none">
  <!-- App Branding Header -->
  <div class="p-4 border-b border-zinc-800/80 flex items-center justify-between">
    <div class="flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
        M
      </div>
      <div>
        <div class="font-bold text-sm text-zinc-100 tracking-wide flex items-center gap-1.5">
          MONETA <span class="text-[10px] uppercase tracking-widest font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">Desktop</span>
        </div>
        <div class="text-[11px] text-zinc-500">Personal Wealth & Ledger</div>
      </div>
    </div>
  </div>

  <!-- Accounts List Area -->
  <div class="flex-1 overflow-y-auto px-3 py-4 space-y-5">
    <!-- Top Nav: Wealth Overview & Envelope Budgets -->
    <div class="space-y-1">
      <button
        onclick={() => financeStore.navigateToOverview()}
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors {financeStore.activeView === 'command_center' && financeStore.selectedAccountId === null ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <span class="flex items-center gap-2">
          <LayoutDashboard class="w-4 h-4 text-emerald-400" />
          Wealth Overview
        </span>
        {#if financeStore.metrics}
          <span class="font-mono text-zinc-300">
            {formatCurrency(financeStore.metrics.net_worth)}
          </span>
        {/if}
      </button>

      <button
        onclick={() => financeStore.navigateToBudgets()}
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors {financeStore.activeView === 'budgets' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <span class="flex items-center gap-2">
          <PiggyBank class="w-4 h-4 text-indigo-400" />
          Envelope Budgets
        </span>
        {#if financeStore.budgets.length > 0}
          {@const remainingTotal = financeStore.budgets.reduce((s, b) => s + (b.remaining_amount || 0), 0)}
          <span class="font-mono text-[11px] {remainingTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            {formatCurrency(remainingTotal)}
          </span>
        {/if}
      </button>

      <button
        onclick={() => financeStore.navigateToBills()}
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors {financeStore.activeView === 'bills' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <span class="flex items-center gap-2">
          <CalendarClock class="w-4 h-4 text-amber-400" />
          Recurring & Bills
        </span>
        {#if financeStore.bills.length > 0}
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-400 border border-amber-800/60">
            {financeStore.bills.length}
          </span>
        {/if}
      </button>

      <button
        onclick={() => financeStore.navigateToCashflow()}
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors {financeStore.activeView === 'cashflow' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <span class="flex items-center gap-2">
          <Workflow class="w-4 h-4 text-indigo-400" />
          Cash Flow & Sankey
        </span>
        {#if financeStore.cashflowForecast?.summary}
          {@const net = financeStore.cashflowForecast.summary.net_projected_cashflow}
          <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded {net >= 0 ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'}">
            {net >= 0 ? '+' : ''}{formatCurrency(net)}
          </span>
        {/if}
      </button>

      <button
        onclick={() => financeStore.navigateToPayees()}
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors {financeStore.activeView === 'payees' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <span class="flex items-center gap-2">
          <Store class="w-4 h-4 text-pink-400" />
          Payees & Directory
        </span>
        {#if financeStore.payees.length > 0}
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-950/60 text-pink-400 border border-pink-800/60">
            {financeStore.payees.length}
          </span>
        {/if}
      </button>

      <button
        onclick={() => financeStore.navigateToGoals()}
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors {financeStore.activeView === 'goals' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <span class="flex items-center gap-2">
          <Target class="w-4 h-4 text-sky-400" />
          Financial Goals
        </span>
        {#if financeStore.goals.length > 0}
          {@const achieved = financeStore.goals.filter((g) => g.status === 'achieved').length}
          <span class="font-mono text-[11px] text-zinc-400">
            {achieved}/{financeStore.goals.length}
          </span>
        {/if}
      </button>

      <button
        onclick={() => financeStore.navigateToPortfolio()}
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors {financeStore.activeView === 'portfolio' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <span class="flex items-center gap-2">
          <Briefcase class="w-4 h-4 text-emerald-400" />
          Portfolio & Tax-Lots
        </span>
        {#if financeStore.portfolioSummary}
          <span class="font-mono text-[11px] text-zinc-300">
            {formatCurrency(financeStore.portfolioSummary.total_portfolio_value)}
          </span>
        {:else if financeStore.holdings.length > 0}
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            {financeStore.holdings.length}
          </span>
        {/if}
      </button>

      <button
        onclick={() => financeStore.navigateToProperties()}
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors {financeStore.activeView === 'property' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <span class="flex items-center gap-2">
          <Building2 class="w-4 h-4 text-amber-400" />
          Property & Equity
        </span>
        {#if financeStore.properties.length > 0}
          {@const equity = financeStore.properties.reduce((s, p) => s + (p.equity_value || 0), 0)}
          <span class="font-mono text-[11px] text-zinc-300">{formatCurrency(equity)}</span>
        {/if}
      </button>

      <button
        onclick={() => financeStore.navigateToLoans()}
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors {financeStore.activeView === 'loans' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <span class="flex items-center gap-2">
          <Landmark class="w-4 h-4 text-rose-400" />
          Loans & Payoff
        </span>
        {#if financeStore.loanScenarios.length > 0}
          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/60 text-rose-400 border border-rose-800/60">
            {financeStore.loanScenarios.length}
          </span>
        {/if}
      </button>

      <button
        onclick={() => financeStore.navigateToLandlord()}
        class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors {financeStore.activeView === 'landlord' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <span class="flex items-center gap-2">
          <KeyRound class="w-4 h-4 text-amber-400" />
          Landlord & Rent Roll
        </span>
        {#if financeStore.tenants.length > 0}
          {@const activeLeases = financeStore.tenants.filter((t) => t.lease_status === 'active').length}
          <span class="font-mono text-[11px] {activeLeases > 0 ? 'text-emerald-400' : 'text-zinc-500'}">
            {activeLeases}/{financeStore.tenants.length}
          </span>
        {/if}
      </button>
    </div>

    <!-- Banks & Cash -->
    <div>
      <div class="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1.5">
        <span class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          Cash & Banks ({bankAccounts.length})
        </span>
      </div>
      <div class="space-y-0.5">
        {#each bankAccounts as acc}
          <button
            onclick={() => financeStore.selectAccount(acc.id)}
            class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all {financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
          >
            <div class="truncate text-left pr-2">
              <div class="truncate">{acc.name}</div>
              <div class="text-[10px] text-zinc-500">{acc.institution_name || 'Bank'}</div>
            </div>
            <div class="font-mono text-right whitespace-nowrap text-emerald-400">
              {formatCurrency(acc.current_balance, acc.currency_code)}
            </div>
          </button>
        {/each}
      </div>
    </div>

    <!-- Brokerage & Investments -->
    {#if investmentAccounts.length > 0}
      <div>
        <div class="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1.5">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-sky-400"></span>
            Investments ({investmentAccounts.length})
          </span>
        </div>
        <div class="space-y-0.5">
          {#each investmentAccounts as acc}
            <button
              onclick={() => financeStore.selectAccount(acc.id)}
              class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all {financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
            >
              <div class="truncate text-left pr-2">
                <div class="truncate">{acc.name}</div>
                <div class="text-[10px] text-zinc-500">{acc.institution_name || 'Brokerage'}</div>
              </div>
              <div class="font-mono text-right whitespace-nowrap text-sky-400">
                {formatCurrency(acc.current_balance, acc.currency_code)}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Tangible Assets & Properties -->
    {#if assetAccounts.length > 0}
      <div>
        <div class="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1.5">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-400"></span>
            Assets & Properties ({assetAccounts.length})
          </span>
        </div>
        <div class="space-y-0.5">
          {#each assetAccounts as acc}
            <button
              onclick={() => financeStore.selectAccount(acc.id)}
              class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all {financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
            >
              <div class="truncate text-left pr-2">
                <div class="truncate">{acc.name}</div>
                <div class="text-[10px] text-zinc-500">{acc.institution_name || 'Tangible Asset'}</div>
              </div>
              <div class="font-mono text-right whitespace-nowrap text-amber-400">
                {formatCurrency(acc.current_balance, acc.currency_code)}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Credit Cards -->
    {#if creditAccounts.length > 0}
      <div>
        <div class="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1.5">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-purple-400"></span>
            Credit Cards ({creditAccounts.length})
          </span>
        </div>
        <div class="space-y-0.5">
          {#each creditAccounts as acc}
            <button
              onclick={() => financeStore.selectAccount(acc.id)}
              class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all {financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
            >
              <div class="truncate text-left pr-2">
                <div class="truncate">{acc.name}</div>
                <div class="text-[10px] text-zinc-500">{acc.institution_name || 'Card'}</div>
              </div>
              <div class="font-mono text-right whitespace-nowrap text-purple-400">
                {formatCurrency(acc.current_balance, acc.currency_code)}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Loans & Mortgages -->
    {#if loanAccounts.length > 0}
      <div>
        <div class="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 mb-1.5">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-rose-400"></span>
            Loans & Debt ({loanAccounts.length})
          </span>
        </div>
        <div class="space-y-0.5">
          {#each loanAccounts as acc}
            <button
              onclick={() => financeStore.selectAccount(acc.id)}
              class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all {financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
            >
              <div class="truncate text-left pr-2">
                <div class="truncate">{acc.name}</div>
                <div class="text-[10px] text-zinc-500">{acc.institution_name || 'Mortgage'}</div>
              </div>
              <div class="font-mono text-right whitespace-nowrap text-rose-400">
                {formatCurrency(acc.current_balance, acc.currency_code)}
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Bottom Connection & Settings Status Bar -->
  <div class="p-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between">
    <div class="flex items-center gap-2 overflow-hidden">
      {#if financeStore.config.mode === 'odoo'}
        <span class="w-2 h-2 rounded-full {financeStore.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}"></span>
        <div class="truncate">
          <div class="text-xs font-semibold text-zinc-200 truncate">
            {financeStore.connectedUser || 'Odoo 18 Live'}
          </div>
          <div class="text-[10px] text-zinc-500 truncate">{financeStore.config.serverUrl.replace(/^https?:\/\//, '')}</div>
        </div>
      {:else if financeStore.config.mode === 'sqlite'}
        <span class="w-2 h-2 rounded-full bg-sky-400"></span>
        <div>
          <div class="text-xs font-semibold text-zinc-200">Local SQLite DB</div>
          <div class="text-[10px] text-sky-400/80">Standalone Offline</div>
        </div>
      {:else}
        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
        <div>
          <div class="text-xs font-semibold text-zinc-200">Demo Sandbox</div>
          <div class="text-[10px] text-amber-500/80">Preview Data</div>
        </div>
      {/if}
    </div>

    <button
      onclick={() => (financeStore.isSettingsOpen = true)}
      class="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
      title="Connection & Backend Settings"
    >
      <Settings class="w-4 h-4" />
    </button>
  </div>
</aside>
