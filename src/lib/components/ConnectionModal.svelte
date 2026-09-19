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
    UploadCloud,
    ArrowRightLeft,
    HardDrive,
    ShieldCheck,
    RotateCcw,
    Layers,
    FileCheck2,
    Trash2
  } from '@lucide/svelte';

  let activeTab = $state<'database' | 'cloud'>('database');

  let dataSource = $state<'local' | 'sandbox'>(financeStore.config.dataSource);
  let serverUrl = $state(financeStore.config.serverUrl);
  let apiToken = $state(financeStore.config.apiToken);

  let dbStats = $state<{
    sizeBytes: number;
    tables: { name: string; rowCount: number }[];
    totalRows: number;
  } | null>(null);

  let restoreFile = $state<File | null>(null);
  let isRestoring = $state(false);
  let restoreResult = $state<{ success: boolean; message: string; counts?: Record<string, number> } | null>(null);

  let isResetting = $state(false);
  let resetResult = $state<{ success: boolean; message: string } | null>(null);
  let showResetConfirm = $state(false);

  let testResult = $state<{ success: boolean; message: string; user?: string } | null>(null);
  let isTesting = $state(false);

  let isMigrating = $state(false);
  let migrationResult = $state<{ success: boolean; message: string } | null>(null);

  let fileInputRef = $state<HTMLInputElement | null>(null);

  // Load database stats when modal opens
  $effect(() => {
    if (financeStore.isSettingsOpen) {
      loadDbStats();
      restoreFile = null;
      restoreResult = null;
      showResetConfirm = false;
      resetResult = null;
    }
  });

  const loadDbStats = async () => {
    try {
      dbStats = await financeStore.getDatabaseStats();
    } catch (e) {
      console.warn('Could not load database stats:', e);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      restoreFile = target.files[0];
      restoreResult = null;
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) return;
    isRestoring = true;
    restoreResult = null;
    try {
      const res = await financeStore.restoreSqliteBackup(restoreFile);
      restoreResult = res;
      if (res.success) {
        await loadDbStats();
        restoreFile = null;
      }
    } catch (err: any) {
      restoreResult = {
        success: false,
        message: err?.message || 'Restore failed.',
      };
    } finally {
      isRestoring = false;
    }
  };

  const handleReset = async () => {
    isResetting = true;
    resetResult = null;
    try {
      const res = await financeStore.resetLocalDatabase();
      resetResult = res;
      showResetConfirm = false;
      await loadDbStats();
    } catch (err: any) {
      resetResult = {
        success: false,
        message: err?.message || 'Reset failed.',
      };
    } finally {
      isResetting = false;
    }
  };

  const runTest = async () => {
    isTesting = true;
    testResult = null;
    financeStore.config = { dataSource, serverUrl, apiToken };
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
      dataSource = 'local';
      await loadDbStats();
    }
    isMigrating = false;
  };

  const handleSave = (e: Event) => {
    e.preventDefault();
    financeStore.saveConfig({ dataSource, serverUrl, apiToken });
    financeStore.isSettingsOpen = false;
  };
</script>

