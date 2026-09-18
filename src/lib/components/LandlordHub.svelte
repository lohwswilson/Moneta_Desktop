<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { PropertyTenant, RentPayment, LeaseStatus, RentPaymentStatus, DepositStatus } from '../types/moneta';
  import {
    Users,
    Plus,
    Pencil,
    Trash2,
    X,
    DoorOpen,
    Banknote,
    CheckCircle2,
    AlertTriangle,
    CalendarDays,
    KeyRound,
    ShieldCheck,
    ReceiptText,
    RefreshCw,
    Mail,
    Phone,
    Building2,
    CalendarClock,
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

  // --- Action feedback state ---
  let schedBusyId = $state<string | number | null>(null);
  let schedMsg = $state<{ tenantId: string | number; text: string } | null>(null);
  let payingId = $state<string | number | null>(null);
  let recentlyPaidId = $state<string | number | null>(null);

  // --- Create / edit tenant modal form state ---
  let formId = $state<string | number | undefined>(undefined);
  let formName = $state<string>('');
  let formPropertyId = $state<string | number>('');
  let formUnit = $state<string>('');
  let formEmail = $state<string>('');
  let formPhone = $state<string>('');
  let formEmergency = $state<string>('');
  let formStart = $state<string>(new Date().toISOString().split('T')[0]);
  let formEnd = $state<string>('');
  let formRent = $state<number | ''>('');
  let formDueDay = $state<number | ''>(1);
  let formDeposit = $state<number | ''>('');
  let formDepositStatus = $state<DepositStatus>('held');
  let formNotes = $state<string>('');

  // Properties that can be let out.
  let rentalProperties = $derived.by(() =>
    financeStore.properties.filter((p) => p.asset_category === 'real_estate')
  );

  // --- Summary metrics, from the adapter-derived tenant figures ---
  let activeLeaseCount = $derived.by(() =>
    financeStore.tenants.filter((t) => t.lease_status === 'active').length
  );

  let monthlyContractedRent = $derived.by(() =>
    financeStore.tenants
      .filter((t) => t.lease_status === 'active')
      .reduce((sum, t) => sum + (t.monthly_rent_amount || 0), 0)
  );

  let totalCollected = $derived.by(() =>
    financeStore.tenants.reduce((sum, t) => sum + (t.total_rent_collected || 0), 0)
  );

  let totalOverdue = $derived.by(() =>
    financeStore.tenants.reduce((sum, t) => sum + (t.total_rent_overdue || 0), 0)
  );

  // Rent roll: overdue first, then by due date ascending.
  let sortedPayments = $derived.by(() => {
    const rank = (st: RentPaymentStatus) => (st === 'overdue' ? 0 : 1);
    return [...financeStore.rentPayments].sort(
      (a, b) => rank(a.payment_status) - rank(b.payment_status) || a.due_date.localeCompare(b.due_date)
    );
  });

  let tenantNames = $derived.by(() => {
    const map = new Map<string, string>();
    for (const t of financeStore.tenants) map.set(String(t.id), t.name);
    return map;
  });

  const leaseBadgeClass = (status: LeaseStatus) => {
    switch (status) {
      case 'upcoming':
        return 'bg-sky-950/70 text-sky-300 border-sky-800/70';
      case 'active':
        return 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70';
      case 'terminated':
        return 'bg-rose-950/70 text-rose-300 border-rose-800/70';
      default:
        return 'bg-zinc-800/80 text-zinc-400 border-zinc-700';
    }
  };

  const rentStatusBadge = (status: RentPaymentStatus) => {
    switch (status) {
      case 'paid':
        return { label: 'Paid', cls: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/70' };
      case 'partial':
        return { label: 'Partial', cls: 'bg-amber-950/70 text-amber-300 border-amber-800/70' };
      case 'overdue':
        return { label: 'Overdue', cls: 'bg-rose-950/70 text-rose-300 border-rose-800/70' };
      case 'waived':
        return { label: 'Waived', cls: 'bg-zinc-800/80 text-zinc-400 border-zinc-700' };
      default:
        return { label: 'Pending', cls: 'bg-zinc-800/80 text-zinc-300 border-zinc-700' };
    }
  };

  function openCreateModal() {
    financeStore.editingTenant = null;
    formId = undefined;
    formName = '';
    formPropertyId = rentalProperties[0]?.id ?? '';
    formUnit = '';
    formEmail = '';
    formPhone = '';
    formEmergency = '';
    formStart = new Date().toISOString().split('T')[0];
    formEnd = '';
    formRent = '';
    formDueDay = 1;
    formDeposit = '';
    formDepositStatus = 'held';
    formNotes = '';
    financeStore.isTenantModalOpen = true;
  }

  function openEditModal(t: PropertyTenant) {
    financeStore.editingTenant = t;
    formId = t.id;
    formName = t.name;
    formPropertyId = t.property_id;
    formUnit = t.unit_number || '';
    formEmail = t.email || '';
    formPhone = t.phone || '';
    formEmergency = t.emergency_contact || '';
    formStart = t.lease_start_date;
    formEnd = t.lease_end_date;
    formRent = t.monthly_rent_amount;
    formDueDay = t.rent_due_day || 1;
    formDeposit = t.security_deposit_held ?? '';
    formDepositStatus = t.deposit_status;
    formNotes = t.notes || '';
    financeStore.isTenantModalOpen = true;
  }

  async function submitTenant() {
    if (!formName.trim() || formPropertyId === '' || formRent === '' || Number(formRent) <= 0) return;

    const property = financeStore.properties.find((p) => String(p.id) === String(formPropertyId));

    await financeStore.saveTenant({
      name: formName.trim(),
      property_id: formPropertyId,
      property_name: property?.name,
      unit_number: formUnit.trim() || undefined,
      email: formEmail.trim() || undefined,
      phone: formPhone.trim() || undefined,
      emergency_contact: formEmergency.trim() || undefined,
      lease_start_date: formStart,
      lease_end_date: formEnd,
      monthly_rent_amount: Number(formRent),
      // Capped at 28 so a due day can never overflow into the following month.
      rent_due_day: Math.min(Math.max(Number(formDueDay) || 1, 1), 28),
      security_deposit_held: formDeposit === '' ? undefined : Number(formDeposit),
      deposit_status: formDepositStatus,
      notes: formNotes.trim() || undefined,
    });

    financeStore.isTenantModalOpen = false;
    financeStore.editingTenant = null;
  }

  async function confirmDelete(t: PropertyTenant) {
    if (confirm(`Delete the tenant "${t.name}"? Their rent payment history will be removed too.`)) {
      await financeStore.deleteTenant(t.id);
    }
  }

  // Generate rent schedule — idempotent per rental month, so a zero return
  // simply means the schedule was already complete.
  async function handleGenerateSchedule(t: PropertyTenant) {
    schedBusyId = t.id;
    try {
      const n = await financeStore.generateRentSchedule(t.id);
      const text =
        n > 0
          ? `Created ${n} rent payment${n === 1 ? '' : 's'} for ${t.name}.`
          : `Nothing to create — the rent schedule for ${t.name} is already complete.`;
      schedMsg = { tenantId: t.id, text };
      setTimeout(() => {
        if (schedMsg?.tenantId === t.id) schedMsg = null;
      }, 5000);
    } finally {
      schedBusyId = null;
    }
  }

  async function handleMarkPaid(p: RentPayment) {
    payingId = p.id;
    try {
      const ok = await financeStore.markRentPaid(p.id);
      if (ok) {
        recentlyPaidId = p.id;
        setTimeout(() => {
          if (recentlyPaidId === p.id) recentlyPaidId = null;
        }, 3000);
      }
    } finally {
      payingId = null;
    }
  }
</script>

<div class="flex-1 flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
  <!-- Header -->
  <header class="px-8 py-5 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-3.5">
      <div class="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm">
        <Users class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-zinc-50">Landlord &amp; Rent Roll</h1>
        <p class="text-xs text-zinc-500 mt-1">
          Tenants, lease terms and the monthly rent roll — collected, overdue and due next
        </p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <button
        onclick={openCreateModal}
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold text-xs transition shadow-sm hover:shadow-sky-500/10"
      >
        <Plus class="w-4 h-4" />
        New Tenant
      </button>
    </div>
  </header>

  <div class="flex-1 overflow-y-auto px-8 py-6 space-y-6">
    {#if financeStore.tenants.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <KeyRound class="w-6 h-6 text-zinc-600" />
        </div>
        <h2 class="text-sm font-semibold text-zinc-300">No tenants yet</h2>
        <p class="text-xs text-zinc-500 mt-1.5 max-w-sm">
          Add a tenant to a rental property to track their lease, monthly rent, deposit and the
          payments on the rent roll.
        </p>
        <button
          onclick={openCreateModal}
          class="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold text-xs transition"
        >
          <Plus class="w-4 h-4" />
          Add your first tenant
        </button>
      </div>
    {:else}
      <!-- Summary strip -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Active Leases</span>
            <DoorOpen class="w-4 h-4 text-sky-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-zinc-100">
            {activeLeaseCount}<span class="text-zinc-600 text-lg">/{financeStore.tenants.length}</span>
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">
            {financeStore.tenants.filter((t) => t.lease_status === 'upcoming').length} upcoming,
            {financeStore.tenants.filter((t) => t.lease_status === 'expired' || t.lease_status === 'terminated').length} ended
          </div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Monthly Contracted Rent</span>
            <Banknote class="w-4 h-4 text-emerald-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-emerald-300">{formatCurrencyExact(monthlyContractedRent)}</div>
          <div class="text-[11px] text-zinc-500 mt-1">Across active leases only</div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Total Collected</span>
            <CheckCircle2 class="w-4 h-4 text-emerald-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-zinc-100">{formatCurrency(totalCollected)}</div>
          <div class="text-[11px] text-zinc-500 mt-1">Rent received across all tenants</div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Total Overdue</span>
            <AlertTriangle class="w-4 h-4 {totalOverdue > 0 ? 'text-rose-400' : 'text-zinc-600'}" />
          </div>
          <div class="text-2xl font-bold font-mono {totalOverdue > 0 ? 'text-rose-300' : 'text-zinc-100'}">
            {formatCurrency(totalOverdue)}
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">Unsettled rent past its due date</div>
        </div>
      </div>

      {#if schedMsg}
        <div class="px-4 py-2.5 rounded-lg bg-sky-950/40 border border-sky-800/50 text-[11px] text-sky-300 flex items-center gap-2">
          <RefreshCw class="w-3.5 h-3.5 shrink-0" />
          {schedMsg.text}
        </div>
      {/if}

      <!-- Tenant cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {#each financeStore.tenants as t (t.id)}
          <div class="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-semibold text-zinc-100 truncate" title={t.name}>{t.name}</h3>
                  <span class="shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize {leaseBadgeClass(t.lease_status)}">
                    {t.lease_status}
                  </span>
                </div>
                <div class="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5 min-w-0">
                  <Building2 class="w-3 h-3 shrink-0" />
                  <span class="truncate">{t.property_name || 'Unknown property'}</span>
                  {#if t.unit_number}
                    <span class="shrink-0">· {t.unit_number}</span>
                  {/if}
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button
                  onclick={() => openEditModal(t)}
                  class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
                  title="Edit tenant"
                >
                  <Pencil class="w-3.5 h-3.5" />
                </button>
                <button
                  onclick={() => confirmDelete(t)}
                  class="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                  title="Delete tenant"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Lease dates -->
            <div class="flex items-center justify-between text-[11px] text-zinc-400">
              <span class="flex items-center gap-1.5">
                <CalendarDays class="w-3.5 h-3.5 text-zinc-500" />
                <span class="font-mono">{t.lease_start_date}</span>
                <span class="text-zinc-600">→</span>
                <span class="font-mono">{t.lease_end_date}</span>
              </span>
              <span class="flex items-center gap-1.5" title="Rent due day">
                <CalendarClock class="w-3.5 h-3.5 text-zinc-500" />
                <span class="font-mono">Day {t.rent_due_day}</span>
              </span>
            </div>

            <!-- Rent & deposit -->
            <div class="grid grid-cols-2 gap-2">
              <div class="px-3 py-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
                <div class="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Monthly Rent</div>
                <div class="text-sm font-bold font-mono text-zinc-100">{formatCurrencyExact(t.monthly_rent_amount)}</div>
              </div>
              <div class="px-3 py-2.5 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
                <div class="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
                  <ShieldCheck class="w-3 h-3" /> Deposit · {t.deposit_status.replace('_', ' ')}
                </div>
                <div class="text-sm font-bold font-mono text-zinc-100">
                  {formatCurrency(t.security_deposit_held || 0)}
                </div>
              </div>
            </div>

            <!-- Collected / overdue pair -->
            <div class="flex items-center justify-between text-[11px] pt-3 border-t border-zinc-800/70">
              <span class="text-zinc-400">
                Collected <span class="font-mono font-semibold text-emerald-300 ml-1">{formatCurrency(t.total_rent_collected)}</span>
              </span>
              <span class="text-zinc-400">
                Overdue
                <span class={`font-mono font-semibold ml-1 ${t.total_rent_overdue > 0 ? 'text-rose-300' : 'text-zinc-500'}`}>
                  {formatCurrency(t.total_rent_overdue)}
                </span>
              </span>
            </div>

            {#if t.email || t.phone || t.emergency_contact}
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                {#if t.email}
                  <span class="flex items-center gap-1"><Mail class="w-3 h-3" /> {t.email}</span>
                {/if}
                {#if t.phone}
                  <span class="flex items-center gap-1"><Phone class="w-3 h-3" /> {t.phone}</span>
                {/if}
              </div>
            {/if}

            {#if t.notes}
              <p class="text-[11px] text-zinc-500 leading-relaxed line-clamp-2">{t.notes}</p>
            {/if}

            <!-- Actions -->
            <div class="flex items-center gap-2 pt-1">
              <button
                onclick={() => handleGenerateSchedule(t)}
                disabled={schedBusyId === t.id}
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-950/60 border border-sky-800/60 hover:bg-sky-900/60 text-sky-300 text-[11px] font-semibold transition disabled:opacity-50"
                title="Generate pending rent payments for every month of the lease (idempotent)"
              >
                {#if schedBusyId === t.id}
                  <span class="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></span>
                  Generating...
                {:else}
                  <RefreshCw class="w-3.5 h-3.5" />
                  Generate Rent Schedule
                {/if}
              </button>
              <button
                onclick={() => openEditModal(t)}
                class="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60 hover:bg-zinc-800 text-zinc-300 text-[11px] font-semibold transition"
              >
                <Pencil class="w-3.5 h-3.5" />
                Edit
              </button>
            </div>
          </div>
        {/each}
      </div>

      <!-- Rent roll table -->
      <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-xl overflow-hidden shadow-sm">
        <div class="p-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/40">
          <h3 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <ReceiptText class="w-4 h-4 text-sky-400" />
            Rent Roll
            <span class="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {financeStore.rentPayments.length} payment{financeStore.rentPayments.length === 1 ? '' : 's'}
            </span>
          </h3>
          <span class="text-[10px] text-zinc-500">Overdue first · then by due date</span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-zinc-300 border-collapse">
            <thead>
              <tr class="border-b border-zinc-800 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 bg-zinc-900/80">
                <th class="py-3 px-4">Tenant</th>
                <th class="py-3 px-4">Period</th>
                <th class="py-3 px-4">Due</th>
                <th class="py-3 px-4 text-right">Amount</th>
                <th class="py-3 px-4 text-right">Paid</th>
                <th class="py-3 px-4 text-right">Balance</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800/60">
              {#if sortedPayments.length === 0}
                <tr>
                  <td colspan="8" class="text-center py-12 text-zinc-500">
                    <div class="flex flex-col items-center justify-center gap-2">
                      <CalendarClock class="w-8 h-8 text-zinc-600" />
                      <span>No rent payments yet — use "Generate Rent Schedule" on a tenant card.</span>
                    </div>
                  </td>
                </tr>
              {:else}
                {#each sortedPayments as p (p.id)}
                  {@const badge = rentStatusBadge(p.payment_status)}
                  {@const tenantName = p.tenant_name || tenantNames.get(String(p.tenant_id)) || 'Unknown tenant'}
                  <tr class="hover:bg-zinc-800/40 transition-colors {p.payment_status === 'overdue'
                    ? 'bg-rose-950/25 border-l-2 border-l-rose-500'
                    : recentlyPaidId === p.id
                      ? 'bg-emerald-950/30'
                      : ''}">
                    <td class="py-3 px-4 font-medium text-zinc-100 whitespace-nowrap">{tenantName}</td>
                    <td class="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">{p.period_month}</td>
                    <td class="py-3 px-4 font-mono text-zinc-400 whitespace-nowrap">{p.due_date}</td>
                    <td class="py-3 px-4 text-right font-mono font-semibold text-zinc-200">{formatCurrencyExact(p.amount_due)}</td>
                    <td class="py-3 px-4 text-right font-mono text-emerald-300/90">{formatCurrencyExact(p.amount_paid)}</td>
                    <td class="py-3 px-4 text-right font-mono font-bold {p.balance_due > 0 ? 'text-rose-300' : 'text-zinc-500'}">
                      {formatCurrencyExact(p.balance_due)}
                    </td>
                    <td class="py-3 px-4 text-center">
                      <span class={`px-2 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-right whitespace-nowrap">
                      {#if p.payment_status !== 'paid' && p.payment_status !== 'waived'}
                        <button
                          onclick={() => handleMarkPaid(p)}
                          disabled={payingId === p.id}
                          class="px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 transition disabled:opacity-50"
                          title="Record the payment for this rent month"
                        >
                          {#if payingId === p.id}
                            <span class="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></span>
                            Recording...
                          {:else if recentlyPaidId === p.id}
                            <CheckCircle2 class="w-3.5 h-3.5 text-emerald-400" />
                            Paid!
                          {:else}
                            <CheckCircle2 class="w-3.5 h-3.5" />
                            Mark Paid
                          {/if}
                        </button>
                      {:else}
                        <span class="text-zinc-600 text-[11px]">—</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Create / Edit Tenant Modal -->
{#if financeStore.isTenantModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Users class="w-4 h-4 text-sky-400" />
          {financeStore.editingTenant ? 'Edit Tenant' : 'New Tenant'}
        </h2>
        <button
          onclick={() => { financeStore.isTenantModalOpen = false; financeStore.editingTenant = null; }}
          class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="px-6 py-5 space-y-4">
        <div>
          <label for="tenant-name" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Tenant Name</label>
          <input
            id="tenant-name"
            type="text"
            bind:value={formName}
            placeholder="e.g. Lim Wei Jie"
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </div>

        <div>
          <label for="tenant-property" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Property</label>
          <select
            id="tenant-property"
            bind:value={formPropertyId}
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
          >
            {#if rentalProperties.length === 0}
              <option value="">No rental properties — add one in Properties first</option>
            {:else}
              {#each rentalProperties as p (p.id)}
                <option value={p.id}>{p.name}</option>
              {/each}
            {/if}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="tenant-unit" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Unit Number</label>
            <input
              id="tenant-unit"
              type="text"
              bind:value={formUnit}
              placeholder="e.g. #04-12"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label for="tenant-due-day" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">
              Rent Due Day <span class="text-zinc-600 font-normal">(1–28)</span>
            </label>
            <input
              id="tenant-due-day"
              type="number"
              min="1"
              max="28"
              step="1"
              bind:value={formDueDay}
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
            <p class="text-[10px] text-zinc-600 mt-1">Capped at 28 so the date can never overflow into next month</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="tenant-email" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Email</label>
            <input
              id="tenant-email"
              type="email"
              bind:value={formEmail}
              placeholder="tenant@email.com"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label for="tenant-phone" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Phone</label>
            <input
              id="tenant-phone"
              type="tel"
              bind:value={formPhone}
              placeholder="+65 9xxx xxxx"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div>
          <label for="tenant-emergency" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Emergency Contact</label>
          <input
            id="tenant-emergency"
            type="text"
            bind:value={formEmergency}
            placeholder="Name / relationship / number"
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="tenant-lease-start" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Lease Start</label>
            <input
              id="tenant-lease-start"
              type="date"
              bind:value={formStart}
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
            />
          </div>
          <div>
            <label for="tenant-lease-end" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Lease End</label>
            <input
              id="tenant-lease-end"
              type="date"
              bind:value={formEnd}
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="tenant-rent" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Monthly Rent</label>
            <input
              id="tenant-rent"
              type="number"
              min="0"
              step="0.01"
              bind:value={formRent}
              placeholder="0.00"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
          <div>
            <label for="tenant-deposit" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Security Deposit Held</label>
            <input
              id="tenant-deposit"
              type="number"
              min="0"
              step="0.01"
              bind:value={formDeposit}
              placeholder="0.00"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div>
          <label for="tenant-deposit-status" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Deposit Status</label>
          <select
            id="tenant-deposit-status"
            bind:value={formDepositStatus}
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100"
          >
            <option value="held">Held</option>
            <option value="partially_refunded">Partially refunded</option>
            <option value="refunded">Refunded</option>
            <option value="forfeited">Forfeited</option>
          </select>
        </div>

        <div>
          <label for="tenant-notes" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Notes</label>
          <textarea
            id="tenant-notes"
            bind:value={formNotes}
            rows="2"
            placeholder="Pets, maintenance requests, renewal terms, etc."
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-sky-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600 resize-none"
          ></textarea>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-800">
        <button
          onclick={() => { financeStore.isTenantModalOpen = false; financeStore.editingTenant = null; }}
          class="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition"
        >
          Cancel
        </button>
        <button
          onclick={submitTenant}
          disabled={!formName.trim() || formPropertyId === '' || formRent === '' || Number(formRent) <= 0}
          class="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-semibold text-xs transition"
        >
          {financeStore.editingTenant ? 'Save Changes' : 'Create Tenant'}
        </button>
      </div>
    </div>
  </div>
{/if}
