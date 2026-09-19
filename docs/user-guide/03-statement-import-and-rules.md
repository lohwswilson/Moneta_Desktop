# Bank Statement Import & Rules Engine

Importing monthly bank statements should not take hours of manual data entry. Moneta Wealth features a drag-and-drop statement parser coupled with an intelligent auto-categorization rules engine.

---

## 📥 Drag-and-Drop Statement Wizard (`StatementImportModal.svelte`)

To import transactions from your bank:

1. Click the **`Import Statement`** button in [`TopMenuBar.svelte`](file:///opt/moneta_wealth/src/lib/components/TopMenuBar.svelte) or above the checkbook register.
2. The [`StatementImportModal.svelte`](file:///opt/moneta_wealth/src/lib/components/StatementImportModal.svelte) opens:
   - Select the target **Account** (e.g. `DBS Multiplier` or `Citi Cash Back`).
   - Drag and drop your statement file directly into the drop zone (or click to browse).
3. **Supported Formats**:
   - **CSV**: Standard comma-separated transaction exports from major banks (DBS, POSB, OCBC, UOB, Standard Chartered, HSBC, Citibank).
   - **QIF**: Quicken Interchange Format standard.

```
+-------------------------------------------------------------------------------+
|  Import Bank Statement                                                    [X] |
+-------------------------------------------------------------------------------+
|  Target Account: [ DBS Multiplier - S$ 5,210.80               ▼ ]             |
|                                                                               |
|  +-------------------------------------------------------------------------+  |
|  |                📁 Drag & Drop your CSV or QIF file here                  |  |
|  |                           or click to browse                            |  |
|  +-------------------------------------------------------------------------+  |
|                                                                               |
|  Preview: 42 transactions detected                                            |
|  • 39 Auto-categorized via Singapore Merchant Rules                           |
|  • 3 Duplicates ignored                                                       |
|                                                                               |
|  [ Cancel ]                                            [ Commit 39 Items ]    |
+-------------------------------------------------------------------------------+
```

---

## 🤖 33 Singapore Merchant Auto-Categorization Rules

When a statement is parsed, the transaction descriptions pass through Moneta Wealth's built-in rule engine (`src/lib/data/rulesEngine.ts`). 

The engine normalizes noisy merchant strings and automatically assigns the correct budget envelope:

| Merchant Keyword Patterns | Clean Payee Name | Auto-Assigned Category | Budget Envelope |
| :--- | :--- | :--- | :--- |
| `FAIRPRICE`, `FP ONLINE`, `CHEERS` | NTUC FairPrice | `Groceries` | Needs |
| `SHENG SIONG`, `SHENGSIONG` | Sheng Siong Supermarket | `Groceries` | Needs |
| `COLD STORAGE`, `CS FRESH` | Cold Storage | `Groceries` | Needs |
| `GRAB*`, `GRABTAXI`, `GRAB FOOD` | Grab / GrabFood | `Transport / Dining` | Needs / Wants |
| `FOODPANDA`, `DELIVEROO` | Foodpanda / Deliveroo | `Dining & Takeaway` | Wants |
| `SINGTEL`, `SINGTEL MOBILE` | Singtel Telecommunications | `Utilities: Mobile & Broadband` | Needs |
| `STARHUB`, `M1 LIMITED` | StarHub / M1 | `Utilities: Mobile & Broadband` | Needs |
| `SP SERVICES`, `SP GROUP` | SP Services Ltd | `Utilities: Electricity & Water` | Needs |
| `BUS/MRT`, `TRANSITLINK`, `SIMPLYGO`| SimplyGo (TransitLink) | `Public Transport` | Needs |
| `COMFORTDELGRO`, `CDG ZIG` | ComfortDelGro Taxi | `Transport: Taxi` | Needs |
| `SHOPEE*`, `LAZADA*`, `AMZN` | Shopee / Lazada / Amazon | `Online Shopping` | Wants |
| `NETFLIX`, `SPOTIFY`, `DISNEY` | Digital Entertainment | `Subscriptions` | Wants |
| `GREAT EASTERN`, `PRUDENTIAL` | Insurance Carrier | `Insurance Premiums` | Needs |
| `CPF BOARD`, `CPF MEDISAVE` | Central Provident Fund | `CPF Contributions` | Savings |

!!! note "Smart Merchant Cleaning"
    Messy bank transaction strings like `POS DEBIT-0918-FAIRPRICE FINEST-SG#129` are automatically cleaned into `NTUC FairPrice` with category `Groceries` without requiring manual text editing.

---

## 🛡️ Duplicate Transaction Prevention

To prevent duplicate entries when importing overlapping statement periods:
- The parser computes a unique transaction fingerprint using the tuple `(Date, Amount, Payee/Description)`.
- If an identical transaction already exists in the selected account register, Moneta Wealth flags it as a duplicate and omits it from the pending commit queue.
- You can review the duplicate list in the preview table before finalizing.

---

## 🔍 Pre-Commit Review & Verification

1. The preview table displays all parsed transactions with their clean Payees and auto-assigned categories.
2. If any transaction has an unrecognized merchant, you can click the category dropdown right in the preview table to assign it before committing.
3. Click **Commit Transactions** to append the batch to your SQLite register.
4. All newly imported transactions enter the register in `'cleared'` status, ready for immediate balance verification.
