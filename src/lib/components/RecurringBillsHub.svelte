<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { RecurringBill, DetectedSubscription, BillFrequency } from '../types/moneta';
  import {
    CalendarClock,
    Plus,
    Sparkles,
    Check,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    Clock,
    CreditCard,
    Edit3,
    Trash2,
    X,
    Calendar,
    ReceiptText,
    ArrowRight,
    Zap,
    ExternalLink,
    Filter
  } from '@lucide/svelte';

  // Horizon filter state
  let horizonFilter = $state<'14' | '30' | 'all'>('30');
  let searchQuery = $state<string>('');
  let payingBillId = $state<string | number | null>(null);
  let recentlyPaidId = $state<string | number | null>(null);

  // Bill modal form state
  let formId = $state<string | number | undefined>(undefined);
  let formName = $state<string>('');
  let formPayee = $state<string>('');
  let formCategory = $state<string>('Utilities');
  let formAccountId = $state<string | number>('');
  let formAmount = $state<number | ''>('');
  let formFrequency = $state<BillFrequency>('monthly');
  let formNextDueDate = $state<string>(new Date().toISOString().split('T')[0]);
  let formAutoPay = $state<boolean>(false);

  // Format currency helper
  const formatCurrency = (amount: number, currency: string = 'SGD') => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Filtered bills
  let filteredBills = $derived(() => {
    let list = financeStore.bills;
    if (horizonFilter === '14') {
      list = list.filter((b) => (b.days_until_due ?? 999) <= 14);
    } else if (horizonFilter === '30') {
      list = list.filter((b) => (b.days_until_due ?? 999) <= 30);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.payee_name.toLowerCase().includes(q) ||
          (b.category_name && b.category_name.toLowerCase().includes(q))
      );
    }
    return list;
  });

  // Derived financial metrics
  let totalMonthlyCommitted = $derived(() => {
    return financeStore.bills.reduce((sum, b) => {
      let monthly = b.amount;
      if (b.frequency === 'weekly') monthly = b.amount * 4.33;
      else if (b.frequency === 'biweekly') monthly = b.amount * 2.16;
      else if (b.frequency === 'quarterly') monthly = b.amount / 3;
      else if (b.frequency === 'semiannual') monthly = b.amount / 6;
      else if (b.frequency === 'yearly') monthly = b.amount / 12;
      return sum + monthly;
    }, 0);
  });

  let next14DayOutflow = $derived(() => {
    return financeStore.bills
      .filter((b) => (b.days_until_due ?? 999) <= 14)
      .reduce((sum, b) => sum + b.amount, 0);
  });

  let overdueCount = $derived(() => {
    return financeStore.bills.filter((b) => b.due_status === 'overdue').length;
  });

  let autoPayCount = $derived(() => {
    return financeStore.bills.filter((b) => b.auto_pay).length;
  });

  // Open modal to create bill
  const openCreateModal = () => {
    formId = undefined;
    formName = '';
    formPayee = '';
    formCategory = 'Utilities';
    formAccountId = financeStore.accounts[0]?.id || '';
    formAmount = '';
    formFrequency = 'monthly';
    formNextDueDate = new Date().toISOString().split('T')[0];
    formAutoPay = false;
    financeStore.isBillModalOpen = true;
  };

  // Open modal to edit bill
  const openEditModal = (bill: RecurringBill) => {
    formId = bill.id;
    formName = bill.name;
    formPayee = bill.payee_name;
    formCategory = bill.category_name || 'Utilities';
    formAccountId = bill.account_id || financeStore.accounts[0]?.id || '';
    formAmount = bill.amount;
    formFrequency = bill.frequency;
    formNextDueDate = bill.next_due_date;
    formAutoPay = bill.auto_pay;
    financeStore.isBillModalOpen = true;
  };

  // Track detected subscription as a bill
  const trackDetectedSubscription = (sub: DetectedSubscription) => {
    formId = undefined;
    formName = sub.payee_name;
    formPayee = sub.payee_name;
    formCategory = sub.category_name || 'Entertainment';
    formAccountId = sub.account_id || financeStore.accounts[0]?.id || '';
    formAmount = sub.average_amount;
    formFrequency = sub.detected_frequency;

    // Calculate projected next due date based on last charge
    const d = new Date(sub.last_charge_date || Date.now());
    if (sub.detected_frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (sub.detected_frequency === 'biweekly') d.setDate(d.getDate() + 14);
    else if (sub.detected_frequency === 'quarterly') d.setMonth(d.getMonth() + 3);
    else if (sub.detected_frequency === 'semiannual') d.setMonth(d.getMonth() + 6);
    else if (sub.detected_frequency === 'yearly') d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    formNextDueDate = d.toISOString().split('T')[0];

    formAutoPay = false;
    financeStore.isBillModalOpen = true;
  };

  // Dismiss detected subscription
  const dismissDetected = (payee: string) => {
    financeStore.detectedSubscriptions = financeStore.detectedSubscriptions.filter((s) => s.payee_name !== payee);
  };

  // Submit bill modal
  const handleSaveBill = async () => {
    if (!formName.trim() || !formAmount || formAmount <= 0) return;

    const matchedAcc = financeStore.accounts.find((a) => String(a.id) === String(formAccountId));

    await financeStore.saveBill({
      id: formId,
      name: formName.trim(),
      payee_name: formPayee.trim() || formName.trim(),
      category_name: formCategory,
      account_id: formAccountId,
      account_name: matchedAcc ? matchedAcc.name : undefined,
      amount: Number(formAmount),
      frequency: formFrequency,
      next_due_date: formNextDueDate,
      auto_pay: formAutoPay,
    });
  };

  // 1-Click Mark Paid
  const handleMarkPaid = async (bill: RecurringBill) => {
    payingBillId = bill.id;
    try {
      const ok = await financeStore.markBillPaid(bill.id, bill.account_id);
      if (ok) {
        recentlyPaidId = bill.id;
        setTimeout(() => {
          if (recentlyPaidId === bill.id) recentlyPaidId = null;
        }, 3000);
      }
    } finally {
      payingBillId = null;
    }
  };

  // Delete bill
  const handleDeleteBill = async (id: string | number) => {
    if (confirm('Are you sure you want to remove this recurring bill?')) {
      await financeStore.deleteBill(id);
    }
  };

  // Status badge styling
  const getStatusBadge = (status?: string, days?: number) => {
    if (status === 'overdue') {
      const d = Math.abs(days ?? 1);
      return {
        label: `Overdue by ${d}d`,
        bg: 'bg-rose-950/80 text-rose-400 border-rose-800/80',
        dot: 'bg-rose-500',
      };
    }
    if (status === 'today') {
      return {
        label: 'Due Today',
        bg: 'bg-amber-950/80 text-amber-300 border-amber-800/80 animate-pulse',
        dot: 'bg-amber-400',
      };
    }
    if (status === 'due_soon') {
      return {
        label: days === 1 ? 'Due Tomorrow' : `In ${days} days`,
        bg: 'bg-orange-950/80 text-orange-300 border-orange-800/80',
        dot: 'bg-orange-400',
      };
    }
    return {
      label: `In ${days} days`,
      bg: 'bg-zinc-800/80 text-zinc-300 border-zinc-700/80',
      dot: 'bg-zinc-500',
    };
  };
</script>

<div class="flex-1 flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
  <!-- Top Hub Bar -->
  <header class="border-b border-zinc-800/80 px-8 py-5 flex items-center justify-between bg-zinc-950/60 backdrop-blur shrink-0">
    <div class="flex items-center gap-3.5">
      <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm">
        <CalendarClock class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
          Recurring Bills & Subscriptions
          {#if overdueCount() > 0}
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800">
              {overdueCount()} overdue
            </span>
          {/if}
        </h1>
        <p class="text-xs text-zinc-400 mt-0.5">
          Track upcoming commitments, manage cash outflows, and auto-detect subscription renewals.
        </p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <button
        onclick={() => financeStore.detectSubscriptions()}
        class="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-600 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition shadow-sm"
        title="Scan past 180 days of ledger expenses to detect recurring merchants"
      >
        <Sparkles class="w-4 h-4 text-amber-400" />
        Detect Subscriptions
      </button>

      <button
        onclick={openCreateModal}
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs transition shadow-sm hover:shadow-amber-500/10"
      >
        <Plus class="w-4 h-4" />
        New Recurring Bill
      </button>
    </div>
  </header>

  <!-- Main Scrollable Area -->
  <div class="flex-1 overflow-y-auto px-8 py-6 space-y-6">
    <!-- Hero Summary Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- Total Monthly Committed -->
      <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 relative overflow-hidden">
        <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
          <span>Monthly Committed</span>
          <ReceiptText class="w-4 h-4 text-amber-400" />
        </div>
        <div class="text-2xl font-bold font-mono text-zinc-100">
          {formatCurrency(totalMonthlyCommitted())}
        </div>
        <div class="text-[11px] text-zinc-500 mt-1">
          Normalized monthly recurring outflow
        </div>
      </div>

      <!-- Next 14-Day Outflow -->
      <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 relative overflow-hidden">
        <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
          <span>Next 14 Days Outflow</span>
          <AlertCircle class="w-4 h-4 text-orange-400" />
        </div>
        <div class="text-2xl font-bold font-mono text-orange-300">
          {formatCurrency(next14DayOutflow())}
        </div>
        <div class="text-[11px] text-zinc-500 mt-1">
          Bills due within two weeks
        </div>
      </div>

      <!-- Total Tracked Bills -->
      <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 relative overflow-hidden">
        <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
          <span>Tracked Bills</span>
          <Calendar class="w-4 h-4 text-sky-400" />
        </div>
        <div class="text-2xl font-bold font-mono text-zinc-100">
          {financeStore.bills.length}
        </div>
        <div class="text-[11px] text-zinc-500 mt-1">
          Active recurring schedules
        </div>
      </div>

      <!-- Auto-Pay Status -->
      <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 relative overflow-hidden">
        <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
          <span>Auto-Pay Enabled</span>
          <Zap class="w-4 h-4 text-emerald-400" />
        </div>
        <div class="text-2xl font-bold font-mono text-emerald-400">
          {autoPayCount()} / {financeStore.bills.length}
        </div>
        <div class="text-[11px] text-zinc-500 mt-1">
          Automated payment mandates
        </div>
      </div>
    </div>

    <!-- Smart Subscriptions Detector Banner (if suggestions found) -->
    {#if financeStore.detectedSubscriptions.length > 0}
      <div class="p-5 rounded-xl bg-gradient-to-r from-amber-950/40 via-zinc-900/70 to-zinc-900/50 border border-amber-600/30 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <Sparkles class="w-5 h-5 text-amber-400" />
            <h2 class="text-sm font-bold text-zinc-100">
              Smart Subscription Detector ({financeStore.detectedSubscriptions.length} Found)
            </h2>
            <span class="text-xs text-zinc-400">
              Identified repeat charges from the past 180 days that are not yet tracked as recurring bills.
            </span>
          </div>
          <button
            onclick={() => (financeStore.detectedSubscriptions = [])}
            class="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Dismiss All
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {#each financeStore.detectedSubscriptions as sub (sub.payee_name)}
            <div class="p-3.5 rounded-lg bg-zinc-900/90 border border-zinc-800 flex items-center justify-between shadow-sm">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-white">{sub.payee_name}</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold bg-zinc-800 text-zinc-300">
                    {sub.detected_frequency}
                  </span>
                </div>
                <div class="text-[11px] text-zinc-400 flex items-center gap-2">
                  <span class="font-mono text-zinc-200">{formatCurrency(sub.average_amount)}</span>
                  <span>•</span>
                  <span>{sub.charge_count} charges</span>
                </div>
              </div>

              <div class="flex items-center gap-1.5">
                <button
                  onclick={() => trackDetectedSubscription(sub)}
                  class="px-2.5 py-1.5 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold flex items-center gap-1 transition"
                  title="Add to recurring bills"
                >
                  <Plus class="w-3.5 h-3.5" />
                  Track
                </button>
                <button
                  onclick={() => dismissDetected(sub.payee_name)}
                  class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                  aria-label="Dismiss subscription"
                >
                  <X class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Bills Table / Register Area -->
    <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
      <!-- Filters and Controls Bar -->
      <div class="p-4 border-b border-zinc-800/80 flex items-center justify-between gap-4 bg-zinc-950/40">
        <!-- Horizon Selector -->
        <div class="flex items-center gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs font-semibold">
          <button
            onclick={() => (horizonFilter = '14')}
            class="px-3 py-1 rounded-md transition {horizonFilter === '14' ? 'bg-zinc-800 text-amber-300 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            Next 14 Days
          </button>
          <button
            onclick={() => (horizonFilter = '30')}
            class="px-3 py-1 rounded-md transition {horizonFilter === '30' ? 'bg-zinc-800 text-amber-300 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            Next 30 Days
          </button>
          <button
            onclick={() => (horizonFilter = 'all')}
            class="px-3 py-1 rounded-md transition {horizonFilter === 'all' ? 'bg-zinc-800 text-amber-300 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
          >
            All Active ({financeStore.bills.length})
          </button>
        </div>

        <!-- Search Input -->
        <div class="w-64">
          <input
            type="text"
            placeholder="Search bills or payees..."
            bind:value={searchQuery}
            class="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>
      </div>

      <!-- Table of Bills -->
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider text-[10px] font-semibold border-b border-zinc-800/80">
            <tr>
              <th class="py-3 px-4">Status / Due Date</th>
              <th class="py-3 px-4">Bill & Payee</th>
              <th class="py-3 px-4">Category</th>
              <th class="py-3 px-4">Account</th>
              <th class="py-3 px-4">Frequency</th>
              <th class="py-3 px-4 text-right">Amount</th>
              <th class="py-3 px-4 text-center">Auto-Pay</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800/60">
            {#if filteredBills().length === 0}
              <tr>
                <td colspan="8" class="text-center py-12 text-zinc-500">
                  <div class="flex flex-col items-center justify-center gap-2">
                    <CalendarClock class="w-8 h-8 text-zinc-600" />
                    <span>No recurring bills found matching the selected criteria.</span>
                  </div>
                </td>
              </tr>
            {:else}
              {#each filteredBills() as bill (bill.id)}
                {@const badge = getStatusBadge(bill.due_status, bill.days_until_due)}
                <tr class="hover:bg-zinc-900/50 transition-colors {recentlyPaidId === bill.id ? 'bg-emerald-950/30' : ''}">
                  <!-- Status & Due Date -->
                  <td class="py-3.5 px-4 whitespace-nowrap">
                    <div class="flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full {badge.dot}"></span>
                      <span class="px-2 py-0.5 rounded text-[11px] font-semibold border {badge.bg}">
                        {badge.label}
                      </span>
                      <span class="text-zinc-500 font-mono text-[11px] ml-1">{bill.next_due_date}</span>
                    </div>
                  </td>

                  <!-- Bill Name & Payee -->
                  <td class="py-3.5 px-4 font-medium text-white">
                    <div>{bill.name}</div>
                    {#if bill.payee_name && bill.payee_name !== bill.name}
                      <div class="text-[11px] text-zinc-400">{bill.payee_name}</div>
                    {/if}
                  </td>

                  <!-- Category -->
                  <td class="py-3.5 px-4 text-zinc-300">
                    <span class="px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-300 text-[11px]">
                      {bill.category_name || 'General'}
                    </span>
                  </td>

                  <!-- Account -->
                  <td class="py-3.5 px-4 text-zinc-400">
                    {bill.account_name || 'Checking Account'}
                  </td>

                  <!-- Frequency -->
                  <td class="py-3.5 px-4">
                    <span class="capitalize text-zinc-300 font-medium">
                      {bill.frequency}
                    </span>
                  </td>

                  <!-- Amount -->
                  <td class="py-3.5 px-4 text-right font-mono font-bold text-zinc-100">
                    {formatCurrency(bill.amount)}
                  </td>

                  <!-- Auto Pay -->
                  <td class="py-3.5 px-4 text-center">
                    {#if bill.auto_pay}
                      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
                        <Check class="w-3 h-3" /> Auto
                      </span>
                    {:else}
                      <span class="text-zinc-600 text-[11px]">Manual</span>
                    {/if}
                  </td>

                  <!-- Actions -->
                  <td class="py-3.5 px-4 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1.5">
                      <!-- 1-Click Mark as Paid -->
                      <button
                        onclick={() => handleMarkPaid(bill)}
                        disabled={payingBillId === bill.id}
                        class="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
                        title="Record payment transaction and advance next due date"
                      >
                        {#if payingBillId === bill.id}
                          <span class="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                          Paying...
                        {:else if recentlyPaidId === bill.id}
                          <Check class="w-3.5 h-3.5 text-emerald-400" />
                          Paid!
                        {:else}
                          <Check class="w-3.5 h-3.5" />
                          Mark Paid
                        {/if}
                      </button>

                      <!-- Edit Button -->
                      <button
                        onclick={() => openEditModal(bill)}
                        class="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                        title="Edit Bill"
                      >
                        <Edit3 class="w-3.5 h-3.5" />
                      </button>

                      <!-- Delete Button -->
                      <button
                        onclick={() => handleDeleteBill(bill.id)}
                        class="p-1.5 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 transition"
                        title="Delete Bill"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>

<!-- Create / Edit Recurring Bill Modal -->
{#if financeStore.isBillModalOpen}
  <div class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 class="font-bold text-base text-zinc-100 flex items-center gap-2">
          <CalendarClock class="w-5 h-5 text-amber-400" />
          {formId ? 'Edit Recurring Bill' : 'New Recurring Bill'}
        </h3>
        <button
          onclick={() => (financeStore.isBillModalOpen = false)}
          class="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          aria-label="Close modal"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body -->
      <form onsubmit={(e) => { e.preventDefault(); handleSaveBill(); }} class="p-6 space-y-4">
        <!-- Bill Name -->
        <div>
          <label for="bill-name" class="block text-xs font-semibold text-zinc-300 mb-1.5">
            Bill Name *
          </label>
          <input
            id="bill-name"
            type="text"
            required
            placeholder="e.g. SP Group Utilities"
            bind:value={formName}
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <!-- Payee Name -->
        <div>
          <label for="bill-payee" class="block text-xs font-semibold text-zinc-300 mb-1.5">
            Payee / Merchant
          </label>
          <input
            id="bill-payee"
            type="text"
            placeholder="e.g. SP Services Ltd"
            bind:value={formPayee}
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <!-- Amount & Frequency Grid -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="bill-amount" class="block text-xs font-semibold text-zinc-300 mb-1.5">
              Amount (SGD) *
            </label>
            <input
              id="bill-amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              bind:value={formAmount}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div>
            <label for="bill-freq" class="block text-xs font-semibold text-zinc-300 mb-1.5">
              Frequency
            </label>
            <select
              id="bill-freq"
              bind:value={formFrequency}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500 transition"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semiannual">Semi-annual</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <!-- Next Due Date & Category Grid -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="bill-due-date" class="block text-xs font-semibold text-zinc-300 mb-1.5">
              Next Due Date *
            </label>
            <input
              id="bill-due-date"
              type="date"
              required
              bind:value={formNextDueDate}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          <div>
            <label for="bill-category" class="block text-xs font-semibold text-zinc-300 mb-1.5">
              Category
            </label>
            <input
              id="bill-category"
              type="text"
              placeholder="e.g. Utilities"
              bind:value={formCategory}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition"
            />
          </div>
        </div>

        <!-- Account Selector -->
        <div>
          <label for="bill-account" class="block text-xs font-semibold text-zinc-300 mb-1.5">
            Default Payment Account
          </label>
          <select
            id="bill-account"
            bind:value={formAccountId}
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-500 transition"
          >
            {#each financeStore.accounts as acc (acc.id)}
              <option value={acc.id}>{acc.name} ({acc.account_type})</option>
            {/each}
          </select>
        </div>

        <!-- Auto Pay Toggle -->
        <div class="pt-2">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              bind:checked={formAutoPay}
              class="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-900"
            />
            <span class="text-xs font-semibold text-zinc-200">Auto-Pay Mandate / GIRO enabled</span>
          </label>
          <p class="text-[11px] text-zinc-500 mt-0.5 pl-6">
            Automatically handled via GIRO, recurring card instruction, or standing order.
          </p>
        </div>

        <!-- Modal Footer Buttons -->
        <div class="pt-4 border-t border-zinc-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onclick={() => (financeStore.isBillModalOpen = false)}
            class="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition shadow-sm"
          >
            {formId ? 'Update Bill' : 'Save Recurring Bill'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
