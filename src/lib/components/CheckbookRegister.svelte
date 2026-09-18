<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { ReconcileState, MonetaTransaction } from '../types/moneta';
  import {
    Plus,
    Search,
    Filter,
    ArrowUpDown,
    Check,
    CheckCheck,
    RotateCcw,
    Sparkles,
    Calendar,
    Upload,
    Split,
    ChevronDown,
    ChevronRight,
  } from '@lucide/svelte';

  let searchQuery = $state('');
  let expandedSplits = $state<Record<string, boolean>>({});

  const toggleSplitExpand = (txId: string | number) => {
    const key = String(txId);
    expandedSplits[key] = !expandedSplits[key];
  };

  let currentAccount = $derived(
    financeStore.accounts.find((a) => a.id === financeStore.selectedAccountId)
  );

  let filteredTransactions = $derived(
    financeStore.transactions.filter((tx) => {
      // Status filter
      if (financeStore.filterState !== 'all' && tx.reconciliation_state !== financeStore.filterState) {
        return false;
      }
      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesPayee = tx.payee_name?.toLowerCase().includes(q);
        const matchesCat = tx.category_name?.toLowerCase().includes(q);
        const matchesMemo = tx.memo?.toLowerCase().includes(q);
        return matchesPayee || matchesCat || matchesMemo;
      }
      return true;
    })
  );

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currentAccount?.currency_code || 'SGD',
      minimumFractionDigits: 2,
    }).format(val);
  };
</script>

