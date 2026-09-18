<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { LoanScenario } from '../types/moneta';
  import { simulatePrepayment } from '../data/loanMath';
  import {
    Landmark,
    Plus,
    Pencil,
    Trash2,
    X,
    Calculator,
    Zap,
    Clock,
    CalendarClock,
    BadgePercent,
    Sparkles,
    History,
    ListOrdered,
    Wallet,
    Info,
  } from '@lucide/svelte';

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

  // -------------------------------------------------------------------------
  // Live prepayment simulation — local state, never persisted.
  // Seed from the scenario that is selected when the hub mounts; switching
  // scenarios re-seeds from that scenario's own saved prepayment settings.
  // -------------------------------------------------------------------------
  const initialScenario =
    financeStore.loanScenarios.find((s) => String(s.id) === String(financeStore.selectedLoanId)) ||
    financeStore.loanScenarios[0];

  let extra = $state<number>(initialScenario?.extra_monthly_payment || 0);
  let lump = $state<number>(initialScenario?.lump_sum_payment || 0);
  let lumpDate = $state<string>(initialScenario?.lump_sum_date || '');
  let showAllPayments = $state<boolean>(false);
  let inferBusy = $state<boolean>(false);
  let inferMsg = $state<string>('');

  // Create / edit loan scenario modal form state
  let formId = $state<string | number | undefined>(undefined);
  let formName = $state<string>('');
  let formAccountId = $state<string | number>('');
  let formPrincipal = $state<number | ''>('');
  let formRate = $state<number | ''>('');
  let formTermYears = $state<number | ''>('');
  let formTermMonths = $state<number | ''>('');
  let formStartDate = $state<string>(new Date().toISOString().split('T')[0]);
  let formExtra = $state<number | ''>(0);
  let formLump = $state<number | ''>(0);
  let formLumpDate = $state<string>('');

  let mortgageAccounts = $derived.by(() =>
    financeStore.accounts.filter((a) => a.account_type === 'mortgage' || a.account_type === 'loan')
  );

  let activeScenario = $derived.by(() => {
    const list = financeStore.loanScenarios;
    if (list.length === 0) return null;
    return list.find((s) => String(s.id) === String(financeStore.selectedLoanId)) || list[0];
  });

  let hasPrepayment = $derived.by(() => extra > 0 || lump > 0);

  // The live simulation — all amortization arithmetic lives in loanMath.ts.
  let sim = $derived.by(() => {
    const s = activeScenario;
    if (!s) return null;
    return simulatePrepayment({
      principal: s.principal_amount,
      annualRatePct: s.annual_interest_rate,
      termMonths: s.loan_term_months,
      startDate: s.start_date,
      extraMonthly: extra,
      lumpSum: lump,
      lumpSumDate: lumpDate || s.lump_sum_date,
      rateChanges: s.rate_changes,
    });
  });

  let scheduleLines = $derived.by(() => {
    if (!sim) return [];
    const lines = hasPrepayment ? sim.accelerated.lines : sim.baseline.lines;
    return showAllPayments ? lines : lines.slice(0, 24);
  });

  function selectScenario(s: LoanScenario) {
    financeStore.selectedLoanId = s.id;
    extra = s.extra_monthly_payment || 0;
    lump = s.lump_sum_payment || 0;
    lumpDate = s.lump_sum_date || '';
    showAllPayments = false;
    inferMsg = '';
  }

  // --- Modal handlers ---
  function openCreateModal() {
    financeStore.editingLoan = null;
    formId = undefined;
    formName = '';
    formAccountId = mortgageAccounts[0]?.id ?? '';
    formPrincipal = '';
    formRate = '';
    formTermYears = '';
    formTermMonths = '';
    formStartDate = new Date().toISOString().split('T')[0];
    formExtra = 0;
    formLump = 0;
    formLumpDate = '';
    financeStore.isLoanModalOpen = true;
  }

  function openEditModal(s: LoanScenario) {
    financeStore.editingLoan = s;
    formId = s.id;
    formName = s.name;
    formAccountId = s.account_id ?? '';
    formPrincipal = s.principal_amount;
    formRate = s.annual_interest_rate;
    formTermYears = s.loan_term_years;
    formTermMonths = s.loan_term_months;
    formStartDate = s.start_date;
    formExtra = s.extra_monthly_payment || 0;
    formLump = s.lump_sum_payment || 0;
    formLumpDate = s.lump_sum_date || '';
    financeStore.isLoanModalOpen = true;
  }

  async function submitLoan() {
    if (!formName.trim() || formPrincipal === '' || Number(formPrincipal) <= 0) return;

    const acc = financeStore.accounts.find((a) => String(a.id) === String(formAccountId));
    const termMonths = formTermMonths === '' ? (Number(formTermYears) || 0) * 12 : Number(formTermMonths);
    if (termMonths <= 0) return;

    await financeStore.saveLoanScenario({
      name: formName.trim(),
      account_id: formAccountId === '' ? undefined : formAccountId,
      account_name: acc?.name,
      principal_amount: Number(formPrincipal),
      annual_interest_rate: Number(formRate) || 0,
      loan_term_years: Number(formTermYears) || 0,
      loan_term_months: termMonths,
      start_date: formStartDate,
      extra_monthly_payment: Number(formExtra) || 0,
      lump_sum_payment: Number(formLump) || 0,
      lump_sum_date: formLumpDate || undefined,
    });

    financeStore.isLoanModalOpen = false;
    financeStore.editingLoan = null;
  }

  async function confirmDelete(s: LoanScenario) {
    if (confirm(`Delete the loan scenario "${s.name}"? This cannot be undone.`)) {
      await financeStore.deleteLoanScenario(s.id);
    }
  }

  async function handleInferRateChanges() {
    const s = activeScenario;
    if (!s) return;
    inferBusy = true;
    try {
      const n = await financeStore.inferLoanRateChanges(s.id);
      const msg =
        n > 0
          ? `Inferred ${n} rate-change segment${n === 1 ? '' : 's'} from the payment history.`
          : 'No rate segments inferred — the payment history is flat or unavailable.';
      inferMsg = msg;
      setTimeout(() => {
        if (inferMsg === msg) inferMsg = '';
      }, 5000);
    } finally {
      inferBusy = false;
    }
  }