{#if financeStore.isSettingsOpen}
  <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
      <!-- Modal Header -->
      <div class="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Database class="w-4 h-4" />
          </div>
          <div>
            <h3 class="font-bold text-sm text-zinc-100">Database & Backup Settings</h3>
            <p class="text-[11px] text-zinc-400">Local SQLite storage, backup, restore, and cloud sync</p>
          </div>
        </div>
        <button
          onclick={() => (financeStore.isSettingsOpen = false)}
          class="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Tab Switcher -->
      <div class="flex border-b border-zinc-800 bg-zinc-950 px-5 pt-2">
        <button
          type="button"
          onclick={() => (activeTab = 'database')}
          class="pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer {activeTab === 'database' ? 'border-sky-400 text-sky-300' : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <HardDrive class="w-3.5 h-3.5" />
          <span>Local SQLite Database & Backup</span>
        </button>
        <button
          type="button"
          onclick={() => (activeTab = 'cloud')}
          class="pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer {activeTab === 'cloud' ? 'border-emerald-400 text-emerald-300' : 'border-transparent text-zinc-400 hover:text-zinc-200'}"
        >
          <Server class="w-3.5 h-3.5" />
          <span>Moneta Cloud (Optional)</span>
        </button>
      </div>

      <!-- Content Area -->
      <div class="p-5 max-h-[75vh] overflow-y-auto space-y-5">
        {#if activeTab === 'database'}
          <!-- Mode Switcher: My Ledger vs Demo Sandbox -->
          <div>
            <span class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1.5">
              Active Environment
            </span>
            <div class="grid grid-cols-2 gap-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
              <button
                type="button"
                onclick={() => (dataSource = 'local')}
                class="py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer {dataSource === 'local' ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'}"
              >
                <Database class="w-3.5 h-3.5 text-sky-400" />
                <span>My Real Ledger</span>
              </button>
              <button
                type="button"
                onclick={() => (dataSource = 'sandbox')}
                class="py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer {dataSource === 'sandbox' ? 'bg-zinc-800 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'}"
              >
                <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>Demo Sandbox</span>
              </button>
            </div>
            <p class="text-[11px] text-zinc-500 mt-1.5">
              {dataSource === 'local' ? 'Your financial records are stored securely in local SQLite with microsecond queries and 100% offline capability.' : 'Sandbox mode with pre-loaded Singapore mock data. Real changes will not be saved.'}
            </p>
          </div>

          <!-- Local Database Health & Metrics Card -->
          <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-xs shadow-emerald-500/50"></span>
                <span class="text-xs font-bold text-zinc-200">SQLite 3 WASM Active</span>
              </div>
              {#if dbStats}
                <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-sky-400">
                  {formatBytes(dbStats.sizeBytes)} ({dbStats.totalRows} total rows)
                </span>
              {/if}
            </div>

            <!-- Ledger Record Counts Grid -->
            <div class="grid grid-cols-4 gap-2 pt-1 text-center">
              <div class="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <div class="text-xs font-bold font-mono text-zinc-100">{financeStore.accounts.length}</div>
                <div class="text-[10px] text-zinc-500 uppercase tracking-wider">Accounts</div>
              </div>
              <div class="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <div class="text-xs font-bold font-mono text-zinc-100">{financeStore.transactions.length}</div>
                <div class="text-[10px] text-zinc-500 uppercase tracking-wider">Txns</div>
              </div>
              <div class="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <div class="text-xs font-bold font-mono text-zinc-100">{financeStore.budgets.length}</div>
                <div class="text-[10px] text-zinc-500 uppercase tracking-wider">Envelopes</div>
              </div>
              <div class="p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80">
                <div class="text-xs font-bold font-mono text-zinc-100">{financeStore.properties.length}</div>
                <div class="text-[10px] text-zinc-500 uppercase tracking-wider">Properties</div>
              </div>
            </div>
          </div>

          <!-- Backup & Restore Actions Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- Backup Card -->
            <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-3">
              <div>
                <div class="flex items-center gap-2 text-xs font-bold text-zinc-200">
                  <Download class="w-4 h-4 text-sky-400" />
                  <span>Export Database Backup</span>
                </div>
                <p class="text-[11px] text-zinc-400 mt-1">
                  Download a complete binary <code class="text-sky-300">.sqlite</code> snapshot of all accounts, transactions, splits, budgets, and rules.
                </p>
              </div>

              <button
                type="button"
                onclick={() => financeStore.downloadSqliteBackup()}
                class="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <Download class="w-3.5 h-3.5" />
                <span>Download .sqlite Backup</span>
              </button>
            </div>

            <!-- Restore Card -->
            <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-between space-y-3">
              <div>
                <div class="flex items-center gap-2 text-xs font-bold text-zinc-200">
                  <UploadCloud class="w-4 h-4 text-emerald-400" />
                  <span>Restore from Backup</span>
                </div>
                <p class="text-[11px] text-zinc-400 mt-1">
                  Upload an existing <code class="text-emerald-300">.sqlite</code> backup file to replace and restore your local ledger.
                </p>
              </div>

              <!-- Hidden file input -->
              <input
                bind:this={fileInputRef}
                type="file"
                accept=".sqlite,.db,.sqlite3"
                onchange={handleFileSelect}
                class="hidden"
              />

              {#if !restoreFile}
                <button
                  type="button"
                  onclick={() => fileInputRef?.click()}
                  class="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileCheck2 class="w-3.5 h-3.5 text-emerald-400" />
                  <span>Select .sqlite File</span>
                </button>
              {:else}
                <div class="space-y-2">
                  <div class="p-2 bg-zinc-900 rounded-lg border border-zinc-800 text-[11px] font-mono text-zinc-300 flex items-center justify-between">
                    <span class="truncate">{restoreFile.name}</span>
                    <span class="text-zinc-500 text-[10px] shrink-0 ml-2">{formatBytes(restoreFile.size)}</span>
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onclick={() => (restoreFile = null)}
                      class="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onclick={handleRestore}
                      disabled={isRestoring}
                      class="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <RefreshCw class="w-3.5 h-3.5 {isRestoring ? 'animate-spin' : ''}" />
                      <span>{isRestoring ? 'Restoring...' : 'Confirm Restore'}</span>
                    </button>
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- Restore Result Notification -->
          {#if restoreResult}
            <div class="p-3 rounded-xl text-xs flex items-center gap-2.5 {restoreResult.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'}">
              {#if restoreResult.success}
                <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
              {:else}
                <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
              {/if}
              <span>{restoreResult.message}</span>
            </div>
          {/if}

          <!-- Danger Zone: Reset Database -->
          <div class="p-4 rounded-xl bg-rose-950/20 border border-rose-900/30 flex items-center justify-between">
            <div>
              <div class="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <Trash2 class="w-3.5 h-3.5" />
                <span>Reset Database</span>
              </div>
              <p class="text-[11px] text-zinc-400 mt-0.5">
                Permanently erase all local ledger records and start fresh with default categories.
              </p>
            </div>

            {#if showResetConfirm}
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  onclick={() => (showResetConfirm = false)}
                  class="px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onclick={handleReset}
                  disabled={isResetting}
                  class="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  {isResetting ? 'Resetting...' : 'Yes, Wipe All'}
                </button>
              </div>
            {:else}
              <button
                type="button"
                onclick={() => (showResetConfirm = true)}
                class="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/50 border border-rose-900/40 text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
              >
                Reset Ledger
              </button>
            {/if}
          </div>

          {#if resetResult}
            <div class="p-3 rounded-xl text-xs flex items-center gap-2 {resetResult.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'}">
              <span>{resetResult.message}</span>
            </div>
          {/if}

        {:else}
          <!-- Tab 2: Moneta Cloud (Optional) -->
          <div class="space-y-4">
            <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <span class="font-bold text-zinc-200 flex items-center gap-1.5">
                <ShieldCheck class="w-3.5 h-3.5 text-emerald-400" />
                <span>Moneta Cloud Headless Engine (Optional)</span>
              </span>
              <p class="text-[11px]">
                Moneta Wealth works 100% offline with local SQLite. Connecting to Moneta Cloud is entirely optional for dual-custody backup or multi-device sync.
              </p>
            </div>

            <!-- Server URL -->
            <div>
              <label class="block text-[11px] uppercase font-semibold text-zinc-400 mb-1" for="conn-server-url">
                Moneta Cloud Server URL
              </label>
              <input
                id="conn-server-url"
                type="url"
                placeholder="https://weeseng.dev8.ansis.com.sg"
                bind:value={serverUrl}
                class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
              />
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
                  placeholder="Enter Bearer PAT token"
                  bind:value={apiToken}
                  class="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            <!-- Test Connection Button -->
            <div>
              <button
                type="button"
                onclick={runTest}
                disabled={isTesting}
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
              >
                <RefreshCw class="w-3.5 h-3.5 {isTesting ? 'animate-spin' : ''}" />
                <span>{isTesting ? 'Testing connection...' : 'Test Connection'}</span>
              </button>

              {#if testResult}
                <div class="mt-2 p-2.5 rounded-lg text-xs flex items-center gap-2 {testResult.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'}">
                  {#if testResult.success}
                    <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Success! Authenticated as <strong>{testResult.user}</strong>.</span>
                  {:else}
                    <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{testResult.message}</span>
                  {/if}
                </div>
              {/if}
            </div>

            <!-- 1-Click Migration Card -->
            <div class="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div class="flex items-center gap-2 text-xs font-bold text-zinc-200">
                <ArrowRightLeft class="w-4 h-4 text-emerald-400" />
                <span>Pull Moneta Cloud into Local SQLite</span>
              </div>
              <p class="text-[11px] text-zinc-400">
                Import your existing accounts, categories, and transactions from Moneta Cloud into this local SQLite database.
              </p>
              <button
                type="button"
                onclick={handleMigration}
                disabled={isMigrating || !apiToken}
                class="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-50 transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw class="w-3.5 h-3.5 {isMigrating ? 'animate-spin' : ''}" />
                <span>{isMigrating ? 'Migrating Cloud records into SQLite...' : 'Start Migration to SQLite'}</span>
              </button>

              {#if migrationResult}
                <div class="p-2.5 rounded-lg text-xs flex items-center gap-2 {migrationResult.success ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950/60 text-rose-300 border border-rose-800/60'}">
                  {#if migrationResult.success}
                    <CheckCircle2 class="w-4 h-4 text-emerald-400 shrink-0" />
                  {:else}
                    <AlertCircle class="w-4 h-4 text-rose-400 shrink-0" />
                  {/if}
                  <span>{migrationResult.message}</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-end gap-2">
        <button
          type="button"
          onclick={() => (financeStore.isSettingsOpen = false)}
          class="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={handleSave}
          class="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
        >
          Apply & Save
        </button>
      </div>
    </div>
  </div>
{/if}