<div class="flex-1 flex flex-col h-screen bg-zinc-950 overflow-hidden select-none">
  <!-- Register Header Bar -->
  <header class="p-6 border-b border-zinc-800/80 bg-zinc-900/30 flex items-center justify-between">
    <div>
      <div class="flex items-center gap-2">
        <h2 class="text-xl font-bold text-zinc-100">{currentAccount?.name || 'Account Ledger'}</h2>
        {#if currentAccount?.account_number_mask}
          <span class="px-2 py-0.5 rounded bg-zinc-800 font-mono text-[11px] text-zinc-400">
            {currentAccount.account_number_mask}
          </span>
        {/if}
      </div>
      <div class="text-xs text-zinc-400 mt-1 flex items-center gap-3">
        <span>{currentAccount?.institution_name || 'Personal Account'}</span>
        <span class="text-zinc-600">•</span>
        <span>Currency: <strong class="text-zinc-300">{currentAccount?.currency_code || 'SGD'}</strong></span>
      </div>
    </div>

    <!-- Balance Summaries -->
    <div class="flex items-center gap-6">
      <div class="text-right">
        <div class="text-[11px] uppercase tracking-wider text-zinc-400 font-medium">Cleared Balance</div>
        <div class="text-lg font-bold font-mono text-zinc-100">
          {formatAmount(currentAccount?.cleared_balance || 0)}
        </div>
      </div>

      <div class="h-8 w-px bg-zinc-800"></div>

      <div class="text-right">
        <div class="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">Total Balance</div>
        <div class="text-xl font-extrabold font-mono text-emerald-400">
          {formatAmount(currentAccount?.current_balance || 0)}
        </div>
      </div>
    </div>
  </header>

  <!-- Controls Bar: Filters, Search, Add Button -->
  <div class="px-6 py-3 border-b border-zinc-800/60 bg-zinc-950 flex items-center justify-between gap-4">
    <!-- Filter State Tabs -->
    <div class="flex items-center gap-1 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
      <button
        onclick={() => (financeStore.filterState = 'all')}
        class="px-3 py-1 rounded-md text-xs font-medium transition-all {financeStore.filterState === 'all' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        All ({financeStore.transactions.length})
      </button>
      <button
        onclick={() => (financeStore.filterState = 'unreconciled')}
        class="px-3 py-1 rounded-md text-xs font-medium transition-all {financeStore.filterState === 'unreconciled' ? 'bg-amber-950/80 text-amber-300 border border-amber-700/50 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        Unreconciled
      </button>
      <button
        onclick={() => (financeStore.filterState = 'cleared')}
        class="px-3 py-1 rounded-md text-xs font-medium transition-all {financeStore.filterState === 'cleared' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        Cleared (C)
      </button>
      <button
        onclick={() => (financeStore.filterState = 'reconciled')}
        class="px-3 py-1 rounded-md text-xs font-medium transition-all {financeStore.filterState === 'reconciled' ? 'bg-sky-950/80 text-sky-300 border border-sky-700/50 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        Reconciled (R)
      </button>
    </div>

    <!-- Right Controls: Search, Import & New Transaction -->
    <div class="flex items-center gap-3">
      <div class="relative w-64">
        <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Filter payee, category..."
          class="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500/60"
        />
      </div>

      <button
        onclick={() => (financeStore.isImportModalOpen = true)}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white font-semibold text-xs border border-zinc-800 transition-colors shadow-sm"
      >
        <Upload class="w-3.5 h-3.5 text-emerald-400" />
        <span>Import Statement</span>
      </button>

      <button
        onclick={() => financeStore.openAddTransactionModal(financeStore.selectedAccountId)}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer"
      >
        <Plus class="w-3.5 h-3.5" />
        <span>Add Transaction</span>
      </button>
    </div>
  </div>

  <!-- Checkbook Table Area -->
  <div class="flex-1 overflow-y-auto">
    <table class="w-full text-left border-collapse text-xs">
      <thead class="sticky top-0 bg-zinc-900/90 backdrop-blur border-b border-zinc-800 z-10 text-zinc-400 uppercase font-semibold text-[11px] tracking-wider">
        <tr>
          <th class="py-2.5 px-4 w-28">Date</th>
          <th class="py-2.5 px-4">Payee / Description</th>
          <th class="py-2.5 px-4 w-44">Category</th>
          <th class="py-2.5 px-4 w-52">Memo</th>
          <th class="py-2.5 px-4 w-32 text-right">Debit (-)</th>
          <th class="py-2.5 px-4 w-32 text-right">Credit (+)</th>
          <th class="py-2.5 px-3 w-20 text-center">Status</th>
          <th class="py-2.5 px-4 w-36 text-right">Balance</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-800/40 font-mono">
        {#if filteredTransactions.length === 0}
          <tr>
            <td colspan="8" class="text-center py-16 text-zinc-500 font-sans text-xs">
              {#if currentAccount?.account_type === 'asset' || currentAccount?.account_type === 'property'}
                <div class="max-w-md mx-auto space-y-2">
                  <div class="text-amber-400 font-semibold text-sm">Physical Property & Tangible Asset</div>
                  <p class="text-zinc-400 text-xs leading-relaxed">
                    This tangible asset is tracked by its current market valuation ({formatAmount(currentAccount?.current_balance || 0)}). Valuations and mortgage linkages are synchronized directly with Odoo. Checkbook register transactions and statement imports do not apply to physical holdings.
                  </p>
                </div>
              {:else}
                No transactions found for this account and filter.
              {/if}
            </td>
          </tr>
        {:else}
          {#each filteredTransactions as tx (tx.id)}
            <tr
              onclick={() => financeStore.openEditTransactionModal(tx)}
              class="hover:bg-zinc-900/70 transition-colors group cursor-pointer"
            >
              <!-- Date -->
              <td class="py-2.5 px-4 text-zinc-400 whitespace-nowrap">
                {tx.date}
              </td>

              <!-- Payee -->
              <td class="py-2.5 px-4 font-sans font-medium text-zinc-100 truncate max-w-xs">
                {tx.payee_name}
              </td>

              <!-- Category -->
              <td class="py-2.5 px-4 font-sans text-zinc-400">
                {#if tx.splits && tx.splits.length > 0}
                  <button
                    type="button"
                    onclick={(e) => {
                      e.stopPropagation();
                      toggleSplitExpand(tx.id);
                    }}
                    class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-purple-950/90 hover:bg-purple-900 text-purple-300 border border-purple-800/70 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    <Split class="w-3 h-3" />
                    <span>Split ({tx.splits.length})</span>
                    {#if expandedSplits[String(tx.id)]}
                      <ChevronDown class="w-3 h-3" />
                    {:else}
                      <ChevronRight class="w-3 h-3" />
                    {/if}
                  </button>
                {:else if tx.category_name}
                  <span class="px-2 py-0.5 rounded bg-zinc-800/80 text-[11px] text-zinc-300">
                    {tx.category_name}
                  </span>
                {:else}
                  <span class="text-zinc-600 italic">Uncategorized</span>
                {/if}
              </td>

              <!-- Memo -->
              <td class="py-2.5 px-4 font-sans text-zinc-500 truncate max-w-xs text-[11px]">
                {tx.memo || '—'}
              </td>

              <!-- Debit (-) -->
              <td class="py-2.5 px-4 text-right font-medium {tx.amount < 0 ? 'text-rose-400' : 'text-zinc-600'}">
                {tx.amount < 0 ? formatAmount(Math.abs(tx.amount)) : ''}
              </td>

              <!-- Credit (+) -->
              <td class="py-2.5 px-4 text-right font-medium {tx.amount > 0 ? 'text-emerald-400' : 'text-zinc-600'}">
                {tx.amount > 0 ? formatAmount(tx.amount) : ''}
              </td>

              <!-- 1-Click Interactive Clr Toggle -->
              <td class="py-2.5 px-3 text-center">
                <button
                  type="button"
                  onclick={(e) => {
                    e.stopPropagation();
                    financeStore.toggleClr(tx.id);
                  }}
                  title="Click to cycle status: Unreconciled -> Cleared -> Reconciled"
                  class="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider transition-all uppercase cursor-pointer {
                    tx.reconciliation_state === 'cleared'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-700/60 shadow-sm'
                      : tx.reconciliation_state === 'reconciled'
                      ? 'bg-sky-950 text-sky-400 border border-sky-700/60 shadow-sm'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700/40 hover:border-zinc-500 hover:text-zinc-200'
                  }"
                >
                  {#if tx.reconciliation_state === 'cleared'}
                    CLR
                  {:else if tx.reconciliation_state === 'reconciled'}
                    REC
                  {:else}
                    UNC
                  {/if}
                </button>
              </td>

              <!-- Running Balance -->
              <td class="py-2.5 px-4 text-right font-semibold text-zinc-300 whitespace-nowrap">
                {tx.running_balance !== undefined && tx.running_balance !== null
                  ? formatAmount(tx.running_balance)
                  : '—'}
              </td>
            </tr>

            <!-- Expandable Split Sub-row -->
            {#if expandedSplits[String(tx.id)] && tx.splits && tx.splits.length > 0}
              <tr class="bg-purple-950/20 border-t border-b border-purple-900/30">
                <td colspan="8" class="px-6 py-2.5">
                  <div class="space-y-1.5 pl-6 border-l-2 border-purple-500/50">
                    <div class="text-[10px] uppercase font-bold text-purple-400 tracking-wider">
                      Split Allocation Breakdown ({tx.splits.length} parts)
                    </div>
                    <div class="space-y-1 font-sans text-xs">
                      {#each tx.splits as split}
                        <div class="flex items-center justify-between py-1.5 px-3 bg-zinc-950/70 rounded-lg border border-zinc-800/80">
                          <div class="flex items-center gap-3">
                            <span class="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-medium text-[11px] border border-purple-800/50">
                              {split.category_name}
                            </span>
                            <span class="text-zinc-400 text-xs">{split.memo || '—'}</span>
                          </div>
                          <span class="font-mono font-bold {split.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}">
                            {formatAmount(split.amount)}
                          </span>
                        </div>
                      {/each}
                    </div>
                  </div>
                </td>
              </tr>
            {/if}
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>
