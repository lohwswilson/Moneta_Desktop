# Bank Statement Import Wizard & Categorization Rules

Moneta Desktop includes an interactive bank statement import wizard with drag-and-drop support for **CSV** and **Quicken QIF** statement files, combined with an automated categorization rules engine tailored for Singapore and regional merchants.

---

## 1. Statement Import Wizard Overview

Clicking **Import Statement** in the Checkbook Register top toolbar opens the **Bank Statement Import Wizard**:

```
+---------------------------------------------------------------------------------------------------------+
| [📄] Bank Statement Import Wizard                                                                   [X] |
| Import CSV or QIF bank statements with automatic category classification                                |
+---------------------------------------------------------------------------------------------------------+
| Target Account: [ DBS High Interest Checking (SGD) - DBS Bank ▼ ]             [ Load Sample Statement ] |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|       [⬆️]  Drop your bank statement file here (.csv, .qif, .txt)                                       |
|             or click to browse from your computer                                                       |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Supported File Formats & Bank Presets

The parser ([`src/lib/data/importers/bankStatementParser.ts`](file:///opt/moneta_desktop/src/lib/data/importers/bankStatementParser.ts)) dynamically detects delimiters (`,`, `;`, `\t`) and normalizes date structures across major institutions:

### A. Singapore Bank Formats
1. **DBS / POSB**:
   - Headers: `Transaction Date`, `Reference`, `Debit Amount`, `Credit Amount`, `Client Reference`.
   - Date formats: `DD Mon YYYY` (e.g. `15 Sep 2026`) or `DD/MM/YYYY`.
2. **OCBC Bank**:
   - Headers: `Transaction Date`, `Value Date`, `Description`, `Debit`, `Credit`.
   - Date format: `DD/MM/YYYY`.
3. **United Overseas Bank (UOB)**:
   - Headers: `Transaction Date`, `Value Date`, `Description`, `Withdrawal`, `Deposit`.
   - Date format: `DD Mon YYYY` or `DD/MM/YYYY`.
4. **Standard Chartered & Wise**:
   - Headers: `Date`, `Description`, `Amount`, `Currency`.
   - Single signed amount column (+ for credits, - for debits).

### B. Quicken Interchange Format (QIF)
- Supports standard `!Type:Bank` QIF exports:
  - `D`: Transaction Date
  - `T`: Amount
  - `P`: Payee / Merchant
  - `M`: Memo / Notes
  - `L`: Category
  - `^`: End of Record

---

## 3. Intelligent Duplicate Detection

Before presenting parsed rows for import, Moneta Desktop cross-references the incoming file against transactions already recorded in your active account:

- **Matching Logic**:
  $$\text{Duplicate Flag} = \text{true} \iff (\text{Date}_{\text{import}} = \text{Date}_{\text{ledger}}) \;\land\; (|\text{Amount}_{\text{import}} - \text{Amount}_{\text{ledger}}| < 0.001)$$
- **Auto-Uncheck**: Duplicate rows are visually tagged with an amber `Duplicate` badge and their checkbox is **automatically unchecked by default**.
- **User Override**: If a duplicate charge is legitimate (e.g., two identical $10 transactions on the same day), simply check the row to import both.

---

## 4. Singapore Merchant Rules Engine

The categorization engine ([`src/lib/data/rulesEngine.ts`](file:///opt/moneta_desktop/src/lib/data/rulesEngine.ts)) uses priority-ordered substring matching on payee names and memo descriptions.

### Default Singapore Merchant Rules (33 Rules)

| Category | Priority | Match Patterns | Examples |
| :--- | :---: | :--- | :--- |
| **Groceries** | 1 | `fairprice`, `cold storage`, `sheng siong`, `don don donki`, `redmart` | NTUC FairPrice, Don Don Donki Orchard, RedMart Lazada |
| **Dining & Cafes** | 2 | `starbucks`, `bacha coffee`, `mcdonald`, `toast box`, `kopitiam`, `foodpanda`, `deliveroo` | Bacha Coffee ION, Toast Box Marina, McDonald's |
| **Transportation** | 3 | `grab`, `gojek`, `simplygo`, `smrt`, `comfortdelgro`, `shell`, `esso` | Grab Ride SG, SMRT Transit, SimplyGo MRT/Bus |
| **Utilities** | 4 | `sp services`, `sp power`, `singtel`, `starhub`, `m1 limited` | SP Services Electricity/Water, Singtel Fibre |
| **Subscriptions** | 5 | `apple.com`, `netflix`, `spotify`, `openai`, `claude.ai`, `google cloud` | Apple Services, ChatGPT Plus, Claude Pro, Netflix SG |
| **Income & Salary** | 6 | `salary`, `payroll` | Monthly Salary Payroll, Employer Deposit |
| **Investments** | 6 | `dividend` | Quarterly Stock Dividend Credit |

### Custom Rule Extension
Custom categorization rules can be added with custom priorities. The evaluator evaluates lower priority numbers first (1 before 2), ensuring specific merchants take precedence over broad keywords.

---

## 5. Import Review & Commit Workflow

1. **Upload File**: Drop your bank export CSV/QIF onto the dropzone (or click **Load Sample** to test).
2. **Review Extracted Rows**:
   - The preview table displays parsed dates, payees, auto-classified categories (marked with a ✨ sparkle icon), amounts, and duplicate badges.
   - Summary banner displays total selected items, duplicate count, total inflows, and total outflows.
3. **Inline Adjustments**:
   - Modify payee names or override categories directly within table cells before committing.
   - Select or deselect individual rows using checkboxes.
4. **Commit to Ledger**:
   - Click **Import Selected Transactions**.
   - Moneta Desktop commits the records directly into SQLite (or the active adapter), updates account balances, and refreshes the register.
