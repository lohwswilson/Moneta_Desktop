# Moneta Wealth User Guide

Welcome to the **Moneta Wealth User Guide**. This comprehensive handbook walks you through every feature, workflow, and financial tool available in the desktop application.

Moneta Wealth combines the checkbook ledger precision of **Quicken Premier**, the envelope budgeting discipline of **YNAB**, and modern personal wealth management into a single, high-performance desktop application.

---

## 🧭 Navigation Map

| Chapter | Topic | Key Capabilities Covered |
| :--- | :--- | :--- |
| [**1. Getting Started**](01-getting-started.md) | App Launch & Tour | Tauri Desktop vs Browser modes, Command Center hero, Top Menu Bar, Sidebar, Offline-first privacy |
| [**2. Accounts & Banking**](02-accounts-and-banking.md) | Ledger & Register | Account types, Checkbook Register, QuickAdd modal, multi-split transactions, 1-click reconciliation, 10-second balance verification |
| [**3. Statement Import & Rules**](03-statement-import-and-rules.md) | Automated Ingestion | Drag-and-drop CSV & QIF statement wizard, 33 Singapore merchant rules, duplicate transaction prevention |
| [**4. Budgeting & Bills**](04-budgeting-and-bills.md) | Cash Planning | Zero-based envelope budgeting (Needs/Wants/Savings), "Can I Spend?" Affordability Engine, recurring bills countdown, 1-click "Mark as Paid" |
| [**5. Cash Flow & Analytics**](05-cash-flow-and-analytics.md) | Trajectory & Vendors | 30-to-365 day forward liquidity trajectory, interactive Sankey diagram, Payee Intelligence directory & spend cadence |
| [**6. Net Worth, FIRE & Goals**](06-wealth-and-goals.md) | Long-Term Wealth | Consolidated Net Worth, Emergency Runway months, 4% Rule FIRE milestone progress, sinking funds & goal progress |
| [**7. Investments & Property**](07-investments-and-property.md) | Assets & Liabilities | Stock portfolio holdings, tax lots (FIFO/LIFO/SpecID), realized gains, property valuation, mortgage amortization, step-rate prepayment, landlord rent roll |
| [**8. Database & Backups**](08-database-and-backups.md) | Data Ownership | Embedded SQLite engine, snapshot export (`.sqlite`), binary restore & audit, safe ledger reset, optional Moneta Cloud sync |

---

## 🔒 Privacy & Local-First Philosophy

Moneta Wealth is designed with **radical data privacy**:

!!! tip "100% Offline by Default"
    Your financial records, bank balances, stock holdings, and property records never leave your machine unless you explicitly configure Moneta Cloud sync. All transactions and calculations run directly in your local WebAssembly SQLite engine.

- **Zero Mandatory Telemetry**: No tracking, no user analytics, no background external pings.
- **Direct Data Ownership**: Your ledger resides in a standard SQLite binary database file that you can export, back up, or inspect with any SQLite tool at any time.
- **Fast & Responsive**: Powered by Svelte 5 runes and native WASM, view transitions and complex mathematical projections compute in single-digit milliseconds.
