<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import {
    LayoutDashboard,
    TrendingUp,
    ReceiptText,
    PiggyBank,
    Building2,
    BarChart3,
    Wrench,
    Plus,
    ChevronDown,
    Settings,
    UploadCloud,
    Download,
    Briefcase,
    CalendarClock,
    Workflow,
    Store,
    Target,
    Landmark,
    KeyRound,
    Scale,
    Shield,
    Database,
    Sparkles,
    CheckCircle2
  } from '@lucide/svelte';

  let activeMenu = $state<string | null>(null);

  function toggleMenu(menu: string, event: MouseEvent) {
    event.stopPropagation();
    activeMenu = activeMenu === menu ? null : menu;
  }

  function closeMenu() {
    activeMenu = null;
  }

  function handleNavigate(action: () => void) {
    action();
    closeMenu();
  }

  // Active domain calculation for highlighting top bar tabs
  let currentDomain = $derived.by(() => {
    const view = financeStore.activeView;
    if (view === 'command_center' && financeStore.selectedAccountId === null) return 'overview';
    if (view === 'register' || view === 'payees') return 'spending';
    if (['budgets', 'bills', 'cashflow', 'goals'].includes(view)) return 'planning';
    if (view === 'portfolio') return 'investing';
    if (['property', 'loans', 'landlord'].includes(view)) return 'property';
    return null;
  });
</script>

<svelte:window onclick={closeMenu} />

