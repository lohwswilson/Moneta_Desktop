<script lang="ts">
  import { onMount } from 'svelte';
  import { financeStore } from './lib/stores/financeStore.svelte';
  import Sidebar from './lib/components/Sidebar.svelte';
  import CommandCenter from './lib/components/CommandCenter.svelte';
  import CheckbookRegister from './lib/components/CheckbookRegister.svelte';
  import QuickAddModal from './lib/components/QuickAddModal.svelte';
  import ConnectionModal from './lib/components/ConnectionModal.svelte';

  onMount(() => {
    financeStore.refreshAll();
  });
</script>

<main class="flex h-screen w-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans antialiased">
  <!-- Left Sidebar Navigation & Accounts -->
  <Sidebar />

  <!-- Main Content Area -->
  <section class="flex-1 flex flex-col h-screen overflow-hidden">
    {#if financeStore.selectedAccountId === null}
      <CommandCenter />
    {:else}
      <CheckbookRegister />
    {/if}
  </section>

  <!-- Global Modals -->
  <QuickAddModal />
  <ConnectionModal />
</main>
