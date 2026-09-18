<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { FinancialGoal } from '../types/moneta';
  import {
    Target,
    Plus,
    PiggyBank,
    TrendingUp,
    CalendarClock,
    CheckCircle2,
    Pencil,
    Trash2,
    X,
    ArrowDownCircle,
    ArrowUpCircle,
    Sparkles,
    Wallet,
    Flag,
    Info
  } from '@lucide/svelte';

  // Create / edit modal form state
  let formName = $state<string>('');
  let formIcon = $state<string>('🎯');
  let formTarget = $state<number | ''>('');
  let formCurrent = $state<number | ''>('');
  let formStartDate = $state<string>(new Date().toISOString().split('T')[0]);
  let formTargetDate = $state<string>('');
  let formAccountId = $state<string | number>('');
  let formNotes = $state<string>('');

  // Fund modal state
  let fundAction = $state<'deposit' | 'withdraw'>('deposit');
  let fundAmount = $state<number | ''>('');
  let fundError = $state<string>('');

  const ICON_CHOICES = ['🎯', '🛡️', '🏡', '✈️', '🚗', '💻', '🎓', '💍', '🏖️', '📈'];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: financeStore.settings?.base_currency || 'SGD',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatCurrencyExact = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: financeStore.settings?.base_currency || 'SGD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Goals whose target date is soonest come first; achieved goals sink to the end.
  let sortedGoals = $derived(() => {
    return [...financeStore.goals].sort((a, b) => {
      if (a.status === 'achieved' && b.status !== 'achieved') return 1;
      if (b.status === 'achieved' && a.status !== 'achieved') return -1;
      return a.target_date.localeCompare(b.target_date) || a.name.localeCompare(b.name);
    });
  });

  let activeGoals = $derived(() => financeStore.goals.filter((g) => g.status !== 'achieved'));
  let achievedCount = $derived(() => financeStore.goals.filter((g) => g.status === 'achieved').length);

  let totalTarget = $derived(() => financeStore.goals.reduce((sum, g) => sum + (g.target_amount || 0), 0));
  let totalSaved = $derived(() => financeStore.goals.reduce((sum, g) => sum + (g.current_amount || 0), 0));
  let totalMonthlyRequired = $derived(() =>
    activeGoals().reduce((sum, g) => sum + (g.monthly_contribution_required || 0), 0)
  );
  let overallPercent = $derived(() => (totalTarget() > 0 ? (totalSaved() / totalTarget()) * 100 : 0));

  const statusStyles = (status: FinancialGoal['status']) => {
    switch (status) {
      case 'achieved':
        return { badge: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70', bar: 'bg-emerald-500' };
      case 'paused':
        return { badge: 'bg-zinc-800/80 text-zinc-400 border-zinc-700', bar: 'bg-zinc-600' };
      default:
        return { badge: 'bg-sky-950/70 text-sky-300 border-sky-800/70', bar: 'bg-sky-500' };
    }
  };

  const statusLabel = (status: FinancialGoal['status']) => {
    if (status === 'achieved') return 'Achieved';
    if (status === 'paused') return 'Paused';
    return 'In Progress';
  };

  function openCreateModal() {
    financeStore.editingGoal = null;
    formName = '';
    formIcon = '🎯';
    formTarget = '';
    formCurrent = '';
    formStartDate = new Date().toISOString().split('T')[0];
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    formTargetDate = nextYear.toISOString().split('T')[0];
    formAccountId = '';
    formNotes = '';
    financeStore.isGoalModalOpen = true;
  }

  function openEditModal(goal: FinancialGoal) {
    financeStore.editingGoal = goal;
    formName = goal.name;
    formIcon = goal.icon || '🎯';
    formTarget = goal.target_amount;
    formCurrent = goal.current_amount;
    formStartDate = goal.start_date;
    formTargetDate = goal.target_date;
    formAccountId = goal.account_id ?? '';
    formNotes = goal.notes || '';
    financeStore.isGoalModalOpen = true;
  }

  async function submitGoal() {
    if (!formName.trim() || formTarget === '' || Number(formTarget) <= 0) return;

    const accountId = formAccountId === '' ? undefined : formAccountId;
    const account = financeStore.accounts.find((a) => String(a.id) === String(accountId));

    await financeStore.saveGoal({
      name: formName.trim(),
      icon: formIcon || '🎯',
      target_amount: Number(formTarget),
      current_amount: Number(formCurrent) || 0,
      start_date: formStartDate,
      target_date: formTargetDate,
      account_id: accountId,
      account_name: account?.name,
      notes: formNotes.trim() || undefined,
    });

    financeStore.isGoalModalOpen = false;
    financeStore.editingGoal = null;
  }

  function openFundModal(goal: FinancialGoal, action: 'deposit' | 'withdraw') {
    financeStore.fundingGoal = goal;
    fundAction = action;
    fundAmount = '';
    fundError = '';
    financeStore.isFundGoalOpen = true;
  }

  async function submitFund() {
    const goal = financeStore.fundingGoal;
    if (!goal) return;

    const amount = Number(fundAmount);
    if (!amount || amount <= 0) {
      fundError = 'Please specify an amount greater than 0.';
      return;
    }
    if (fundAction === 'withdraw' && amount > goal.current_amount) {
      fundError = `You can withdraw at most ${formatCurrencyExact(goal.current_amount)}.`;
      return;
    }

    fundError = '';
    await financeStore.fundGoal(goal.id, amount, fundAction);
    financeStore.isFundGoalOpen = false;
    financeStore.fundingGoal = null;
  }

  async function confirmDelete(goal: FinancialGoal) {
    if (confirm(`Delete the goal "${goal.name}"? This cannot be undone.`)) {
      await financeStore.deleteGoal(goal.id);
    }
  }
</script>

<div class="flex-1 flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
  <!-- Header -->
  <header class="px-8 py-5 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between shrink-0">
    <div>
      <h1 class="text-xl font-bold text-zinc-50 flex items-center gap-2.5">
        <Target class="w-5 h-5 text-sky-400" />
        Financial Goals
      </h1>
      <p class="text-xs text-zinc-500 mt-1">
        Milestone goals and sinking funds, with the monthly contribution each one needs
      </p>
    </div>

    <div class="flex items-center gap-3">
      <button
        onclick={openCreateModal}
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold text-xs transition shadow-sm hover:shadow-sky-500/10"
      >
        <Plus class="w-4 h-4" />
        New Goal
      </button>
    </div>
  </header>

  <div class="flex-1 overflow-y-auto px-8 py-6 space-y-6">
    {#if financeStore.goals.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <Flag class="w-6 h-6 text-zinc-600" />
        </div>
        <h2 class="text-sm font-semibold text-zinc-300">No goals yet</h2>
        <p class="text-xs text-zinc-500 mt-1.5 max-w-sm">
          Set a target — an emergency fund, a down payment, a holiday — and this hub tracks the
          progress and the monthly amount needed to reach it on time.
        </p>
        <button
          onclick={openCreateModal}
          class="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold text-xs transition"
        >
          <Plus class="w-4 h-4" />
          Create your first goal
        </button>
      </div>
    {:else}
      <!-- Summary cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Total Target</span>
            <Target class="w-4 h-4 text-sky-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-zinc-100">{formatCurrency(totalTarget())}</div>
          <div class="text-[11px] text-zinc-500 mt-1">
            Across {financeStore.goals.length} goal{financeStore.goals.length === 1 ? '' : 's'}
          </div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Total Saved</span>
            <PiggyBank class="w-4 h-4 text-emerald-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-emerald-300">{formatCurrency(totalSaved())}</div>
          <div class="text-[11px] text-zinc-500 mt-1">
            {overallPercent().toFixed(1)}% of the combined target
          </div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Monthly Required</span>
            <TrendingUp class="w-4 h-4 text-amber-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-amber-300">
            {formatCurrency(totalMonthlyRequired())}
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">
            To fund {activeGoals().length} active goal{activeGoals().length === 1 ? '' : 's'} on time
          </div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Achieved</span>
            <CheckCircle2 class="w-4 h-4 text-emerald-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-zinc-100">
            {achievedCount()}<span class="text-zinc-600 text-lg">/{financeStore.goals.length}</span>
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">Goals fully funded</div>
        </div>
      </div>

      <!-- Goal cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {#each sortedGoals() as goal (goal.id)}
          {@const style = statusStyles(goal.status)}
          {@const pct = Math.min(goal.progress_percent || 0, 100)}
          <div class="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-start gap-3 min-w-0">
                <div class="w-10 h-10 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-lg shrink-0">
                  {goal.icon || '🎯'}
                </div>
                <div class="min-w-0">
                  <h3 class="text-sm font-semibold text-zinc-100 truncate" title={goal.name}>{goal.name}</h3>
                  <div class="flex items-center gap-1.5 mt-1">
                    <span class="text-[10px] px-1.5 py-0.5 rounded border font-medium {style.badge}">
                      {statusLabel(goal.status)}
                    </span>
                    {#if goal.account_name}
                      <span class="text-[10px] text-zinc-500 flex items-center gap-1 truncate">
                        <Wallet class="w-3 h-3" />
                        {goal.account_name}
                      </span>
                    {/if}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button
                  onclick={() => openEditModal(goal)}
                  class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
                  title="Edit goal"
                >
                  <Pencil class="w-3.5 h-3.5" />
                </button>
                <button
                  onclick={() => confirmDelete(goal)}
                  class="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                  title="Delete goal"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Progress -->
            <div>
              <div class="flex items-baseline justify-between mb-1.5">
                <span class="text-lg font-bold font-mono text-zinc-100">
                  {formatCurrency(goal.current_amount)}
                </span>
                <span class="text-xs text-zinc-500 font-mono">of {formatCurrency(goal.target_amount)}</span>
              </div>
              <div class="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div class="h-full rounded-full transition-all duration-500 {style.bar}" style="width: {pct}%"></div>
              </div>
              <div class="flex items-center justify-between mt-1.5 text-[11px]">
                <span class="text-zinc-400 font-medium">{pct.toFixed(1)}% funded</span>
                {#if goal.status === 'achieved'}
                  <span class="text-emerald-400 font-medium">Target reached</span>
                {:else}
                  <span class="text-zinc-500 font-mono">
                    {formatCurrency(goal.remaining_amount)} to go
                  </span>
                {/if}
              </div>
            </div>

            <!-- Timing -->
            <div class="flex items-center justify-between pt-3 border-t border-zinc-800/70 text-[11px]">
              <div class="flex items-center gap-1.5 text-zinc-400">
                <CalendarClock class="w-3.5 h-3.5 text-zinc-500" />
                <span class="font-mono">{goal.target_date}</span>
                {#if goal.months_remaining > 0}
                  <span class="text-zinc-600">·</span>
                  <span class="text-zinc-500">
                    {goal.months_remaining} mo{goal.months_remaining === 1 ? '' : 's'} left
                  </span>
                {/if}
              </div>
              {#if goal.status !== 'achieved'}
                <div class="text-right">
                  <span class="text-zinc-500">Needs</span>
                  <span class="text-sky-300 font-mono font-semibold ml-1">
                    {formatCurrencyExact(goal.monthly_contribution_required)}/mo
                  </span>
                </div>
              {/if}
            </div>

            {#if goal.notes}
              <p class="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{goal.notes}</p>
            {/if}

            <!-- Actions -->
            <div class="flex items-center gap-2 pt-1">
              <button
                onclick={() => openFundModal(goal, 'deposit')}
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/60 hover:bg-emerald-900/60 text-emerald-300 text-[11px] font-semibold transition"
              >
                <ArrowDownCircle class="w-3.5 h-3.5" />
                Add Funds
              </button>
              {#if goal.current_amount > 0}
                <button
                  onclick={() => openFundModal(goal, 'withdraw')}
                  class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 hover:bg-zinc-800 text-zinc-300 text-[11px] font-semibold transition"
                >
                  <ArrowUpCircle class="w-3.5 h-3.5" />
                  Withdraw
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/60">
        <Info class="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
        <p class="text-[11px] text-zinc-500 leading-relaxed">
          Progress and the monthly contribution are derived from the target, the saved amount and the
          target date. A goal is marked achieved once its saved amount reaches the target.
        </p>
      </div>
    {/if}
  </div>
</div>

<!-- Create / Edit Goal Modal -->
{#if financeStore.isGoalModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Target class="w-4 h-4 text-sky-400" />
          {financeStore.editingGoal ? 'Edit Goal' : 'New Financial Goal'}
        </h2>
        <button
          onclick={() => { financeStore.isGoalModalOpen = false; financeStore.editingGoal = null; }}
          class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="px-6 py-5 space-y-4">
        <div>
          <label for="goal-name" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Goal Name</label>
          <input
            id="goal-name"
            type="text"
            bind:value={formName}
            placeholder="e.g. Emergency Fund (6 Months)"
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </div>

        <div>
          <label for="goal-icon" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Icon</label>
          <div id="goal-icon" class="flex flex-wrap gap-1.5">
            {#each ICON_CHOICES as icon}
              <button
                onclick={() => (formIcon = icon)}
                class="w-9 h-9 rounded-lg border text-base transition {formIcon === icon
                  ? 'bg-sky-950/60 border-sky-700'
                  : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}"
              >
                {icon}
              </button>
            {/each}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="goal-target" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Target Amount</label>
            <input
              id="goal-target"
              type="number"
              min="0"
              step="0.01"
              bind:value={formTarget}
              placeholder="0.00"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label for="goal-current" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Already Saved</label>
            <input
              id="goal-current"
              type="number"
              min="0"
              step="0.01"
              bind:value={formCurrent}
              placeholder="0.00"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="goal-start" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Start Date</label>
            <input
              id="goal-start"
              type="date"
              bind:value={formStartDate}
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
            />
          </div>
          <div>
            <label for="goal-target-date" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Target Date</label>
            <input
              id="goal-target-date"
              type="date"
              bind:value={formTargetDate}
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
            />
          </div>
        </div>

        <div>
          <label for="goal-account" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">
            Dedicated Account <span class="text-zinc-600 font-normal">(optional)</span>
          </label>
          <select
            id="goal-account"
            bind:value={formAccountId}
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
          >
            <option value="">No dedicated account</option>
            {#each financeStore.accounts as account}
              <option value={account.id}>{account.name}</option>
            {/each}
          </select>
        </div>

        <div>
          <label for="goal-notes" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">
            Motivation &amp; Notes
          </label>
          <textarea
            id="goal-notes"
            bind:value={formNotes}
            rows="2"
            placeholder="Why this goal matters"
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600 resize-none"
          ></textarea>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-800">
        <button
          onclick={() => { financeStore.isGoalModalOpen = false; financeStore.editingGoal = null; }}
          class="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition"
        >
          Cancel
        </button>
        <button
          onclick={submitGoal}
          disabled={!formName.trim() || formTarget === '' || Number(formTarget) <= 0}
          class="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-semibold text-xs transition"
        >
          {financeStore.editingGoal ? 'Save Changes' : 'Create Goal'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Fund Goal Modal -->
{#if financeStore.isFundGoalOpen && financeStore.fundingGoal}
  {@const goal = financeStore.fundingGoal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl">
      <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-emerald-400" />
          {fundAction === 'deposit' ? 'Add Funds' : 'Withdraw Funds'}
        </h2>
        <button
          onclick={() => { financeStore.isFundGoalOpen = false; financeStore.fundingGoal = null; }}
          class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="px-6 py-5 space-y-4">
        <div class="flex items-center gap-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
          <div class="w-9 h-9 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-base shrink-0">
            {goal.icon || '🎯'}
          </div>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-zinc-100 truncate">{goal.name}</div>
            <div class="text-[11px] text-zinc-500 font-mono">
              {formatCurrencyExact(goal.current_amount)} of {formatCurrencyExact(goal.target_amount)}
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            onclick={() => { fundAction = 'deposit'; fundError = ''; }}
            class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition {fundAction === 'deposit'
              ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
          >
            <ArrowDownCircle class="w-3.5 h-3.5" />
            Deposit
          </button>
          <button
            onclick={() => { fundAction = 'withdraw'; fundError = ''; }}
            class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition {fundAction === 'withdraw'
              ? 'bg-amber-950/60 border-amber-700 text-amber-300'
              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'}"
          >
            <ArrowUpCircle class="w-3.5 h-3.5" />
            Withdraw
          </button>
        </div>

        <div>
          <label for="fund-amount" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Amount</label>
          <input
            id="fund-amount"
            type="number"
            min="0"
            step="0.01"
            bind:value={fundAmount}
            placeholder="0.00"
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
          />
        </div>

        {#if fundError}
          <p class="text-[11px] text-rose-400">{fundError}</p>
        {/if}

        <!-- Live preview of the resulting balance -->
        {#if Number(fundAmount) > 0}
          {@const next = fundAction === 'withdraw'
            ? Math.max(goal.current_amount - Number(fundAmount), 0)
            : goal.current_amount + Number(fundAmount)}
          <div class="px-3 py-2 rounded-lg bg-zinc-950/60 border border-zinc-800 text-[11px]">
            <span class="text-zinc-500">New saved balance</span>
            <span class="text-zinc-100 font-mono font-semibold ml-2">{formatCurrencyExact(next)}</span>
            {#if next >= goal.target_amount && goal.target_amount > 0}
              <span class="text-emerald-400 ml-2">· goal reached 🎉</span>
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-800">
        <button
          onclick={() => { financeStore.isFundGoalOpen = false; financeStore.fundingGoal = null; }}
          class="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition"
        >
          Cancel
        </button>
        <button
          onclick={submitFund}
          disabled={!Number(fundAmount) || Number(fundAmount) <= 0}
          class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-semibold text-xs transition"
        >
          {fundAction === 'deposit' ? 'Add Funds' : 'Withdraw'}
        </button>
      </div>
    </div>
  </div>
{/if}
