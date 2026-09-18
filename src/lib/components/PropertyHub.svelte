<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { PropertyAsset, AssetCategory, PropertyType } from '../types/moneta';
  import { computePortfolioEquity } from '../data/propertyMath';
  import {
    Building2,
    Plus,
    Pencil,
    Trash2,
    X,
    Landmark,
    Wallet,
    Percent,
    KeyRound,
    TrendingUp,
    CircleDollarSign,
    History,
    CalendarDays,
    Banknote,
    Hammer,
    Info,
  } from '@lucide/svelte';

  const ASSET_CATEGORIES: AssetCategory[] = ['real_estate', 'vehicle', 'jewelry', 'antiques', 'other'];
  const PROPERTY_TYPES: PropertyType[] = [
    'primary_residence',
    'vacation_home',
    'rental_property',
    'commercial',
    'land',
    'automobile',
    'motorcycle',
    'luxury_watch',
    'fine_jewelry',
    'antique_furniture',
    'fine_art',
    'collectible',
    'other',
  ];

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

  const formatLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // LTV bar colour: emerald under 60%, amber 60–80%, rose above 80%.
  const ltvBarClass = (ltv: number) => (ltv < 60 ? 'bg-emerald-500' : ltv <= 80 ? 'bg-amber-500' : 'bg-rose-500');
  const ltvTextClass = (ltv: number) => (ltv < 60 ? 'text-emerald-300' : ltv <= 80 ? 'text-amber-300' : 'text-rose-300');

  // Portfolio aggregates come from the shared math module — never summed inline.
  let portfolio = $derived.by(() => computePortfolioEquity(financeStore.properties));

  // Accounts that can back a mortgage / loan.
  let mortgageAccounts = $derived.by(() =>
    financeStore.accounts.filter((a) => a.account_type === 'mortgage' || a.account_type === 'loan')
  );

  // --- Create / edit property modal form state ---
  let formName = $state<string>('');
  let formCategory = $state<AssetCategory>('real_estate');
  let formPropertyType = $state<PropertyType>('primary_residence');
  let formPurchaseDate = $state<string>(new Date().toISOString().split('T')[0]);
  let formPurchasePrice = $state<number | ''>('');
  let formMarketValue = $state<number | ''>('');
  let formMortgageAccountId = $state<string | number>('');
  let formNotes = $state<string>('');
  let formRentalIncome = $state<number | ''>('');
  let formPropertyTax = $state<number | ''>('');
  let formInsurance = $state<number | ''>('');
  let formHoa = $state<number | ''>('');

  // --- Valuation modal form state ---
  let formValuationDate = $state<string>(new Date().toISOString().split('T')[0]);
  let formAppraisedValue = $state<number | ''>('');
  let formAppraiser = $state<string>('');
  let formValuationNotes = $state<string>('');

  // Valuations of the property currently being valued, newest first.
  let sortedValuations = $derived.by(() => {
    const p = financeStore.valuingProperty;
    if (!p || !p.valuation_history || p.valuation_history.length === 0) return [];
    return [...p.valuation_history].sort((a, b) => b.valuation_date.localeCompare(a.valuation_date));
  });

  function openCreateModal() {
    financeStore.editingProperty = null;
    formName = '';
    formCategory = 'real_estate';
    formPropertyType = 'primary_residence';
    formPurchaseDate = new Date().toISOString().split('T')[0];
    formPurchasePrice = '';
    formMarketValue = '';
    formMortgageAccountId = '';
    formNotes = '';
    formRentalIncome = '';
    formPropertyTax = '';
    formInsurance = '';
    formHoa = '';
    financeStore.isPropertyModalOpen = true;
  }

  function openEditModal(p: PropertyAsset) {
    financeStore.editingProperty = p;
    formName = p.name;
    formCategory = p.asset_category;
    formPropertyType = p.property_type;
    formPurchaseDate = p.purchase_date || new Date().toISOString().split('T')[0];
    formPurchasePrice = p.purchase_price ?? '';
    formMarketValue = p.current_market_value;
    formMortgageAccountId = p.mortgage_account_id ?? '';
    formNotes = p.notes || '';
    formRentalIncome = p.monthly_rental_income ?? '';
    formPropertyTax = p.monthly_property_tax ?? '';
    formInsurance = p.monthly_insurance ?? '';
    formHoa = p.monthly_hoa_maintenance ?? '';
    financeStore.isPropertyModalOpen = true;
  }

  async function submitProperty() {
    if (!formName.trim() || formMarketValue === '' || Number(formMarketValue) <= 0) return;

    const acc = financeStore.accounts.find((a) => String(a.id) === String(formMortgageAccountId));

    await financeStore.saveProperty({
      name: formName.trim(),
      asset_category: formCategory,
      property_type: formPropertyType,
      purchase_date: formPurchaseDate || undefined,
      purchase_price: formPurchasePrice === '' ? undefined : Number(formPurchasePrice),
      current_market_value: Number(formMarketValue),
      mortgage_account_id: formMortgageAccountId === '' ? undefined : formMortgageAccountId,
      mortgage_account_name: acc?.name,
      notes: formNotes.trim() || undefined,
      monthly_rental_income: formRentalIncome === '' ? undefined : Number(formRentalIncome),
      monthly_property_tax: formPropertyTax === '' ? undefined : Number(formPropertyTax),
      monthly_insurance: formInsurance === '' ? undefined : Number(formInsurance),
      monthly_hoa_maintenance: formHoa === '' ? undefined : Number(formHoa),
    });

    financeStore.isPropertyModalOpen = false;
    financeStore.editingProperty = null;
  }

  async function confirmDelete(p: PropertyAsset) {
    if (confirm(`Delete the property "${p.name}"? This cannot be undone.`)) {
      await financeStore.deleteProperty(p.id);
    }
  }

  function openValuationModal(p: PropertyAsset) {
    financeStore.valuingProperty = p;
    formValuationDate = new Date().toISOString().split('T')[0];
    formAppraisedValue = '';
    formAppraiser = '';
    formValuationNotes = '';
    financeStore.isValuationModalOpen = true;
  }

  function closeValuationModal() {
    financeStore.isValuationModalOpen = false;
    financeStore.valuingProperty = null;
  }

  async function submitValuation() {
    const p = financeStore.valuingProperty;
    if (!p || formAppraisedValue === '' || Number(formAppraisedValue) <= 0) return;

    await financeStore.addPropertyValuation(p.id, {
      valuation_date: formValuationDate,
      appraised_value: Number(formAppraisedValue),
      appraiser: formAppraiser.trim() || undefined,
      notes: formValuationNotes.trim() || undefined,
    });

    closeValuationModal();
  }
