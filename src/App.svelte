<script lang="ts">
  import { onMount } from 'svelte';
  import { financeStore } from './lib/stores/financeStore.svelte';
  import Sidebar from './lib/components/Sidebar.svelte';
  import CommandCenter from './lib/components/CommandCenter.svelte';
  import CheckbookRegister from './lib/components/CheckbookRegister.svelte';
  import QuickAddModal from './lib/components/QuickAddModal.svelte';
  import ConnectionModal from './lib/components/ConnectionModal.svelte';
  import StatementImportModal from './lib/components/StatementImportModal.svelte';
  import BudgetHub from './lib/components/BudgetHub.svelte';
  import RecurringBillsHub from './lib/components/RecurringBillsHub.svelte';
  import CashFlowHub from './lib/components/CashFlowHub.svelte';

  onMount(() => {
    financeStore.refreshAll();
  });
</script>

<main class="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans antialiased">
  <!-- Left Sidebar Navigation & Accounts -->
  <Sidebar />

  <!-- Main Content Area -->
  <section class="flex-1 flex flex-col h-screen overflow-hidden">
    {#if financeStore.activeView === 'budgets'}
      <BudgetHub />
    {:else if financeStore.activeView === 'bills'}
      <RecurringBillsHub />
    {:else if financeStore.activeView === 'cashflow'}
      <CashFlowHub />
    {:else if financeStore.selectedAccountId === null || financeStore.activeView === 'command_center'}
      <CommandCenter />
    {:else}
      <CheckbookRegister />
    {/if}
  </section>

  <!-- Global Modals -->
  <QuickAddModal />
  <ConnectionModal />
  <StatementImportModal />
</main>
