<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import { X, ArrowDownRight, ArrowUpRight } from '@lucide/svelte';

  let date = $state(new Date().toISOString().split('T')[0]);
  let payeeName = $state('');
  let categoryName = $state('');
  let amountStr = $state('');
  let isExpense = $state(true);
  let memo = $state('');

  const handleSave = async (e: Event) => {
    e.preventDefault();
    const numericAmount = parseFloat(amountStr);
    if (isNaN(numericAmount) || numericAmount <= 0) return;

    const finalAmount = isExpense ? -numericAmount : numericAmount;

    await financeStore.addTransaction({
      date,
      payee_name: payeeName || 'Expense',
      category_name: categoryName || 'General',
      amount: finalAmount,
      transaction_type: isExpense ? 'expense' : 'income',
      reconciliation_state: 'unreconciled',
      memo,
    });
  };
</script>

{#if financeStore.isQuickAddOpen}
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
      <!-- Modal Header -->
      <div class="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 class="font-bold text-sm text-zinc-100">Record New Transaction</h3>
        <button
          onclick={() => (financeStore.isQuickAddOpen = false)}
          class="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form onsubmit={handleSave} class="p-5 space-y-4">
        <!-- Expense vs Income Switcher -->
        <div class="grid grid-cols-2 gap-2 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
          <button
            type="button"
            onclick={() => (isExpense = true)}
            class="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all {isExpense ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            <ArrowDownRight class="w-3.5 h-3.5 text-rose-400" />
            <span>Debit (Expense)</span>
          </button>
          <button
            type="button"
            onclick={() => (isExpense = false)}
            class="flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all {!isExpense ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            <ArrowUpRight class="w-3.5 h-3.5 text-emerald-400" />
            <span>Credit (Income)</span>
          </button>
        </div>

        <!-- Amount Input -->
        <div>
          <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="tx-amount">Amount</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-zinc-500 text-sm">$</span>
            <input
              id="tx-amount"
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              bind:value={amountStr}
              class="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-lg font-mono font-bold text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <!-- Date & Payee -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="tx-date">Date</label>
            <input
              id="tx-date"
              type="date"
              required
              bind:value={date}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="tx-payee">Payee / Merchant</label>
            <input
              id="tx-payee"
              type="text"
              required
              placeholder="e.g. FairPrice, Grab"
              bind:value={payeeName}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <!-- Category & Memo -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="tx-category">Category</label>
            <input
              id="tx-category"
              type="text"
              placeholder="e.g. Groceries, Dining"
              bind:value={categoryName}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="tx-memo">Memo</label>
            <input
              id="tx-memo"
              type="text"
              placeholder="Optional notes"
              bind:value={memo}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <!-- Submit Buttons -->
        <div class="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onclick={() => (financeStore.isQuickAddOpen = false)}
            class="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
          >
            Record Entry
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
