<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import {
    X,
    Server,
    Key,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    Database,
    Download,
    ArrowRightLeft,
    Sparkles
  } from '@lucide/svelte';

  let mode = $state<'odoo' | 'sqlite' | 'mock'>(financeStore.config.mode);
  let serverUrl = $state(financeStore.config.serverUrl);
  let apiToken = $state(financeStore.config.apiToken);

  let testResult = $state<{ success: boolean; message: string; user?: string } | null>(null);
  let isTesting = $state(false);

  let isMigrating = $state(false);
  let migrationResult = $state<{ success: boolean; message: string } | null>(null);

  const runTest = async () => {
    isTesting = true;
    testResult = null;
    financeStore.config = { mode, serverUrl, apiToken };
    financeStore.updateAdapter();
    testResult = await financeStore.testCurrentConnection();
    isTesting = false;
  };

  const handleMigration = async () => {
    isMigrating = true;
    migrationResult = null;
    const res = await financeStore.migrateFromOdoo(serverUrl, apiToken);
    migrationResult = res;
    if (res.success) {
      mode = 'sqlite';
    }
    isMigrating = false;
  };

  const handleSave = (e: Event) => {
    e.preventDefault();
    financeStore.saveConfig({ mode, serverUrl, apiToken });
    financeStore.isSettingsOpen = false;
  };
</script>

{#if financeStore.isSettingsOpen}
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg overflow-hidden shadow-2xl">
      <!-- Header -->
      <div class="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Database class="w-4 h-4 text-emerald-400" />
          <h3 class="font-bold text-sm text-zinc-100">Database & Connection Settings</h3>
        </div>
        <button
          onclick={() => (financeStore.isSettingsOpen = false)}
          class="p-1 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Content -->
      <form onsubmit={handleSave} class="p-5 space-y-5">
        <!-- 3-Way Mode Switcher -->
        <div>
          <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1.5" for="conn-mode">
            Data Source Architecture
          </label>
          <div class="grid grid-cols-3 gap-1.5 p-1 bg-zinc-950 rounded-lg border border-zinc-800">
            <!-- Moneta Cloud -->
            <button
              type="button"
              onclick={() => (mode = 'odoo')}
              class="py-2 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all {mode === 'odoo' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
            >
              <Server class="w-3.5 h-3.5 text-emerald-400" />
              <span>Moneta Cloud</span>
            </button>

            <!-- Local SQLite -->
            <button
              type="button"
              onclick={() => (mode = 'sqlite')}
              class="py-2 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all {mode === 'sqlite' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
            >
              <Database class="w-3.5 h-3.5 text-sky-400" />
              <span>Local SQLite</span>
            </button>

            <!-- Demo Sandbox -->
            <button
              type="button"
              onclick={() => (mode = 'mock')}
              class="py-2 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all {mode === 'mock' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
            >
              <span class="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Demo Mock</span>
            </button>
          </div>
        </div>

        {#if mode === 'odoo'}
          <!-- Server URL -->
          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="conn-server-url">
              Moneta Cloud URL
            </label>
            <input
              id="conn-server-url"
              type="url"
              required
              placeholder="https://weeseng.dev8.ansis.com.sg"
              bind:value={serverUrl}
              class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
            />
            <p class="text-[11px] text-zinc-500 mt-1">
              Connects via <code class="text-zinc-400">/api/v1/mobile/*</code> REST controller.
            </p>
          </div>

          <!-- Bearer PAT Token -->
          <div>
            <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="conn-api-token">
              Personal Access Token (PAT)
            </label>
            <div class="relative">
              <Key class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                id="conn-api-token"
                type="password"
                placeholder="Enter your Moneta Cloud Bearer PAT"
                bind:value={apiToken}
                class="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <p class="text-[11px] text-zinc-500 mt-1">
              Generated in Moneta Cloud under User Preferences → API Keys (Scope: <code class="text-zinc-400">rpc</code>).
            </p>
          </div>

          <!-- Test Button & Status -->
          <div class="pt-2">
            <button
              type="button"
              onclick={runTest}
              disabled={isTesting}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw class="w-3.5 h-3.5 {isTesting ? 'animate-spin' : ''}" />
              <span>{isTesting ? 'Testing connection...' : 'Test Connection'}</span>
            </button>

            {#if testResult}
              <div class="mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 {testResult.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'}">
                {#if testResult.success}
                  <CheckCircle2 class="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Success! Authenticated as <strong>{testResult.user}</strong>.</span>
                {:else}
                  <AlertCircle class="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{testResult.message}</span>
                {/if}
              </div>
            {/if}
          </div>

        {:else if mode === 'sqlite'}
          <!-- SQLite Status & Backup Panel -->
          <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                <span class="text-xs font-bold text-zinc-200">Local SQLite Active</span>
              </div>
              <button
                type="button"
                onclick={() => financeStore.downloadSqliteBackup()}
                class="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/80 text-[11px] font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <Download class="w-3 h-3 text-sky-400" />
                <span>Export Backup (.sqlite)</span>
              </button>
            </div>
            <p class="text-[11px] text-zinc-400">
              All transactions, balances, and accounts are stored in your local SQLite database with microsecond query speed and 100% offline capability.
            </p>
          </div>

          <!-- 1-Click Migration from Moneta Cloud into SQLite -->
          <div class="p-4 rounded-xl bg-gradient-to-br from-zinc-950 to-zinc-900/60 border border-zinc-800 space-y-3">
            <div class="flex items-center gap-2">
              <ArrowRightLeft class="w-4 h-4 text-emerald-400" />
              <div class="text-xs font-bold text-zinc-200">Migrate Moneta Cloud into Local SQLite</div>
            </div>
            <p class="text-[11px] text-zinc-400">
              Transfer all your real accounts, categories, and transactions from Moneta Cloud directly into this local SQLite database.
            </p>

            <div class="grid grid-cols-2 gap-2 text-xs">
              <input
                type="url"
                placeholder="https://weeseng.dev8.ansis.com.sg"
                bind:value={serverUrl}
                class="px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="password"
                placeholder="Moneta Cloud Bearer PAT"
                bind:value={apiToken}
                class="px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onclick={handleMigration}
              disabled={isMigrating || !apiToken}
              class="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              <RefreshCw class="w-3.5 h-3.5 {isMigrating ? 'animate-spin' : ''}" />
              <span>{isMigrating ? 'Migrating Moneta Cloud records into SQLite...' : 'Start Migration to SQLite'}</span>
            </button>

            {#if migrationResult}
              <div class="p-2.5 rounded-lg text-xs flex items-center gap-2 {migrationResult.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'}">
                {#if migrationResult.success}
                  <CheckCircle2 class="w-4 h-4 text-emerald-400 flex-shrink-0" />
                {:else}
                  <AlertCircle class="w-4 h-4 text-rose-400 flex-shrink-0" />
                {/if}
                <span>{migrationResult.message}</span>
              </div>
            {/if}
          </div>

        {:else}
          <div class="p-4 rounded-lg bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-400 space-y-2">
            <div class="font-semibold text-zinc-200">Offline Demo Sandbox Active</div>
            <p>
              Pre-loaded with sample Singapore bank accounts (DBS, OCBC, CPF OA/SA/MA), credit cards, mortgages, and checkbook registers.
            </p>
          </div>
        {/if}

        <!-- Footer -->
        <div class="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onclick={() => (financeStore.isSettingsOpen = false)}
            class="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors"
          >
            Apply & Save
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
