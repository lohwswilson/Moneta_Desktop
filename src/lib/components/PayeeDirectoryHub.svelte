<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { PayeeIntelligence } from '../types/moneta';
  import {
    Store,
    Search,
    Filter,
    Edit3,
    ArrowUpDown,
    ExternalLink,
    Calendar,
    Receipt,
    Sparkles,
    Check,
    X,
    TrendingUp,
    Tag,
    Clock,
    DollarSign,
    Layers,
    Plus
  } from '@lucide/svelte';

  // Filters & Sorting state
  let searchQuery = $state('');
  let cadenceFilter = $state<'all' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly' | 'none'>('all');
  let sortBy = $state<'spend_desc' | 'count_desc' | 'avg_desc' | 'name_asc' | 'date_desc'>('spend_desc');

  // Edit Payee modal state
  let isEditModalOpen = $state(false);
  let editingPayee = $state<PayeeIntelligence | null>(null);
  let editCategory = $state('');
  let editCadence = $state<'none' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'>('none');
  let editWebsite = $state('');
  let editNotes = $state('');
  let isSaving = $state(false);

  // Common Singapore categories for quick dropdown
  const commonCategories = [
    'Groceries',
    'Dining',
    'Transportation',
    'Utilities',
    'Housing',
    'Healthcare',
    'Entertainment',
    'Shopping',
    'Subscriptions',
    'Insurance',
    'Personal Care',
    'Education',
    'Travel',
    'General',
  ];

  const formatCurrency = (amount: number, currency: string = 'SGD') => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Filtered & sorted payees
  let filteredPayees = $derived.by(() => {
    let list = [...financeStore.payees];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.default_category_name && p.default_category_name.toLowerCase().includes(q)) ||
          (p.suggested_category_name && p.suggested_category_name.toLowerCase().includes(q)) ||
          (p.notes && p.notes.toLowerCase().includes(q))
      );
    }

    if (cadenceFilter !== 'all') {
      list = list.filter((p) => (p.detected_cadence || 'none') === cadenceFilter);
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'spend_desc') return b.total_spend - a.total_spend;
      if (sortBy === 'count_desc') return b.transaction_count - a.transaction_count;
      if (sortBy === 'avg_desc') return b.avg_amount - a.avg_amount;
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'date_desc') {
        const da = a.last_transaction_date ? new Date(a.last_transaction_date).getTime() : 0;
        const db = b.last_transaction_date ? new Date(b.last_transaction_date).getTime() : 0;
        return db - da;
      }
      return 0;
    });

    return list;
  });

  // Derived metrics
  let totalTrackedSpend = $derived.by(() => {
    return financeStore.payees.reduce((sum, p) => sum + (p.total_spend || 0), 0);
  });

  let topMerchant = $derived.by(() => {
    if (financeStore.payees.length === 0) return null;
    const sorted = [...financeStore.payees].sort((a, b) => b.total_spend - a.total_spend);
    return sorted[0];
  });

  let avgTicketSize = $derived.by(() => {
    const totalCount = financeStore.payees.reduce((sum, p) => sum + (p.transaction_count || 0), 0);
    if (totalCount === 0) return 0;
    return totalTrackedSpend / totalCount;
  });

  let categorizedCount = $derived.by(() => {
    return financeStore.payees.filter(
      (p) => p.default_category_name || p.suggested_category_name
    ).length;
  });

  let categorizationCoveragePct = $derived.by(() => {
    if (financeStore.payees.length === 0) return 100;
    return Math.round((categorizedCount / financeStore.payees.length) * 100);
  });

  const getCadenceBadge = (cadence?: string) => {
    switch (cadence) {
      case 'weekly':
        return { label: 'Weekly', class: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/60' };
      case 'biweekly':
        return { label: 'Bi-Weekly', class: 'bg-teal-950/70 text-teal-300 border-teal-800/60' };
      case 'monthly':
        return { label: 'Monthly', class: 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60' };
      case 'quarterly':
        return { label: 'Quarterly', class: 'bg-purple-950/70 text-purple-300 border-purple-800/60' };
      case 'yearly':
        return { label: 'Yearly', class: 'bg-amber-950/70 text-amber-300 border-amber-800/60' };
      default:
        return { label: 'Irregular', class: 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50' };
    }
  };

  const openEditModal = (payee: PayeeIntelligence) => {
    editingPayee = payee;
    editCategory = payee.default_category_name || payee.suggested_category_name || 'General';
    editCadence = payee.detected_cadence || 'none';
    editWebsite = payee.website || '';
    editNotes = payee.notes || '';
    isEditModalOpen = true;
  };

  const savePayeeChanges = async () => {
    if (!editingPayee) return;
    isSaving = true;
    try {
      await financeStore.updatePayee(editingPayee.id, {
        name: editingPayee.name,
        default_category_name: editCategory.trim() || undefined,
        suggested_category_name: editCategory.trim() || undefined,
        detected_cadence: editCadence,
        website: editWebsite.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });
      isEditModalOpen = false;
      editingPayee = null;
    } catch (err) {
      console.error('Failed to save payee intelligence:', err);
    } finally {
      isSaving = false;
    }
  };
</script>

<div class="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
  <!-- Top Header -->
  <header class="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-md flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400">
        <Store class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-base font-bold text-zinc-100 flex items-center gap-2">
          Payee Intelligence & Directory
          <span class="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-pink-950/80 text-pink-300 border border-pink-800/60">
            {financeStore.payees.length} Merchants
          </span>
        </h1>
        <p class="text-xs text-zinc-400">
          Historical spend analytics, cadence profiling, transaction frequency & automated category memory
        </p>
      </div>
    </div>
  </header>

  <!-- Main Scrollable Body -->
  <div class="flex-1 overflow-y-auto p-6 space-y-6">
    <!-- Hero Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- Card 1: Total Merchants -->
      <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
        <div class="flex items-center justify-between text-zinc-400 text-xs">
          <span class="flex items-center gap-1.5 font-medium">
            <Store class="w-3.5 h-3.5 text-pink-400" />
            Unique Merchants
          </span>
          <span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-zinc-800 text-zinc-300">Total</span>
        </div>
        <div class="text-2xl font-mono font-bold text-zinc-100">
          {financeStore.payees.length}
        </div>
        <div class="text-[11px] text-zinc-400">
          {financeStore.payees.filter(p => (p.detected_cadence || 'none') !== 'none').length} recurring cadence profiles
        </div>
      </div>

      <!-- Card 2: Total Tracked Spend -->
      <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
        <div class="flex items-center justify-between text-zinc-400 text-xs">
          <span class="flex items-center gap-1.5 font-medium">
            <DollarSign class="w-3.5 h-3.5 text-emerald-400" />
            Total Tracked Spend
          </span>
          <span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">All Time</span>
        </div>
        <div class="text-2xl font-mono font-bold text-emerald-400">
          {formatCurrency(totalTrackedSpend)}
        </div>
        <div class="text-[11px] text-zinc-400">
          Across all active ledger registers
        </div>
      </div>

      <!-- Card 3: Top Merchant -->
      <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
        <div class="flex items-center justify-between text-zinc-400 text-xs">
          <span class="flex items-center gap-1.5 font-medium">
            <TrendingUp class="w-3.5 h-3.5 text-amber-400" />
            Top Merchant by Outflow
          </span>
          <span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-950/60 text-amber-400 border border-amber-800/60">Leader</span>
        </div>
        <div class="text-xl font-bold text-zinc-100 truncate" title={topMerchant?.name || 'N/A'}>
          {topMerchant ? topMerchant.name : 'None'}
        </div>
        <div class="text-[11px] text-zinc-400 font-mono">
          {#if topMerchant}
            {formatCurrency(topMerchant.total_spend)} ({topMerchant.transaction_count} txs)
          {:else}
            0.00
          {/if}
        </div>
      </div>

      <!-- Card 4: Category Memory Coverage -->
      <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
        <div class="flex items-center justify-between text-zinc-400 text-xs">
          <span class="flex items-center gap-1.5 font-medium">
            <Sparkles class="w-3.5 h-3.5 text-indigo-400" />
            Category Memory
          </span>
          <span class="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/60">
            {categorizationCoveragePct}% Coverage
          </span>
        </div>
        <div class="text-2xl font-mono font-bold text-indigo-400">
          {categorizedCount} / {financeStore.payees.length}
        </div>
        <div class="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
          <div class="bg-indigo-500 h-full rounded-full transition-all" style="width: {categorizationCoveragePct}%"></div>
        </div>
      </div>
    </div>

    <!-- Search & Filtering Toolbar -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
      <!-- Search Input -->
      <div class="relative w-full sm:w-80">
        <Search class="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Filter by merchant, category, notes..."
          class="w-full pl-9 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-pink-500 transition-colors"
        />
        {#if searchQuery}
          <button
            onclick={() => (searchQuery = '')}
            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        {/if}
      </div>

      <!-- Controls Right: Cadence & Sort -->
      <div class="flex items-center gap-2.5 w-full sm:w-auto justify-end">
        <!-- Cadence Filter -->
        <div class="flex items-center gap-1.5 text-xs text-zinc-400">
          <Clock class="w-3.5 h-3.5 text-zinc-500" />
          <select
            bind:value={cadenceFilter}
            class="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-pink-500"
          >
            <option value="all">All Cadences</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
            <option value="none">Irregular</option>
          </select>
        </div>

        <!-- Sort Dropdown -->
        <div class="flex items-center gap-1.5 text-xs text-zinc-400">
          <ArrowUpDown class="w-3.5 h-3.5 text-zinc-500" />
          <select
            bind:value={sortBy}
            class="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-pink-500"
          >
            <option value="spend_desc">Total Outflow (High to Low)</option>
            <option value="count_desc">Transaction Frequency</option>
            <option value="avg_desc">Average Ticket Size</option>
            <option value="name_asc">Merchant Name (A-Z)</option>
            <option value="date_desc">Recently Active</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Payees Table / List -->
    <div class="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-sm">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="border-b border-zinc-800/80 bg-zinc-900/70 text-zinc-400 uppercase tracking-wider font-semibold text-[11px]">
            <th class="py-3 px-4">Payee / Merchant</th>
            <th class="py-3 px-4">Default Category</th>
            <th class="py-3 px-4 text-center">Cadence</th>
            <th class="py-3 px-4 text-right">Total Outflow</th>
            <th class="py-3 px-4 text-center">Tx Count</th>
            <th class="py-3 px-4 text-right">Avg Ticket</th>
            <th class="py-3 px-4 text-center">Last Active</th>
            <th class="py-3 px-4 text-center">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-800/40 font-mono">
          {#if filteredPayees.length === 0}
            <tr>
              <td colspan="8" class="py-12 text-center text-zinc-500 font-sans">
                <Store class="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
                <p class="font-medium text-zinc-400">No payees match the active search or filter</p>
                <p class="text-xs text-zinc-600 mt-1">Try clearing search keywords or change cadence filters</p>
              </td>
            </tr>
          {:else}
            {#each filteredPayees as payee (payee.id)}
              {@const cadence = getCadenceBadge(payee.detected_cadence)}
              <tr class="hover:bg-zinc-800/30 transition-colors group">
                <!-- Merchant Name & Link -->
                <td class="py-3 px-4 font-sans font-medium text-zinc-200">
                  <div class="flex items-center gap-2">
                    <span class="text-sm font-semibold text-zinc-100 group-hover:text-pink-300 transition-colors">
                      {payee.name}
                    </span>
                    {#if payee.website}
                      <a
                        href={payee.website}
                        target="_blank"
                        rel="noreferrer"
                        class="text-zinc-500 hover:text-pink-400 transition-colors"
                        title={payee.website}
                      >
                        <ExternalLink class="w-3 h-3" />
                      </a>
                    {/if}
                  </div>
                  {#if payee.notes}
                    <div class="text-[11px] text-zinc-500 italic mt-0.5 truncate max-w-xs">
                      {payee.notes}
                    </div>
                  {/if}
                </td>

                <!-- Category -->
                <td class="py-3 px-4 font-sans">
                  {#if payee.default_category_name || payee.suggested_category_name}
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-800 text-zinc-200 border border-zinc-700/60">
                      <Tag class="w-2.5 h-2.5 text-pink-400" />
                      {payee.default_category_name || payee.suggested_category_name}
                    </span>
                  {:else}
                    <span class="text-zinc-500 italic text-[11px]">Uncategorized</span>
                  {/if}
                </td>

                <!-- Cadence -->
                <td class="py-3 px-4 text-center font-sans">
                  <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border {cadence.class}">
                    {cadence.label}
                  </span>
                </td>

                <!-- Total Spend -->
                <td class="py-3 px-4 text-right font-bold text-zinc-100">
                  {formatCurrency(payee.total_spend)}
                </td>

                <!-- Transaction Count -->
                <td class="py-3 px-4 text-center">
                  <span class="px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-300 text-[11px] font-bold">
                    {payee.transaction_count}
                  </span>
                </td>

                <!-- Average Amount -->
                <td class="py-3 px-4 text-right text-zinc-300">
                  {formatCurrency(payee.avg_amount)}
                </td>

                <!-- Last Active Date -->
                <td class="py-3 px-4 text-center text-zinc-400 text-[11px]">
                  {payee.last_transaction_date || 'N/A'}
                </td>

                <!-- Action: Edit -->
                <td class="py-3 px-4 text-center font-sans">
                  <button
                    onclick={() => openEditModal(payee)}
                    class="p-1.5 rounded-lg text-zinc-400 hover:text-pink-300 hover:bg-pink-950/40 border border-transparent hover:border-pink-800/60 transition-all"
                    title="Edit Category & Merchant Intelligence"
                  >
                    <Edit3 class="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Edit Payee Modal -->
  {#if isEditModalOpen && editingPayee}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <!-- Modal Header -->
        <div class="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Store class="w-4 h-4 text-pink-400" />
            <h3 class="font-bold text-sm text-zinc-100">Edit Payee: {editingPayee.name}</h3>
          </div>
          <button
            onclick={() => (isEditModalOpen = false)}
            class="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Form Body -->
        <form onsubmit={(e) => { e.preventDefault(); savePayeeChanges(); }} class="p-5 space-y-4 text-xs">
          <!-- Default Category -->
          <div>
            <label class="block uppercase font-semibold text-[11px] text-zinc-400 mb-1.5" for="edit-category">
              Default Category Rule
            </label>
            <div class="space-y-1.5">
              <input
                id="edit-category"
                type="text"
                list="category-suggestions"
                bind:value={editCategory}
                placeholder="e.g. Groceries, Dining"
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500 font-sans"
              />
              <datalist id="category-suggestions">
                {#each commonCategories as cat}
                  <option value={cat}>{cat}</option>
                {/each}
              </datalist>
              <p class="text-[11px] text-zinc-500">
                Transactions with this payee will automatically assign this category in Quick Add & Bank Statements.
              </p>
            </div>
          </div>

          <!-- Cadence Profile -->
          <div>
            <label class="block uppercase font-semibold text-[11px] text-zinc-400 mb-1.5" for="edit-cadence">
              Cadence Profile
            </label>
            <select
              id="edit-cadence"
              bind:value={editCadence}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:border-pink-500 font-sans"
            >
              <option value="none">Irregular / On-Demand</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <!-- Website -->
          <div>
            <label class="block uppercase font-semibold text-[11px] text-zinc-400 mb-1.5" for="edit-website">
              Website URL (Optional)
            </label>
            <input
              id="edit-website"
              type="url"
              bind:value={editWebsite}
              placeholder="https://..."
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500 font-mono"
            />
          </div>

          <!-- Notes -->
          <div>
            <label class="block uppercase font-semibold text-[11px] text-zinc-400 mb-1.5" for="edit-notes">
              Merchant Notes / Remarks
            </label>
            <textarea
              id="edit-notes"
              rows="2"
              bind:value={editNotes}
              placeholder="e.g. Loyalty card number, subscription details, etc."
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-pink-500 font-sans"
            ></textarea>
          </div>

          <!-- Summary Stats for this payee -->
          <div class="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 grid grid-cols-3 gap-2 text-center">
            <div>
              <div class="text-[10px] text-zinc-500 uppercase">Historical Spend</div>
              <div class="text-xs font-mono font-bold text-zinc-200">{formatCurrency(editingPayee.total_spend)}</div>
            </div>
            <div>
              <div class="text-[10px] text-zinc-500 uppercase">Transactions</div>
              <div class="text-xs font-mono font-bold text-zinc-200">{editingPayee.transaction_count}</div>
            </div>
            <div>
              <div class="text-[10px] text-zinc-500 uppercase">Avg Amount</div>
              <div class="text-xs font-mono font-bold text-zinc-200">{formatCurrency(editingPayee.avg_amount)}</div>
            </div>
          </div>

          <!-- Buttons -->
          <div class="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
            <button
              type="button"
              onclick={() => (isEditModalOpen = false)}
              class="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              class="px-4 py-2 rounded-lg text-xs font-semibold bg-pink-600 hover:bg-pink-500 text-white shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {#if isSaving}
                <Clock class="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              {:else}
                <Check class="w-3.5 h-3.5" />
                <span>Save Changes</span>
              {/if}
            </button>
          </div>
        </form>
      </div>
    </div>
  {/if}
</div>
