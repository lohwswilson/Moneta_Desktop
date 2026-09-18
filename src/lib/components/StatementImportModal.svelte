<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import {
    parseCsvStatement,
    parseQifStatement,
    type ParsedStatementRow,
  } from '../data/importers/bankStatementParser';
  import {
    X,
    Upload,
    FileSpreadsheet,
    Sparkles,
    Check,
    AlertCircle,
    RotateCcw,
    FileText,
  } from '@lucide/svelte';

  let fileInput = $state<HTMLInputElement>();
  let fileName = $state('');
  let isDragging = $state(false);
  let parsedRows = $state<ParsedStatementRow[]>([]);
  let targetAccountId = $state<string | number>(financeStore.selectedAccountId || '');
  let isImporting = $state(false);
  let importSuccessMessage = $state<string | null>(null);

  // Keep targetAccountId synced with selected account
  $effect(() => {
    if (financeStore.selectedAccountId && !targetAccountId) {
      targetAccountId = financeStore.selectedAccountId;
    }
  });

  const sampleCsvContent = `Transaction Date,Description,Debit Amount,Credit Amount,Reference
15/09/2026,FAIRPRICE FINEST KATONG,89.40,,FP-99120
14/09/2026,GRAB* RIDE SINGAPORE,24.50,,GRB-1092
14/09/2026,BACHA COFFEE ION ORCHARD,48.00,,BCH-551
13/09/2026,SALARY PAYROLL ACME PTE LTD,,7500.00,SAL-SEP26
12/09/2026,SP SERVICES UTILITIES,132.80,,SP-8831
11/09/2026,NETFLIX SINGAPORE,22.98,,SUB-8812
10/09/2026,MCDONALD'S MARINE COVE,18.50,,MCD-294`;

  const selectedCount = $derived(parsedRows.filter((r) => r.selected).length);
  const duplicateCount = $derived(parsedRows.filter((r) => r.isDuplicate).length);
  const totalInflow = $derived(
    parsedRows.filter((r) => r.selected && r.amount > 0).reduce((sum, r) => sum + r.amount, 0)
  );
  const totalOutflow = $derived(
    parsedRows.filter((r) => r.selected && r.amount < 0).reduce((sum, r) => sum + Math.abs(r.amount), 0)
  );

  const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      processFile(target.files[0]);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processFile = (file: File) => {
    fileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      parseContent(content, file.name);
    };
    reader.readAsText(file);
  };

  const parseContent = (content: string, name: string) => {
    const isQif = name.toLowerCase().endsWith('.qif');
    if (isQif) {
      parsedRows = parseQifStatement(content, financeStore.transactions);
    } else {
      parsedRows = parseCsvStatement(content, financeStore.transactions);
    }
  };

  const loadSampleData = () => {
    fileName = 'Sample_DBS_Bank_Statement.csv';
    parseContent(sampleCsvContent, 'sample.csv');
  };

  const toggleSelectAll = () => {
    const shouldSelectAll = selectedCount < parsedRows.length;
    parsedRows = parsedRows.map((r) => ({ ...r, selected: shouldSelectAll }));
  };

  const handleImport = async () => {
    if (!targetAccountId || selectedCount === 0) return;
    isImporting = true;

    const rowsToImport = parsedRows
      .filter((r) => r.selected)
      .map((r) => ({
        account_id: targetAccountId,
        date: r.date,
        payee_name: r.payee,
        category_name: r.category,
        amount: r.amount,
        transaction_type: (r.amount >= 0 ? 'income' : 'expense') as 'income' | 'expense',
        reconciliation_state: 'unreconciled' as const,
        memo: r.memo || 'Imported via Statement Wizard',
      }));

    try {
      await financeStore.batchImportTransactions(targetAccountId, rowsToImport);
      importSuccessMessage = `Successfully imported ${rowsToImport.length} transactions!`;
      setTimeout(() => {
        importSuccessMessage = null;
        parsedRows = [];
        fileName = '';
        financeStore.isImportModalOpen = false;
      }, 1200);
    } catch (err) {
      console.error('Failed to import statement:', err);
    } finally {
      isImporting = false;
    }
  };

  const resetImport = () => {
    parsedRows = [];
    fileName = '';
    importSuccessMessage = null;
  };
</script>