<nav class="h-12 bg-zinc-950 border-b border-zinc-800/80 px-4 flex items-center justify-between select-none z-40 relative text-xs">
  <!-- Brand & Logo -->
  <div class="flex items-center gap-6">
    <button
      onclick={() => handleNavigate(() => financeStore.navigateToOverview())}
      class="flex items-center gap-2.5 hover:opacity-90 transition-opacity focus:outline-none"
    >
      <div class="w-6 h-6 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
        M
      </div>
      <div class="flex items-center gap-1.5 font-bold text-zinc-100 tracking-wide">
        MONETA
        <span class="text-[9px] uppercase tracking-widest font-semibold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
          Desktop
        </span>
      </div>
    </button>

    <!-- The 7 Odoo Domain Centers -->
    <div class="flex items-center space-x-1">
      <!-- 1. Spending -->
      <div class="relative">
        <button
          onclick={(e) => toggleMenu('spending', e)}
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors {currentDomain === 'spending' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'}"
        >
          <ReceiptText class="w-3.5 h-3.5 text-emerald-400" />
          <span>Spending</span>
          <ChevronDown class="w-3 h-3 text-zinc-500 transition-transform {activeMenu === 'spending' ? 'rotate-180' : ''}" />
        </button>

        {#if activeMenu === 'spending'}
          <div class="absolute left-0 mt-1.5 w-60 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div class="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Banking & Cash
            </div>
            <button
              onclick={() => handleNavigate(() => {
                if (financeStore.selectedAccountId) {
                  financeStore.selectAccount(financeStore.selectedAccountId);
                } else if (financeStore.accounts.length > 0) {
                  financeStore.selectAccount(financeStore.accounts[0].id);
                }
              })}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <ReceiptText class="w-4 h-4 text-emerald-400" />
              <div>
                <div class="font-medium text-zinc-100">Checkbook Register</div>
                <div class="text-[10px] text-zinc-400">Transaction ledger & 1-click reconcile</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToPayees())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Store class="w-4 h-4 text-pink-400" />
              <div>
                <div class="font-medium text-zinc-100">Payee Directory</div>
                <div class="text-[10px] text-zinc-400">Merchant memory & spend analytics</div>
              </div>
            </button>
            <div class="border-t border-zinc-800 my-1"></div>
            <button
              onclick={() => handleNavigate(() => (financeStore.isImportModalOpen = true))}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <UploadCloud class="w-4 h-4 text-sky-400" />
              <div>
                <div class="font-medium text-zinc-100">Import Statement</div>
                <div class="text-[10px] text-zinc-400">CSV & QIF statement wizard</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.openAddTransactionModal())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Plus class="w-4 h-4 text-emerald-400" />
              <div>
                <div class="font-medium text-zinc-100">Capture Transaction</div>
                <div class="text-[10px] text-zinc-400">Record expense or income</div>
              </div>
            </button>
          </div>
        {/if}
      </div>

      <!-- 2. Planning -->
      <div class="relative">
        <button
          onclick={(e) => toggleMenu('planning', e)}
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors {currentDomain === 'planning' ? 'bg-zinc-800 text-indigo-400' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'}"
        >
          <PiggyBank class="w-3.5 h-3.5 text-indigo-400" />
          <span>Planning</span>
          <ChevronDown class="w-3 h-3 text-zinc-500 transition-transform {activeMenu === 'planning' ? 'rotate-180' : ''}" />
        </button>

        {#if activeMenu === 'planning'}
          <div class="absolute left-0 mt-1.5 w-64 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div class="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Budgets & Cash Flow
            </div>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToBudgets())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <PiggyBank class="w-4 h-4 text-indigo-400" />
              <div>
                <div class="font-medium text-zinc-100">Envelope Budgets</div>
                <div class="text-[10px] text-zinc-400">Zero-based category budget envelopes</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToBills())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <CalendarClock class="w-4 h-4 text-amber-400" />
              <div>
                <div class="font-medium text-zinc-100">Bills & Subscriptions</div>
                <div class="text-[10px] text-zinc-400">Upcoming bills & automated detector</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToCashflow())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Workflow class="w-4 h-4 text-indigo-400" />
              <div>
                <div class="font-medium text-zinc-100">Cash Flow & Sankey</div>
                <div class="text-[10px] text-zinc-400">90-day trajectory & overdraft alerts</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToGoals())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Target class="w-4 h-4 text-sky-400" />
              <div>
                <div class="font-medium text-zinc-100">Financial Goals</div>
                <div class="text-[10px] text-zinc-400">Sinking funds & milestone target dates</div>
              </div>
            </button>
          </div>
        {/if}
      </div>

      <!-- 3. Investing -->
      <div class="relative">
        <button
          onclick={(e) => toggleMenu('investing', e)}
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors {currentDomain === 'investing' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'}"
        >
          <TrendingUp class="w-3.5 h-3.5 text-emerald-400" />
          <span>Investing</span>
          <ChevronDown class="w-3 h-3 text-zinc-500 transition-transform {activeMenu === 'investing' ? 'rotate-180' : ''}" />
        </button>

        {#if activeMenu === 'investing'}
          <div class="absolute left-0 mt-1.5 w-64 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div class="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Stock Portfolio & Taxes
            </div>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToPortfolio())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Briefcase class="w-4 h-4 text-emerald-400" />
              <div>
                <div class="font-medium text-zinc-100">Portfolio Holdings</div>
                <div class="text-[10px] text-zinc-400">Multi-brokerage equities, ETFs & weights</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToPortfolio())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Scale class="w-4 h-4 text-amber-400" />
              <div>
                <div class="font-medium text-zinc-100">Tax-Lots Inventory</div>
                <div class="text-[10px] text-zinc-400">Short-term vs long-term lot tranches</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToPortfolio())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <BarChart3 class="w-4 h-4 text-purple-400" />
              <div>
                <div class="font-medium text-zinc-100">Realized Gains & TWR</div>
                <div class="text-[10px] text-zinc-400">Modified Dietz, XIRR & tax schedule</div>
              </div>
            </button>
            <div class="border-t border-zinc-800 my-1"></div>
            <button
              onclick={() => handleNavigate(() => financeStore.openTradeModal())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Plus class="w-4 h-4 text-emerald-400" />
              <div>
                <div class="font-medium text-zinc-100">Record Trade</div>
                <div class="text-[10px] text-zinc-400">Buy or sell with FIFO/LIFO/HIFO/SpecID</div>
              </div>
            </button>
          </div>
        {/if}
      </div>

      <!-- 4. Property & Debt -->
      <div class="relative">
        <button
          onclick={(e) => toggleMenu('property', e)}
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors {currentDomain === 'property' ? 'bg-zinc-800 text-amber-400' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'}"
        >
          <Building2 class="w-3.5 h-3.5 text-amber-400" />
          <span>Property & Debt</span>
          <ChevronDown class="w-3 h-3 text-zinc-500 transition-transform {activeMenu === 'property' ? 'rotate-180' : ''}" />
        </button>

        {#if activeMenu === 'property'}
          <div class="absolute left-0 mt-1.5 w-64 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div class="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Real Estate & Mortgages
            </div>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToProperties())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Building2 class="w-4 h-4 text-amber-400" />
              <div>
                <div class="font-medium text-zinc-100">Property & Equity</div>
                <div class="text-[10px] text-zinc-400">Valuation tracking & net home equity</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToLoans())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Landmark class="w-4 h-4 text-rose-400" />
              <div>
                <div class="font-medium text-zinc-100">Loans & Prepayment</div>
                <div class="text-[10px] text-zinc-400">Amortization schedule & debt payoff</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToLandlord())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <KeyRound class="w-4 h-4 text-amber-400" />
              <div>
                <div class="font-medium text-zinc-100">Landlord Hub</div>
                <div class="text-[10px] text-zinc-400">Tenants, leases & monthly rent roll</div>
              </div>
            </button>
          </div>
        {/if}
      </div>

      <!-- 5. Regional Wealth (SG/MY) -->
      <div class="relative">
        <button
          onclick={(e) => toggleMenu('regional', e)}
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
        >
          <Shield class="w-3.5 h-3.5 text-red-400" />
          <span>Regional</span>
          <span class="text-[9px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono">SG/MY</span>
          <ChevronDown class="w-3 h-3 text-zinc-500 transition-transform {activeMenu === 'regional' ? 'rotate-180' : ''}" />
        </button>

        {#if activeMenu === 'regional'}
          <div class="absolute left-0 mt-1.5 w-64 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div class="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Singapore & Malaysia Packs
            </div>
            <div class="px-3 py-2 flex items-center justify-between text-zinc-400 hover:bg-zinc-800/40 rounded-lg">
              <div class="flex items-center gap-2.5">
                <span class="text-base">🇸🇬</span>
                <div>
                  <div class="font-medium text-zinc-200">Singapore CPF & SRS</div>
                  <div class="text-[10px] text-zinc-500">OA/SA/MA/RA, T-Bills & IRAS Tax</div>
                </div>
              </div>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                Phase 6
              </span>
            </div>
            <div class="px-3 py-2 flex items-center justify-between text-zinc-400 hover:bg-zinc-800/40 rounded-lg">
              <div class="flex items-center gap-2.5">
                <span class="text-base">🇲🇾</span>
                <div>
                  <div class="font-medium text-zinc-200">Malaysia EPF / KWSP</div>
                  <div class="text-[10px] text-zinc-500">Akaun 1, 2, 3 & LHDN Tax Relief</div>
                </div>
              </div>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                Phase 6
              </span>
            </div>
          </div>
        {/if}
      </div>

      <!-- 6. Reports -->
      <div class="relative">
        <button
          onclick={(e) => toggleMenu('reports', e)}
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-colors {currentDomain === 'overview' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'}"
        >
          <BarChart3 class="w-3.5 h-3.5 text-sky-400" />
          <span>Reports</span>
          <ChevronDown class="w-3 h-3 text-zinc-500 transition-transform {activeMenu === 'reports' ? 'rotate-180' : ''}" />
        </button>

        {#if activeMenu === 'reports'}
          <div class="absolute left-0 mt-1.5 w-60 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div class="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Financial Intelligence
            </div>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToOverview())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <LayoutDashboard class="w-4 h-4 text-emerald-400" />
              <div>
                <div class="font-medium text-zinc-100">Wealth Command Center</div>
                <div class="text-[10px] text-zinc-400">Net worth trend & FIRE progress</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.navigateToCashflow())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Workflow class="w-4 h-4 text-indigo-400" />
              <div>
                <div class="font-medium text-zinc-100">Cash Flow & Savings</div>
                <div class="text-[10px] text-zinc-400">Savings efficiency & burn rate</div>
              </div>
            </button>
          </div>
        {/if}
      </div>

      <!-- 7. Tools -->
      <div class="relative">
        <button
          onclick={(e) => toggleMenu('tools', e)}
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
        >
          <Wrench class="w-3.5 h-3.5 text-zinc-400" />
          <span>Tools</span>
          <ChevronDown class="w-3 h-3 text-zinc-500 transition-transform {activeMenu === 'tools' ? 'rotate-180' : ''}" />
        </button>

        {#if activeMenu === 'tools'}
          <div class="absolute left-0 mt-1.5 w-64 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
            <div class="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Data & Operations
            </div>
            <button
              onclick={() => handleNavigate(() => (financeStore.isImportModalOpen = true))}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <UploadCloud class="w-4 h-4 text-sky-400" />
              <div>
                <div class="font-medium text-zinc-100">Import Statement (CSV/QIF)</div>
                <div class="text-[10px] text-zinc-400">Parse & auto-categorize bank files</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => financeStore.downloadSqliteBackup())}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Download class="w-4 h-4 text-emerald-400" />
              <div>
                <div class="font-medium text-zinc-100">Download SQLite Backup</div>
                <div class="text-[10px] text-zinc-400">Export full local database file</div>
              </div>
            </button>
            <button
              onclick={() => handleNavigate(() => (financeStore.isSettingsOpen = true))}
              class="w-full px-3 py-2 text-left flex items-center gap-2.5 text-zinc-200 hover:bg-zinc-800/80 transition-colors"
            >
              <Database class="w-4 h-4 text-purple-400" />
              <div>
                <div class="font-medium text-zinc-100">Odoo 18 Migration</div>
                <div class="text-[10px] text-zinc-400">1-click sync accounts & ledger</div>
              </div>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>

  <!-- Right Actions: Quick Add, Mode Pill & Settings -->
  <div class="flex items-center gap-2.5">
    <!-- Quick Add Transaction Button -->
    <button
      onclick={() => financeStore.openAddTransactionModal()}
      class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] shadow-sm transition-colors cursor-pointer"
    >
      <Plus class="w-3.5 h-3.5" />
      <span>Transaction</span>
    </button>

    <!-- Connection Mode Badge -->
    <button
      onclick={() => (financeStore.isSettingsOpen = true)}
      class="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-mono transition-colors"
      title="Click to switch data source mode"
    >
      {#if financeStore.config.mode === 'odoo'}
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span class="text-emerald-400 font-semibold">Odoo Live</span>
      {:else if financeStore.config.mode === 'sqlite'}
        <span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
        <span class="text-sky-400 font-semibold">SQLite WASM</span>
      {:else}
        <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
        <span class="text-amber-400 font-semibold">Mock Sandbox</span>
      {/if}
    </button>

    <!-- Settings Gear -->
    <button
      onclick={() => (financeStore.isSettingsOpen = true)}
      class="p-1.5 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
      title="Settings & Configuration"
    >
      <Settings class="w-4 h-4" />
    </button>
  </div>
</nav>