</script>

<div class="flex-1 flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
  <!-- Header -->
  <header class="px-8 py-5 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-3.5">
      <div class="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm">
        <Landmark class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-zinc-50">Loan Scenarios &amp; Prepayment Simulator</h1>
        <p class="text-xs text-zinc-500 mt-1">
          Model extra payments and lump sums against the full amortization schedule before committing
        </p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <button
        onclick={openCreateModal}
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold text-xs transition shadow-sm hover:shadow-sky-500/10"
      >
        <Plus class="w-4 h-4" />
        New Loan Scenario
      </button>
    </div>
  </header>

  <div class="flex-1 overflow-y-auto px-8 py-6 space-y-6">
    {#if financeStore.loanScenarios.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <Landmark class="w-6 h-6 text-zinc-600" />
        </div>
        <h2 class="text-sm font-semibold text-zinc-300">No loan scenarios yet</h2>
        <p class="text-xs text-zinc-500 mt-1.5 max-w-sm">
          Capture a mortgage or personal loan once, then explore prepayment strategies against a
          full amortization schedule — without changing the saved plan.
        </p>
        <button
          onclick={openCreateModal}
          class="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold text-xs transition"
        >
          <Plus class="w-4 h-4" />
          Create your first scenario
        </button>
      </div>
    {:else if activeScenario && sim}
      {@const s = activeScenario}
      <!-- Scenario selector -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mr-1">Scenario</span>
        {#each financeStore.loanScenarios as sc (sc.id)}
          <button
            onclick={() => selectScenario(sc)}
            class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition {String(financeStore.selectedLoanId) === String(sc.id)
              ? 'bg-sky-950/60 border-sky-700 text-sky-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}"
          >
            {sc.name}
          </button>
        {/each}

        <div class="flex items-center gap-1 ml-auto">
          <button
            onclick={() => openEditModal(s)}
            class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Edit scenario"
          >
            <Pencil class="w-3.5 h-3.5" />
          </button>
          <button
            onclick={() => confirmDelete(s)}
            class="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
            title="Delete scenario"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Scenario facts -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Principal</span>
            <Wallet class="w-4 h-4 text-sky-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-zinc-100">{formatCurrency(s.principal_amount)}</div>
          <div class="text-[11px] text-zinc-500 mt-1">{s.account_name || 'No account linked'}</div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Rate &amp; Term</span>
            <BadgePercent class="w-4 h-4 text-amber-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-amber-300">{s.annual_interest_rate.toFixed(2)}%</div>
          <div class="text-[11px] text-zinc-500 mt-1">
            {s.loan_term_years} yr / {s.loan_term_months} mo · since {s.start_date}
          </div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Monthly Payment</span>
            <Calculator class="w-4 h-4 text-emerald-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-emerald-300">{formatCurrencyExact(s.monthly_payment)}</div>
          <div class="text-[11px] text-zinc-500 mt-1">As saved on the scenario</div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Original Payoff</span>
            <CalendarClock class="w-4 h-4 text-zinc-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-zinc-100">{s.original_payoff_date}</div>
          <div class="text-[11px] text-zinc-500 mt-1">Before any prepayment</div>
        </div>
      </div>

      <!-- Prepayment simulator panel -->
      <div class="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Calculator class="w-4 h-4 text-sky-400" />
            Prepayment Simulator
          </h3>
          <span class="text-[10px] text-zinc-500 uppercase tracking-wider">Live — not saved</span>
        </div>

        <!-- Sliders -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label for="extra-monthly-slider" class="text-[11px] font-semibold text-zinc-400">Extra Monthly Payment</label>
              <span class="text-xs font-mono font-semibold text-emerald-300">{formatCurrencyExact(extra)}/mo</span>
            </div>
            <input
              id="extra-monthly-slider"
              type="range"
              min="0"
              max="2000"
              step="50"
              bind:value={extra}
              class="w-full accent-sky-500"
            />
            <div class="flex justify-between text-[10px] text-zinc-600 font-mono"><span>0</span><span>2,000</span></div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label for="lump-sum-slider" class="text-[11px] font-semibold text-zinc-400">Lump Sum</label>
              <span class="text-xs font-mono font-semibold {lump > 0 ? 'text-emerald-300' : 'text-zinc-500'}">
                {formatCurrency(lump)}
              </span>
            </div>
            <input
              id="lump-sum-slider"
              type="range"
              min="0"
              max="100000"
              step="1000"
              bind:value={lump}
              class="w-full accent-sky-500"
            />
            <div class="flex justify-between text-[10px] text-zinc-600 font-mono"><span>0</span><span>100,000</span></div>
          </div>

          <div>
            <label for="lump-sum-date" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Lump Sum Date</label>
            <input
              id="lump-sum-date"
              type="date"
              bind:value={lumpDate}
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
            />
            <p class="text-[10px] text-zinc-600 mt-1">Applied in the month of the chosen date</p>
          </div>
        </div>

        <!-- Live comparison -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="px-3.5 py-3 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
            <div class="text-[11px] text-zinc-500 mb-1">Months to Payoff</div>
            <div class="font-mono text-sm">
              <span class="text-zinc-400">{sim.baseline.months}</span>
              <span class="text-zinc-600 mx-1.5">→</span>
              <span class="font-bold text-zinc-100">{sim.accelerated.months}</span>
            </div>
            <div class="text-[10px] text-zinc-600 mt-1">baseline → accelerated</div>
          </div>
          <div class="px-3.5 py-3 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
            <div class="text-[11px] text-zinc-500 mb-1">Total Interest</div>
            <div class="font-mono text-sm">
              <span class="text-zinc-400">{formatCurrency(sim.baseline.totalInterest)}</span>
              <span class="text-zinc-600 mx-1.5">→</span>
              <span class="font-bold text-zinc-100">{formatCurrency(sim.accelerated.totalInterest)}</span>
            </div>
            <div class="text-[10px] text-zinc-600 mt-1">baseline → accelerated</div>
          </div>
          <div class="px-3.5 py-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50">
            <div class="text-[11px] text-emerald-400/80 mb-1 flex items-center gap-1">
              <Zap class="w-3 h-3" /> Interest Saved
            </div>
            <div class="font-mono text-sm font-bold text-emerald-300">{formatCurrency(sim.interestSaved)}</div>
            <div class="text-[10px] text-emerald-500/50 mt-1">vs the baseline schedule</div>
          </div>
          <div class="px-3.5 py-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50">
            <div class="text-[11px] text-emerald-400/80 mb-1 flex items-center gap-1">
              <Clock class="w-3 h-3" /> Time Saved
            </div>
            <div class="font-mono text-sm font-bold text-emerald-300">
              {sim.monthsSaved} mo <span class="text-emerald-400/60 normal-case text-[11px]">/ {sim.yearsSaved} yr</span>
            </div>
            <div class="text-[10px] text-emerald-500/50 mt-1">
              payoff {sim.accelerated.payoffDate}
            </div>
          </div>
        </div>

        <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
          <Info class="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
          <p class="text-[11px] text-zinc-500 leading-relaxed">
            The sim runs locally against the shared loan math — nothing here is saved. Move the
            sliders to compare against the scenario's own stored plan below.
          </p>
        </div>
      </div>

      <!-- Saved vs live -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <h3 class="text-[11px] font-bold text-zinc-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-zinc-600"></span>
            Saved plan (as last saved)
          </h3>
          <dl class="space-y-2 text-[11px]">
            <div class="flex items-center justify-between">
              <dt class="text-zinc-500">Total interest (original)</dt>
              <dd class="font-mono text-zinc-300">{formatCurrencyExact(s.total_interest_original)}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-zinc-500">Interest saved on plan</dt>
              <dd class="font-mono text-emerald-300">{formatCurrencyExact(s.interest_saved)}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-zinc-500">Months saved on plan</dt>
              <dd class="font-mono text-emerald-300">{s.months_saved}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-zinc-500">Actual payoff date</dt>
              <dd class="font-mono text-zinc-300">{s.actual_payoff_date}</dd>
            </div>
          </dl>
        </div>

        <div class="p-4 rounded-xl bg-sky-950/20 border border-sky-800/40">
          <h3 class="text-[11px] font-bold text-sky-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-sky-400"></span>
            Live simulation (current sliders)
          </h3>
          <dl class="space-y-2 text-[11px]">
            <div class="flex items-center justify-between">
              <dt class="text-zinc-400">Total interest</dt>
              <dd class="font-mono text-zinc-200">{formatCurrencyExact(sim.accelerated.totalInterest)}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-zinc-400">Interest saved</dt>
              <dd class="font-mono text-sky-300">{formatCurrencyExact(sim.interestSaved)}</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-zinc-400">Months saved</dt>
              <dd class="font-mono text-sky-300">{sim.monthsSaved} mo · {sim.yearsSaved} yr</dd>
            </div>
            <div class="flex items-center justify-between">
              <dt class="text-zinc-400">Payoff date</dt>
              <dd class="font-mono text-zinc-200">{sim.accelerated.payoffDate}</dd>
            </div>
          </dl>
        </div>
      </div>

      <!-- Rate changes -->
      <div class="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 space-y-3">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <History class="w-4 h-4 text-amber-400" />
            Rate Changes
          </h3>
          <button
            onclick={handleInferRateChanges}
            disabled={inferBusy}
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-800/50 text-[11px] font-semibold transition disabled:opacity-50"
            title="Analyze historical interest payments on the linked account"
          >
            <Sparkles class="w-3.5 h-3.5" />
            {inferBusy ? 'Inferring...' : 'Infer from payment history'}
          </button>
        </div>

        {#if inferMsg}
          <p class="text-[11px] text-sky-300 px-3 py-2 rounded-lg bg-sky-950/40 border border-sky-800/50">{inferMsg}</p>
        {/if}

        {#if s.rate_changes && s.rate_changes.length > 0}
          <div class="space-y-1.5">
            {#each [...s.rate_changes].sort((a, b) => a.effective_date.localeCompare(b.effective_date)) as rc (rc.id || rc.effective_date)}
              <div class="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
                <div class="flex items-center gap-3 min-w-0">
                  <BadgePercent class="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span class="font-mono text-[11px] text-zinc-300">Effective {rc.effective_date}</span>
                  {#if rc.note}
                    <span class="text-[11px] text-zinc-500 truncate">{rc.note}</span>
                  {/if}
                </div>
                <span class="font-mono text-[11px] font-semibold text-amber-300 shrink-0">{rc.annual_rate.toFixed(2)}%</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="px-3 py-4 rounded-lg bg-zinc-950/60 border border-zinc-800/70 text-[11px] text-zinc-500 flex items-center gap-2">
            <BadgePercent class="w-3.5 h-3.5 text-zinc-600 shrink-0" />
            No rate changes recorded for this scenario. Infer them from the linked account's payment history, or edit the scenario to add a change.
          </div>
        {/if}
      </div>

      <!-- Amortization schedule table -->
      <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
        <div class="p-4 border-b border-zinc-800/80 flex items-center justify-between gap-4 bg-zinc-950/40">
          <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <ListOrdered class="w-4 h-4 text-sky-400" />
            Amortization Schedule
            <span class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {hasPrepayment ? 'accelerated' : 'baseline'}
            </span>
          </h3>
          <button
            onclick={() => (showAllPayments = !showAllPayments)}
            class="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-[11px] font-semibold text-zinc-300 transition"
          >
            {showAllPayments ? 'Show first 24 payments' : `Show all ${hasPrepayment ? sim.accelerated.lines.length : sim.baseline.lines.length} payments`}
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-zinc-300 border-collapse">
            <thead>
              <tr class="border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-900/80">
                <th class="py-3 px-4">#</th>
                <th class="py-3 px-4">Date</th>
                <th class="py-3 px-4 text-right">Opening</th>
                <th class="py-3 px-4 text-right">Payment</th>
                <th class="py-3 px-4 text-right">Principal</th>
                <th class="py-3 px-4 text-right">Interest</th>
                <th class="py-3 px-4 text-right">Extra</th>
                <th class="py-3 px-4 text-right">Closing</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800/60">
              {#each scheduleLines as line (line.payment_number)}
                <tr class="hover:bg-zinc-800/40 transition-colors font-mono">
                  <td class="py-2.5 px-4 text-zinc-500">{line.payment_number}</td>
                  <td class="py-2.5 px-4 text-zinc-300">{line.payment_date}</td>
                  <td class="py-2.5 px-4 text-right text-zinc-400">{formatCurrencyExact(line.starting_balance)}</td>
                  <td class="py-2.5 px-4 text-right text-zinc-200">{formatCurrencyExact(line.scheduled_payment)}</td>
                  <td class="py-2.5 px-4 text-right text-emerald-300/90">{formatCurrencyExact(line.principal_amount)}</td>
                  <td class="py-2.5 px-4 text-right text-amber-300/90">{formatCurrencyExact(line.interest_amount)}</td>
                  <td class="py-2.5 px-4 text-right text-sky-300/90">{formatCurrencyExact(line.extra_payment)}</td>
                  <td class="py-2.5 px-4 text-right font-bold text-zinc-100">{formatCurrencyExact(line.ending_balance)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="px-4 py-3 border-t border-zinc-800/80 bg-zinc-950/40 text-[11px] text-zinc-500 flex items-center gap-2">
          <Info class="w-3.5 h-3.5 text-zinc-600 shrink-0" />
          {hasPrepayment
            ? `Prepaying ${formatCurrencyExact(extra)}/mo${lump > 0 ? ` plus a ${formatCurrency(lump)} lump sum${lumpDate ? ` on ${lumpDate}` : ''}` : ''} clears the loan in ${sim.accelerated.months} payments by ${sim.accelerated.payoffDate}.`
            : `No prepayment is active — showing the baseline schedule over ${sim.baseline.months} payments. Use the sliders above to model extra payments and a lump sum.`}
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Create / Edit Loan Scenario Modal -->
{#if financeStore.isLoanModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Landmark class="w-4 h-4 text-sky-400" />
          {financeStore.editingLoan ? 'Edit Loan Scenario' : 'New Loan Scenario'}
        </h2>
        <button
          onclick={() => { financeStore.isLoanModalOpen = false; financeStore.editingLoan = null; }}
          class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="px-6 py-5 space-y-4">
        <div>
          <label for="loan-name" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Scenario Name</label>
          <input
            id="loan-name"
            type="text"
            bind:value={formName}
            placeholder="e.g. HDB Concessionary Loan"
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </div>

        <div>
          <label for="loan-account" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Linked Mortgage / Loan Account</label>
          <select
            id="loan-account"
            bind:value={formAccountId}
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
          >
            <option value="">No account linked</option>
            {#each mortgageAccounts as acc (acc.id)}
              <option value={acc.id}>{acc.name} ({acc.account_type})</option>
            {/each}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="loan-principal" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Principal Amount</label>
            <input
              id="loan-principal"
              type="number"
              min="0"
              step="0.01"
              bind:value={formPrincipal}
              placeholder="0.00"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label for="loan-rate" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Annual Interest Rate (%)</label>
            <input
              id="loan-rate"
              type="number"
              min="0"
              step="0.01"
              bind:value={formRate}
              placeholder="e.g. 4.25"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="loan-term-years" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Term (years)</label>
            <input
              id="loan-term-years"
              type="number"
              min="0"
              step="1"
              bind:value={formTermYears}
              placeholder="e.g. 30"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label for="loan-term-months" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">
              Term (months) <span class="text-zinc-600 font-normal">· defaults to years × 12</span>
            </label>
            <input
              id="loan-term-months"
              type="number"
              min="0"
              step="1"
              bind:value={formTermMonths}
              placeholder="e.g. 360"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div>
          <label for="loan-start-date" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Start Date</label>
          <input
            id="loan-start-date"
            type="date"
            bind:value={formStartDate}
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
          />
        </div>

        <div class="pt-2 border-t border-zinc-800/70 grid grid-cols-2 gap-3">
          <div>
            <label for="loan-extra" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Saved Extra / Month</label>
            <input
              id="loan-extra"
              type="number"
              min="0"
              step="0.01"
              bind:value={formExtra}
              placeholder="0.00"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label for="loan-lump" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Saved Lump Sum</label>
            <input
              id="loan-lump"
              type="number"
              min="0"
              step="0.01"
              bind:value={formLump}
              placeholder="0.00"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
          <div class="col-span-2">
            <label for="loan-lump-date" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Lump Sum Date</label>
            <input
              id="loan-lump-date"
              type="date"
              bind:value={formLumpDate}
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
            />
          </div>
        </div>

        <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-zinc-950/50 border border-zinc-800/60">
          <Info class="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
          <p class="text-[11px] text-zinc-500 leading-relaxed">
            The monthly payment, payoff dates and the interest / time saved are recomputed from
            these inputs by the shared loan math whenever the scenario is saved.
          </p>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-800">
        <button
          onclick={() => { financeStore.isLoanModalOpen = false; financeStore.editingLoan = null; }}
          class="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition"
        >
          Cancel
        </button>
        <button
          onclick={submitLoan}
          disabled={!formName.trim() || formPrincipal === '' || Number(formPrincipal) <= 0}
          class="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-semibold text-xs transition"
        >
          {financeStore.editingLoan ? 'Save Changes' : 'Create Scenario'}
        </button>
      </div>
    </div>
  </div>
{/if}
