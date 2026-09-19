<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import {
    X,
    Check,
    CheckCheck,
    AlertCircle,
    ShieldCheck,
    ArrowRight,
    Scale,
    Sparkles,
    Coins,
  } from '@lucide/svelte';

  let mode = $state<'prompt' | 'adjust'>('prompt');
  let bankBalanceInput = $state<string>('');
  let isSubmitting = $state<boolean>(false);

  let currentAccount = $derived(
    financeStore.accounts.find((a) => a.id === financeStore.selectedAccountId)
  );

  let clearedTransactions = $derived(
    financeStore.transactions.filter(
      (t) =>
        String(t.account_id) === String(financeStore.selectedAccountId) &&
        t.reconciliation_state === 'cleared'
    )
  );

  let unreconciledTransactions = $derived(
    financeStore.transactions.filter(
      (t) =>
        String(t.account_id) === String(financeStore.selectedAccountId) &&
        t.reconciliation_state === 'unreconciled'
    )
  );

  let clearedBalance = $derived(currentAccount?.cleared_balance ?? 0);
  let currencyCode = $derived(currentAccount?.currency_code || 'SGD');

  let enteredBalanceNumber = $derived(
    bankBalanceInput.trim() === '' ? clearedBalance : parseFloat(bankBalanceInput) || 0
  );

  let difference = $derived(
    Number((enteredBalanceNumber - clearedBalance).toFixed(2))
  );

  // Reset state when modal opens
  $effect(() => {
    if (financeStore.isVerifyBalanceModalOpen) {
      mode = 'prompt';
      bankBalanceInput = clearedBalance.toFixed(2);
      isSubmitting = false;
    }
  });

  const formatAmount = (val: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(val);
  };

  const handleClose = () => {
    financeStore.closeVerifyBalanceModal();
  };

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  const confirmMatch = async () => {
    if (isSubmitting) return;
    isSubmitting = true;
    try {
      await financeStore.verifyAndReconcileAccount(clearedBalance, false);
    } finally {
      isSubmitting = false;
    }
  };

  const confirmAdjustment = async () => {
    if (isSubmitting) return;
    isSubmitting = true;
    try {
      const needsAdjustment = Math.abs(difference) >= 0.01;
      await financeStore.verifyAndReconcileAccount(enteredBalanceNumber, needsAdjustment);
    } finally {
      isSubmitting = false;
    }
  };
</script>

<svelte:window onkeydown={handleKeydown} />