</script>

<div class="flex-1 flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden">
  <!-- Header -->
  <header class="px-8 py-5 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between shrink-0">
    <div class="flex items-center gap-3.5">
      <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm">
        <Building2 class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-xl font-bold text-zinc-50">Properties &amp; Real Estate</h1>
        <p class="text-xs text-zinc-500 mt-1">
          Track equity, mortgage exposure and rental performance across your property portfolio
        </p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <button
        onclick={openCreateModal}
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition shadow-sm hover:shadow-emerald-500/10"
      >
        <Plus class="w-4 h-4" />
        New Property
      </button>
    </div>
  </header>

  <div class="flex-1 overflow-y-auto px-8 py-6 space-y-6">
    {#if financeStore.properties.length === 0}
      <!-- Empty state -->
      <div class="flex flex-col items-center justify-center py-24 text-center">
        <div class="w-14 h-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <Building2 class="w-6 h-6 text-zinc-600" />
        </div>
        <h2 class="text-sm font-semibold text-zinc-300">No properties yet</h2>
        <p class="text-xs text-zinc-500 mt-1.5 max-w-sm">
          Add a home, a rental unit or any other tangible asset to track its market value, mortgage
          debt and the equity you actually own.
        </p>
        <button
          onclick={openCreateModal}
          class="mt-5 flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs transition"
        >
          <Plus class="w-4 h-4" />
          Add your first property
        </button>
      </div>
    {:else}
      <!-- Summary strip -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Total Market Value</span>
            <Landmark class="w-4 h-4 text-sky-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-zinc-100">{formatCurrency(portfolio.total_market_value)}</div>
          <div class="text-[11px] text-zinc-500 mt-1">
            Across {financeStore.properties.length} propert{financeStore.properties.length === 1 ? 'y' : 'ies'}
          </div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Total Mortgage Debt</span>
            <Wallet class="w-4 h-4 text-rose-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-rose-300">{formatCurrency(portfolio.total_mortgage_balance)}</div>
          <div class="text-[11px] text-zinc-500 mt-1">Outstanding on linked mortgage / loan accounts</div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Total Equity</span>
            <CircleDollarSign class="w-4 h-4 text-emerald-400" />
          </div>
          <div class="text-2xl font-bold font-mono text-emerald-300">{formatCurrency(portfolio.total_equity)}</div>
          <div class="text-[11px] text-zinc-500 mt-1">Market value minus debt, floored at zero per property</div>
        </div>

        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Blended LTV</span>
            <Percent class="w-4 h-4 text-amber-400" />
          </div>
          <div class="text-2xl font-bold font-mono {ltvTextClass(portfolio.blended_ltv)}">
            {portfolio.blended_ltv.toFixed(1)}%
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">Total debt against total market value</div>
        </div>
      </div>

      <!-- Property cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {#each financeStore.properties as p (p.id)}
          <div
            role="button"
            tabindex="0"
            onclick={() => openValuationModal(p)}
            onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openValuationModal(p); } }}
            class="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800/80 flex flex-col gap-4 cursor-pointer hover:border-zinc-700/80 hover:bg-zinc-900/90 transition"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-sm font-semibold text-zinc-100 truncate" title={p.name}>{p.name}</h3>
                  <span class="shrink-0 text-[10px] px-1.5 py-0.5 rounded border font-medium bg-zinc-800/80 text-zinc-300 border-zinc-700/60">
                    {formatLabel(p.asset_category)}
                  </span>
                </div>
                <div class="text-[11px] text-zinc-500 mt-1 flex items-center gap-1.5">
                  <span class="capitalize">{formatLabel(p.property_type)}</span>
                  {#if p.purchase_date}
                    <span>· purchased {p.purchase_date}</span>
                  {/if}
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button
                  onclick={(e) => { e.stopPropagation(); openEditModal(p); }}
                  class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
                  title="Edit property"
                >
                  <Pencil class="w-3.5 h-3.5" />
                </button>
                <button
                  onclick={(e) => { e.stopPropagation(); confirmDelete(p); }}
                  class="p-1.5 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 transition"
                  title="Delete property"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Market value & mortgage -->
            <div class="flex items-baseline justify-between">
              <span class="text-lg font-bold font-mono text-zinc-100">{formatCurrency(p.current_market_value)}</span>
              <span class="text-[11px] text-zinc-500 flex items-center gap-1 truncate ml-3" title={p.mortgage_account_name}>
                <Wallet class="w-3 h-3 shrink-0" />
                {p.mortgage_account_name || 'No mortgage linked'}
              </span>
            </div>

            <!-- Equity / LTV pair with progress bar -->
            <div>
              <div class="flex items-baseline justify-between mb-1.5">
                <span class="text-[11px] text-zinc-400 font-medium">
                  Equity <span class="text-emerald-300 font-mono font-semibold ml-1">{formatCurrency(p.equity_value)}</span>
                </span>
                <span class="text-[11px] font-mono font-semibold {ltvTextClass(p.loan_to_value_ratio)}">
                  {p.loan_to_value_ratio.toFixed(1)}% LTV
                </span>
              </div>
              <div class="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500 {ltvBarClass(p.loan_to_value_ratio)}"
                  style="width: {Math.min(p.loan_to_value_ratio, 100)}%"
                ></div>
              </div>
            </div>

            <!-- Rental line when there are tenants -->
            {#if p.tenant_count > 0}
              <div class="pt-3 border-t border-zinc-800/70">
                <div class="flex items-center gap-1.5 text-[11px] text-zinc-400 mb-2">
                  <KeyRound class="w-3.5 h-3.5 text-sky-400" />
                  <span class="font-semibold text-zinc-300">
                    Rental line · {p.tenant_count} tenant{p.tenant_count === 1 ? '' : 's'}
                  </span>
                  <span class="text-zinc-600">·</span>
                  <span class="font-mono">{p.occupancy_rate_pct.toFixed(0)}% occupied</span>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px]">
                  <div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
                    <span class="text-zinc-500 flex items-center gap-1">
                      <Banknote class="w-3 h-3" /> Cashflow / mo
                    </span>
                    <span class="font-mono font-semibold {(p.net_monthly_cashflow || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}">
                      {formatCurrencyExact(p.net_monthly_cashflow)}
                    </span>
                  </div>
                  <div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-950/60 border border-zinc-800/70">
                    <span class="text-zinc-500 flex items-center gap-1">
                      <TrendingUp class="w-3 h-3" /> Gross yield
                    </span>
                    <span class="font-mono font-semibold text-zinc-200">{p.gross_rental_yield_pct.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            {/if}

            <!-- Valuation history hint -->
            <div class="flex items-center justify-between pt-2 text-[11px] text-zinc-500 border-t border-zinc-800/70">
              <span class="flex items-center gap-1.5">
                <History class="w-3.5 h-3.5 text-zinc-600" />
                {(p.valuation_history || []).length} valuation{(p.valuation_history || []).length === 1 ? '' : 's'}
              </span>
              <span class="text-sky-400/80 font-medium">Click to view history &amp; record valuation</span>
            </div>
          </div>
        {/each}
      </div>

      <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-zinc-900/50 border border-zinc-800/60">
        <Info class="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
        <p class="text-[11px] text-zinc-500 leading-relaxed">
          Equity, LTV and the rental metrics are computed by the shared property math, mirroring the
          Odoo property module. Equity is clamped at zero by that math — an underwater property reads
          as &dollar;0 equity, with the debt still visible in the LTV and the linked account.
        </p>
      </div>
    {/if}
  </div>
</div>

<!-- Create / Edit Property Modal -->
{#if financeStore.isPropertyModalOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Building2 class="w-4 h-4 text-emerald-400" />
          {financeStore.editingProperty ? 'Edit Property' : 'New Property'}
        </h2>
        <button
          onclick={() => { financeStore.isPropertyModalOpen = false; financeStore.editingProperty = null; }}
          class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="px-6 py-5 space-y-4">
        <div>
          <label for="property-name" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Property Name</label>
          <input
            id="property-name"
            type="text"
            bind:value={formName}
            placeholder="e.g. 21 Tampines Street 34"
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
          />
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="property-category" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Asset Category</label>
            <select
              id="property-category"
              bind:value={formCategory}
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100"
            >
              {#each ASSET_CATEGORIES as cat (cat)}
                <option value={cat}>{formatLabel(cat)}</option>
              {/each}
            </select>
          </div>
          <div>
            <label for="property-type" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Property Type</label>
            <select
              id="property-type"
              bind:value={formPropertyType}
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100"
            >
              {#each PROPERTY_TYPES as ptype (ptype)}
                <option value={ptype}>{formatLabel(ptype)}</option>
              {/each}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="property-purchase-date" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Purchase Date</label>
            <input
              id="property-purchase-date"
              type="date"
              bind:value={formPurchaseDate}
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100"
            />
          </div>
          <div>
            <label for="property-purchase-price" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Purchase Price</label>
            <input
              id="property-purchase-price"
              type="number"
              min="0"
              step="0.01"
              bind:value={formPurchasePrice}
              placeholder="0.00"
              class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div>
          <label for="property-market-value" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Current Market Value</label>
          <input
            id="property-market-value"
            type="number"
            min="0"
            step="0.01"
            bind:value={formMarketValue}
            placeholder="0.00"
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
          />
        </div>

        <div>
          <label for="property-mortgage-account" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">
            Linked Mortgage / Loan Account
          </label>
          <select
            id="property-mortgage-account"
            bind:value={formMortgageAccountId}
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100"
          >
            <option value="">No mortgage linked</option>
            {#each mortgageAccounts as acc (acc.id)}
              <option value={acc.id}>{acc.name} ({acc.account_type})</option>
            {/each}
          </select>
        </div>

        <div class="pt-2 border-t border-zinc-800/70">
          <div class="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 mb-3">
            <KeyRound class="w-3.5 h-3.5 text-sky-400" />
            Rental Costs <span class="text-zinc-600 font-normal">(monthly, used to derive cashflow &amp; yield)</span>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="property-rental-income" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Monthly Rental Income</label>
              <input
                id="property-rental-income"
                type="number"
                min="0"
                step="0.01"
                bind:value={formRentalIncome}
                placeholder="0.00"
                class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label for="property-property-tax" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Monthly Property Tax</label>
              <input
                id="property-property-tax"
                type="number"
                min="0"
                step="0.01"
                bind:value={formPropertyTax}
                placeholder="0.00"
                class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label for="property-insurance" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Monthly Insurance</label>
              <input
                id="property-insurance"
                type="number"
                min="0"
                step="0.01"
                bind:value={formInsurance}
                placeholder="0.00"
                class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label for="property-hoa" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Monthly HOA / Maintenance</label>
              <input
                id="property-hoa"
                type="number"
                min="0"
                step="0.01"
                bind:value={formHoa}
                placeholder="0.00"
                class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
              />
            </div>
          </div>
        </div>

        <div>
          <label for="property-notes" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Notes</label>
          <textarea
            id="property-notes"
            bind:value={formNotes}
            rows="2"
            placeholder="Freehold / leasehold, tenure, agent, etc."
            class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600 resize-none"
          ></textarea>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-800">
        <button
          onclick={() => { financeStore.isPropertyModalOpen = false; financeStore.editingProperty = null; }}
          class="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition"
        >
          Cancel
        </button>
        <button
          onclick={submitProperty}
          disabled={!formName.trim() || formMarketValue === '' || Number(formMarketValue) <= 0}
          class="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-semibold text-xs transition"
        >
          {financeStore.editingProperty ? 'Save Changes' : 'Create Property'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Valuation History Modal -->
{#if financeStore.isValuationModalOpen && financeStore.valuingProperty}
  {@const property = financeStore.valuingProperty}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
    <div class="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2 min-w-0">
          <History class="w-4 h-4 text-sky-400 shrink-0" />
          <span class="truncate">Valuation History — {property.name}</span>
        </h2>
        <button onclick={closeValuationModal} class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition shrink-0">
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="px-6 py-5 space-y-5">
        <!-- History list, newest first -->
        <div>
          <div class="text-[11px] font-semibold text-zinc-400 mb-2 flex items-center gap-1.5">
            <CalendarDays class="w-3.5 h-3.5" />
            {sortedValuations.length === 0 ? 'No appraisals recorded yet' : `${sortedValuations.length} appraisal${sortedValuations.length === 1 ? '' : 's'} (newest first)`}
          </div>
          {#if sortedValuations.length === 0}
            <div class="px-3 py-4 rounded-lg bg-zinc-950/60 border border-zinc-800 text-center text-[11px] text-zinc-500">
              Record the first appraisal below — it becomes the property's current market value.
            </div>
          {:else}
            <div class="space-y-2">
              {#each sortedValuations as v (v.id)}
                <div class="flex items-start justify-between gap-3 px-3.5 py-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-[11px] font-mono text-zinc-300">{v.valuation_date}</span>
                      {#if v.appraiser}
                        <span class="text-[10px] text-zinc-500 truncate">by {v.appraiser}</span>
                      {/if}
                    </div>
                    {#if v.notes}
                      <p class="text-[11px] text-zinc-500 mt-1 leading-relaxed">{v.notes}</p>
                    {/if}
                  </div>
                  <span class="text-sm font-bold font-mono text-emerald-300 shrink-0">{formatCurrency(v.appraised_value)}</span>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Record valuation form -->
        <div class="pt-4 border-t border-zinc-800">
          <div class="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300 mb-3">
            <Hammer class="w-3.5 h-3.5 text-amber-400" />
            Record Valuation
          </div>
          <form onsubmit={(e) => { e.preventDefault(); submitValuation(); }} class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="valuation-date" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Valuation Date</label>
                <input
                  id="valuation-date"
                  type="date"
                  bind:value={formValuationDate}
                  class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100"
                />
              </div>
              <div>
                <label for="valuation-value" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Appraised Value</label>
                <input
                  id="valuation-value"
                  type="number"
                  min="0"
                  step="0.01"
                  bind:value={formAppraisedValue}
                  placeholder="0.00"
                  class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 font-mono placeholder:text-zinc-600"
                />
              </div>
            </div>
            <div>
              <label for="valuation-appraiser" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Appraiser</label>
              <input
                id="valuation-appraiser"
                type="text"
                bind:value={formAppraiser}
                placeholder="e.g. Colliers International"
                class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label for="valuation-notes" class="block text-[11px] font-semibold text-zinc-400 mb-1.5">Notes</label>
              <textarea
                id="valuation-notes"
                bind:value={formValuationNotes}
                rows="2"
                placeholder="Basis of appraisal, comparable sales, etc."
                class="w-full px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800 focus:border-emerald-600 focus:outline-none text-sm text-zinc-100 placeholder:text-zinc-600 resize-none"
              ></textarea>
            </div>
            <div class="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onclick={closeValuationModal}
                class="px-4 py-2 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-xs font-semibold text-zinc-300 transition"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={formAppraisedValue === '' || Number(formAppraisedValue) <= 0}
                class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-zinc-950 font-semibold text-xs transition"
              >
                <Hammer class="w-3.5 h-3.5" />
                Record Valuation
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
{/if}
