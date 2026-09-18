# Payee Intelligence & Directory

This document covers the **Phase 2** payee intelligence layer: merchant analytics, cadence detection, and the two places payee memory feeds back into transaction capture.

*Parity with Odoo `payee.py`.*

---

## 1. Overview

Moneta Desktop treats a payee as more than a name on a line. Each payee accumulates **memory** — the category you habitually file it under, how often it recurs, what it typically costs — and that memory is used to pre-fill the next transaction rather than asking you to re-decide.

```
+---------------------------------------------------------------------------+
|  Capture-time memory                     Analytical surface               |
|                                                                           |
|  QuickAddModal                           PayeeDirectoryHub                |
|  ├── Autocomplete over payee list        ├── Spend ranking & filters       |
|  ├── Category from default_category_name ├── Cadence classification        |
|  ├── Fallback to suggested_category_name ├── Average ticket size           |
|  ├── Amount prefill from avg_amount      ├── Top-merchant summary          |
|  └── Rules-engine fallback               └── Category memory override      |
+-----------------------------------+---------------------------------------+
                                    |
                                    v
              payee memory (PayeeIntelligence)
                                    |
              +---------------------+---------------------+
              v                     v                     v
    +-------------------+ +-------------------+ +-------------------+
    |  SqliteAdapter    | |   OdooAdapter     | |   MockAdapter     |
    |  `payees` table   | |  payees/list      | |  Seeded directory |
    |                   | |  payees/update    | |                   |
    +-------------------+ +-------------------+ +-------------------+
```

---

## 2. Data Shape

`PayeeIntelligence` in [`src/lib/types/moneta.ts`](../src/lib/types/moneta.ts):

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `string \| number` | Identity |
| `name` | `string` | Unique per user |
| `default_category_name` | `string?` | **Authoritative** category memory — set by explicit user override |
| `suggested_category_name` | `string?` | **Inferred** suggestion, weaker than the default |
| `total_spend` | `number` | Lifetime outflow |
| `transaction_count` | `number` | Lifetime count |
| `avg_amount` | `number` | Average ticket size |
| `last_transaction_date` | `string?` | Most recent activity |
| `detected_cadence` | enum | `none` \| `weekly` \| `biweekly` \| `monthly` \| `quarterly` \| `yearly` |
| `website` | `string?` | Merchant site |
| `notes` | `string?` | Free text |

### Two categories, deliberately distinct

`default_category_name` and `suggested_category_name` are **not** interchangeable. The default is a decision the user made; the suggestion is an inference the system made. Capture prefers the former and only falls back to the latter. Conflating them would let an inference silently overwrite a stated preference — and once overwritten, the user has no way to tell which of the two they are looking at.

---

## 3. Capture-Time Behaviour (`QuickAddModal.svelte`)

Payee memory is consumed at three points while capturing a transaction:

1. **Autocomplete** — typing filters the payee list. Selecting a suggestion:
   - sets the payee name,
   - fills the category from `default_category_name`, falling back to `suggested_category_name`,
   - pre-fills the **amount** from `avg_amount` when the amount field is still empty or zero. A pre-filled amount is an offer, not an override: it only applies when nothing has been typed.
2. **Category prediction on payee change** — resolved in priority order:
   - exact payee-memory match → `default_category_name`
   - exact payee-memory match → `suggested_category_name`
   - otherwise → the rules engine (`predictCategory(payeeName, memo)`), matching the 33 built-in Singapore merchant rules.
3. **User-edit suppression** — once the category field has been edited by hand, `userEditedCategory` latches and automatic prediction stops for that transaction. The app does not argue with a category you have just chosen.

Split transactions are excluded from automatic prediction entirely (`!isSplit`), since a split has no single category to predict.

---

## 4. The Directory (`PayeeDirectoryHub.svelte`)

A dedicated view for the merchant layer as a whole:

- **Spend ranking** — payees ordered by lifetime outflow, with transaction counts and average ticket size.
- **Cadence classification** — `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`, or `irregular`, so a subscription and a one-off are distinguishable at a glance.
- **Filtering and sorting** across name, category and cadence.
- **Top-merchant summary** — the largest single relationship in the ledger.
- **Edit modal** — override the default category, cadence, website and notes. This is the **only** place a payee's category memory is written.

**Sources:** `/api/v1/mobile/payees/list` and `/api/v1/mobile/payees/update` · SQLite `payees` table · Mock sandbox directory.

---

## 5. SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS payees (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  default_category_name TEXT,
  suggested_category_name TEXT,
  detected_cadence TEXT DEFAULT 'none',
  website TEXT,
  notes TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

Note `name TEXT UNIQUE NOT NULL` — the SQLite adapter's `updatePayee` upserts `ON CONFLICT(name)`, so editing a payee with an existing name merges into that row rather than creating a duplicate. Lifetime figures (`total_spend`, `transaction_count`, `avg_amount`, `last_transaction_date`) are **not stored here**: they are aggregated from the `transactions` table at read time, so they cannot fall out of step with the ledger they summarise.

---

## 6. Relationship to the Rules Engine

The rules engine (`src/lib/data/rulesEngine.ts`) and payee memory answer the same question — *what category is this?* — from different evidence, and are consulted in that order:

| Source | Evidence | Strength |
| :--- | :--- | :--- |
| `default_category_name` | You filed this payee here before | Explicit |
| `suggested_category_name` | Inferred from history | Inferred |
| Rules engine | Merchant keyword matched a known pattern | Heuristic |

Payee memory always wins, because it is derived from this ledger's actual history while the rules engine is a general-purpose default seeded for Singapore merchants. A rule that fires on "Grab" cannot know that your particular Grab charges are filed under Transport rather than Dining.

See [`03_BANK_STATEMENT_WIZARD_AND_RULES.md`](03_BANK_STATEMENT_WIZARD_AND_RULES.md) for the rules engine itself.
