<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type { CashflowDailyPoint, SankeyNode, SankeyLink } from '../types/moneta';
  import {
    Workflow,
    TrendingUp,
    TrendingDown,
    Calendar,
    AlertTriangle,
    CheckCircle2,
    ArrowRight,
    ArrowDownRight,
    ArrowUpRight,
    Wallet,
    Layers,
    ReceiptText,
    Sparkles,
    Shield,
    DollarSign,
    PiggyBank,
    Eye
  } from '@lucide/svelte';

  // Sub-view tab: 'sankey' | 'trajectory' | 'ledger'
  let activeTab = $state<'sankey' | 'trajectory' | 'ledger'>('sankey');
  let selectedAccountId = $state<string | number | ''>('');
  let activityOnly = $state<boolean>(true);

  // Hover state for Sankey
  let hoveredNode = $state<SankeyNode | null>(null);
  let hoveredLink = $state<{ source: SankeyNode; target: SankeyNode; value: number } | null>(null);

  // Hover state for Trajectory chart
  let hoveredPoint = $state<CashflowDailyPoint | null>(null);
  let mouseX = $state<number>(0);

  // Format currency helper
  const formatCurrency = (amount: number, currency: string = 'SGD') => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyExact = (amount: number, currency: string = 'SGD') => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Switch horizon
  const handleHorizonChange = async (days: 30 | 90 | 180 | 365) => {
    financeStore.cashflowHorizon = days;
    await financeStore.loadCashflow(days, selectedAccountId || undefined);
  };

  // Switch account filter
  const handleAccountChange = async (accId: string | number | '') => {
    selectedAccountId = accId;
    await financeStore.loadCashflow(financeStore.cashflowHorizon, accId || undefined);
  };

  // Forecast data shortcut
  let forecast = $derived(financeStore.cashflowForecast);
  let summary = $derived(forecast?.summary);
  let dailyPoints = $derived(forecast?.daily_points || []);
  let sankeyData = $derived(forecast?.sankey);

  // Filtered daily points for calendar ledger
  let filteredDailyPoints = $derived.by(() => {
    if (!activityOnly) return dailyPoints;
    return dailyPoints.filter(
      (p) => p.total_income > 0 || p.total_expense > 0 || p.event_summary.length > 0 || p.is_overdraft
    );
  });

  // Calculate Net Savings Rate
  let savingsRate = $derived.by(() => {
    if (!summary || summary.total_projected_income <= 0) return 0;
    const rate = (summary.net_projected_cashflow / summary.total_projected_income) * 100;
    return Math.max(0, Math.round(rate));
  });

  // SANKEY DIAGRAM LAYOUT COMPUTATION
  const SANKEY_WIDTH = 960;
  const SANKEY_HEIGHT = 440;
  const PADDING_Y = 24;
  const NODE_WIDTH = 14;

  let sankeyLayout = $derived.by(() => {
    if (!sankeyData || !sankeyData.nodes.length) return null;

    const inflowNodes = sankeyData.nodes.filter((n) => n.tier === 'inflow');
    const hubNodes = sankeyData.nodes.filter((n) => n.tier === 'hub');
    const outflowNodes = sankeyData.nodes.filter((n) => n.tier === 'outflow' || n.tier === 'saving');

    const totalInflow = inflowNodes.reduce((s, n) => s + n.value, 0) || 1;
    const totalOutflow = outflowNodes.reduce((s, n) => s + n.value, 0) || 1;
    const availableHeight = SANKEY_HEIGHT - PADDING_Y * 2;

    // Layout left (inflow) tier
    const leftX = 40;
    let curLeftY = PADDING_Y;
    const leftGap = 16;
    const totalLeftGaps = Math.max(0, inflowNodes.length - 1) * leftGap;
    const usableLeftH = availableHeight - totalLeftGaps;

    const layoutNodes = new Map<string, { x: number; y: number; width: number; height: number; node: SankeyNode }>();

    for (const n of inflowNodes) {
      const h = Math.max(28, (n.value / totalInflow) * usableLeftH);
      layoutNodes.set(n.id, { x: leftX, y: curLeftY, width: NODE_WIDTH, height: h, node: n });
      curLeftY += h + leftGap;
    }

    // Layout center (hub) tier
    const hubX = 460;
    const hubH = Math.min(availableHeight - 40, Math.max(120, availableHeight * 0.7));
    const hubY = (SANKEY_HEIGHT - hubH) / 2;
    for (const n of hubNodes) {
      layoutNodes.set(n.id, { x: hubX, y: hubY, width: 20, height: hubH, node: n });
    }

    // Layout right (outflow + saving) tier
    const rightX = 860;
    let curRightY = PADDING_Y;
    const rightGap = 12;
    const totalRightGaps = Math.max(0, outflowNodes.length - 1) * rightGap;
    const usableRightH = availableHeight - totalRightGaps;

    for (const n of outflowNodes) {
      const h = Math.max(20, (n.value / totalOutflow) * usableRightH);
      layoutNodes.set(n.id, { x: rightX, y: curRightY, width: NODE_WIDTH, height: h, node: n });
      curRightY += h + rightGap;
    }

    // Compute ribbon links
    // Track current stack position on hub
    let hubInY = hubY;
    let hubOutY = hubY;

    const layoutLinks: Array<{
      source: SankeyNode;
      target: SankeyNode;
      value: number;
      d: string;
      color: string;
    }> = [];

    for (const link of sankeyData.links) {
      const src = layoutNodes.get(link.source);
      const dst = layoutNodes.get(link.target);
      if (!src || !dst) continue;

      let x0 = src.x + src.width;
      let y0 = src.y;
      let h0 = src.height;

      let x1 = dst.x;
      let y1 = dst.y;
      let h1 = dst.height;

      let linkColor = src.node.color || '#6366f1';

      if (src.node.tier === 'inflow' && dst.node.tier === 'hub') {
        const linkH = (link.value / totalInflow) * hubH;
        y1 = hubInY;
        h1 = linkH;
        hubInY += linkH;
        linkColor = src.node.color || '#10b981';
      } else if (src.node.tier === 'hub') {
        const linkH = (link.value / totalOutflow) * hubH;
        y0 = hubOutY;
        h0 = linkH;
        hubOutY += linkH;
        linkColor = dst.node.color || '#f59e0b';
      }

      // Cubic Bézier curve
      const dx = (x1 - x0) * 0.5;
      const pathD = `
        M ${x0},${y0}
        C ${x0 + dx},${y0} ${x1 - dx},${y1} ${x1},${y1}
        L ${x1},${y1 + h1}
        C ${x1 - dx},${y1 + h1} ${x0 + dx},${y0 + h0} ${x0},${y0 + h0}
        Z
      `;

      layoutLinks.push({
        source: src.node,
        target: dst.node,
        value: link.value,
        d: pathD,
        color: linkColor,
      });
    }

    return {
      nodes: Array.from(layoutNodes.values()),
      links: layoutLinks,
    };
  });

  // TRAJECTORY CHART COMPUTATION
  const CHART_WIDTH = 960;
  const CHART_HEIGHT = 240;
  const CHART_PAD_LEFT = 65;
  const CHART_PAD_RIGHT = 30;
  const CHART_PAD_TOP = 25;
  const CHART_PAD_BOTTOM = 35;

  let trajectoryChart = $derived.by(() => {
    if (!dailyPoints.length) return null;

    const plotW = CHART_WIDTH - CHART_PAD_LEFT - CHART_PAD_RIGHT;
    const plotH = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;

    const balances = dailyPoints.map((p) => p.closing_balance);
    const minBal = Math.min(...balances);
    const maxBal = Math.max(...balances);
    const padRange = (maxBal - minBal) * 0.1 || 1000;
    const yMin = Math.min(0, minBal - padRange);
    const yMax = maxBal + padRange;
    const yRange = yMax - yMin || 1;

    // Coordinate helpers
    const getX = (index: number) => {
      return CHART_PAD_LEFT + (index / (dailyPoints.length - 1)) * plotW;
    };

    const getY = (val: number) => {
      return CHART_PAD_TOP + (1 - (val - yMin) / yRange) * plotH;
    };

    const zeroY = getY(0);

    // Build SVG path
    let linePath = `M ${getX(0)},${getY(dailyPoints[0].closing_balance)}`;
    for (let i = 1; i < dailyPoints.length; i++) {
      linePath += ` L ${getX(i)},${getY(dailyPoints[i].closing_balance)}`;
    }

    const areaPath = `${linePath} L ${getX(dailyPoints.length - 1)},${getY(yMin)} L ${getX(0)},${getY(yMin)} Z`;

    // Find lowest point index
    let lowestIdx = 0;
    for (let i = 1; i < dailyPoints.length; i++) {
      if (dailyPoints[i].closing_balance < dailyPoints[lowestIdx].closing_balance) {
        lowestIdx = i;
      }
    }

    const lowestPoint = {
      x: getX(lowestIdx),
      y: getY(dailyPoints[lowestIdx].closing_balance),
      data: dailyPoints[lowestIdx],
    };

    // Horizontal grid lines
    const gridTicks = [yMin, (yMin + yMax) / 2, yMax];

    return {
      plotW,
      plotH,
      linePath,
      areaPath,
      zeroY,
      yMin,
      yMax,
      lowestPoint,
      gridTicks,
      getX,
      getY,
    };
  });

  // Trajectory hover handler
  const handleTrajectoryMouseMove = (e: MouseEvent) => {
    if (!trajectoryChart || !dailyPoints.length) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    mouseX = x;

    const plotW = CHART_WIDTH - CHART_PAD_LEFT - CHART_PAD_RIGHT;
    const relX = Math.max(0, Math.min(plotW, x - CHART_PAD_LEFT));
    const idx = Math.round((relX / plotW) * (dailyPoints.length - 1));
    hoveredPoint = dailyPoints[idx] || null;
  };

  const handleTrajectoryMouseLeave = () => {
    hoveredPoint = null;
  };
