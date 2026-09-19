<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { AccountType, MonetaAccount } from '../types/moneta';
  import {
    X,
    Building2,
    Wallet,
    CreditCard,
    PiggyBank,
    TrendingUp,
    Home,
    AlertCircle,
    Check,
    Trash2
  } from '@lucide/svelte';

  let name = $state('');
  let accountType = $state<AccountType>('checking');
  let institutionName = $state('');
  let accountNumberMask = $state('');
  let currencyCode = $state('SGD');
  let startingBalance = $state('');
  let creditLimit = $state('');
  let interestRate = $state('');
  let monthlyPayment = $state('');
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let showDeleteConfirm = $state(false);

  let isEditing = $derived(Boolean(financeStore.editingAccount));

  $effect(() => {
    if (financeStore.isAddAccountOpen) {
      errorMessage = null;
      showDeleteConfirm = false;
      if (financeStore.editingAccount) {
        const acc = financeStore.editingAccount;
        name = acc.name;
        accountType = acc.account_type;
        institutionName = acc.institution_name || '';
        accountNumberMask = acc.account_number_mask || '';
        currencyCode = acc.currency_code || 'SGD';
        startingBalance = String(acc.current_balance || 0);
        creditLimit = acc.credit_limit !== undefined ? String(acc.credit_limit) : '';
        interestRate = acc.interest_rate !== undefined ? String(acc.interest_rate) : '';
        monthlyPayment = acc.monthly_payment !== undefined ? String(acc.monthly_payment) : '';
      } else {
        name = '';
        accountType = 'checking';
        institutionName = '';
        accountNumberMask = '';
        currencyCode = 'SGD';
        startingBalance = '0.00';
        creditLimit = '';
        interestRate = '';
        monthlyPayment = '';
      }
    }
  });

  const closeModal = () => {
    financeStore.isAddAccountOpen = false;
    financeStore.editingAccount = null;
  };

  const handleSave = async (e: Event) => {
    e.preventDefault();
    if (!name.trim()) {
      errorMessage = 'Please enter an account name.';
      return;
    }

    isSubmitting = true;
    errorMessage = null;

    try {
      const bal = parseFloat(startingBalance) || 0.0;
      const limit = creditLimit ? parseFloat(creditLimit) : undefined;
      const rate = interestRate ? parseFloat(interestRate) : undefined;
      const pmt = monthlyPayment ? parseFloat(monthlyPayment) : undefined;

      const payload: Partial<MonetaAccount> = {
        name: name.trim(),
        account_type: accountType,
        institution_name: institutionName.trim() || undefined,
        account_number_mask: accountNumberMask.trim() || undefined,
        currency_code: currencyCode,
        current_balance: bal,
        credit_limit: limit,
        interest_rate: rate,
        monthly_payment: pmt,
        active: true,
      };

      if (financeStore.editingAccount) {
        payload.id = financeStore.editingAccount.id;
      }

      await financeStore.saveAccount(payload);
      closeModal();
    } catch (err: any) {
      errorMessage = err?.message || 'Failed to save account.';
    } finally {
      isSubmitting = false;
    }
  };

  const handleDelete = async () => {
    if (!financeStore.editingAccount) return;
    isSubmitting = true;
    try {
      await financeStore.deleteAccount(financeStore.editingAccount.id);
      closeModal();
    } catch (err: any) {
      errorMessage = err?.message || 'Failed to delete account.';
    } finally {
      isSubmitting = false;
    }
  };

  const isLiability = $derived(
    ['credit_card', 'credit', 'loan', 'mortgage', 'loc'].includes(accountType)
  );
</script>

