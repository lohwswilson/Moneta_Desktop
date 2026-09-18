<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { EnvelopeBudget } from '../types/moneta';
  import {
    PiggyBank,
    Plus,
    Sparkles,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    Edit3,
    Trash2,
    X,
    ArrowRight,
    HelpCircle,
    Wallet,
    TrendingDown,
    SlidersHorizontal,
    Check
  } from '@lucide/svelte';

  // State
  let filterGroup = $state<'all' | 'need' | 'want' | 'saving'>('all');
  
  // Can I Spend modal state
  let canISpendAmount = $state<number | ''>('');
  let canISpendCategory = $state<string>('');
  let canISpendMemo = $state<string>('');

  // Edit / Create Envelope modal state
  let isEditing = $state<boolean>(false);
  let formId = $state<string | number | undefined>(undefined);
  let formName = $state<string>('');
  let formCategory = $state<string>('');
  let formAllocated = $state<number | ''>('');
  let formGroup = $state<'need' | 'want' | 'saving'>('need');
  let formColor = $state<string>('#10b981');
  let formRollover = $state<boolean>(false);

  const COLOR_PALETTE = [
    '#10b981', // emerald
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#14b8a6', // teal
    '#ef4444', // rose
  ];

  // Derived metrics
  let totalAllocated = $derived(
    financeStore.budgets.reduce((sum, b) => sum + (b.allocated_amount || 0), 0)
  );

  let totalSpent = $derived(
    financeStore.budgets.reduce((sum, b) => sum + (b.spent_amount || 0), 0)
  );

  let totalRemaining = $derived(totalAllocated - totalSpent);

  let overallPercent = $derived(
    totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0
  );

  // Month progress
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  const monthPercentElapsed = Math.round((currentDay / daysInMonth) * 100);

  let filteredBudgets = $derived(
    filterGroup === 'all'
      ? financeStore.budgets
      : financeStore.budgets.filter((b) => b.category_group === filterGroup)
  );

  // Needs vs Wants vs Savings breakdown
  let needsAllocated = $derived(
    financeStore.budgets.filter((b) => b.category_group === 'need').reduce((s, b) => s + b.allocated_amount, 0)
  );
  let needsSpent = $derived(
    financeStore.budgets.filter((b) => b.category_group === 'need').reduce((s, b) => s + b.spent_amount, 0)
  );

  let wantsAllocated = $derived(
    financeStore.budgets.filter((b) => b.category_group === 'want').reduce((s, b) => s + b.allocated_amount, 0)
  );
  let wantsSpent = $derived(
    financeStore.budgets.filter((b) => b.category_group === 'want').reduce((s, b) => s + b.spent_amount, 0)
  );

  let savingsAllocated = $derived(
    financeStore.budgets.filter((b) => b.category_group === 'saving').reduce((s, b) => s + b.allocated_amount, 0)
  );

  // Formatting helper
  const formatCurrency = (amount: number, currency: string = 'SGD') => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Can I Spend calculation
  let selectedBudgetForCheck = $derived(
    financeStore.budgets.find((b) => b.category_name === canISpendCategory)
  );

  let spendAnalysis = $derived(() => {
    if (!selectedBudgetForCheck || !canISpendAmount || canISpendAmount <= 0) return null;
    const currentRem = selectedBudgetForCheck.remaining_amount;
    const projectedRem = currentRem - Number(canISpendAmount);
    const exceeds = projectedRem < 0;
    const deficit = exceeds ? Math.abs(projectedRem) : 0;

    // Potential donors for reallocation
    const candidateDonors = financeStore.budgets
      .filter((b) => b.id !== selectedBudgetForCheck?.id && b.remaining_amount > 20)
      .sort((a, b) => b.remaining_amount - a.remaining_amount);

    return {
      currentRemaining: currentRem,
      projectedRemaining: projectedRem,
      exceeds,
      deficit,
      candidateDonors,
    };
  });

  // Modal handlers
  function openCreateModal() {
    isEditing = false;
    formId = undefined;
    formName = '';
    formCategory = '';
    formAllocated = '';
    formGroup = 'need';
    formColor = '#10b981';
    formRollover = false;
    financeStore.isBudgetModalOpen = true;
  }

  function openEditModal(budget: EnvelopeBudget) {
    isEditing = true;
    formId = budget.id;
    formName = budget.name;
    formCategory = budget.category_name;
    formAllocated = budget.allocated_amount;
    formGroup = budget.category_group || 'need';
    formColor = budget.color_code || '#10b981';
    formRollover = budget.rollover || false;
    financeStore.isBudgetModalOpen = true;
  }

  async function handleSaveBudget() {
    if (!formName || !formCategory || formAllocated === '') return;
    await financeStore.saveBudget({
      id: formId,
      name: formName,
      category_name: formCategory,
      allocated_amount: Number(formAllocated),
      period: 'monthly',
      category_group: formGroup,
      rollover: formRollover,
      color_code: formColor,
    });
  }

  async function handleDeleteBudget(id: string | number) {
    if (confirm('Are you sure you want to remove this envelope?')) {
      await financeStore.deleteBudget(id);
    }
  }

  function openCanISpendModal(defaultCategory?: string) {
    canISpendAmount = '';
    canISpendMemo = '';
    canISpendCategory = defaultCategory || (financeStore.budgets[0]?.category_name ?? '');
    financeStore.isCanISpendOpen = true;
  }