</script>

<div class="flex-1 flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-hidden select-none">
  <!-- Top Header Navigation -->
  <header class="border-b border-zinc-800/80 px-8 py-5 flex items-center justify-between bg-zinc-950/60 backdrop-blur shrink-0">
    <div class="flex items-center gap-3.5">
      <div class="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm">
        <Workflow class="w-5 h-5" />
      </div>
      <div>
        <h1 class="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
          Cash Flow Forecaster & Sankey
          {#if summary?.has_overdraft_risk}
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800 flex items-center gap-1">
              <AlertTriangle class="w-3.5 h-3.5" />
              Overdraft Risk Detected
            </span>
          {:else}
            <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 flex items-center gap-1">
              <CheckCircle2 class="w-3.5 h-3.5" />
              Cash Flow Healthy
            </span>
          {/if}
        </h1>
        <p class="text-xs text-zinc-400 mt-0.5">
          Quicken-style 30 to 365-day cash flow simulation, balance trajectory, and interactive money distribution.
        </p>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <!-- Account Filter Dropdown -->
      <div class="flex items-center gap-2 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 text-xs">
        <Wallet class="w-3.5 h-3.5 text-zinc-400" />
        <select
          value={selectedAccountId}
          onchange={(e) => handleAccountChange((e.target as HTMLSelectElement).value)}
          class="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
        >
          <option value="">All Liquid Accounts</option>
          {#each financeStore.accounts.filter(a => ['checking', 'chequing', 'savings', 'cash'].includes(a.account_type)) as acc (acc.id)}
            <option value={acc.id}>{acc.name}</option>
          {/each}
        </select>
      </div>

      <!-- Horizon Selector -->
      <div class="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs font-semibold">
        <button
          onclick={() => handleHorizonChange(30)}
          class="px-2.5 py-1 rounded transition {financeStore.cashflowHorizon === 30 ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
        >
          30d
        </button>
        <button
          onclick={() => handleHorizonChange(90)}
          class="px-2.5 py-1 rounded transition {financeStore.cashflowHorizon === 90 ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
        >
          90d
        </button>
        <button
          onclick={() => handleHorizonChange(180)}
          class="px-2.5 py-1 rounded transition {financeStore.cashflowHorizon === 180 ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
        >
          180d
        </button>
        <button
          onclick={() => handleHorizonChange(365)}
          class="px-2.5 py-1 rounded transition {financeStore.cashflowHorizon === 365 ? 'bg-indigo-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
        >
          1 Year
        </button>
      </div>
    </div>
  </header>

  <!-- Main Scrollable Body -->
  <div class="flex-1 overflow-y-auto px-8 py-6 space-y-6">
    <!-- Hero Forecast Metrics Cards -->
    {#if summary}
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <!-- Starting Balance -->
        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Starting Balance</span>
            <Wallet class="w-4 h-4 text-zinc-400" />
          </div>
          <div class="text-xl font-bold font-mono text-zinc-100">
            {formatCurrency(summary.starting_balance)}
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">Current liquid cash</div>
        </div>

        <!-- Projected Inflows -->
        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Projected Inflows</span>
            <ArrowDownRight class="w-4 h-4 text-emerald-400" />
          </div>
          <div class="text-xl font-bold font-mono text-emerald-400">
            +{formatCurrency(summary.total_projected_income)}
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">
            {financeStore.cashflowHorizon}d salary & deposits
          </div>
        </div>

        <!-- Projected Outflows -->
        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Projected Outflows</span>
            <ArrowUpRight class="w-4 h-4 text-rose-400" />
          </div>
          <div class="text-xl font-bold font-mono text-rose-400">
            -{formatCurrency(summary.total_projected_expenses)}
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">
            {financeStore.cashflowHorizon}d bills & living
          </div>
        </div>

        <!-- Lowest Projected Balance -->
        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80 {summary.lowest_projected_balance < 1000 ? 'border-amber-500/40 bg-amber-950/10' : ''}">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Lowest Point</span>
            {#if summary.lowest_projected_balance < 0}
              <AlertTriangle class="w-4 h-4 text-rose-400" />
            {:else}
              <Shield class="w-4 h-4 text-amber-400" />
            {/if}
          </div>
          <div class="text-xl font-bold font-mono {summary.lowest_projected_balance < 0 ? 'text-rose-400' : 'text-amber-300'}">
            {formatCurrency(summary.lowest_projected_balance)}
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">
            {summary.lowest_balance_date ? `On ${summary.lowest_balance_date}` : 'Trajectory nadir'}
          </div>
        </div>

        <!-- Ending Balance & Net Change -->
        <div class="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div class="flex items-center justify-between text-zinc-400 text-xs mb-1.5 font-medium">
            <span>Ending Balance</span>
            <PiggyBank class="w-4 h-4 text-indigo-400" />
          </div>
          <div class="text-xl font-bold font-mono {summary.net_projected_cashflow >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            {formatCurrency(summary.ending_projected_balance)}
          </div>
          <div class="text-[11px] font-medium {summary.net_projected_cashflow >= 0 ? 'text-emerald-400' : 'text-rose-400'} mt-1 flex items-center gap-1">
            {summary.net_projected_cashflow >= 0 ? '▲ +' : '▼ -'}{formatCurrency(Math.abs(summary.net_projected_cashflow))} net ({savingsRate}% save)
          </div>
        </div>
      </div>
    {/if}

    <!-- Segmented Tab Header -->
    <div class="flex items-center justify-between border-b border-zinc-800/80 pb-2">
      <div class="flex items-center gap-2">
        <button
          onclick={() => (activeTab = 'sankey')}
          class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition {activeTab === 'sankey' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
        >
          <Workflow class="w-4 h-4 text-indigo-400" />
          Interactive Sankey Flow
        </button>

        <button
          onclick={() => (activeTab = 'trajectory')}
          class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition {activeTab === 'trajectory' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
        >
          <TrendingUp class="w-4 h-4 text-emerald-400" />
          Balance Trajectory Chart
        </button>

        <button
          onclick={() => (activeTab = 'ledger')}
          class="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition {activeTab === 'ledger' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}"
        >
          <Calendar class="w-4 h-4 text-amber-400" />
          Daily Cash Calendar ({filteredDailyPoints.length})
        </button>
      </div>

      {#if activeTab === 'ledger'}
        <label class="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer select-none">
          <input
            type="checkbox"
            bind:checked={activityOnly}
            class="w-3.5 h-3.5 rounded bg-zinc-900 border-zinc-700 text-indigo-500 focus:ring-indigo-500"
          />
          Show Activity Days Only
        </label>
      {/if}
    </div>

    <!-- TAB 1: INTERACTIVE SANKEY FLOW -->
    {#if activeTab === 'sankey'}
      <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 relative overflow-hidden">
        <!-- Sankey Legend & Header -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-4 text-xs font-semibold">
            <span class="flex items-center gap-1.5 text-zinc-300">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              Income Sources
            </span>
            <span class="text-zinc-600">→</span>
            <span class="flex items-center gap-1.5 text-zinc-300">
              <span class="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
              Liquid Cash Pool
            </span>
            <span class="text-zinc-600">→</span>
            <span class="flex items-center gap-1.5 text-zinc-300">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              Expenses & Envelopes
            </span>
            <span class="flex items-center gap-1.5 text-zinc-300">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Net Savings Reserve
            </span>
          </div>

          {#if hoveredLink}
            <div class="px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 animate-in fade-in duration-100">
              {hoveredLink.source.name} → {hoveredLink.target.name}: <span class="font-bold text-white">{formatCurrency(hoveredLink.value)}</span>
            </div>
          {:else if hoveredNode}
            <div class="px-3 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 animate-in fade-in duration-100">
              {hoveredNode.name}: <span class="font-bold text-white">{formatCurrency(hoveredNode.value)}</span>
            </div>
          {:else}
            <div class="text-[11px] text-zinc-500 italic">
              Hover over ribbons or nodes to inspect flow amounts
            </div>
          {/if}
        </div>

        <!-- Pure SVG Sankey Diagram -->
        {#if sankeyLayout}
          <div class="w-full flex justify-center overflow-x-auto py-2">
            <svg
              viewBox="0 0 {SANKEY_WIDTH} {SANKEY_HEIGHT}"
              class="w-full max-w-[960px] h-auto overflow-visible select-none"
            >
              <defs>
                <linearGradient id="hubGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stop-color="#10b981" stop-opacity="0.7" />
                  <stop offset="100%" stop-color="#6366f1" stop-opacity="0.7" />
                </linearGradient>
              </defs>

              <!-- Flow Ribbons -->
              {#each sankeyLayout.links as link}
                {@const isHovered = hoveredLink === link}
                <path
                  d={link.d}
                  fill={link.color}
                  fill-opacity={isHovered ? '0.75' : '0.35'}
                  stroke={link.color}
                  stroke-width={isHovered ? '1.5' : '0.5'}
                  stroke-opacity="0.6"
                  class="transition-all duration-150 cursor-pointer"
                  role="presentation"
                  onmouseenter={() => (hoveredLink = link)}
                  onmouseleave={() => (hoveredLink = null)}
                />
              {/each}

              <!-- Nodes & Labels -->
              {#each sankeyLayout.nodes as item}
                {@const node = item.node}
                {@const isHovered = hoveredNode === node}
                <g
                  class="cursor-pointer"
                  role="group"
                  aria-label="{node.name}"
                  onmouseenter={() => (hoveredNode = node)}
                  onmouseleave={() => (hoveredNode = null)}
                >
                  <!-- Bar Rect -->
                  <rect
                    x={item.x}
                    y={item.y}
                    width={item.width}
                    height={item.height}
                    rx="3"
                    fill={node.color || '#6366f1'}
                    fill-opacity={isHovered ? '1' : '0.9'}
                    stroke={isHovered ? '#ffffff' : '#000000'}
                    stroke-width={isHovered ? '2' : '0.5'}
                    class="transition-all duration-150 shadow-lg"
                  />

                  <!-- Text Labels -->
                  {#if node.tier === 'inflow'}
                    <text
                      x={item.x - 10}
                      y={item.y + item.height / 2 + 4}
                      text-anchor="end"
                      class="text-[11px] font-semibold fill-zinc-200"
                    >
                      {node.name}
                    </text>
                    <text
                      x={item.x - 10}
                      y={item.y + item.height / 2 + 16}
                      text-anchor="end"
                      class="text-[10px] font-mono fill-zinc-400"
                    >
                      {formatCurrency(node.value)}
                    </text>
                  {:else if node.tier === 'hub'}
                    <text
                      x={item.x + item.width / 2}
                      y={item.y - 12}
                      text-anchor="middle"
                      class="text-xs font-bold fill-indigo-300 uppercase tracking-wider"
                    >
                      {node.name}
                    </text>
                    <text
                      x={item.x + item.width / 2}
                      y={item.y + item.height + 18}
                      text-anchor="middle"
                      class="text-xs font-mono font-bold fill-zinc-200"
                    >
                      {formatCurrency(node.value)}
                    </text>
                  {:else}
                    <text
                      x={item.x + item.width + 10}
                      y={item.y + item.height / 2 + (item.height < 28 ? 0 : 4)}
                      text-anchor="start"
                      class="text-[11px] font-semibold fill-zinc-200"
                    >
                      {node.name}
                    </text>
                    <text
                      x={item.x + item.width + 10}
                      y={item.y + item.height / 2 + (item.height < 28 ? 12 : 16)}
                      text-anchor="start"
                      class="text-[10px] font-mono fill-zinc-400"
                    >
                      {formatCurrency(node.value)}
                    </text>
                  {/if}
                </g>
              {/each}
            </svg>
          </div>
        {/if}
      </div>
    {/if}

    <!-- TAB 2: BALANCE TRAJECTORY CHART -->
    {#if activeTab === 'trajectory'}
      <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 relative">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp class="w-4 h-4 text-emerald-400" />
              Projected Balance Trajectory ({financeStore.cashflowHorizon} Days)
            </h2>
            <p class="text-xs text-zinc-400">
              Simulated closing cash balances taking into account regular income, scheduled bills, and baseline spending.
            </p>
          </div>

          {#if hoveredPoint}
            <div class="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-200 animate-in fade-in duration-100 flex items-center gap-3">
              <span>{hoveredPoint.date} ({hoveredPoint.day_of_week.slice(0, 3)})</span>
              <span>•</span>
              <span class="font-bold text-emerald-400">{formatCurrencyExact(hoveredPoint.closing_balance)}</span>
              {#if hoveredPoint.event_summary}
                <span>•</span>
                <span class="text-zinc-400">{hoveredPoint.event_summary}</span>
              {/if}
            </div>
          {/if}
        </div>

        {#if trajectoryChart}
          <!-- Trajectory SVG Area Chart -->
          <div
            class="relative cursor-crosshair py-2"
            onmousemove={handleTrajectoryMouseMove}
            onmouseleave={handleTrajectoryMouseLeave}
            role="region"
            aria-label="Balance Trajectory Interactive Chart"
          >
            <svg
              viewBox="0 0 {CHART_WIDTH} {CHART_HEIGHT}"
              class="w-full h-auto overflow-visible"
            >
              <defs>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
                  <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
                </linearGradient>
              </defs>

              <!-- Grid Horizontal Lines -->
              {#each trajectoryChart.gridTicks as tick}
                {@const y = trajectoryChart.getY(tick)}
                <line
                  x1={CHART_PAD_LEFT}
                  y1={y}
                  x2={CHART_WIDTH - CHART_PAD_RIGHT}
                  y2={y}
                  stroke="#27272a"
                  stroke-dasharray="3 3"
                />
                <text
                  x={CHART_PAD_LEFT - 8}
                  y={y + 4}
                  text-anchor="end"
                  class="text-[10px] font-mono fill-zinc-500"
                >
                  {formatCurrency(tick)}
                </text>
              {/each}

              <!-- Zero Baseline if in range -->
              {#if trajectoryChart.yMin <= 0 && trajectoryChart.yMax >= 0}
                <line
                  x1={CHART_PAD_LEFT}
                  y1={trajectoryChart.zeroY}
                  x2={CHART_WIDTH - CHART_PAD_RIGHT}
                  y2={trajectoryChart.zeroY}
                  stroke="#f43f5e"
                  stroke-width="1.5"
                  stroke-dasharray="4 4"
                />
                <text
                  x={CHART_WIDTH - CHART_PAD_RIGHT + 6}
                  y={trajectoryChart.zeroY + 3}
                  class="text-[9px] font-bold fill-rose-400 uppercase tracking-widest"
                >
                  Zero Line
                </text>
              {/if}

              <!-- Area Fill -->
              <path d={trajectoryChart.areaPath} fill="url(#areaGradient)" />

              <!-- Trajectory Line -->
              <path
                d={trajectoryChart.linePath}
                fill="none"
                stroke="#10b981"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              <!-- Lowest Point Marker -->
              <circle
                cx={trajectoryChart.lowestPoint.x}
                cy={trajectoryChart.lowestPoint.y}
                r="5"
                fill="#f59e0b"
                stroke="#ffffff"
                stroke-width="2"
              />
              <text
                x={trajectoryChart.lowestPoint.x}
                y={trajectoryChart.lowestPoint.y - 10}
                text-anchor="middle"
                class="text-[10px] font-bold fill-amber-300 font-mono"
              >
                Lowest: {formatCurrency(trajectoryChart.lowestPoint.data.closing_balance)}
              </text>

              <!-- Crosshair Indicator on Hover -->
              {#if hoveredPoint}
                {@const hoverIdx = dailyPoints.indexOf(hoveredPoint)}
                {@const hx = trajectoryChart.getX(hoverIdx)}
                {@const hy = trajectoryChart.getY(hoveredPoint.closing_balance)}
                <line
                  x1={hx}
                  y1={CHART_PAD_TOP}
                  x2={hx}
                  y2={CHART_HEIGHT - CHART_PAD_BOTTOM}
                  stroke="#a1a1aa"
                  stroke-dasharray="2 2"
                />
                <circle cx={hx} cy={hy} r="6" fill="#38bdf8" stroke="#ffffff" stroke-width="2" />
              {/if}
            </svg>
          </div>
        {/if}
      </div>
    {/if}

    <!-- TAB 3: DAILY CASH LEDGER -->
    {#if activeTab === 'ledger'}
      <div class="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden">
        <div class="p-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/40">
          <div class="text-xs font-semibold text-zinc-300">
            Day-by-Day Cash Balance Simulation
          </div>
          <div class="text-xs text-zinc-500">
            Showing {filteredDailyPoints.length} days
          </div>
        </div>

        <div class="overflow-x-auto max-h-[500px]">
          <table class="w-full text-left text-xs">
            <thead class="bg-zinc-950/90 text-zinc-400 uppercase tracking-wider text-[10px] font-semibold sticky top-0 border-b border-zinc-800/80 z-10">
              <tr>
                <th class="py-3 px-4">Date</th>
                <th class="py-3 px-4">Day</th>
                <th class="py-3 px-4">Events & Scheduled Transactions</th>
                <th class="py-3 px-4 text-right">Inflows</th>
                <th class="py-3 px-4 text-right">Outflows</th>
                <th class="py-3 px-4 text-right">Net Change</th>
                <th class="py-3 px-4 text-right">Closing Balance</th>
                <th class="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800/60 font-mono text-[11px]">
              {#each filteredDailyPoints as day (day.date)}
                <tr class="hover:bg-zinc-900/50 transition-colors {day.is_overdraft ? 'bg-rose-950/20' : ''}">
                  <td class="py-2.5 px-4 font-semibold text-zinc-200">{day.date}</td>
                  <td class="py-2.5 px-4 text-zinc-400 font-sans">{day.day_of_week}</td>
                  <td class="py-2.5 px-4 text-zinc-300 font-sans">
                    {day.event_summary || '—'}
                  </td>
                  <td class="py-2.5 px-4 text-right text-emerald-400">
                    {day.total_income > 0 ? `+${formatCurrencyExact(day.total_income)}` : '—'}
                  </td>
                  <td class="py-2.5 px-4 text-right text-rose-400">
                    {day.total_expense > 0 ? `-${formatCurrencyExact(day.total_expense)}` : '—'}
                  </td>
                  <td class="py-2.5 px-4 text-right font-bold {day.net_change > 0 ? 'text-emerald-400' : day.net_change < 0 ? 'text-rose-400' : 'text-zinc-500'}">
                    {day.net_change > 0 ? `+${formatCurrencyExact(day.net_change)}` : day.net_change < 0 ? formatCurrencyExact(day.net_change) : '0.00'}
                  </td>
                  <td class="py-2.5 px-4 text-right font-bold {day.closing_balance < 0 ? 'text-rose-400' : 'text-zinc-100'}">
                    {formatCurrencyExact(day.closing_balance)}
                  </td>
                  <td class="py-2.5 px-4 text-center">
                    {#if day.is_overdraft}
                      <span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-950 text-rose-400 border border-rose-800">
                        Overdraft
                      </span>
                    {:else if day.closing_balance < 1000}
                      <span class="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-950 text-amber-400 border border-amber-800">
                        Low
                      </span>
                    {:else}
                      <span class="text-zinc-600 text-[10px]">OK</span>
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
</div>