{#if financeStore.isImportModalOpen}
  <div class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
    <div class="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
      <!-- Modal Header -->
      <div class="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/60">
            <FileSpreadsheet class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-bold text-base text-zinc-100">Bank Statement Import Wizard</h3>
            <p class="text-xs text-zinc-400">Import CSV or QIF bank statements with automatic category classification</p>
          </div>
        </div>
        <button
          onclick={() => (financeStore.isImportModalOpen = false)}
          class="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Content Area -->
      <div class="p-6 flex-1 overflow-y-auto space-y-5">
        {#if importSuccessMessage}
          <div class="p-6 bg-emerald-950/60 border border-emerald-700/60 rounded-xl text-center space-y-2">
            <Check class="w-10 h-10 text-emerald-400 mx-auto" />
            <h4 class="font-bold text-emerald-200 text-lg">{importSuccessMessage}</h4>
            <p class="text-xs text-emerald-300/80">Your checkbook register has been updated.</p>
          </div>
        {:else if parsedRows.length === 0}
          <!-- Upload Step -->
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Account Target Selector -->
              <div>
                <label for="import-acc-select" class="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Target Account
                </label>
                <select
                  id="import-acc-select"
                  bind:value={targetAccountId}
                  class="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                >
                  {#each financeStore.accounts as acc}
                    <option value={acc.id}>
                      {acc.name} ({acc.currency_code}) - {acc.institution_name || 'Personal'}
                    </option>
                  {/each}
                </select>
              </div>

              <!-- Format Support Note -->
              <div class="p-3 bg-zinc-950/60 border border-zinc-800/80 rounded-lg flex items-center justify-between">
                <div>
                  <div class="text-xs font-semibold text-zinc-300">Supported Formats</div>
                  <div class="text-[11px] text-zinc-500 mt-0.5">DBS/POSB, OCBC, UOB, StanChart, Wise (.csv, .qif)</div>
                </div>
                <button
                  type="button"
                  onclick={loadSampleData}
                  class="px-2.5 py-1 text-[11px] font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 transition-colors border border-zinc-700"
                >
                  Load Sample
                </button>
              </div>
            </div>

            <!-- Drag & Drop Zone -->
            <button
              type="button"
              ondragover={(e) => { e.preventDefault(); isDragging = true; }}
              ondragleave={() => (isDragging = false)}
              ondrop={handleDrop}
              class="w-full border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer {isDragging ? 'border-emerald-500 bg-emerald-950/20' : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40'}"
              onclick={() => fileInput?.click()}
            >
              <input
                bind:this={fileInput}
                type="file"
                accept=".csv,.qif,.txt"
                class="hidden"
                onchange={handleFileUpload}
              />
              <Upload class="w-10 h-10 text-zinc-500 mx-auto mb-3" />
              <div class="text-sm font-semibold text-zinc-200">
                Click to browse or drop your bank statement file here
              </div>
              <div class="text-xs text-zinc-500 mt-1">
                CSV (comma, semicolon, tab delimited) or Quicken QIF
              </div>
            </button>
          </div>
        {:else}
          <!-- Preview & Edit Step -->
          <div class="space-y-4">
            <!-- Stats Bar -->
            <div class="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-950 rounded-xl border border-zinc-800">
              <div class="flex items-center gap-4 text-xs">
                <div>
                  <span class="text-zinc-500">File:</span>
                  <span class="font-semibold text-zinc-200 ml-1">{fileName}</span>
                </div>
                <div>
                  <span class="text-zinc-500">Selected:</span>
                  <span class="font-bold text-emerald-400 ml-1">{selectedCount} / {parsedRows.length}</span>
                </div>
                {#if duplicateCount > 0}
                  <div class="flex items-center gap-1 text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/50">
                    <AlertCircle class="w-3.5 h-3.5" />
                    <span>{duplicateCount} possible duplicate{duplicateCount > 1 ? 's' : ''} auto-unchecked</span>
                  </div>
                {/if}
              </div>

              <div class="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span class="text-zinc-500">Inflow:</span>
                  <span class="font-bold text-emerald-400 ml-1">+${totalInflow.toFixed(2)}</span>
                </div>
                <div>
                  <span class="text-zinc-500">Outflow:</span>
                  <span class="font-bold text-rose-400 ml-1">-${totalOutflow.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  onclick={resetImport}
                  class="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 ml-2"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                  <span>Choose Another</span>
                </button>
              </div>
            </div>

            <!-- Table of Extracted Rows -->
            <div class="border border-zinc-800 rounded-xl overflow-hidden max-h-[48vh] overflow-y-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead class="sticky top-0 bg-zinc-900 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold z-10">
                  <tr>
                    <th class="p-2.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedCount === parsedRows.length}
                        onchange={toggleSelectAll}
                        class="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th class="p-2.5 w-24">Date</th>
                    <th class="p-2.5">Payee / Description</th>
                    <th class="p-2.5 w-44">Category (Rule Matched)</th>
                    <th class="p-2.5 w-32 text-right">Amount</th>
                    <th class="p-2.5 w-24 text-center">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800/50 font-mono">
                  {#each parsedRows as row (row.id)}
                    <tr class="hover:bg-zinc-800/40 transition-colors {row.selected ? 'bg-zinc-900/30' : 'opacity-60 bg-zinc-950'}">
                      <td class="p-2.5 text-center">
                        <input
                          type="checkbox"
                          bind:checked={row.selected}
                          class="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td class="p-2.5 text-zinc-400 whitespace-nowrap">{row.date}</td>
                      <td class="p-2.5 font-sans">
                        <input
                          type="text"
                          bind:value={row.payee}
                          class="w-full bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-emerald-500 focus:bg-zinc-950 px-1 py-0.5 rounded text-zinc-100 focus:outline-none"
                        />
                      </td>
                      <td class="p-2.5 font-sans">
                        <div class="relative flex items-center">
                          <input
                            type="text"
                            bind:value={row.category}
                            class="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                          />
                          <Sparkles class="w-3 h-3 text-amber-400 absolute right-2 pointer-events-none" />
                        </div>
                      </td>
                      <td class="p-2.5 text-right font-bold whitespace-nowrap {row.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}">
                        {row.amount < 0 ? `-$${Math.abs(row.amount).toFixed(2)}` : `+$${row.amount.toFixed(2)}`}
                      </td>
                      <td class="p-2.5 text-center">
                        {#if row.isDuplicate}
                          <span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-950 text-amber-300 border border-amber-800/60">
                            Duplicate
                          </span>
                        {:else}
                          <span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                            New
                          </span>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {/if}
      </div>

      <!-- Modal Footer -->
      {#if parsedRows.length > 0 && !importSuccessMessage}
        <div class="px-6 py-4 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div class="text-xs text-zinc-400">
            Target: <strong class="text-zinc-200">
              {financeStore.accounts.find((a) => a.id === targetAccountId)?.name || 'Selected Account'}
            </strong>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              onclick={() => (financeStore.isImportModalOpen = false)}
              class="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedCount === 0 || isImporting}
              onclick={handleImport}
              class="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm transition-colors"
            >
              <Check class="w-4 h-4" />
              <span>{isImporting ? 'Importing...' : `Import ${selectedCount} Transactions`}</span>
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
