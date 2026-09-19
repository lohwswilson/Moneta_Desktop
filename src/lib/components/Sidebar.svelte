<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { AccountType, MonetaAccount } from '../types/moneta';
  import {
    Wallet,
    TrendingUp,
    CreditCard,
    Home,
    Settings,
    LayoutDashboard,
    Gem,
    Building2,
    Plus,
    UploadCloud,
    ChevronDown,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen,
    Layers,
    Pencil
  } from '@lucide/svelte';

  const formatCurrency = (amount: number, currency: string = 'SGD') => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  let groupBy = $state<'type' | 'institution'>('type');
  let expandedGroups = $state<Record<string, boolean>>({});

  const toggleGroup = (key: string) => {
    expandedGroups[key] = !expandedGroups[key];
  };

  let hasAnyExpanded = $derived(Object.values(expandedGroups).some(Boolean));

  const toggleAllGroups = () => {
    if (hasAnyExpanded) {
      expandedGroups = {};
    } else {
      const all: Record<string, boolean> = {
        banks: true,
        investments: true,
        assets: true,
        credit: true,
        loans: true,
      };
      for (const inst of institutionGroups) {
        all[inst.name] = true;
      }
      expandedGroups = all;
    }
  };

  // Auto-expand active account's group when viewing register
  $effect(() => {
    if (financeStore.activeView === 'register' && financeStore.selectedAccountId) {
      const acc = financeStore.accounts.find((a) => a.id === financeStore.selectedAccountId);
      if (acc) {
        if (groupBy === 'type') {
          if (
            ['checking', 'chequing', 'savings', 'cash', 'cpf_oa', 'cpf_sa', 'cpf_ma', 'cpf_ra', 'srs', 'epf_akaun_persaraan', 'epf_akaun_sejahtera', 'epf_akaun_fleksibel'].includes(acc.account_type)
          ) {
            expandedGroups['banks'] = true;
          } else if (['brokerage', 'retirement', 'crypto'].includes(acc.account_type)) {
            expandedGroups['investments'] = true;
          } else if (['asset', 'property', 'other'].includes(acc.account_type)) {
            expandedGroups['assets'] = true;
          } else if (['credit', 'credit_card', 'loc'].includes(acc.account_type)) {
            expandedGroups['credit'] = true;
          } else if (['loan', 'mortgage'].includes(acc.account_type)) {
            expandedGroups['loans'] = true;
          }
        } else {
          const inst = acc.institution_name?.trim() || 'Other';
          expandedGroups[inst] = true;
        }
      }
    }
  });

  // Group accounts by Type
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

  // Group totals
  let bankTotal = $derived(bankAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0));
  let investmentTotal = $derived(investmentAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0));
  let assetTotal = $derived(assetAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0));
  let creditTotal = $derived(creditAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0));
  let loanTotal = $derived(loanAccounts.reduce((sum, a) => sum + (a.current_balance || 0), 0));

  // Dynamic grouping by Institution
  let institutionGroups = $derived.by(() => {
    const map = new Map<string, MonetaAccount[]>();
    for (const acc of financeStore.accounts) {
      const inst = acc.institution_name?.trim() || 'Other';
      if (!map.has(inst)) {
        map.set(inst, []);
      }
      map.get(inst)!.push(acc);
    }
    return Array.from(map.entries())
      .map(([name, accounts]) => ({
        name,
        accounts,
        total: accounts.reduce((sum, a) => sum + (a.current_balance || 0), 0),
      }))
      .sort((a, b) => b.total - a.total);
  });
</script>

