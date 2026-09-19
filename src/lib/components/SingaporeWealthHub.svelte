<script lang="ts">
  import { financeStore } from '../stores/financeStore.svelte';
  import type {
    CPFAccountSummary,
    CPFHousingRecord,
    IRASTaxRecord,
    SSBBondRecord,
    TBillRecord,
    SRSTrackerRecord,
  } from '../types/moneta';
  import {
    computeCPFInterest,
    computeCPFLifeSimulation,
    computeCPFHousingRefund,
    computeSingaporeStampDuty,
    computeCPFContributionRates,
    computeMASTDSRAffordability,
    type CPFLifePlan,
  } from '../data/cpfMath';
  import { computeSingaporeTax } from '../data/irasMath';
  import {
    computeSSBYields,
    computeTBillEconomics,
    computeUCITSETFComparison,
  } from '../data/singaporeFixedIncomeMath';
  import {
    computeSRSMetrics,
    computeSRSWithdrawalPlan,
  } from '../data/srsMath';
  import {
    ShieldCheck,
    Building2,
    Calculator,
    PiggyBank,
    BadgePercent,
    TrendingUp,
    Plus,
    Trash2,
    Info,
    CheckCircle2,
    AlertCircle,
    ArrowUpRight,
    Coins,
    FileText,
    HelpCircle,
    Sparkles,
    Landmark,
    Globe,
    Percent,
    ShieldAlert,
  } from '@lucide/svelte';

  // Sub-tabs: 'cpf' | 'housing' | 'iras' | 'fixed_income' | 'srs_ucits'
  let activeTab = $state<'cpf' | 'housing' | 'iras' | 'fixed_income' | 'srs_ucits'>('cpf');

  // Formatters
  const formatSGD = (amount: number) => {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: 'SGD',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatPct = (pct: number) => `${(pct || 0).toFixed(2)}%`;

  // --- TAB 1: CPF LIFE SIMULATOR STATE ---
  let simAge = $state<number>(55);
  let simSumTier = $state<'BRS' | 'FRS' | 'ERS' | 'custom'>('FRS');
  let simCustomRA = $state<number>(213000);
  let simPlan = $state<CPFLifePlan>('standard');

  let activeRABalance = $derived(() => {
    if (simSumTier === 'BRS') return 106500;
    if (simSumTier === 'FRS') return 213000;
    if (simSumTier === 'ERS') return 426000;
    return simCustomRA;
  });

  let cpfLifeSimulation = $derived(() => {
    return computeCPFLifeSimulation({
      raBalance: activeRABalance(),
      gender: 'male',
      startAge: 65,
      plan: simPlan,
    });
  });

  // User Age for CPF interest calculation
  let userAgeInput = $state<number>(financeStore.userAge || 35);
  const handleUserAgeChange = (e: Event) => {
    const val = Number((e.target as HTMLInputElement).value);
    if (val >= 18 && val <= 99) {
      userAgeInput = val;
      financeStore.setUserAge(val);
    }
  };

  // Statutory CPF Contribution Rate Calculator State (2026 OW ceiling $8,000)
  let cpfSalaryOW = $state<number>(8000);
  let cpfBonusAW = $state<number>(0);
  let cpfAgeTier = $state<number>(35);

  let cpfContributionCalculation = $derived(() => {
    return computeCPFContributionRates(cpfAgeTier, cpfSalaryOW, 8000);
  });

  // --- TAB 2: HOUSING ACCRUED INTEREST & STAMP DUTY ---
  let isAddHousingOpen = $state<boolean>(false);
  let newHousing = $state<Partial<CPFHousingRecord>>({
    property_name: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_price: 600000,
    valuation: 750000,
    oa_withdrawn_downpayment: 60000,
    oa_withdrawn_monthly: 40000,
    housing_grant_amount: 30000,
    outstanding_loan: 250000,
    ownership_years: 5,
    notes: '',
  });

  const handleSaveHousing = async () => {
    if (!newHousing.property_name) return;
    await financeStore.saveCPFHousingRecord(newHousing);
    isAddHousingOpen = false;
    newHousing = {
      property_name: '',
      purchase_date: new Date().toISOString().split('T')[0],
      purchase_price: 600000,
      valuation: 750000,
      oa_withdrawn_downpayment: 60000,
      oa_withdrawn_monthly: 40000,
      housing_grant_amount: 30000,
      outstanding_loan: 250000,
      ownership_years: 5,
      notes: '',
    };
  };

  // Stamp Duty Interactive Simulator
  let stampPropertyPrice = $state<number>(1200000);
  let stampBuyerProfile = $state<
    'citizen_1st' | 'citizen_2nd' | 'citizen_3rd' | 'pr_1st' | 'pr_2nd' | 'pr_3rd' | 'foreigner' | 'entity'
  >('citizen_1st');

  let stampDutyResult = $derived(() => {
    return computeSingaporeStampDuty(stampPropertyPrice, stampBuyerProfile);
  });

  // MAS TDSR / MSR Affordability Simulator State
  let masGrossIncome = $state<number>(10000);
  let masProposedLoanMonthly = $state<number>(3200);
  let masOtherDebtCommitments = $state<number>(800);
  let masPropertyType = $state<'hdb' | 'ec' | 'private'>('hdb');

  let masAffordabilityResult = $derived(() => {
    return computeMASTDSRAffordability({
      grossMonthlyIncome: masGrossIncome,
      proposedLoanPayment: masProposedLoanMonthly,
      monthlyDebtCommitments: masOtherDebtCommitments,
      propertyType: masPropertyType,
    });
  });

  // --- TAB 3: IRAS TAX PLANNER ---
  let irasYear = $state<number>(2025);
  let irasEmployment = $state<number>(120000);
  let irasTrade = $state<number>(0);
  let irasRental = $state<number>(0);
  let irasOther = $state<number>(0);

  // Relief inputs
  let reliefCPF = $state<number>(20400);
  let reliefEarned = $state<number>(1000);
  let reliefSRS = $state<number>(15300);
  let reliefRSTUSelf = $state<number>(8000);
  let reliefRSTUFamily = $state<number>(0);
  let reliefNSman = $state<number>(3000);
  let reliefChild = $state<number>(4000);
  let reliefParent = $state<number>(0);
  let reliefDonation = $state<number>(2000);

  let currentTaxCalculation = $derived(() => {
    return computeSingaporeTax({
      employmentIncome: irasEmployment,
      tradeIncome: irasTrade,
      rentalIncome: irasRental,
      otherIncome: irasOther,
      reliefs: {
        cpfEmployee: reliefCPF,
        earnedIncome: reliefEarned,
        srs: reliefSRS,
        rstuSelf: reliefRSTUSelf,
        rstuFamily: reliefRSTUFamily,
        nsman: reliefNSman,
        child: reliefChild,
        parent: reliefParent,
        donations250Pct: reliefDonation,
      },
    });
  });

  const handleSaveTaxAssessment = async () => {
    await financeStore.saveIRASTaxRecord({
      assessment_year: irasYear,
      employment_income: irasEmployment,
      trade_income: irasTrade,
      rental_income: irasRental,
      other_income: irasOther,
      cpf_employee_relief: reliefCPF,
      earned_income_relief: reliefEarned,
      srs_contribution: reliefSRS,
      rstu_self: reliefRSTUSelf,
      rstu_family: reliefRSTUFamily,
      nsman_relief: reliefNSman,
      child_relief: reliefChild,
      parent_relief: reliefParent,
      donations_250: reliefDonation,
      notes: `YA ${irasYear} Assessment`,
    });
  };

  // --- TAB 4: SINGAPORE SAVINGS BONDS (SSB) & T-BILLS ---
  let isAddSSBOpen = $state<boolean>(false);
  let newSSB = $state<Partial<SSBBondRecord>>({
    issue_code: 'SBMAY26 GX26050A',
    investment_amount: 10000,
    funding_source: 'cash',
    rate_year_1: 2.80,
    rate_year_2: 2.85,
    rate_year_3: 2.90,
    rate_year_4: 2.95,
    rate_year_5: 3.00,
    rate_year_6: 3.05,
    rate_year_7: 3.10,
    rate_year_8: 3.15,
    rate_year_9: 3.20,
    rate_year_10: 3.30,
    notes: '',
  });

  const handleSaveSSB = async () => {
    if (!newSSB.issue_code || !newSSB.investment_amount) return;
    await financeStore.saveSSBBond(newSSB);
    isAddSSBOpen = false;
  };

  let isAddTBillOpen = $state<boolean>(false);
  let newTBill = $state<Partial<TBillRecord>>({
    issue_code: 'BS26110E',
    tenure_type: '6_month',
    face_value: 10000,
    issue_price_per_hundred: 98.20,
    funding_source: 'cash',
    notes: '',
  });

  const handleSaveTBill = async () => {
    if (!newTBill.issue_code || !newTBill.face_value) return;
    await financeStore.saveTBill(newTBill);
    isAddTBillOpen = false;
  };

  let ssbTotalInvested = $derived(() => {
    return financeStore.ssbBonds.reduce((acc, b) => acc + (b.investment_amount || 0), 0);
  });

  let ssbRemainingCap = $derived(() => {
    return Math.max(200000 - ssbTotalInvested(), 0);
  });

  let tbillTotalFace = $derived(() => {
    return financeStore.tbills.reduce((acc, t) => acc + (t.face_value || 0), 0);
  });

  // --- TAB 5: SRS TAX SHIELD & IRISH UCITS COMPARATOR ---
  let srsResidencyStatus = $state<'citizen_pr' | 'foreigner'>('citizen_pr');
  let srsContributionYTD = $state<number>(15300);
  let srsMarginalTaxRate = $state<number>(15.0);
  let srsAccumulatedBalance = $state<number>(80000);

  let srsMetricsCalculated = $derived(() => {
    return computeSRSMetrics({
      residencyStatus: srsResidencyStatus,
      totalContributedYTD: srsContributionYTD,
      marginalTaxRatePct: srsMarginalTaxRate,
    });
  });

  let srsWithdrawalPlanCalculated = $derived(() => {
    return computeSRSWithdrawalPlan({
      currentBalance: srsAccumulatedBalance,
    });
  });

  const handleSaveSRSPlan = async () => {
    await financeStore.saveSRSRecord({
      tax_year: 2025,
      residency_status: srsResidencyStatus,
      total_contributed: srsContributionYTD,
      marginal_tax_rate: srsMarginalTaxRate,
      srs_current_balance: srsAccumulatedBalance,
      notes: 'SRS Annual Tax Strategy',
    });
  };

  // Irish UCITS vs US ETF Comparator State
  let ucitsPortfolioValue = $state<number>(100000);
  let ucitsDividendYieldPct = $state<number>(1.5);
  let ucitsCapitalGrowthPct = $state<number>(7.0);
  let ucitsHorizonYears = $state<number>(20);

  let ucitsComparisonResult = $derived(() => {
    return computeUCITSETFComparison({
      portfolioValue: ucitsPortfolioValue,
      dividendYieldPct: ucitsDividendYieldPct,
      expectedGrowthRatePct: ucitsCapitalGrowthPct,
      investmentHorizonYears: ucitsHorizonYears,
    });
  });
</script>

<div class="h-full flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
  <!-- Top Hub Header -->
  <header class="px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between flex-shrink-0">
    <div>
      <div class="flex items-center gap-2.5">
        <span class="text-xl">🇸🇬</span>
        <h1 class="text-lg font-bold text-zinc-100 tracking-tight">Singapore Regional Wealth Pack</h1>
        <span class="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-red-950/80 text-red-400 border border-red-800/60">
          CPF • Housing • IRAS • SSB/T-Bills • SRS/UCITS
        </span>
      </div>
      <p class="text-xs text-zinc-400 mt-0.5">
        Statutory CPF rates & LIFE simulator, 2.5% housing refund & MAS TDSR/MSR, IRAS progressive tax, SSB/T-Bills ladder, and SRS tax shield & UCITS
      </p>
    </div>

    <!-- Sub-tab Switcher -->
    <div class="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800">
      <button
        onclick={() => (activeTab = 'cpf')}
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer {activeTab === 'cpf' ? 'bg-zinc-800 text-emerald-400 shadow-xs' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <ShieldCheck class="w-3.5 h-3.5" />
        CPF & LIFE
      </button>
      <button
        onclick={() => (activeTab = 'housing')}
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer {activeTab === 'housing' ? 'bg-zinc-800 text-sky-400 shadow-xs' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <Building2 class="w-3.5 h-3.5" />
        Housing & TDSR
      </button>
      <button
        onclick={() => (activeTab = 'iras')}
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer {activeTab === 'iras' ? 'bg-zinc-800 text-indigo-400 shadow-xs' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <Calculator class="w-3.5 h-3.5" />
        IRAS Tax
      </button>
      <button
        onclick={() => (activeTab = 'fixed_income')}
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer {activeTab === 'fixed_income' ? 'bg-zinc-800 text-amber-400 shadow-xs' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <Landmark class="w-3.5 h-3.5" />
        SSB & T-Bills
      </button>
      <button
        onclick={() => (activeTab = 'srs_ucits')}
        class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer {activeTab === 'srs_ucits' ? 'bg-zinc-800 text-purple-400 shadow-xs' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        <Globe class="w-3.5 h-3.5" />
        SRS & UCITS
      </button>
    </div>
  </header>

  <!-- Scrollable Tab Content Body -->
  <div class="flex-1 overflow-y-auto p-6 space-y-6">
    {#if activeTab === 'cpf'}
      <!-- ========================================================================= -->
      <!-- TAB 1: CPF ACCOUNTS & CPF LIFE SIMULATOR -->
      <!-- ========================================================================= -->

      <!-- Top Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <!-- OA -->
        <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div class="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span class="font-medium">Ordinary Account (OA)</span>
            <span class="text-emerald-400 font-mono text-[10px] bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">2.50%</span>
          </div>
          <div class="text-lg font-bold font-mono text-zinc-100">
            {formatSGD(financeStore.cpfAccounts?.oa_balance || 0)}
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">
            Housing, education & investment
          </div>
        </div>

        <!-- SA -->
        <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div class="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span class="font-medium">Special Account (SA)</span>
            <span class="text-emerald-400 font-mono text-[10px] bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">4.05%</span>
          </div>
          <div class="text-lg font-bold font-mono text-zinc-100">
            {formatSGD(financeStore.cpfAccounts?.sa_balance || 0)}
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">
            Retirement & fixed-income growth
          </div>
        </div>

        <!-- MA -->
        <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div class="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span class="font-medium">MediSave (MA)</span>
            <span class="text-emerald-400 font-mono text-[10px] bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">4.05%</span>
          </div>
          <div class="text-lg font-bold font-mono text-zinc-100">
            {formatSGD(financeStore.cpfAccounts?.ma_balance || 0)}
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">
            BHS Cap: $71,500 (Overflows to SA/RA)
          </div>
        </div>

        <!-- RA -->
        <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div class="flex items-center justify-between text-xs text-zinc-400 mb-1">
            <span class="font-medium">Retirement (RA)</span>
            <span class="text-emerald-400 font-mono text-[10px] bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">4.05%</span>
          </div>
          <div class="text-lg font-bold font-mono text-zinc-100">
            {formatSGD(financeStore.cpfAccounts?.ra_balance || 0)}
          </div>
          <div class="text-[11px] text-zinc-500 mt-1">
            Created at age 55 for CPF LIFE
          </div>
        </div>

        <!-- Total CPF & Extra Interest -->
        <div class="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/50">
          <div class="flex items-center justify-between text-xs text-emerald-400 mb-1">
            <span class="font-medium">Total CPF Wealth</span>
            <Sparkles class="w-3.5 h-3.5" />
          </div>
          <div class="text-lg font-bold font-mono text-emerald-400">
            {formatSGD(financeStore.cpfAccounts?.total_balance || 0)}
          </div>
          <div class="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
            <span>Annual Interest:</span>
            <span class="font-mono text-emerald-300 font-semibold">+{formatSGD(financeStore.cpfAccounts?.total_annual_interest || 0)}/yr</span>
          </div>
        </div>
      </div>

      <!-- Statutory Extra Interest Callout & Age Control -->
      <div class="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Info class="w-4 h-4" />
          </div>
          <div>
            <div class="font-semibold text-zinc-200">CPF Extra Statutory Interest Boost</div>
            <p class="text-zinc-400 text-[11px]">
              The Singapore Government pays an extra 1.0% interest on the first $60,000 of combined CPF balances (capped at $20,000 for OA).
              {#if (financeStore.cpfAccounts?.user_age || 35) >= 55}
                Members aged 55 and above earn an additional 1.0% (total 2.0% extra) on the first $30,000!
              {/if}
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-zinc-400">User Age:</span>
          <input
            type="number"
            min="18"
            max="99"
            value={userAgeInput}
            onchange={handleUserAgeChange}
            class="w-16 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-100 text-center text-xs"
          />
          <span class="text-emerald-400 font-mono text-xs font-semibold">
            +{formatSGD(financeStore.cpfAccounts?.extra_interest_earned || 0)} Extra/yr
          </span>
        </div>
      </div>

      <!-- Interactive CPF LIFE Simulator -->
      <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
        <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div>
            <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <PiggyBank class="w-4 h-4 text-amber-400" />
              CPF LIFE National Annuity Retirement Simulator
            </h2>
            <p class="text-xs text-zinc-400">
              Lifelong monthly retirement payouts starting from age 65 based on Retirement Account (RA) accumulation
            </p>
          </div>
          <span class="text-[11px] font-mono text-zinc-400">2026 CPF Board Parameters</span>
        </div>

        <!-- Simulator Controls -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- RA Tier Selection -->
          <div class="space-y-2">
            <span class="text-xs text-zinc-400 font-medium block">Retirement Sum at Age 55</span>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onclick={() => (simSumTier = 'BRS')}
                class="px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition-colors {simSumTier === 'BRS' ? 'bg-amber-950/60 border-amber-500/60 text-amber-300' : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300'}"
              >
                <div>BRS</div>
                <div class="text-[10px] font-mono text-zinc-400">$106.5k</div>
              </button>
              <button
                type="button"
                onclick={() => (simSumTier = 'FRS')}
                class="px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition-colors {simSumTier === 'FRS' ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300' : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300'}"
              >
                <div>FRS</div>
                <div class="text-[10px] font-mono text-zinc-400">$213k</div>
              </button>
              <button
                type="button"
                onclick={() => (simSumTier = 'ERS')}
                class="px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition-colors {simSumTier === 'ERS' ? 'bg-indigo-950/60 border-indigo-500/60 text-indigo-300' : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300'}"
              >
                <div>ERS</div>
                <div class="text-[10px] font-mono text-zinc-400">$426k</div>
              </button>
            </div>
          </div>

          <!-- Plan Selection -->
          <div class="space-y-2">
            <span class="text-xs text-zinc-400 font-medium block">CPF LIFE Plan Type</span>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onclick={() => (simPlan = 'standard')}
                class="px-2 py-2 rounded-lg text-xs font-medium border text-center transition-colors {simPlan === 'standard' ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300' : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300'}"
              >
                Standard
              </button>
              <button
                type="button"
                onclick={() => (simPlan = 'escalating')}
                class="px-2 py-2 rounded-lg text-xs font-medium border text-center transition-colors {simPlan === 'escalating' ? 'bg-indigo-950/60 border-indigo-500/60 text-indigo-300' : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300'}"
              >
                Escalating (+2%/yr)
              </button>
              <button
                type="button"
                onclick={() => (simPlan = 'basic')}
                class="px-2 py-2 rounded-lg text-xs font-medium border text-center transition-colors {simPlan === 'basic' ? 'bg-amber-950/60 border-amber-500/60 text-amber-300' : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-300'}"
              >
                Basic
              </button>
            </div>
          </div>

          <!-- Simulation Output Hero -->
          <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-center">
            <div class="text-[11px] text-zinc-400">Estimated Lifelong Monthly Payout:</div>
            <div class="text-xl font-bold font-mono text-emerald-400 mt-0.5">
              {formatSGD(cpfLifeSimulation().monthlyPayoutMin)} – {formatSGD(cpfLifeSimulation().monthlyPayoutMax)}
              <span class="text-xs text-zinc-400 font-normal">/ month</span>
            </div>
            <div class="text-[10px] text-zinc-500 mt-1">
              Guaranteed lifelong payouts regardless of longevity
            </div>
          </div>
        </div>

        <!-- Plan Mechanics & Bequest Breakdown -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-800/80 text-xs">
          <div class="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
            <span class="text-zinc-400 font-medium">Bequest at Age 75:</span>
            <div class="font-mono text-zinc-200 text-sm font-semibold mt-0.5">
              ~{formatSGD(cpfLifeSimulation().bequest75)}
            </div>
            <p class="text-[10px] text-zinc-500 mt-1">Unconsumed premium refunded to nominees</p>
          </div>
          <div class="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
            <span class="text-zinc-400 font-medium">Bequest at Age 85:</span>
            <div class="font-mono text-zinc-200 text-sm font-semibold mt-0.5">
              ~{formatSGD(cpfLifeSimulation().bequest85)}
            </div>
            <p class="text-[10px] text-zinc-500 mt-1">Lifespan average expectancy threshold</p>
          </div>
          <div class="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/60">
            <span class="text-zinc-400 font-medium">Inflation Hedge:</span>
            <div class="font-mono text-zinc-200 text-sm font-semibold mt-0.5">
              {simPlan === 'escalating' ? 'Yes (+2% compound/year)' : 'Level nominal payouts'}
            </div>
            <p class="text-[10px] text-zinc-500 mt-1">
              {simPlan === 'escalating' ? 'Protects purchasing power over 30+ retirement years' : 'Consistent predictable monthly baseline'}
            </p>
          </div>
        </div>
      </div>

      <!-- Statutory Monthly CPF Contribution Rate Engine (2026 OW Ceiling: S$8,000) -->
      <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Percent class="w-4 h-4 text-emerald-400" />
              Statutory CPF Contribution Rate Calculator (2026 Wage Ceiling)
            </h2>
            <p class="text-xs text-zinc-400">
              Statutory employee & employer allocation by age tier under the 2026 Ordinary Wage ceiling of S$8,000/month (Annual Total Wage Ceiling: S$102,000)
            </p>
          </div>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/50 text-emerald-400">
            CPF Act 2026 Revision
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label for="cpf-age-tier" class="text-xs text-zinc-400 block mb-1.5 font-medium">Age Group / Tier</label>
            <select
              id="cpf-age-tier"
              bind:value={cpfAgeTier}
              class="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500"
            >
              <option value={30}>Age ≤ 55 (37% Total: 20% Employee / 17% Employer)</option>
              <option value={57}>Age 55–60 (32.5% Total: 17% Employee / 15.5% Employer)</option>
              <option value={62}>Age 60–65 (23.5% Total: 11.5% Employee / 12% Employer)</option>
              <option value={67}>Age 65–70 (16.5% Total: 7.5% Employee / 9% Employer)</option>
              <option value={72}>Age &gt; 70 (12.5% Total: 5% Employee / 7.5% Employer)</option>
            </select>
          </div>
          <div>
            <label for="cpf-salary-ow" class="text-xs text-zinc-400 block mb-1.5 font-medium">
              Monthly Ordinary Wage (OW)
              <span class="text-[10px] text-emerald-400 ml-1">Cap S$8,000</span>
            </label>
            <div class="relative">
              <span class="absolute left-3 top-2 text-xs text-zinc-500">S$</span>
              <input
                id="cpf-salary-ow"
                type="number"
                step="100"
                min="0"
                bind:value={cpfSalaryOW}
                class="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
          <div>
            <label for="cpf-bonus-aw" class="text-xs text-zinc-400 block mb-1.5 font-medium">
              Monthly Additional Wage (Bonus / AW)
            </label>
            <div class="relative">
              <span class="absolute left-3 top-2 text-xs text-zinc-500">S$</span>
              <input
                id="cpf-bonus-aw"
                type="number"
                step="500"
                min="0"
                bind:value={cpfBonusAW}
                class="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        <!-- Calculated Statutory Breakdown -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-zinc-800/80">
          <div class="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/70">
            <span class="text-[11px] text-zinc-400">Employee Contribution</span>
            <div class="text-base font-bold font-mono text-emerald-400 mt-0.5">
              {formatSGD(cpfContributionCalculation().employeeContribution)}
            </div>
            <span class="text-[10px] text-zinc-500">({formatPct(cpfContributionCalculation().employeeRatePct)})</span>
          </div>
          <div class="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/70">
            <span class="text-[11px] text-zinc-400">Employer Contribution</span>
            <div class="text-base font-bold font-mono text-sky-400 mt-0.5">
              {formatSGD(cpfContributionCalculation().employerContribution)}
            </div>
            <span class="text-[10px] text-zinc-500">({formatPct(cpfContributionCalculation().employerRatePct)})</span>
          </div>
          <div class="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/70">
            <span class="text-[11px] text-zinc-400">Total Monthly Credited</span>
            <div class="text-base font-bold font-mono text-zinc-100 mt-0.5">
              {formatSGD(cpfContributionCalculation().totalContribution)}
            </div>
            <span class="text-[10px] text-zinc-500">({formatPct(cpfContributionCalculation().totalRatePct)})</span>
          </div>
          <div class="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/70">
            <span class="text-[11px] text-zinc-400">Ordinary Account (OA)</span>
            <div class="text-base font-bold font-mono text-zinc-200 mt-0.5">
              {formatSGD(cpfContributionCalculation().oaAllocation)}
            </div>
            <span class="text-[10px] text-zinc-500">Liquid housing & investment</span>
          </div>
          <div class="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/70">
            <span class="text-[11px] text-zinc-400">Special & MediSave</span>
            <div class="text-base font-bold font-mono text-zinc-200 mt-0.5">
              {formatSGD(cpfContributionCalculation().saAllocation + cpfContributionCalculation().maAllocation)}
            </div>
            <span class="text-[10px] text-zinc-500">SA: {formatSGD(cpfContributionCalculation().saAllocation)} • MA: {formatSGD(cpfContributionCalculation().maAllocation)}</span>
          </div>
        </div>
      </div>

    {:else if activeTab === 'housing'}
      <!-- ========================================================================= -->
      <!-- TAB 2: HOUSING ACCRUED INTEREST & STAMP DUTY -->
      <!-- ========================================================================= -->

      <!-- Top Section: CPF Housing Accrued Interest -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Building2 class="w-4 h-4 text-sky-400" />
              CPF Housing Accrued Interest Engine (2.5% Compounded)
            </h2>
            <p class="text-xs text-zinc-400">
              When selling your property, all CPF Ordinary Account monies withdrawn plus 2.5% compounded interest must be refunded to CPF
            </p>
          </div>
          <button
            type="button"
            onclick={() => (isAddHousingOpen = !isAddHousingOpen)}
            class="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5" />
            Add Property Record
          </button>
        </div>

        <!-- Add Property Form Modal/Drawer -->
        {#if isAddHousingOpen}
          <div class="p-4 rounded-xl bg-zinc-900 border border-sky-900/60 space-y-3 animate-in fade-in duration-100">
            <div class="font-semibold text-xs text-sky-400">New CPF Housing Tracker</div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">Property Name / Address</span>
                  <input
                    type="text"
                    bind:value={newHousing.property_name}
                    placeholder="e.g. Bishan 4-Room Flat"
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  />
                </label>
              </div>
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">Market Valuation (SGD)</span>
                  <input
                    type="number"
                    bind:value={newHousing.valuation}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  />
                </label>
              </div>
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">OA Downpayment Withdrawn</span>
                  <input
                    type="number"
                    bind:value={newHousing.oa_withdrawn_downpayment}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  />
                </label>
              </div>
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">OA Monthly Deductions Total</span>
                  <input
                    type="number"
                    bind:value={newHousing.oa_withdrawn_monthly}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  />
                </label>
              </div>
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">Housing Grants Taken</span>
                  <input
                    type="number"
                    bind:value={newHousing.housing_grant_amount}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  />
                </label>
              </div>
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">Outstanding Bank/HDB Loan</span>
                  <input
                    type="number"
                    bind:value={newHousing.outstanding_loan}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  />
                </label>
              </div>
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">Years Owned</span>
                  <input
                    type="number"
                    bind:value={newHousing.ownership_years}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  />
                </label>
              </div>
              <div class="flex items-end gap-2">
                <button
                  type="button"
                  onclick={handleSaveHousing}
                  class="flex-1 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                >
                  Save Record
                </button>
                <button
                  type="button"
                  onclick={() => (isAddHousingOpen = false)}
                  class="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        {/if}

        <!-- Property Housing Records List -->
        {#if financeStore.cpfHousingRecords.length === 0}
          <div class="p-8 rounded-xl bg-zinc-900/30 border border-zinc-800/80 text-center text-xs text-zinc-500">
            No Singapore property records added. Click "Add Property Record" to calculate your CPF accrued interest and net cash proceeds.
          </div>
        {:else}
          <div class="grid grid-cols-1 gap-4">
            {#each financeStore.cpfHousingRecords as rec}
              <div class="p-5 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3">
                <div class="flex items-center justify-between">
                  <div>
                    <h3 class="text-sm font-bold text-zinc-100">{rec.property_name}</h3>
                    <div class="text-[11px] text-zinc-400 mt-0.5">
                      Owned for {rec.ownership_years} years • Market Valuation: <span class="font-mono text-zinc-200">{formatSGD(rec.valuation)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onclick={() => financeStore.deleteCPFHousingRecord(rec.id)}
                    title="Delete record"
                    class="p-1.5 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>

                <!-- 4 Metrics Pill Cards -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                  <div class="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    <span class="text-zinc-400 text-[11px]">Principal Withdrawn:</span>
                    <div class="font-mono text-zinc-200 font-semibold text-sm mt-0.5">
                      {formatSGD(rec.oa_withdrawn_downpayment + rec.oa_withdrawn_monthly + rec.housing_grant_amount)}
                    </div>
                    <div class="text-[10px] text-zinc-500 mt-0.5">Downpayment + Monthly + Grants</div>
                  </div>

                  <div class="p-3 rounded-lg bg-amber-950/20 border border-amber-800/40">
                    <span class="text-amber-400 text-[11px]">2.5% Accrued Interest:</span>
                    <div class="font-mono text-amber-300 font-semibold text-sm mt-0.5">
                      +{formatSGD(rec.accrued_interest)}
                    </div>
                    <div class="text-[10px] text-zinc-400 mt-0.5">Compounded annually</div>
                  </div>

                  <div class="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    <span class="text-zinc-400 text-[11px]">Total CPF Refund Required:</span>
                    <div class="font-mono text-red-400 font-semibold text-sm mt-0.5">
                      {formatSGD(rec.total_refund_due)}
                    </div>
                    <div class="text-[10px] text-zinc-500 mt-0.5">Returned to your CPF OA</div>
                  </div>

                  <div class="p-3 rounded-lg bg-emerald-950/20 border border-emerald-800/40">
                    <span class="text-emerald-400 text-[11px]">Net Sale Cash in Hand:</span>
                    <div class="font-mono text-emerald-400 font-bold text-base mt-0.5">
                      {formatSGD(rec.net_sale_cash_proceeds)}
                    </div>
                    <div class="text-[10px] text-zinc-400 mt-0.5">Valuation − Loan − CPF Refund</div>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Singapore Stamp Duty Simulator (BSD / ABSD) -->
        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <div class="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div>
              <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <BadgePercent class="w-4 h-4 text-emerald-400" />
                Singapore Stamp Duty Calculator (BSD & ABSD 2026 Statutory Tiers)
              </h2>
              <p class="text-xs text-zinc-400">
                Buyer's Stamp Duty (BSD tiered up to 6%) and Additional Buyer's Stamp Duty (ABSD up to 60%)
              </p>
            </div>
            <span class="text-[11px] font-mono text-zinc-400">IRAS Residential Schedule</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label class="block">
                <span class="text-zinc-400 block mb-1 font-medium">Purchase Price / Market Value (SGD)</span>
                <input
                  type="number"
                  step="50000"
                  bind:value={stampPropertyPrice}
                  class="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 font-mono text-sm"
                />
              </label>
            </div>
            <div>
              <label class="block">
                <span class="text-zinc-400 block mb-1 font-medium">Buyer Residency & Property Count</span>
                <select
                  bind:value={stampBuyerProfile}
                  class="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs cursor-pointer"
                >
                  <option value="citizen_1st">Singapore Citizen (1st Property - 0% ABSD)</option>
                  <option value="citizen_2nd">Singapore Citizen (2nd Property - 20% ABSD)</option>
                  <option value="citizen_3rd">Singapore Citizen (3rd+ Property - 30% ABSD)</option>
                  <option value="pr_1st">Singapore PR (1st Property - 5% ABSD)</option>
                  <option value="pr_2nd">Singapore PR (2nd Property - 30% ABSD)</option>
                  <option value="pr_3rd">Singapore PR (3rd+ Property - 35% ABSD)</option>
                  <option value="foreigner">Foreign National (60% ABSD)</option>
                  <option value="entity">Entity / Corporate Trust (65% ABSD)</option>
                </select>
              </label>
            </div>
            <div class="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-col justify-center">
              <div class="text-[11px] text-zinc-400">Total Stamp Duty Payable:</div>
              <div class="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {formatSGD(stampDutyResult().totalStampDuty)}
              </div>
              <div class="text-[10px] text-zinc-500 mt-0.5">
                Effective Rate: {formatPct(stampDutyResult().effectiveRatePct)} of purchase price
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80 text-xs">
            <div class="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between">
              <div>
                <div class="font-medium text-zinc-200">Buyer's Stamp Duty (BSD)</div>
                <div class="text-[10px] text-zinc-500">Tiered progressive rate (1% to 6%)</div>
              </div>
              <div class="font-mono text-zinc-100 text-sm font-semibold">
                {formatSGD(stampDutyResult().bsd)}
              </div>
            </div>
            <div class="p-3 rounded-lg bg-zinc-900/40 border border-zinc-800/60 flex items-center justify-between">
              <div>
                <div class="font-medium text-zinc-200">Additional Buyer's Stamp Duty (ABSD)</div>
                <div class="text-[10px] text-zinc-500">Rate: {formatPct(stampDutyResult().absdRatePct)}</div>
              </div>
              <div class="font-mono text-amber-300 text-sm font-semibold">
                {formatSGD(stampDutyResult().absd)}
              </div>
            </div>
          </div>
        </div>

        <!-- MAS Mortgage Affordability Engine: TDSR (55%) & MSR (30%) -->
        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Building2 class="w-4 h-4 text-sky-400" />
                MAS Mortgage Affordability Simulator (TDSR 55% & MSR 30%)
              </h2>
              <p class="text-xs text-zinc-400">
                Statutory debt limits enforced by the Monetary Authority of Singapore across residential property classes
              </p>
            </div>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/70 border border-sky-800/50 text-sky-400">
              MAS Notice 645
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label for="mas-property-type" class="text-xs text-zinc-400 block mb-1 font-medium">Property Category</label>
              <select
                id="mas-property-type"
                bind:value={masPropertyType}
                class="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-hidden focus:border-sky-500"
              >
                <option value="hdb">HDB Flat (Subject to MSR 30% & TDSR 55%)</option>
                <option value="ec">Executive Condominium (MSR 30% & TDSR 55%)</option>
                <option value="private">Private Residential (TDSR 55% Only)</option>
              </select>
            </div>
            <div>
              <label for="mas-gross-income" class="text-xs text-zinc-400 block mb-1 font-medium">Monthly Gross Income</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-xs text-zinc-500">S$</span>
                <input
                  id="mas-gross-income"
                  type="number"
                  step="500"
                  min="0"
                  bind:value={masGrossIncome}
                  class="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>
            <div>
              <label for="mas-proposed-loan" class="text-xs text-zinc-400 block mb-1 font-medium">Monthly Property Loan</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-xs text-zinc-500">S$</span>
                <input
                  id="mas-proposed-loan"
                  type="number"
                  step="100"
                  min="0"
                  bind:value={masProposedLoanMonthly}
                  class="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>
            <div>
              <label for="mas-other-debt" class="text-xs text-zinc-400 block mb-1 font-medium">Other Monthly Debts</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-xs text-zinc-500">S$</span>
                <input
                  id="mas-other-debt"
                  type="number"
                  step="50"
                  min="0"
                  bind:value={masOtherDebtCommitments}
                  class="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          <!-- Affordability Evaluation Cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
            <!-- TDSR Card -->
            <div class="p-4 rounded-xl bg-zinc-950 border {masAffordabilityResult().isTDSRCompliant ? 'border-emerald-800/60' : 'border-red-800/60'}">
              <div class="flex items-center justify-between">
                <span class="text-xs text-zinc-300 font-semibold">Total Debt Servicing Ratio (TDSR)</span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full {masAffordabilityResult().isTDSRCompliant ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}">
                  {masAffordabilityResult().isTDSRCompliant ? 'PASSED (≤ 55%)' : 'EXCEEDED (> 55%)'}
                </span>
              </div>
              <div class="flex items-baseline gap-2 mt-2">
                <span class="text-2xl font-bold font-mono text-zinc-100">{formatPct(masAffordabilityResult().tdsrPct)}</span>
                <span class="text-xs text-zinc-500">/ 55.0% MAS statutory ceiling</span>
              </div>
              <div class="text-[11px] text-zinc-400 mt-2">
                Max Affordable Loan: <span class="font-mono text-zinc-200">{formatSGD(masAffordabilityResult().maxAffordableLoanPayment)}/mo</span>
              </div>
            </div>

            <!-- MSR Card -->
            <div class="p-4 rounded-xl bg-zinc-950 border {masPropertyType !== 'private' ? (masAffordabilityResult().isMSRCompliant ? 'border-emerald-800/60' : 'border-amber-800/60') : 'border-zinc-800'}">
              <div class="flex items-center justify-between">
                <span class="text-xs text-zinc-300 font-semibold">Mortgage Servicing Ratio (MSR)</span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full {masPropertyType !== 'private' ? (masAffordabilityResult().isMSRCompliant ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800') : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}">
                  {masPropertyType !== 'private' ? (masAffordabilityResult().isMSRCompliant ? 'PASSED (≤ 30%)' : 'EXCEEDED (> 30%)') : 'NOT APPLICABLE (Private)'}
                </span>
              </div>
              <div class="flex items-baseline gap-2 mt-2">
                <span class="text-2xl font-bold font-mono text-zinc-100">{masPropertyType !== 'private' ? formatPct(masAffordabilityResult().msrPct) : 'N/A'}</span>
                <span class="text-xs text-zinc-500">{masPropertyType !== 'private' ? '/ 30.0% HDB/EC ceiling' : 'Private properties exempt from MSR'}</span>
              </div>
              <div class="text-[11px] text-zinc-400 mt-2">
                {#if masPropertyType !== 'private'}
                  Max 30% MSR Cap: <span class="font-mono text-zinc-200">{formatSGD(masGrossIncome * 0.30)}/mo</span>
                {:else}
                  Private property loans are bounded solely by the 55% MAS Total Debt Servicing Ratio.
                {/if}
              </div>
            </div>
          </div>
        </div>
      </div>

    {:else if activeTab === 'iras'}
      <!-- ========================================================================= -->
      <!-- TAB 3: IRAS PROGRESSIVE TAX PLANNER & RELIEF OPTIMIZATION -->
      <!-- ========================================================================= -->

      <div class="space-y-4">
        <!-- Top Hero: Chargeable Income & Tax Payable -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div class="text-xs text-zinc-400">Total Assessable Income</div>
            <div class="text-xl font-bold font-mono text-zinc-100 mt-1">
              {formatSGD(currentTaxCalculation().totalIncome)}
            </div>
            <div class="text-[10px] text-zinc-500 mt-1">Employment + Trade + Rental</div>
          </div>

          <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div class="flex items-center justify-between text-xs text-zinc-400">
              <span>Personal Reliefs</span>
              <span class="text-[10px] font-mono {currentTaxCalculation().reliefsCapped ? 'text-amber-400 font-semibold' : 'text-zinc-500'}">
                Cap: $80,000
              </span>
            </div>
            <div class="text-xl font-bold font-mono text-emerald-400 mt-1">
              {formatSGD(currentTaxCalculation().totalReliefs)}
            </div>
            <div class="text-[10px] text-zinc-500 mt-1">
              {#if currentTaxCalculation().reliefsCapped}
                <span class="text-amber-400">Statutory $80k relief cap reached</span>
              {:else}
                ${(80000 - currentTaxCalculation().totalReliefs).toLocaleString()} cap headroom remaining
              {/if}
            </div>
          </div>

          <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div class="text-xs text-zinc-400">Chargeable Income</div>
            <div class="text-xl font-bold font-mono text-zinc-100 mt-1">
              {formatSGD(currentTaxCalculation().chargeableIncome)}
            </div>
            <div class="text-[10px] text-zinc-500 mt-1">Marginal Bracket: {formatPct(currentTaxCalculation().marginalTaxRatePct)}</div>
          </div>

          <div class="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40">
            <div class="flex items-center justify-between text-xs text-emerald-400">
              <span>Net Tax Payable</span>
              <span class="text-[10px] font-mono text-emerald-300">Effective: {formatPct(currentTaxCalculation().effectiveTaxRatePct)}</span>
            </div>
            <div class="text-2xl font-bold font-mono text-emerald-400 mt-1">
              {formatSGD(currentTaxCalculation().netTaxPayable)}
            </div>
            <div class="text-[10px] text-zinc-400 mt-1">IRAS Year of Assessment {irasYear}</div>
          </div>
        </div>

        <!-- Input Grid: Incomes and Reliefs -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Income Sources -->
          <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
            <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Coins class="w-4 h-4 text-emerald-400" />
              Assessable Income Streams (SGD)
            </h2>

            <div class="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">Employment Salary / Bonuses</span>
                  <input
                    type="number"
                    bind:value={irasEmployment}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-100"
                  />
                </label>
              </div>
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">Trade / Business Profits</span>
                  <input
                    type="number"
                    bind:value={irasTrade}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-100"
                  />
                </label>
              </div>
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">Gross Rental Income</span>
                  <input
                    type="number"
                    bind:value={irasRental}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-100"
                  />
                </label>
              </div>
              <div>
                <label class="block">
                  <span class="text-zinc-400 block mb-1">Other Taxable Income</span>
                  <input
                    type="number"
                    bind:value={irasOther}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-100"
                  />
                </label>
              </div>
            </div>

            <!-- Tax Optimization Callout -->
            <div class="p-4 rounded-xl bg-indigo-950/20 border border-indigo-800/50 space-y-2 text-xs">
              <div class="font-semibold text-indigo-300 flex items-center gap-1.5">
                <Sparkles class="w-4 h-4" />
                Tax Optimization Advisor
              </div>
              <p class="text-zinc-300 text-[11px]">
                Your current marginal tax bracket is <strong class="text-indigo-200">{formatPct(currentTaxCalculation().marginalTaxRatePct)}</strong>.
                {#if reliefSRS < 15300}
                  Topping up an extra <strong class="text-emerald-300">${(15300 - reliefSRS).toLocaleString()}</strong> into your SRS account would immediately save you
                  <strong class="text-emerald-300 font-mono">+{formatSGD((15300 - reliefSRS) * (currentTaxCalculation().marginalTaxRatePct / 100))}</strong> in cash tax!
                {:else}
                  You have already maximized your statutory SRS deduction of $15,300!
                {/if}
              </p>
            </div>
          </div>

          <!-- Tax Reliefs Checklist -->
          <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <ShieldCheck class="w-4 h-4 text-indigo-400" />
                Personal Tax Reliefs & Deductions
              </h2>
              <button
                type="button"
                onclick={handleSaveTaxAssessment}
                class="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
              >
                Save Assessment
              </button>
            </div>

            <div class="space-y-2 text-xs max-h-72 overflow-y-auto pr-1">
              <div class="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/60">
                <span class="text-zinc-300">CPF Employee Contribution (Cap $20,400)</span>
                <input
                  type="number"
                  max="20400"
                  bind:value={reliefCPF}
                  class="w-24 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 font-mono text-right text-zinc-100"
                />
              </div>
              <div class="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/60">
                <span class="text-zinc-300">Earned Income Relief (Age-based)</span>
                <input
                  type="number"
                  bind:value={reliefEarned}
                  class="w-24 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 font-mono text-right text-zinc-100"
                />
              </div>
              <div class="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/60">
                <span class="text-zinc-300">SRS Contribution (Cap $15,300)</span>
                <input
                  type="number"
                  max="15300"
                  bind:value={reliefSRS}
                  class="w-24 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 font-mono text-right text-zinc-100"
                />
              </div>
              <div class="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/60">
                <span class="text-zinc-300">CPF Cash Top-Up (RSTU Self, Cap $8,000)</span>
                <input
                  type="number"
                  max="8000"
                  bind:value={reliefRSTUSelf}
                  class="w-24 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 font-mono text-right text-zinc-100"
                />
              </div>
              <div class="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/60">
                <span class="text-zinc-300">NSman Relief (Self / Key / General)</span>
                <input
                  type="number"
                  bind:value={reliefNSman}
                  class="w-24 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 font-mono text-right text-zinc-100"
                />
              </div>
              <div class="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/60">
                <span class="text-zinc-300">Qualifying Child Relief (QCR, $4,000/child)</span>
                <input
                  type="number"
                  bind:value={reliefChild}
                  class="w-24 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 font-mono text-right text-zinc-100"
                />
              </div>
              <div class="flex items-center justify-between p-2 rounded bg-zinc-900/40 border border-zinc-800/60">
                <span class="text-zinc-300">250% Donation Deduction (IPC Approved)</span>
                <input
                  type="number"
                  bind:value={reliefDonation}
                  class="w-24 px-2 py-1 rounded bg-zinc-800 border border-zinc-700 font-mono text-right text-zinc-100"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

    {:else if activeTab === 'fixed_income'}
      <!-- ========================================================================= -->
      <!-- TAB 4: SINGAPORE SAVINGS BONDS (SSB) & MAS T-BILLS -->
      <!-- ========================================================================= -->
      <div class="space-y-6">
        <!-- Top Fixed Income Aggregate Cards -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div class="text-xs text-zinc-400">Total SSB Portfolio</div>
            <div class="text-xl font-bold font-mono text-zinc-100 mt-1">
              {formatSGD(ssbTotalInvested())}
            </div>
            <div class="text-[11px] text-zinc-500 mt-1">
              Cap Headroom: <span class="font-mono text-emerald-400">{formatSGD(ssbRemainingCap())}</span>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div class="text-xs text-zinc-400">MAS Individual SSB Cap</div>
            <div class="text-xl font-bold font-mono text-zinc-100 mt-1">
              S$200,000
            </div>
            <div class="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                class="bg-amber-400 h-full rounded-full transition-all"
                style="width: {Math.min((ssbTotalInvested() / 200000) * 100, 100)}%"
              ></div>
            </div>
          </div>

          <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div class="text-xs text-zinc-400">Active T-Bills Par Value</div>
            <div class="text-xl font-bold font-mono text-sky-400 mt-1">
              {formatSGD(tbillTotalFace())}
            </div>
            <div class="text-[11px] text-zinc-500 mt-1">
              {financeStore.tbills.length} issue(s) active
            </div>
          </div>

          <div class="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
            <div class="text-xs text-zinc-400">Fixed Income Security</div>
            <div class="text-base font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
              <ShieldCheck class="w-4 h-4" />
              AAA Singapore Sovereign
            </div>
            <div class="text-[10px] text-zinc-500 mt-1">
              100% Principal & interest backed by Singapore Govt
            </div>
          </div>
        </div>

        <!-- Section A: Singapore Savings Bonds (SSB) -->
        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Landmark class="w-4 h-4 text-amber-400" />
                Singapore Savings Bonds (SSB) Portfolio
              </h2>
              <p class="text-xs text-zinc-400">
                10-year step-up sovereign bonds with monthly MAS liquidity (S$2 redemption fee, zero capital loss risk)
              </p>
            </div>
            <button
              type="button"
              onclick={() => (isAddSSBOpen = !isAddSSBOpen)}
              class="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              Add SSB Holding
            </button>
          </div>

          <!-- Add SSB Inline Modal / Form -->
          {#if isAddSSBOpen}
            <div class="p-4 rounded-xl bg-zinc-950 border border-amber-800/50 space-y-3">
              <div class="text-xs font-semibold text-amber-300">Add New Singapore Savings Bond</div>
              <div class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label for="ssb-issue-code" class="text-zinc-400 block mb-1">Issue Code</label>
                  <input
                    id="ssb-issue-code"
                    type="text"
                    placeholder="e.g. SBJAN26 GX26010T"
                    bind:value={newSSB.issue_code}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  />
                </div>
                <div>
                  <label for="ssb-invest-amount" class="text-zinc-400 block mb-1">
                    Investment Amount (S$500 Multiples)
                  </label>
                  <input
                    id="ssb-invest-amount"
                    type="number"
                    step="500"
                    max="200000"
                    bind:value={newSSB.investment_amount}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label for="ssb-funding" class="text-zinc-400 block mb-1">Funding Source</label>
                  <select
                    id="ssb-funding"
                    bind:value={newSSB.funding_source}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  >
                    <option value="cash">Cash (Bank Account)</option>
                    <option value="srs">SRS (Supplementary Retirement)</option>
                  </select>
                </div>
                <div class="flex items-end gap-2">
                  <button
                    type="button"
                    onclick={handleSaveSSB}
                    class="flex-1 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer"
                  >
                    Save Bond
                  </button>
                  <button
                    type="button"
                    onclick={() => (isAddSSBOpen = false)}
                    class="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          {/if}

          <!-- SSB Table -->
          {#if financeStore.ssbBonds.length === 0}
            <div class="p-6 rounded-xl bg-zinc-900/30 border border-zinc-800/80 text-center text-xs text-zinc-500">
              No Singapore Savings Bonds recorded. Click "Add SSB Holding" to start tracking.
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="bg-zinc-900 text-zinc-400 font-medium border-b border-zinc-800">
                  <tr>
                    <th class="px-4 py-2.5">Issue Code</th>
                    <th class="px-4 py-2.5">Funding</th>
                    <th class="px-4 py-2.5 text-right">Investment</th>
                    <th class="px-4 py-2.5 text-right">10-Yr Avg Yield</th>
                    <th class="px-4 py-2.5 text-right">Total Interest</th>
                    <th class="px-4 py-2.5 text-right">Next Semi-Annual</th>
                    <th class="px-4 py-2.5 text-center">Status</th>
                    <th class="px-4 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800/60">
                  {#each financeStore.ssbBonds as b}
                    <tr class="hover:bg-zinc-900/40">
                      <td class="px-4 py-3 font-medium text-zinc-100">
                        {b.issue_code}
                        <div class="text-[10px] text-zinc-500">Issued: {b.issue_date} • Mat: {b.maturity_date}</div>
                      </td>
                      <td class="px-4 py-3">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-mono {b.funding_source === 'srs' ? 'bg-purple-950/60 text-purple-400 border border-purple-800/50' : 'bg-zinc-800 text-zinc-300'}">
                          {b.funding_source?.toUpperCase()}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right font-mono font-semibold text-zinc-100">
                        {formatSGD(b.investment_amount)}
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-emerald-400">
                        {formatPct(b.average_10yr_yield)}
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-zinc-200">
                        {formatSGD(b.total_interest_to_maturity)}
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-amber-300">
                        {formatSGD(b.next_coupon_payout)}
                      </td>
                      <td class="px-4 py-3 text-center">
                        <span class="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-medium">
                          Active
                        </span>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <button
                          type="button"
                          onclick={() => financeStore.deleteSSBBond(b.id)}
                          title="Delete bond"
                          class="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

        <!-- Section B: MAS Treasury Bills (T-Bills) Discount Ladder -->
        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Coins class="w-4 h-4 text-sky-400" />
                MAS Treasury Bills (T-Bills) Discount Ladder
              </h2>
              <p class="text-xs text-zinc-400">
                Short-term Singapore Government Securities (SGS) issued at a discount to par value (6-month & 1-year tenors)
              </p>
            </div>
            <button
              type="button"
              onclick={() => (isAddTBillOpen = !isAddTBillOpen)}
              class="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" />
              Add T-Bill Issue
            </button>
          </div>

          <!-- Add T-Bill Inline Form -->
          {#if isAddTBillOpen}
            <div class="p-4 rounded-xl bg-zinc-950 border border-sky-800/50 space-y-3">
              <div class="text-xs font-semibold text-sky-300">Add New MAS T-Bill Issue</div>
              <div class="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
                <div>
                  <label for="tbill-code" class="text-zinc-400 block mb-1">Issue Code</label>
                  <input
                    id="tbill-code"
                    type="text"
                    placeholder="e.g. BS26105A"
                    bind:value={newTBill.issue_code}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  />
                </div>
                <div>
                  <label for="tbill-tenure" class="text-zinc-400 block mb-1">Tenure</label>
                  <select
                    id="tbill-tenure"
                    bind:value={newTBill.tenure_type}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100"
                  >
                    <option value="6_month">6-Month (182 Days)</option>
                    <option value="1_year">1-Year (364 Days)</option>
                  </select>
                </div>
                <div>
                  <label for="tbill-face" class="text-zinc-400 block mb-1">Face Value (Par)</label>
                  <input
                    id="tbill-face"
                    type="number"
                    step="1000"
                    bind:value={newTBill.face_value}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label for="tbill-price" class="text-zinc-400 block mb-1">Price per $100</label>
                  <input
                    id="tbill-price"
                    type="number"
                    step="0.01"
                    bind:value={newTBill.issue_price_per_hundred}
                    class="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 font-mono"
                  />
                </div>
                <div class="flex items-end gap-2">
                  <button
                    type="button"
                    onclick={handleSaveTBill}
                    class="flex-1 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold cursor-pointer"
                  >
                    Save T-Bill
                  </button>
                  <button
                    type="button"
                    onclick={() => (isAddTBillOpen = false)}
                    class="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          {/if}

          <!-- T-Bills Table -->
          {#if financeStore.tbills.length === 0}
            <div class="p-6 rounded-xl bg-zinc-900/30 border border-zinc-800/80 text-center text-xs text-zinc-500">
              No T-Bills recorded. Click "Add T-Bill Issue" to track your discounted short-term MAS securities.
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="w-full text-xs text-left">
                <thead class="bg-zinc-900 text-zinc-400 font-medium border-b border-zinc-800">
                  <tr>
                    <th class="px-4 py-2.5">Issue Code</th>
                    <th class="px-4 py-2.5">Tenure</th>
                    <th class="px-4 py-2.5">Funding</th>
                    <th class="px-4 py-2.5 text-right">Face Value</th>
                    <th class="px-4 py-2.5 text-right">Cost Basis</th>
                    <th class="px-4 py-2.5 text-right">Discount Profit</th>
                    <th class="px-4 py-2.5 text-right">Cut-off Yield</th>
                    <th class="px-4 py-2.5">Maturity Date</th>
                    <th class="px-4 py-2.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-zinc-800/60">
                  {#each financeStore.tbills as t}
                    <tr class="hover:bg-zinc-900/40">
                      <td class="px-4 py-3 font-medium text-zinc-100">
                        {t.issue_code}
                      </td>
                      <td class="px-4 py-3">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
                          {t.tenure_type === '6_month' ? '6-Month' : '1-Year'}
                        </span>
                      </td>
                      <td class="px-4 py-3">
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-mono {t.funding_source?.startsWith('cpf') ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/50' : 'bg-zinc-800 text-zinc-300'}">
                          {t.funding_source?.toUpperCase()}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-right font-mono font-semibold text-zinc-100">
                        {formatSGD(t.face_value)}
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-zinc-300">
                        {formatSGD(t.total_investment_cost)}
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-emerald-400 font-semibold">
                        +{formatSGD(t.net_discount_profit)}
                      </td>
                      <td class="px-4 py-3 text-right font-mono text-sky-400 font-semibold">
                        {formatPct(t.cut_off_yield_p_a)}
                      </td>
                      <td class="px-4 py-3 font-mono text-zinc-400 text-[11px]">
                        {t.maturity_date}
                      </td>
                      <td class="px-4 py-3 text-center">
                        <button
                          type="button"
                          onclick={() => financeStore.deleteTBill(t.id)}
                          title="Delete T-Bill"
                          class="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}

          <!-- CPF Buffer Compliance Info Callout -->
          <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-start gap-2.5 text-xs text-zinc-400">
            <Info class="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
            <div>
              <span class="text-zinc-200 font-medium">CPF Investment Scheme (CPFIS) Buffer Rules:</span>
              CPF Ordinary Account investments in T-Bills require a minimum <span class="text-emerald-400 font-mono font-medium">S$20,000</span> liquid buffer to remain untouched. Special Account investments require a minimum <span class="text-emerald-400 font-mono font-medium">S$40,000</span> buffer. Moneta verifies buffer compliance automatically.
            </div>
          </div>
        </div>
      </div>

    {:else if activeTab === 'srs_ucits'}
      <!-- ========================================================================= -->
      <!-- TAB 5: SRS TAX SHIELD & IRISH UCITS COMPARATOR -->
      <!-- ========================================================================= -->
      <div class="space-y-6">
        <!-- Section A: Supplementary Retirement Scheme (SRS) Tax Shield & 10-Year Withdrawal -->
        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <PiggyBank class="w-4 h-4 text-purple-400" />
                Supplementary Retirement Scheme (SRS) Tax Shield Engine
              </h2>
              <p class="text-xs text-zinc-400">
                Dollar-for-dollar tax relief on annual contributions and 10-year penalty-free 50% concession withdrawal optimization
              </p>
            </div>
            <button
              type="button"
              onclick={handleSaveSRSPlan}
              class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              Save SRS Strategy
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label for="srs-residency" class="text-xs text-zinc-400 block mb-1 font-medium">Residency Status</label>
              <select
                id="srs-residency"
                bind:value={srsResidencyStatus}
                class="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-hidden focus:border-purple-500"
              >
                <option value="citizen_pr">Singapore Citizen / PR (Cap S$15,300/yr)</option>
                <option value="foreigner">Foreigner / Employment Pass (Cap S$35,700/yr)</option>
              </select>
            </div>
            <div>
              <label for="srs-ytd-contrib" class="text-xs text-zinc-400 block mb-1 font-medium">Current Year Contribution</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-xs text-zinc-500">S$</span>
                <input
                  id="srs-ytd-contrib"
                  type="number"
                  step="500"
                  min="0"
                  max={srsMetricsCalculated().annualCap}
                  bind:value={srsContributionYTD}
                  class="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-purple-500"
                />
              </div>
            </div>
            <div>
              <label for="srs-tax-rate" class="text-xs text-zinc-400 block mb-1 font-medium">Marginal Tax Bracket</label>
              <div class="relative">
                <input
                  id="srs-tax-rate"
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  bind:value={srsMarginalTaxRate}
                  class="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-purple-500"
                />
                <span class="absolute right-3 top-2 text-xs text-zinc-500">%</span>
              </div>
            </div>
            <div>
              <label for="srs-accumulated-bal" class="text-xs text-zinc-400 block mb-1 font-medium">Accumulated SRS Balance</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-xs text-zinc-500">S$</span>
                <input
                  id="srs-accumulated-bal"
                  type="number"
                  step="5000"
                  min="0"
                  bind:value={srsAccumulatedBalance}
                  class="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          <!-- SRS Summary Cards -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-zinc-800/80 text-xs">
            <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <span class="text-zinc-400">Annual Statutory Cap:</span>
              <div class="text-base font-bold font-mono text-zinc-100 mt-0.5">
                {formatSGD(srsMetricsCalculated().annualCap)}
              </div>
              <span class="text-[10px] text-zinc-500">Remaining: {formatSGD(srsMetricsCalculated().remainingAllowance)}</span>
            </div>

            <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <span class="text-zinc-400">Instant IRAS Tax Relief:</span>
              <div class="text-base font-bold font-mono text-emerald-400 mt-0.5">
                {formatSGD(srsMetricsCalculated().estimatedTaxSavings)}
              </div>
              <span class="text-[10px] text-zinc-500">Saved directly from income tax bill</span>
            </div>

            <div class="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <span class="text-zinc-400">10-Yr Target Withdrawal:</span>
              <div class="text-base font-bold font-mono text-purple-400 mt-0.5">
                {formatSGD(srsWithdrawalPlanCalculated().annualWithdrawalTarget)}/yr
              </div>
              <span class="text-[10px] text-zinc-500">~{formatSGD(srsWithdrawalPlanCalculated().monthlyWithdrawalTarget)}/month over 10 years</span>
            </div>

            <div class="p-3.5 rounded-xl bg-zinc-950 border {srsWithdrawalPlanCalculated().isTaxFreeStrategy ? 'border-emerald-800/60' : 'border-amber-800/60'}">
              <span class="text-zinc-400">50% Statutory Concession:</span>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span class="text-sm font-bold font-mono text-zinc-100">{formatSGD(srsWithdrawalPlanCalculated().annualTaxablePortion)} taxable</span>
              </div>
              <div class="text-[10px] {srsWithdrawalPlanCalculated().isTaxFreeStrategy ? 'text-emerald-400 font-semibold' : 'text-amber-400'} mt-1 flex items-center gap-1">
                <CheckCircle2 class="w-3 h-3" />
                {srsWithdrawalPlanCalculated().isTaxFreeStrategy ? '100% Tax-Free ($0 IRAS Tax)' : 'Subject to progressive tax bracket'}
              </div>
            </div>
          </div>
        </div>

        <!-- Section B: Irish UCITS vs US-Domiciled ETF Comparator -->
        <div class="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Globe class="w-4 h-4 text-emerald-400" />
                Irish UCITS vs US-Domiciled ETF Comparator (CSPX vs VOO)
              </h2>
              <p class="text-xs text-zinc-400">
                Quantify dividend withholding tax drag (15% vs 30%) and complete immunity from the ~40% US Estate Tax
              </p>
            </div>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/50 text-emerald-400">
              US-Ireland Treaty Protection
            </span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label for="ucits-val" class="text-xs text-zinc-400 block mb-1 font-medium">Portfolio Value</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-xs text-zinc-500">S$</span>
                <input
                  id="ucits-val"
                  type="number"
                  step="10000"
                  min="0"
                  bind:value={ucitsPortfolioValue}
                  class="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label for="ucits-div" class="text-xs text-zinc-400 block mb-1 font-medium">Dividend Yield</label>
              <div class="relative">
                <input
                  id="ucits-div"
                  type="number"
                  step="0.1"
                  min="0"
                  bind:value={ucitsDividendYieldPct}
                  class="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                />
                <span class="absolute right-3 top-2 text-xs text-zinc-500">%</span>
              </div>
            </div>
            <div>
              <label for="ucits-growth" class="text-xs text-zinc-400 block mb-1 font-medium">Expected Capital Growth</label>
              <div class="relative">
                <input
                  id="ucits-growth"
                  type="number"
                  step="0.5"
                  min="0"
                  bind:value={ucitsCapitalGrowthPct}
                  class="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-100 focus:outline-hidden focus:border-emerald-500"
                />
                <span class="absolute right-3 top-2 text-xs text-zinc-500">%</span>
              </div>
            </div>
            <div>
              <label for="ucits-horizon" class="text-xs text-zinc-400 block mb-1 font-medium">Investment Horizon</label>
              <select
                id="ucits-horizon"
                bind:value={ucitsHorizonYears}
                class="w-full px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-xs text-zinc-100 focus:outline-hidden focus:border-emerald-500"
              >
                <option value={10}>10 Years</option>
                <option value={15}>15 Years</option>
                <option value={20}>20 Years</option>
                <option value={25}>25 Years</option>
                <option value={30}>30 Years</option>
              </select>
            </div>
          </div>

          <!-- Comparison Side-by-Side Cards -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/80">
            <!-- US Domiciled Card -->
            <div class="p-4 rounded-xl bg-zinc-950 border border-red-900/40 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-red-400">US-Domiciled ETF (VOO / SPY / IVV)</span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-red-950/70 text-red-400 border border-red-800/50">
                  30% WHT + 40% Estate Tax
                </span>
              </div>
              <div class="text-xs space-y-1.5 text-zinc-300">
                <div class="flex justify-between">
                  <span class="text-zinc-400">Dividend Withholding Tax:</span>
                  <span class="font-mono text-red-400 font-semibold">30% (Standard Non-Resident)</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">Annual Dividend Tax Loss:</span>
                  <span class="font-mono text-zinc-200">-{formatSGD(ucitsComparisonResult().usEtfAnnualTaxDrag)}/year</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">US Estate Tax Vulnerability:</span>
                  <span class="font-mono text-red-400 font-semibold">Up to 40% on &gt; US$60k</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">Potential Estate Tax Exposure:</span>
                  <span class="font-mono text-red-400 font-bold">{formatSGD(ucitsComparisonResult().usEstateTaxExposureRisk)}</span>
                </div>
              </div>
            </div>

            <!-- Irish UCITS Card -->
            <div class="p-4 rounded-xl bg-zinc-950 border border-emerald-900/50 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-emerald-400">Irish-Domiciled UCITS (CSPX / VUAA / SWRD)</span>
                <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-400 border border-emerald-800/50">
                  15% WHT + 0% Estate Tax
                </span>
              </div>
              <div class="text-xs space-y-1.5 text-zinc-300">
                <div class="flex justify-between">
                  <span class="text-zinc-400">Dividend Withholding Tax:</span>
                  <span class="font-mono text-emerald-400 font-semibold">15% (US-Ireland Treaty)</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">Annual Tax Savings:</span>
                  <span class="font-mono text-emerald-400 font-semibold">+{formatSGD(ucitsComparisonResult().annualTaxSavingsWithUCITS)}/year</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">US Estate Tax Vulnerability:</span>
                  <span class="font-mono text-emerald-400 font-semibold">0% (Completely Exempt)</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">{ucitsHorizonYears}-Year Compounded Gain:</span>
                  <span class="font-mono text-emerald-400 font-bold">+{formatSGD(ucitsComparisonResult().cumulativeCompoundedTaxSavings)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
