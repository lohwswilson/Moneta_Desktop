<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import { predictCategory } from '../data/rulesEngine';
  import {
    X,
    ArrowDownRight,
    ArrowUpRight,
    Split,
    Plus,
    Trash2,
    Sparkles,
    Check,
    AlertCircle,
  } from '@lucide/svelte';

  import type { PayeeIntelligence, ReconcileState } from '../types/moneta';

  let date = $state(new Date().toISOString().split('T')[0]);
  let payeeName = $state('');
  let categoryName = $state('');
  let amountStr = $state('');
  let isExpense = $state(true);
  let memo = $state('');
  let reconciliationState = $state<ReconcileState>('unreconciled');
  let isPayeeDropdownOpen = $state(false);

  // Split transaction states
  let isSplit = $state(false);
  let splits = $state<Array<{ category_name: string; amountStr: string; memo: string }>>([
    { category_name: '', amountStr: '', memo: '' },
    { category_name: '', amountStr: '', memo: '' },
  ]);

  let totalNumericAmount = $derived(parseFloat(amountStr) || 0);

  let splitSum = $derived(
    splits.reduce((acc, s) => acc + (parseFloat(s.amountStr) || 0), 0)
  );

  let splitRemainder = $derived(
    Number((totalNumericAmount - splitSum).toFixed(2))
  );

  let isSplitValid = $derived(
    !isSplit || (splits.length >= 2 && Math.abs(splitRemainder) < 0.01 && totalNumericAmount > 0)
  );

  // Synchronize form when modal opens or editing transaction changes
  $effect(() => {
    if (financeStore.isQuickAddOpen) {
      const tx = financeStore.editingTransaction;
      if (tx) {
        date = tx.date;
        payeeName = tx.payee_name;
        categoryName = tx.category_name === 'Split' ? '' : (tx.category_name || '');
        const amt = Number(tx.amount || 0);
        isExpense = amt < 0;
        amountStr = Math.abs(amt).toFixed(2);
        memo = tx.memo || '';
        reconciliationState = tx.reconciliation_state || 'unreconciled';
        userEditedCategory = true;
        if (tx.splits && tx.splits.length > 0) {
          isSplit = true;
          splits = tx.splits.map((s) => ({
            category_name: s.category_name,
            amountStr: Math.abs(s.amount).toFixed(2),
            memo: s.memo || '',
          }));
        } else {
          isSplit = false;
          splits = [
            { category_name: '', amountStr: '', memo: '' },
            { category_name: '', amountStr: '', memo: '' },
          ];
        }
      } else {
        date = new Date().toISOString().split('T')[0];
        payeeName = '';
        categoryName = '';
        amountStr = '';
        isExpense = true;
        memo = '';
        reconciliationState = 'unreconciled';
        userEditedCategory = false;
        isSplit = false;
        splits = [
          { category_name: '', amountStr: '', memo: '' },
          { category_name: '', amountStr: '', memo: '' },
        ];
      }
    }
  });

  // Autocomplete matching payees
  let matchingPayees = $derived.by(() => {
    const q = payeeName.trim().toLowerCase();
    if (!q) return [];
    return financeStore.payees
      .filter((p) => p.name.toLowerCase().includes(q))
      .slice(0, 6);
  });

  const selectPayeeSuggestion = (payee: PayeeIntelligence) => {
    payeeName = payee.name;
    if (!userEditedCategory) {
      if (payee.default_category_name) {
        categoryName = payee.default_category_name;
      } else if (payee.suggested_category_name) {
        categoryName = payee.suggested_category_name;
      }
    }
    if ((!amountStr || amountStr === '0') && payee.avg_amount > 0) {
      amountStr = payee.avg_amount.toFixed(2);
    }
    isPayeeDropdownOpen = false;
  };

  // Auto-predict category when payee changes with Payee memory & rules engine fallback
  let userEditedCategory = $state(false);
  $effect(() => {
    if (!isSplit && !userEditedCategory && payeeName.trim()) {
      const match = financeStore.payees.find(
        (p) => p.name.toLowerCase() === payeeName.trim().toLowerCase()
      );
      if (match?.default_category_name) {
        categoryName = match.default_category_name;
      } else if (match?.suggested_category_name) {
        categoryName = match.suggested_category_name;
      } else {
        const predicted = predictCategory(payeeName, memo);
        if (predicted !== 'General') {
          categoryName = predicted;
        }
      }
    }
  });

  const addSplitRow = () => {
    const defaultFill = splitRemainder > 0 ? splitRemainder.toFixed(2) : '';
    splits.push({ category_name: '', amountStr: defaultFill, memo: '' });
  };

  const removeSplitRow = (index: number) => {
    if (splits.length <= 2) return;
    splits.splice(index, 1);
  };

  const fillRemaining = (index: number) => {
    const otherSum = splits.reduce(
      (sum, s, idx) => (idx === index ? sum : sum + (parseFloat(s.amountStr) || 0)),
      0
    );
    const needed = Math.max(0, totalNumericAmount - otherSum);
    splits[index].amountStr = needed.toFixed(2);
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    if (isNaN(totalNumericAmount) || totalNumericAmount <= 0) return;
    if (isSplit && !isSplitValid) return;

    const finalAmount = isExpense ? -totalNumericAmount : totalNumericAmount;

    let splitsPayload = undefined;
    if (isSplit) {
      splitsPayload = splits
        .filter((s) => (parseFloat(s.amountStr) || 0) > 0)
        .map((s) => {
          const splitVal = parseFloat(s.amountStr) || 0;
          return {
            category_name: s.category_name || 'General',
            amount: isExpense ? -splitVal : splitVal,
            memo: s.memo || '',
          };
        });
    }

    if (financeStore.editingTransaction) {
      await financeStore.updateTransaction(financeStore.editingTransaction.id, {
        date,
        payee_name: payeeName || 'Expense',
        category_name: isSplit ? 'Split' : (categoryName || 'General'),
        amount: finalAmount,
        transaction_type: isExpense ? 'expense' : 'income',
        reconciliation_state: reconciliationState,
        memo,
        splits: splitsPayload,
      });
    } else {
      await financeStore.addTransaction({
        date,
        payee_name: payeeName || 'Expense',
        category_name: isSplit ? 'Split' : (categoryName || 'General'),
        amount: finalAmount,
        transaction_type: isExpense ? 'expense' : 'income',
        reconciliation_state: reconciliationState,
        memo,
        splits: splitsPayload,
      });
    }
  };

  const handleDelete = async () => {
    if (!financeStore.editingTransaction) return;
    if (confirm('Are you sure you want to delete this transaction? This will adjust your account balance.')) {
      await financeStore.deleteTransaction(financeStore.editingTransaction.id);
    }
  };