</script>

<div class="flex-1 flex flex-col h-full bg-zinc-950 overflow-y-auto">
  <!-- Top Navigation & Metric Banner -->
  <header class="p-6 border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm sticky top-0 z-10">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <PiggyBank class="w-5 h-5" />
          </div>
          <div>
            <h1 class="text-xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
              Envelope Budgets
              <span class="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                Zero-Based
              </span>
            </h1>
            <p class="text-xs text-zinc-400 mt-0.5">
              Assign every dollar a job. Live balance tracking & impulse spend check.
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2.5">
        <button
          onclick={() => openCanISpendModal()}
          class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
        >
          <Sparkles class="w-4 h-4 text-indigo-200" />
          <span>Can I Spend?</span>
        </button>

        <button
          onclick={openCreateModal}
          class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Plus class="w-4 h-4" />
          <span>New Envelope</span>
        </button>
      </div>
    </div>

    <!-- Monthly Health & Summary Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3.5 mt-6">
      <!-- Total Budgeted -->
      <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
        <div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Budgeted</div>
        <div class="text-2xl font-bold text-zinc-100 font-mono mt-1">
          {formatCurrency(totalAllocated)}
        </div>
        <div class="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
          <span>{financeStore.budgets.length} Active Envelopes</span>
        </div>
      </div>

      <!-- Spent So Far -->
      <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
        <div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Spent So Far</div>
        <div class="text-2xl font-bold text-amber-400 font-mono mt-1">
          {formatCurrency(totalSpent)}
        </div>
        <div class="text-[11px] text-zinc-500 mt-1">
          <span class="text-amber-400 font-medium">{overallPercent}%</span> of monthly allocation
        </div>
      </div>

      <!-- Safe to Spend (Remaining) -->
      <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800">
        <div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Safe to Spend</div>
        <div class="text-2xl font-bold font-mono mt-1 {totalRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
          {formatCurrency(totalRemaining)}
        </div>
        <div class="text-[11px] text-zinc-500 mt-1">
          {#if totalRemaining >= 0}
            <span>Unallocated buffer available</span>
          {:else}
            <span class="text-rose-400 font-medium">Over budget by {formatCurrency(Math.abs(totalRemaining))}</span>
          {/if}
        </div>
      </div>

      <!-- Month Elapsed vs Spend Pace -->
      <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
            <span>Month Pace</span>
            <span class="text-zinc-300 font-mono">Day {currentDay} / {daysInMonth}</span>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <div class="flex-1 bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                class="h-full transition-all duration-500 {overallPercent > monthPercentElapsed ? 'bg-amber-400' : 'bg-emerald-400'}"
                style="width: {Math.min(overallPercent, 100)}%"
              ></div>
            </div>
            <span class="text-xs font-mono text-zinc-300">{overallPercent}%</span>
          </div>
        </div>
        <div class="text-[11px] mt-2 {overallPercent <= monthPercentElapsed ? 'text-emerald-400' : 'text-amber-400'}">
          {#if overallPercent <= monthPercentElapsed}
            ✓ Under pace ({monthPercentElapsed - overallPercent}% under timeline)
          {:else}
            ⚠ Over pace ({overallPercent - monthPercentElapsed}% ahead of timeline)
          {/if}
        </div>
      </div>
    </div>
  </header>

  <!-- Filter Pills & Group Breakdown -->
  <div class="px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/60 bg-zinc-900/20">
    <!-- Filter Pills -->
    <div class="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
      <button
        onclick={() => (filterGroup = 'all')}
        class="px-3 py-1 text-xs font-medium rounded-md transition-all {filterGroup === 'all' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        All ({financeStore.budgets.length})
      </button>
      <button
        onclick={() => (filterGroup = 'need')}
        class="px-3 py-1 text-xs font-medium rounded-md transition-all {filterGroup === 'need' ? 'bg-zinc-800 text-emerald-400 shadow' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        Needs ({financeStore.budgets.filter(b => b.category_group === 'need').length})
      </button>
      <button
        onclick={() => (filterGroup = 'want')}
        class="px-3 py-1 text-xs font-medium rounded-md transition-all {filterGroup === 'want' ? 'bg-zinc-800 text-amber-400 shadow' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        Wants ({financeStore.budgets.filter(b => b.category_group === 'want').length})
      </button>
      <button
        onclick={() => (filterGroup = 'saving')}
        class="px-3 py-1 text-xs font-medium rounded-md transition-all {filterGroup === 'saving' ? 'bg-zinc-800 text-sky-400 shadow' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        Savings ({financeStore.budgets.filter(b => b.category_group === 'saving').length})
      </button>
    </div>

    <!-- Needs vs Wants Micro-Bar -->
    <div class="flex items-center gap-4 text-xs text-zinc-400">
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
        <span>Needs: <strong class="text-zinc-200 font-mono">{formatCurrency(needsSpent)}</strong> / {formatCurrency(needsAllocated)}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
        <span>Wants: <strong class="text-zinc-200 font-mono">{formatCurrency(wantsSpent)}</strong> / {formatCurrency(wantsAllocated)}</span>
      </div>
    </div>
  </div>

  <!-- Category Envelopes Grid -->
  <div class="p-6 flex-1">
    {#if filteredBudgets.length === 0}
      <div class="h-64 flex flex-col items-center justify-center text-center border border-dashed border-zinc-800 rounded-2xl p-6">
        <PiggyBank class="w-10 h-10 text-zinc-600 mb-3" />
        <h3 class="text-sm font-semibold text-zinc-300">No envelopes in this category</h3>
        <p class="text-xs text-zinc-500 max-w-sm mt-1">
          Create an envelope to start allocating monthly caps and tracking safe-to-spend allowances.
        </p>
        <button
          onclick={openCreateModal}
          class="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
        >
          + Create Envelope
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each filteredBudgets as budget (budget.id)}
          {@const spentPct = budget.spent_percent ?? (budget.allocated_amount > 0 ? Math.round((budget.spent_amount / budget.allocated_amount) * 100) : 0)}
          {@const isOver = budget.remaining_amount < 0 || spentPct >= 100}
          {@const isWarning = spentPct >= 70 && !isOver}

          <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col justify-between group">
            <div>
              <!-- Envelope Header -->
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2">
                  <div
                    class="w-3 h-3 rounded-full"
                    style="background-color: {budget.color_code || '#3b82f6'}"
                  ></div>
                  <div>
                    <h3 class="font-semibold text-sm text-zinc-100">{budget.name}</h3>
                    <div class="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                      <span>Category: <strong>{budget.category_name}</strong></span>
                      <span>•</span>
                      <span class="capitalize px-1.5 py-0.2 rounded text-[10px] font-medium {budget.category_group === 'need' ? 'bg-emerald-950/60 text-emerald-400' : budget.category_group === 'want' ? 'bg-amber-950/60 text-amber-400' : 'bg-sky-950/60 text-sky-400'}">
                        {budget.category_group || 'need'}
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Action Dropdown / Buttons -->
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onclick={() => openCanISpendModal(budget.category_name)}
                    title="Test spend against this envelope"
                    class="p-1 rounded text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800"
                  >
                    <Sparkles class="w-3.5 h-3.5" />
                  </button>
                  <button
                    onclick={() => openEditModal(budget)}
                    title="Edit envelope"
                    class="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                  >
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>
                  <button
                    onclick={() => handleDeleteBudget(budget.id)}
                    title="Delete envelope"
                    class="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Spending vs Allocated Numbers -->
              <div class="mt-4 flex items-baseline justify-between">
                <div>
                  <div class="text-[11px] text-zinc-400">Spent</div>
                  <div class="text-base font-bold font-mono text-zinc-200">
                    {formatCurrency(budget.spent_amount)}
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-[11px] text-zinc-400">Allocated Cap</div>
                  <div class="text-base font-bold font-mono text-zinc-400">
                    {formatCurrency(budget.allocated_amount)}
                  </div>
                </div>
              </div>

              <!-- Progress Bar -->
              <div class="mt-2.5">
                <div class="w-full bg-zinc-800/90 h-2 rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500 {isOver ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'}"
                    style="width: {Math.min(spentPct, 100)}%"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Footer Remaining & Alert Status -->
            <div class="mt-4 pt-3 border-t border-zinc-800/60 flex items-center justify-between text-xs">
              <div class="flex items-center gap-1 font-medium">
                {#if isOver}
                  <AlertCircle class="w-3.5 h-3.5 text-rose-400" />
                  <span class="text-rose-400">Over by {formatCurrency(Math.abs(budget.remaining_amount))}</span>
                {:else if isWarning}
                  <AlertTriangle class="w-3.5 h-3.5 text-amber-400" />
                  <span class="text-amber-400">{formatCurrency(budget.remaining_amount)} left</span>
                {:else}
                  <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
                  <span class="text-emerald-400">{formatCurrency(budget.remaining_amount)} left</span>
                {/if}
              </div>

              <div class="text-[11px] font-mono text-zinc-500">
                {spentPct}% used
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<!-- Modal 1: "Can I Spend?" Affordability Calculator -->
{#if financeStore.isCanISpendOpen}
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
      <!-- Modal Header -->
      <div class="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Sparkles class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-100">Can I Spend?</h2>
            <p class="text-xs text-zinc-400">Impulse purchase affordability test</p>
          </div>
        </div>
        <button
          onclick={() => (financeStore.isCanISpendOpen = false)}
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-5 space-y-4">
        <!-- Purchase Amount Input -->
        <div>
          <label for="spend-amount" class="block text-xs font-medium text-zinc-300 mb-1.5">Purchase Amount ($)</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">$</span>
            <input
              id="spend-amount"
              type="number"
              bind:value={canISpendAmount}
              placeholder="0.00"
              step="0.01"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <!-- Target Envelope Dropdown -->
        <div>
          <label for="spend-category" class="block text-xs font-medium text-zinc-300 mb-1.5">Deduct from Envelope</label>
          <select
            id="spend-category"
            bind:value={canISpendCategory}
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
          >
            {#each financeStore.budgets as b}
              <option value={b.category_name}>
                {b.name} ({formatCurrency(b.remaining_amount)} available)
              </option>
            {/each}
          </select>
        </div>

        <!-- Item Name / Memo -->
        <div>
          <label for="spend-memo" class="block text-xs font-medium text-zinc-300 mb-1.5">Item Name / Reason (Optional)</label>
          <input
            id="spend-memo"
            type="text"
            bind:value={canISpendMemo}
            placeholder="e.g. Dinner with friends, New keyboard"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <!-- Real-Time Verdict Card -->
        {#if spendAnalysis()}
          {@const analysis = spendAnalysis()}
          {#if analysis}
            <div class="mt-4 p-4 rounded-xl border transition-all {analysis.exceeds ? 'bg-rose-950/40 border-rose-800/80' : analysis.projectedRemaining < 30 ? 'bg-amber-950/40 border-amber-800/80' : 'bg-emerald-950/40 border-emerald-800/80'}">
              <div class="flex items-start gap-3">
                {#if analysis.exceeds}
                  <AlertCircle class="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
                  <div>
                    <div class="font-bold text-sm text-rose-300">Envelope Overdraft!</div>
                    <div class="text-xs text-rose-200/80 mt-1">
                      This purchase of <strong>{formatCurrency(Number(canISpendAmount))}</strong> exceeds your {canISpendCategory} envelope by <strong>{formatCurrency(analysis.deficit)}</strong>.
                    </div>

                    <!-- Suggest Reallocation -->
                    {#if analysis.candidateDonors.length > 0}
                      <div class="mt-3 pt-2.5 border-t border-rose-800/40 text-[11px] text-zinc-300">
                        <div class="font-semibold text-rose-200">Reallocation Suggestions:</div>
                        <div class="space-y-1 mt-1">
                          {#each analysis.candidateDonors.slice(0, 2) as donor}
                            <div class="flex items-center justify-between text-zinc-400">
                              <span>Reallocate from <strong>{donor.name}</strong></span>
                              <span class="text-emerald-400 font-mono">+{formatCurrency(donor.remaining_amount)} avail</span>
                            </div>
                          {/each}
                        </div>
                      </div>
                    {/if}
                  </div>
                {:else if analysis.projectedRemaining < 30}
                  <AlertTriangle class="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <div class="font-bold text-sm text-amber-300">Tight Margin Ahead</div>
                    <div class="text-xs text-amber-200/80 mt-1">
                      Affordable, but leaves only <strong>{formatCurrency(analysis.projectedRemaining)}</strong> in your {canISpendCategory} envelope for the remaining {daysInMonth - currentDay} days of the month.
                    </div>
                  </div>
                {:else}
                  <CheckCircle2 class="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <div class="font-bold text-sm text-emerald-300">Safe to Spend!</div>
                    <div class="text-xs text-emerald-200/80 mt-1">
                      You will have <strong>{formatCurrency(analysis.projectedRemaining)}</strong> remaining in {canISpendCategory} after this purchase.
                    </div>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
        <button
          onclick={() => (financeStore.isCanISpendOpen = false)}
          class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal 2: Create / Edit Envelope Modal -->
{#if financeStore.isBudgetModalOpen}
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
      <!-- Modal Header -->
      <div class="p-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/50">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <PiggyBank class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-base font-bold text-zinc-100">
              {isEditing ? 'Edit Envelope' : 'New Spending Envelope'}
            </h2>
            <p class="text-xs text-zinc-400">Set monthly cap & category assignment</p>
          </div>
        </div>
        <button
          onclick={() => (financeStore.isBudgetModalOpen = false)}
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <form onsubmit={(e) => { e.preventDefault(); handleSaveBudget(); }} class="p-5 space-y-4">
        <!-- Envelope Label -->
        <div>
          <label for="form-name" class="block text-xs font-medium text-zinc-300 mb-1.5">Envelope Name</label>
          <input
            id="form-name"
            type="text"
            bind:value={formName}
            required
            placeholder="e.g. Groceries & Provisions"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <!-- Ledger Category Name -->
        <div>
          <label for="form-category" class="block text-xs font-medium text-zinc-300 mb-1.5">Matching Ledger Category</label>
          <input
            id="form-category"
            type="text"
            bind:value={formCategory}
            required
            placeholder="e.g. Groceries"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
          />
          <span class="text-[10px] text-zinc-500 mt-1 block">
            Transactions with this category will automatically debit this envelope.
          </span>
        </div>

        <!-- Monthly Cap & Group -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="form-allocated" class="block text-xs font-medium text-zinc-300 mb-1.5">Monthly Cap ($)</label>
            <input
              id="form-allocated"
              type="number"
              bind:value={formAllocated}
              required
              step="1"
              min="0"
              placeholder="500"
              class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label for="form-group" class="block text-xs font-medium text-zinc-300 mb-1.5">Category Group</label>
            <select
              id="form-group"
              bind:value={formGroup}
              class="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="need">Need (Essentials)</option>
              <option value="want">Want (Discretionary)</option>
              <option value="saving">Saving & Debt</option>
            </select>
          </div>
        </div>

        <!-- Color Accent Picker -->
        <div>
          <div class="block text-xs font-medium text-zinc-300 mb-1.5">Color Accent</div>
          <div class="flex items-center gap-2">
            {#each COLOR_PALETTE as color}
              <button
                type="button"
                aria-label="Select color {color}"
                onclick={() => (formColor = color)}
                class="w-7 h-7 rounded-full transition-transform flex items-center justify-center {formColor === color ? 'scale-110 ring-2 ring-white' : 'hover:scale-105'}"
                style="background-color: {color}"
              >
                {#if formColor === color}
                  <Check class="w-3.5 h-3.5 text-white drop-shadow" />
                {/if}
              </button>
            {/each}
          </div>
        </div>

        <!-- Rollover Option -->
        <div class="flex items-center justify-between p-3 rounded-lg bg-zinc-950 border border-zinc-800">
          <div>
            <div class="text-xs font-medium text-zinc-200">Rollover Unspent Surplus</div>
            <div class="text-[10px] text-zinc-500">Carry over positive balance to next month's envelope</div>
          </div>
          <input
            type="checkbox"
            bind:checked={formRollover}
            class="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-400 bg-zinc-900 border-zinc-700"
          />
        </div>

        <!-- Modal Actions -->
        <div class="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onclick={() => (financeStore.isBudgetModalOpen = false)}
            class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition-colors"
          >
            {isEditing ? 'Save Changes' : 'Create Envelope'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