{#if financeStore.isAddAccountOpen}
  <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            {#if accountType === 'credit_card'}
              <CreditCard class="w-4 h-4" />
            {:else if accountType === 'savings'}
              <PiggyBank class="w-4 h-4" />
            {:else if accountType === 'brokerage' || accountType === 'retirement'}
              <TrendingUp class="w-4 h-4" />
            {:else if accountType === 'mortgage' || accountType === 'asset'}
              <Home class="w-4 h-4" />
            {:else}
              <Wallet class="w-4 h-4" />
            {/if}
          </div>
          <div>
            <h3 class="font-bold text-sm text-zinc-100">
              {isEditing ? 'Edit Account' : 'Add Financial Account'}
            </h3>
            <p class="text-[11px] text-zinc-400">
              {isEditing ? 'Update your account settings' : 'Track bank, card, investment, or debt in local SQLite'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onclick={closeModal}
          class="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Form -->
      <form onsubmit={handleSave} class="p-5 space-y-4">
        {#if errorMessage}
          <div class="p-3 rounded-lg bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        {/if}

        <!-- Account Name -->
        <div>
          <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="acc-name">
            Account Name *
          </label>
          <input
            id="acc-name"
            type="text"
            required
            placeholder="e.g. DBS Multiplier, UOB One, OCBC 365"
            bind:value={name}
            class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500 transition-colors"
          />
        </div>

        <!-- Account Type & Currency Grid -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="acc-type">
              Account Type
            </label>
            <select
              id="acc-type"
              bind:value={accountType}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500"
            >
              <optgroup label="Banking & Cash">
                <option value="checking">Checking / Everyday</option>
                <option value="savings">Savings Account</option>
                <option value="cash">Cash Wallet</option>
              </optgroup>
              <optgroup label="Credit & Debt">
                <option value="credit_card">Credit Card</option>
                <option value="loan">Personal / Auto Loan</option>
                <option value="mortgage">Home Mortgage</option>
                <option value="loc">Line of Credit</option>
              </optgroup>
              <optgroup label="Investments">
                <option value="brokerage">Brokerage / Stocks</option>
                <option value="retirement">Retirement Account</option>
                <option value="crypto">Cryptocurrency</option>
              </optgroup>
              <optgroup label="Tangibles & Other">
                <option value="asset">Physical Asset / Property</option>
                <option value="other">Other Account</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="acc-curr">
              Currency
            </label>
            <select
              id="acc-curr"
              bind:value={currencyCode}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500"
            >
              <option value="SGD">SGD - Singapore Dollar</option>
              <option value="USD">USD - US Dollar</option>
              <option value="MYR">MYR - Malaysian Ringgit</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
              <option value="AUD">AUD - Australian Dollar</option>
              <option value="HKD">HKD - Hong Kong Dollar</option>
              <option value="JPY">JPY - Japanese Yen</option>
              <option value="CAD">CAD - Canadian Dollar</option>
              <option value="CNY">CNY - Chinese Yuan</option>
            </select>
          </div>
        </div>

        <!-- Institution & Account Number Mask -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="acc-inst">
              Institution / Bank
            </label>
            <input
              id="acc-inst"
              type="text"
              placeholder="e.g. DBS, OCBC, UOB"
              bind:value={institutionName}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
            />
          </div>

          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="acc-mask">
              Account Mask
            </label>
            <input
              id="acc-mask"
              type="text"
              placeholder="e.g. •••• 4921"
              bind:value={accountNumberMask}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        <!-- Starting / Current Balance -->
        <div>
          <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="acc-bal">
            {isEditing ? 'Current Balance' : 'Starting Balance'} ({currencyCode})
          </label>
          <div class="relative">
            <input
              id="acc-bal"
              type="number"
              step="0.01"
              placeholder="0.00"
              bind:value={startingBalance}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono font-semibold text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
            />
          </div>
          {#if isLiability && !isEditing}
            <p class="text-[10px] text-zinc-500 mt-1">
              For credit cards and loans, enter negative amount if you carry a debt balance (e.g. -1250.00).
            </p>
          {/if}
        </div>

        <!-- Conditional fields: Credit Card Limit or Loan Rates -->
        {#if accountType === 'credit_card' || accountType === 'loc'}
          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="acc-limit">
              Credit Limit ({currencyCode})
            </label>
            <input
              id="acc-limit"
              type="number"
              step="100"
              placeholder="e.g. 10000"
              bind:value={creditLimit}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
            />
          </div>
        {:else if accountType === 'loan' || accountType === 'mortgage'}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="acc-rate">
                Annual Interest Rate (%)
              </label>
              <input
                id="acc-rate"
                type="number"
                step="0.01"
                placeholder="e.g. 3.75"
                bind:value={interestRate}
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
            <div>
              <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="acc-pmt">
                Monthly Payment ({currencyCode})
              </label>
              <input
                id="acc-pmt"
                type="number"
                step="1"
                placeholder="e.g. 1850"
                bind:value={monthlyPayment}
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        {/if}

        <!-- Footer Actions -->
        <div class="pt-3 border-t border-zinc-800 flex items-center justify-between">
          <div>
            {#if isEditing}
              {#if showDeleteConfirm}
                <button
                  type="button"
                  onclick={handleDelete}
                  disabled={isSubmitting}
                  class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                >
                  Confirm Delete
                </button>
              {:else}
                <button
                  type="button"
                  onclick={() => (showDeleteConfirm = true)}
                  class="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors cursor-pointer"
                  title="Delete Account"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              {/if}
            {/if}
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              onclick={closeModal}
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              class="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Check class="w-3.5 h-3.5" />
              <span>{isEditing ? 'Save Changes' : 'Create Account'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
{/if}