</script>

{#if financeStore.isQuickAddOpen}
  <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
      <!-- Modal Header -->
      <div class="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
        <h3 class="font-bold text-sm text-zinc-100">
          {financeStore.editingTransaction ? 'Edit Transaction' : 'Record New Transaction'}
        </h3>
        <button
          onclick={() => financeStore.closeTransactionModal()}
          class="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form onsubmit={handleSave} class="p-5 space-y-4 overflow-y-auto flex-1">
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
          <div class="flex items-center justify-between mb-1">
            <label class="block text-[11px] uppercase font-semibold text-zinc-400" for="tx-amount">
              Total Amount
            </label>
            <button
              type="button"
              onclick={() => {
                isSplit = !isSplit;
                if (isSplit && splits[0].amountStr === '' && totalNumericAmount > 0) {
                  splits[0].amountStr = (totalNumericAmount / 2).toFixed(2);
                  splits[1].amountStr = (totalNumericAmount - totalNumericAmount / 2).toFixed(2);
                }
              }}
              class="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded transition-all {isSplit ? 'bg-purple-950 text-purple-300 border border-purple-800/60' : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/50'}"
            >
              <Split class="w-3 h-3" />
              <span>{isSplit ? 'Split Enabled' : 'Split Across Categories'}</span>
            </button>
          </div>
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
          <div class="relative">
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="tx-payee">Payee / Merchant</label>
            <div class="relative">
              <input
                id="tx-payee"
                type="text"
                required
                placeholder="e.g. FairPrice, Grab"
                bind:value={payeeName}
                onfocus={() => (isPayeeDropdownOpen = true)}
                onblur={() => setTimeout(() => (isPayeeDropdownOpen = false), 200)}
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              />
              {#if matchingPayees.length > 0 && isPayeeDropdownOpen}
                <div class="absolute left-0 right-0 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-800/60 max-h-52 overflow-y-auto">
                  {#each matchingPayees as p}
                    <button
                      type="button"
                      onmousedown={() => selectPayeeSuggestion(p)}
                      class="w-full px-3 py-2 text-left hover:bg-zinc-800/80 flex items-center justify-between gap-2 transition-colors group cursor-pointer"
                    >
                      <div class="min-w-0 flex-1">
                        <div class="text-xs font-semibold text-zinc-200 group-hover:text-emerald-400 truncate">
                          {p.name}
                        </div>
                        <div class="text-[10px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
                          {#if p.default_category_name || p.suggested_category_name}
                            <span class="text-indigo-400 font-medium">{p.default_category_name || p.suggested_category_name}</span>
                            <span>•</span>
                          {/if}
                          <span>{p.transaction_count} txs</span>
                        </div>
                      </div>
                      {#if p.avg_amount > 0}
                        <div class="text-right shrink-0">
                          <div class="text-[10px] text-zinc-500 uppercase">Avg</div>
                          <div class="text-xs font-mono font-medium text-zinc-300">
                            ${p.avg_amount.toFixed(2)}
                          </div>
                        </div>
                      {/if}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
        </div>

        <!-- Single Category & Memo (When NOT split) -->
        {#if !isSplit}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-[11px] uppercase font-semibold text-zinc-400" for="tx-category">Category</label>
                {#if categoryName}
                  <span class="text-[10px] text-amber-400 flex items-center gap-0.5">
                    <Sparkles class="w-2.5 h-2.5" /> Rule
                  </span>
                {/if}
              </div>
              <input
                id="tx-category"
                type="text"
                placeholder="e.g. Groceries, Dining"
                bind:value={categoryName}
                oninput={() => (userEditedCategory = true)}
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
        {:else}
          <!-- Split Transactions Section -->
          <div class="p-3.5 bg-zinc-950/80 rounded-xl border border-purple-900/40 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Split class="w-3.5 h-3.5" />
                <span>Split Allocations ({splits.length} parts)</span>
              </span>

              <!-- Balance status indicator -->
              <div class="text-[11px] font-mono">
                {#if Math.abs(splitRemainder) < 0.01 && totalNumericAmount > 0}
                  <span class="text-emerald-400 flex items-center gap-1 font-semibold">
                    <Check class="w-3 h-3" /> Fully Allocated (${totalNumericAmount.toFixed(2)})
                  </span>
                {:else if splitRemainder > 0}
                  <span class="text-amber-400 flex items-center gap-1 font-semibold">
                    <AlertCircle class="w-3 h-3" /> Remaining: ${splitRemainder.toFixed(2)}
                  </span>
                {:else}
                  <span class="text-rose-400 flex items-center gap-1 font-semibold">
                    <AlertCircle class="w-3 h-3" /> Over by ${Math.abs(splitRemainder).toFixed(2)}
                  </span>
                {/if}
              </div>
            </div>

            <!-- Split Rows -->
            <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
              {#each splits as split, idx}
                <div class="grid grid-cols-12 gap-1.5 items-center bg-zinc-900/60 p-1.5 rounded-lg border border-zinc-800/80">
                  <div class="col-span-5">
                    <input
                      type="text"
                      placeholder="Category name"
                      bind:value={split.category_name}
                      class="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div class="col-span-3 relative">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      bind:value={split.amountStr}
                      class="w-full pl-4 pr-1 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono font-semibold text-zinc-100 focus:outline-none focus:border-purple-500"
                    />
                    <span class="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">$</span>
                  </div>
                  <div class="col-span-3">
                    <input
                      type="text"
                      placeholder="Split memo"
                      bind:value={split.memo}
                      class="w-full px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-zinc-300 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div class="col-span-1 flex items-center justify-center">
                    {#if splits.length > 2}
                      <button
                        type="button"
                        onclick={() => removeSplitRow(idx)}
                        class="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                      >
                        <Trash2 class="w-3 h-3" />
                      </button>
                    {:else}
                      <button
                        type="button"
                        onclick={() => fillRemaining(idx)}
                        title="Auto-fill remainder"
                        class="text-[10px] text-zinc-500 hover:text-purple-400 font-mono font-bold"
                      >
                        max
                      </button>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>

            <!-- Add Split Row Button -->
            <button
              type="button"
              onclick={addSplitRow}
              class="w-full py-1.5 border border-dashed border-zinc-800 hover:border-purple-600 rounded-lg text-xs text-zinc-400 hover:text-purple-300 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus class="w-3 h-3" />
              <span>Add Sub-category Split</span>
            </button>
          </div>
        {/if}

        <!-- Reconciliation Status Selector -->
        <div>
          <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="reconcile-status">
            Reconciliation Status
          </label>
          <div id="reconcile-status" class="grid grid-cols-3 gap-2 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
            <button
              type="button"
              onclick={() => (reconciliationState = 'unreconciled')}
              class="py-1.5 rounded-md text-xs font-semibold transition-all {reconciliationState === 'unreconciled' ? 'bg-zinc-800 text-zinc-200 shadow-sm border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}"
            >
              Unreconciled
            </button>
            <button
              type="button"
              onclick={() => (reconciliationState = 'cleared')}
              class="py-1.5 rounded-md text-xs font-semibold transition-all {reconciliationState === 'cleared' ? 'bg-emerald-950 text-emerald-300 shadow-sm border border-emerald-800/60' : 'text-zinc-500 hover:text-zinc-300'}"
            >
              Cleared (C)
            </button>
            <button
              type="button"
              onclick={() => (reconciliationState = 'reconciled')}
              class="py-1.5 rounded-md text-xs font-semibold transition-all {reconciliationState === 'reconciled' ? 'bg-sky-950 text-sky-300 shadow-sm border border-sky-800/60' : 'text-zinc-500 hover:text-zinc-300'}"
            >
              Reconciled (R)
            </button>
          </div>
        </div>

        <!-- Submit / Delete Buttons -->
        <div class="pt-3 border-t border-zinc-800 flex items-center justify-between gap-2">
          {#if financeStore.editingTransaction}
            <button
              type="button"
              onclick={handleDelete}
              class="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 transition-colors cursor-pointer"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          {:else}
            <div></div>
          {/if}

          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={() => financeStore.closeTransactionModal()}
              class="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSplit && !isSplitValid}
              class="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 text-white shadow-sm transition-colors cursor-pointer"
            >
              {financeStore.editingTransaction ? 'Save Changes' : 'Record Entry'}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}