{#if financeStore.isVerifyBalanceModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
    <div
      class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-xl bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shadow-sm">
            <ShieldCheck class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-base font-semibold text-zinc-100 flex items-center gap-2">
              <span>Verify Account Balance</span>
              <span class="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-mono">
                10-Sec Reconcile
              </span>
            </h3>
            <p class="text-xs text-zinc-400">
              {currentAccount?.name || 'Account'} • {currentAccount?.institution_name || 'Bank'}
            </p>
          </div>
        </div>

        <button
          onclick={handleClose}
          class="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          aria-label="Close"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Modal Body -->
      <div class="p-6 space-y-6">
        {#if mode === 'prompt'}
          <!-- Hero Cleared Balance Display -->
          <div class="p-5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 text-center space-y-2">
            <span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Current Cleared Balance in Moneta
            </span>
            <div class="text-3xl font-extrabold font-mono text-zinc-100 tracking-tight">
              {formatAmount(clearedBalance)}
            </div>
            <div class="flex items-center justify-center gap-2 pt-1">
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                <Check class="w-3 h-3 text-emerald-400" />
                {clearedTransactions.length} cleared items ready to lock
              </span>
              {#if unreconciledTransactions.length > 0}
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
                  {unreconciledTransactions.length} pending
                </span>
              {/if}
            </div>
          </div>

          <!-- Prompt Question -->
          <div class="text-center space-y-1">
            <h4 class="text-sm font-medium text-zinc-200">
              Is your cleared balance in Moneta Wealth the same as your bank account balance?
            </h4>
            <p class="text-xs text-zinc-400 max-w-sm mx-auto">
              Check your bank app right now. If the cleared total matches, lock your ledger in one click.
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="grid grid-cols-2 gap-3 pt-2">
            <button
              onclick={confirmMatch}
              disabled={isSubmitting}
              class="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-950/40 cursor-pointer group disabled:opacity-50"
            >
              <div class="flex items-center gap-2">
                <CheckCheck class="w-5 h-5 text-emerald-100 group-hover:scale-110 transition-transform" />
                <span>Yes, It Matches</span>
              </div>
              <span class="text-[11px] font-normal text-emerald-100/80">
                Promote {clearedTransactions.length} cleared &rarr; reconciled
              </span>
            </button>

            <button
              onclick={() => (mode = 'adjust')}
              class="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl bg-zinc-800 hover:bg-zinc-750 hover:border-zinc-700 border border-zinc-800 text-zinc-200 hover:text-white font-semibold text-sm transition-all cursor-pointer group"
            >
              <div class="flex items-center gap-2">
                <Scale class="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
                <span>No, It's Different</span>
              </div>
              <span class="text-[11px] font-normal text-zinc-400">
                Adjust balance or enter statement figure
              </span>
            </button>
          </div>

        {:else}
          <!-- Adjustment Mode -->
          <div class="space-y-4">
            <div class="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-start gap-3">
              <AlertCircle class="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div class="text-xs text-amber-200/90 leading-relaxed">
                Enter your banking app balance below. Moneta Wealth will automatically create a 1-line 
                <strong class="text-amber-100">Reconciliation Adjustment</strong> and lock your cleared transactions.
              </div>
            </div>

            <!-- Input Field -->
            <div>
              <label for="bank-balance-input" class="block text-xs font-medium text-zinc-300 mb-1.5">
                Actual Bank Account Balance ({currencyCode})
              </label>
              <div class="relative">
                <div class="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">
                  {currencyCode === 'SGD' ? 'S$' : currencyCode}
                </div>
                <input
                  id="bank-balance-input"
                  type="number"
                  step="0.01"
                  bind:value={bankBalanceInput}
                  class="w-full pl-12 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl font-mono text-base font-bold text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/80 transition-colors"
                  placeholder="0.00"
                />
              </div>
            </div>

            <!-- Difference Comparison Box -->
            <div class="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2 font-mono text-xs">
              <div class="flex justify-between items-center text-zinc-400">
                <span>Moneta Cleared Balance:</span>
                <span class="text-zinc-200">{formatAmount(clearedBalance)}</span>
              </div>
              <div class="flex justify-between items-center text-zinc-400">
                <span>Actual Bank Balance:</span>
                <span class="text-zinc-100 font-semibold">{formatAmount(enteredBalanceNumber)}</span>
              </div>
              <div class="h-px bg-zinc-800/80 my-1"></div>
              <div class="flex justify-between items-center font-bold">
                <span class="text-zinc-300">Adjustment Needed:</span>
                {#if Math.abs(difference) < 0.01}
                  <span class="text-emerald-400">S$0.00 (Exact Match)</span>
                {:else if difference > 0}
                  <span class="text-emerald-400">+{formatAmount(difference)} (Deposit)</span>
                {:else}
                  <span class="text-rose-400">-{formatAmount(Math.abs(difference))} (Expense)</span>
                {/if}
              </div>
            </div>

            <!-- Action Buttons for Adjustment -->
            <div class="flex items-center gap-3 pt-2">
              <button
                type="button"
                onclick={() => (mode = 'prompt')}
                class="flex-1 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Back
              </button>

              <button
                type="button"
                onclick={confirmAdjustment}
                disabled={isSubmitting}
                class="flex-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-950/40 cursor-pointer disabled:opacity-50"
              >
                <Sparkles class="w-4 h-4 text-emerald-200" />
                {#if Math.abs(difference) < 0.01}
                  <span>Confirm & Lock Balance</span>
                {:else}
                  <span>Create Adjustment & Lock</span>
                {/if}
              </button>
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer Info -->
      <div class="px-6 py-3 border-t border-zinc-800/60 bg-zinc-950/40 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Press <kbd class="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px]">Esc</kbd> to cancel</span>
        <span class="flex items-center gap-1 text-emerald-400/80">
          <ShieldCheck class="w-3.5 h-3.5" />
          Audit trail preserved
        </span>
      </div>
    </div>
  </div>
{/if}