<aside class="{financeStore.isSidebarCollapsed ? 'w-14' : 'w-72'} bg-zinc-950 border-r border-zinc-800/80 flex flex-col h-full select-none transition-all duration-200 ease-in-out shrink-0 overflow-hidden">
  {#if financeStore.isSidebarCollapsed}
    <!-- Collapsed Rail View -->
    <div class="flex-1 flex flex-col items-center py-3 px-1 space-y-3 overflow-y-auto">
      <!-- Expand Button -->
      <button
        onclick={() => financeStore.toggleSidebar()}
        title="Expand Sidebar"
        class="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer"
      >
        <PanelLeftOpen class="w-4 h-4 text-emerald-400" />
      </button>

      <!-- Wealth Overview Hero Button -->
      <button
        onclick={() => financeStore.navigateToOverview()}
        title="Wealth Overview ({formatCurrency(financeStore.metrics?.net_worth || 0)})"
        class="p-2.5 rounded-xl transition-all cursor-pointer {financeStore.activeView === 'command_center' && financeStore.selectedAccountId === null ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
      >
        <LayoutDashboard class="w-4 h-4" />
      </button>

      <!-- Quick Actions -->
      <div class="space-y-1.5 pt-1 border-t border-zinc-800/80 w-full flex flex-col items-center">
        <button
          onclick={() => financeStore.openAddTransactionModal()}
          title="Record Transaction"
          class="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-emerald-400 border border-zinc-800 transition-colors cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5" />
        </button>
        <button
          onclick={() => (financeStore.isImportModalOpen = true)}
          title="Import Statement"
          class="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-sky-400 border border-zinc-800 transition-colors cursor-pointer"
        >
          <UploadCloud class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- Account Categories Icons Rail -->
      <div class="space-y-2 pt-2 border-t border-zinc-800/80 w-full flex flex-col items-center">
        <!-- Cash & Banks -->
        <button
          onclick={() => financeStore.toggleSidebar()}
          title="Cash & Banks: {formatCurrency(bankTotal)} ({bankAccounts.length} accounts)"
          class="relative p-2 rounded-lg text-zinc-400 hover:text-emerald-400 hover:bg-zinc-900 transition-colors cursor-pointer"
        >
          <Wallet class="w-4 h-4" />
          {#if bankAccounts.length > 0}
            <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-950 border border-emerald-700 text-[9px] font-mono text-emerald-300 flex items-center justify-center">
              {bankAccounts.length}
            </span>
          {/if}
        </button>

        <!-- Investments -->
        {#if investmentAccounts.length > 0}
          <button
            onclick={() => financeStore.toggleSidebar()}
            title="Investments: {formatCurrency(investmentTotal)} ({investmentAccounts.length} accounts)"
            class="relative p-2 rounded-lg text-zinc-400 hover:text-sky-400 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <TrendingUp class="w-4 h-4" />
            <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-sky-950 border border-sky-700 text-[9px] font-mono text-sky-300 flex items-center justify-center">
              {investmentAccounts.length}
            </span>
          </button>
        {/if}

        <!-- Properties -->
        {#if assetAccounts.length > 0}
          <button
            onclick={() => financeStore.toggleSidebar()}
            title="Properties: {formatCurrency(assetTotal)} ({assetAccounts.length} accounts)"
            class="relative p-2 rounded-lg text-zinc-400 hover:text-amber-400 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <Building2 class="w-4 h-4" />
            <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-amber-950 border border-amber-700 text-[9px] font-mono text-amber-300 flex items-center justify-center">
              {assetAccounts.length}
            </span>
          </button>
        {/if}

        <!-- Credit Cards -->
        {#if creditAccounts.length > 0}
          <button
            onclick={() => financeStore.toggleSidebar()}
            title="Credit Cards: {formatCurrency(creditTotal)} ({creditAccounts.length} cards)"
            class="relative p-2 rounded-lg text-zinc-400 hover:text-purple-400 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <CreditCard class="w-4 h-4" />
            <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-purple-950 border border-purple-700 text-[9px] font-mono text-purple-300 flex items-center justify-center">
              {creditAccounts.length}
            </span>
          </button>
        {/if}

        <!-- Loans & Debt -->
        {#if loanAccounts.length > 0}
          <button
            onclick={() => financeStore.toggleSidebar()}
            title="Loans & Debt: {formatCurrency(loanTotal)} ({loanAccounts.length} accounts)"
            class="relative p-2 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <Home class="w-4 h-4" />
            <span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-950 border border-rose-700 text-[9px] font-mono text-rose-300 flex items-center justify-center">
              {loanAccounts.length}
            </span>
          </button>
        {/if}

        <!-- Singapore Wealth Hub -->
        <button
          onclick={() => financeStore.navigateToSingaporeHub()}
          title="Singapore Wealth Hub (CPF, Housing, IRAS)"
          class="relative p-2 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-900 transition-colors cursor-pointer {financeStore.activeView === 'singapore_hub' ? 'bg-zinc-800 text-red-400' : ''}"
        >
          <span class="text-xs">🇸🇬</span>
        </button>
      </div>
    </div>

    <!-- Collapsed Bottom Rail -->
    <div class="p-2 border-t border-zinc-800/80 flex flex-col items-center gap-2">
      <button
        onclick={() => (financeStore.isSettingsOpen = true)}
        class="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer"
        title="Settings & Data Sources"
      >
        <Settings class="w-4 h-4" />
      </button>
    </div>
  {:else}
    <!-- Expanded Full Sidebar View -->
    <div class="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      <!-- Header Row: Title, Group Switcher, Collapse Button -->
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-1.5">
          <span class="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Accounts</span>
          <button
            type="button"
            onclick={() => financeStore.openAddAccountModal()}
            title="Add New Account"
            class="p-0.5 rounded text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <Plus class="w-3 h-3" />
          </button>
          <button
            type="button"
            onclick={toggleAllGroups}
            title={hasAnyExpanded ? "Collapse all accounts" : "Expand all accounts"}
            class="text-[10px] text-zinc-500 hover:text-zinc-300 px-1 py-0.5 rounded hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            {hasAnyExpanded ? 'Collapse' : 'Expand'}
          </button>
        </div>

        <div class="flex items-center gap-1">
          <!-- Group Switcher Pill -->
          <div class="flex items-center bg-zinc-900 border border-zinc-800 rounded-md p-0.5 text-[10px]">
            <button
              onclick={() => (groupBy = 'type')}
              title="Group by Account Type"
              class="px-2 py-0.5 rounded transition-all font-medium {groupBy === 'type' ? 'bg-zinc-800 text-white font-semibold shadow-xs' : 'text-zinc-500 hover:text-zinc-300'}"
            >
              Type
            </button>
            <button
              onclick={() => (groupBy = 'institution')}
              title="Group by Financial Institution"
              class="px-2 py-0.5 rounded transition-all font-medium {groupBy === 'institution' ? 'bg-zinc-800 text-white font-semibold shadow-xs' : 'text-zinc-500 hover:text-zinc-300'}"
            >
              Bank
            </button>
          </div>

          <!-- Collapse Sidebar Button -->
          <button
            onclick={() => financeStore.toggleSidebar()}
            title="Collapse Sidebar"
            class="p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <PanelLeftClose class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Wealth Overview Hero Button -->
      <div class="space-y-1">
        <button
          onclick={() => financeStore.navigateToOverview()}
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer {financeStore.activeView === 'command_center' ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60' : 'text-zinc-300 hover:bg-zinc-900 hover:text-white border border-transparent'}"
        >
          <span class="flex items-center gap-2">
            <LayoutDashboard class="w-4 h-4 text-emerald-400" />
            Wealth Overview
          </span>
          {#if financeStore.metrics}
            <span class="font-mono text-zinc-200 font-bold">
              {formatCurrency(financeStore.metrics.net_worth)}
            </span>
          {/if}
        </button>

        <button
          onclick={() => financeStore.navigateToSingaporeHub()}
          class="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer {financeStore.activeView === 'singapore_hub' ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700/60' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border border-transparent'}"
        >
          <span class="flex items-center gap-2">
            <span class="text-sm">🇸🇬</span>
            Singapore Wealth Hub
          </span>
          {#if financeStore.cpfAccounts}
            <span class="font-mono text-emerald-400 text-[11px] font-bold">
              {formatCurrency(financeStore.cpfAccounts.total_balance)}
            </span>
          {/if}
        </button>
      </div>

      <!-- Quick Action Bar -->
      <div class="grid grid-cols-2 gap-1.5 px-0.5">
        <button
          onclick={() => financeStore.openAddTransactionModal()}
          class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors shadow-xs cursor-pointer"
        >
          <Plus class="w-3.5 h-3.5 text-emerald-400" />
          Record
        </button>
        <button
          onclick={() => (financeStore.isImportModalOpen = true)}
          class="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors shadow-xs cursor-pointer"
        >
          <UploadCloud class="w-3.5 h-3.5 text-sky-400" />
          Import
        </button>
      </div>

      <!-- Accounts List -->
      {#if groupBy === 'type'}
        <!-- Group 1: Cash & Banks -->
        <div>
          <button
            type="button"
            onclick={() => toggleGroup('banks')}
            class="w-full flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1 rounded hover:bg-zinc-900/60 transition-colors cursor-pointer group"
          >
            <span class="flex items-center gap-1.5">
              {#if expandedGroups['banks']}
                <ChevronDown class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
              {:else}
                <ChevronRight class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
              {/if}
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Cash & Banks ({bankAccounts.length})</span>
            </span>
            <span class="font-mono text-emerald-400/90 font-medium normal-case">
              {formatCurrency(bankTotal)}
            </span>
          </button>

          {#if expandedGroups['banks']}
            <div class="space-y-0.5 mt-1">
              {#each bankAccounts as acc}
                <button
                  onclick={() => financeStore.selectAccount(acc.id)}
                  class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all cursor-pointer {financeStore.activeView === 'register' && financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
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
          {/if}
        </div>

        <!-- Group 2: Investments -->
        {#if investmentAccounts.length > 0}
          <div>
            <button
              type="button"
              onclick={() => toggleGroup('investments')}
              class="w-full flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1 rounded hover:bg-zinc-900/60 transition-colors cursor-pointer group"
            >
              <span class="flex items-center gap-1.5">
                {#if expandedGroups['investments']}
                  <ChevronDown class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
                {:else}
                  <ChevronRight class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
                {/if}
                <span class="w-2 h-2 rounded-full bg-sky-400"></span>
                <span>Investments ({investmentAccounts.length})</span>
              </span>
              <span class="font-mono text-sky-400/90 font-medium normal-case">
                {formatCurrency(investmentTotal)}
              </span>
            </button>

            {#if expandedGroups['investments']}
              <div class="space-y-0.5 mt-1">
                {#each investmentAccounts as acc}
                  <button
                    onclick={() => financeStore.selectAccount(acc.id)}
                    class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all cursor-pointer {financeStore.activeView === 'register' && financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
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
            {/if}
          </div>
        {/if}

        <!-- Group 3: Properties -->
        {#if assetAccounts.length > 0}
          <div>
            <button
              type="button"
              onclick={() => toggleGroup('assets')}
              class="w-full flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1 rounded hover:bg-zinc-900/60 transition-colors cursor-pointer group"
            >
              <span class="flex items-center gap-1.5">
                {#if expandedGroups['assets']}
                  <ChevronDown class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
                {:else}
                  <ChevronRight class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
                {/if}
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Properties ({assetAccounts.length})</span>
              </span>
              <span class="font-mono text-amber-400/90 font-medium normal-case">
                {formatCurrency(assetTotal)}
              </span>
            </button>

            {#if expandedGroups['assets']}
              <div class="space-y-0.5 mt-1">
                {#each assetAccounts as acc}
                  <button
                    onclick={() => financeStore.selectAccount(acc.id)}
                    class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all cursor-pointer {financeStore.activeView === 'register' && financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
                  >
                    <div class="truncate text-left pr-2">
                      <div class="truncate">{acc.name}</div>
                      <div class="text-[10px] text-zinc-500">{acc.institution_name || 'Property'}</div>
                    </div>
                    <div class="font-mono text-right whitespace-nowrap text-amber-400">
                      {formatCurrency(acc.current_balance, acc.currency_code)}
                    </div>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Group 4: Credit Cards -->
        {#if creditAccounts.length > 0}
          <div>
            <button
              type="button"
              onclick={() => toggleGroup('credit')}
              class="w-full flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1 rounded hover:bg-zinc-900/60 transition-colors cursor-pointer group"
            >
              <span class="flex items-center gap-1.5">
                {#if expandedGroups['credit']}
                  <ChevronDown class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
                {:else}
                  <ChevronRight class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
                {/if}
                <span class="w-2 h-2 rounded-full bg-purple-400"></span>
                <span>Credit Cards ({creditAccounts.length})</span>
              </span>
              <span class="font-mono text-purple-400/90 font-medium normal-case">
                {formatCurrency(creditTotal)}
              </span>
            </button>

            {#if expandedGroups['credit']}
              <div class="space-y-0.5 mt-1">
                {#each creditAccounts as acc}
                  <button
                    onclick={() => financeStore.selectAccount(acc.id)}
                    class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all cursor-pointer {financeStore.activeView === 'register' && financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
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
            {/if}
          </div>
        {/if}

        <!-- Group 5: Loans & Mortgages -->
        {#if loanAccounts.length > 0}
          <div>
            <button
              type="button"
              onclick={() => toggleGroup('loans')}
              class="w-full flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1 rounded hover:bg-zinc-900/60 transition-colors cursor-pointer group"
            >
              <span class="flex items-center gap-1.5">
                {#if expandedGroups['loans']}
                  <ChevronDown class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
                {:else}
                  <ChevronRight class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform" />
                {/if}
                <span class="w-2 h-2 rounded-full bg-rose-400"></span>
                <span>Loans & Debt ({loanAccounts.length})</span>
              </span>
              <span class="font-mono text-rose-400/90 font-medium normal-case">
                {formatCurrency(loanTotal)}
              </span>
            </button>

            {#if expandedGroups['loans']}
              <div class="space-y-0.5 mt-1">
                {#each loanAccounts as acc}
                  <button
                    onclick={() => financeStore.selectAccount(acc.id)}
                    class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all cursor-pointer {financeStore.activeView === 'register' && financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
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
            {/if}
          </div>
        {/if}
      {:else}
        <!-- Grouping by Financial Institution -->
        <div class="space-y-3">
          {#each institutionGroups as inst}
            <div>
              <button
                type="button"
                onclick={() => toggleGroup(inst.name)}
                class="w-full flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider px-2 py-1 rounded hover:bg-zinc-900/60 transition-colors cursor-pointer group"
              >
                <span class="flex items-center gap-1.5 truncate pr-2">
                  {#if expandedGroups[inst.name]}
                    <ChevronDown class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform shrink-0" />
                  {:else}
                    <ChevronRight class="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform shrink-0" />
                  {/if}
                  <Building2 class="w-3 h-3 text-indigo-400 shrink-0" />
                  <span class="truncate">{inst.name} ({inst.accounts.length})</span>
                </span>
                <span class="font-mono text-zinc-200 font-medium normal-case whitespace-nowrap shrink-0">
                  {formatCurrency(inst.total)}
                </span>
              </button>

              {#if expandedGroups[inst.name]}
                <div class="space-y-0.5 mt-1">
                  {#each inst.accounts as acc}
                    <button
                      onclick={() => financeStore.selectAccount(acc.id)}
                      class="w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs transition-all cursor-pointer {financeStore.activeView === 'register' && financeStore.selectedAccountId === acc.id ? 'bg-zinc-800 text-white font-medium shadow-sm' : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'}"
                    >
                      <div class="truncate text-left pr-2">
                        <div class="truncate">{acc.name}</div>
                        <div class="text-[10px] text-zinc-500 capitalize">{acc.account_type.replace(/_/g, ' ')}</div>
                      </div>
                      <div class="font-mono text-right whitespace-nowrap {acc.current_balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
                        {formatCurrency(acc.current_balance, acc.currency_code)}
                      </div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Expanded Bottom Connection Status Bar -->
    <div class="p-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between">
      <div class="flex items-center gap-2 overflow-hidden">
        {#if financeStore.cloudConfigured}
          <span class="w-2 h-2 rounded-full {financeStore.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}"></span>
          <div class="truncate">
            <div class="text-xs font-semibold text-zinc-200 truncate">
              {financeStore.connectedUser || 'Moneta Cloud'}
            </div>
            <div class="text-[10px] text-zinc-500 truncate">{financeStore.config.serverUrl.replace(/^https?:\/\//, '')}</div>
          </div>
        {:else if financeStore.config.dataSource === 'local'}
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
        class="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
        title="Connection & Backend Settings"
      >
        <Settings class="w-4 h-4" />
      </button>
    </div>
  {/if}
</aside>
