# ADR 0001 — Subscription Tiers and Cloud Sync

- **Status:** Proposed
- **Date:** 2026-09-19
- **Supersedes:** ROADMAP.md Phase 8 (Supabase Cloud Sync, E2EE, Stripe)
- **Deciders:** Wilson (product owner)

---

## Context

Moneta Wealth is an offline-first personal finance application with a pluggable repository: a local SQLite store (`SqliteAdapter`), a live Odoo adapter against `moneta_wealth` (`OdooAdapter`), and a demo sandbox (`MockAdapter`). Phases 1–5 are complete — ledger, banking, planning hubs, portfolio and property/rental.

**Moneta Cloud** is the existing self-hosted Odoo 18 `moneta_wealth` backend. It is not a new service: it already models every entity the Desktop app does (accounts, transactions, budgets, bills, goals, securities, lots, properties, tenants, rent payments, loans) via `/api/v1/mobile/*`.

The product intent is a subscription model where Moneta Cloud provides the paid tier, **Moneta Mobile** provides the multi-device story, and each subscriber has their own database.

Two constraints already in force shape everything below:

- `AGENTS.md` §1.1 — *"Every feature must be fully operational without an internet connection when using the `SqliteAdapter`. Never introduce mandatory external network calls or telemetry."*
- `ROADMAP.md` §Phase 8 — *"Pro Tier unlocks automated live cloud sync across multiple desktop and mobile devices"* — i.e. the tier was already conceived around sync rather than feature locks.

---

## Decision

### 1. Gate on entitlement, never on connectivity

A feature is gated by **subscription tier**, not by whether the app is online. A subscriber uses gated features fully offline against local SQLite.

This preserves the offline-first invariant, keeps the existing rental/loan/portfolio implementations across all three adapters live rather than dead, and avoids the failure mode where a landlord at a vacant property with no signal sees a locked panel.

**Rejected:** gating on "connected to Moneta Cloud". It would break §1.1, strand working code, and disable features precisely when offline-first earns its keep.

### 2. Tier composition

> **See also [ADR 0004](0004-entitlement-matrix-and-lifecycle.md)** for the entitlement matrix (what each tier can *access* — Cloud login, sync, Mobile, bank feeds), pricing, and the free → paid → cancelled lifecycle. This section defines which *features* exist in which tier; ADR 0004 defines what a tier entitles.

**Free — "the complete personal ledger."** A finished product, not a trial.

| Domain | Included |
| :--- | :--- |
| Ledger | Accounts, register, 1-click `Clr` reconciliation, split transactions |
| Ingest | Manual statement import (CSV / QIF), duplicate detection, 33 SG merchant rules, payee intelligence |
| Recurring | Bills, subscription detection, mark-as-paid |
| Overview | Net worth, Property equity & LTV, loans & amortization, reports, multi-currency |

**Subscriber — "depth, domains and the cloud."**

| Domain | Included | Modelled on |
| :--- | :--- | :--- |
| Planning depth | Zero-based envelope budgets, financial goals, cash flow forecasting | YNAB (method as product) |
| Domain — property | Landlord Hub: tenants, leases, rent roll, overdue | Quicken Home & Business (top tier) |
| Domain — investment | Portfolio analytics, tax-lot accounting, stock analysis | Quicken Premier |
| Domain — regional | Tax packs: CPF, EPF, IRAS reliefs, LHDN Borang BE | No US competitor |
| Ingest | **Automated bank feeds** | Category standard |
| Platform | Multi-device sync, Moneta Mobile, cloud backup & restore, partner sharing | YNAB / Monarch / Copilot |

**Two rules that keep the boundary predictable:**

1. **Totals are never gated.** Net worth and the Command Center must remain fully inspectable. A dashboard showing assets a user cannot open reads as broken, not as an upsell. Gate the specialist tools, never the figures they roll up into.
2. **The strongest conversion mechanic is experience-based, not screen-based.** Manual import is free; automated feeds are paid. The free user performs the chore monthly and feels the friction; the subscriber never thinks about it. The decision re-presents itself every month.

### 3. Enforcement: the service is the gate

> **Amended 2026-09-19** after the scope decision that **all product features are implemented in Moneta Wealth**, with Odoo serving only as a sync store plus licensing and billing (ADR 0002 §2). The original text assumed subscriber-only logic ran server-side; it does not. See [ADR 0003 §5](0003-licence-and-billing-topology.md) for the full position.

Moneta Wealth is a Tauri binary — **its JavaScript ships to the user and can be patched.** With no server-side feature logic, a local licence check is a **speed bump, not a lock**, and the team should not over-invest in defeating tampering. Someone who patches a paid app was not a customer.

What *is* enforceable is the service itself:

- **Sync, multi-device, cloud backup, Moneta Mobile and bank feeds all require the server.** A non-subscriber does not sync — and that cannot be patched away, because there is nothing on the client to patch. The data simply never leaves the machine.
- **The local licence token gates the UI only.** It selects what to render and must never be relied upon for security.
- **Premium domains can be gated at the data layer** — the sync API may refuse premium entity types without a valid entitlement, so locally-computed data never backs up or reaches Mobile.

Lead the paid tier with what only the service provides. Feature gates on locally-executed tools are a secondary nudge, not the primary value.

### 4. Licence token and offline grace period

Because subscriber features run locally, they need a locally-verifiable entitlement:

```
LicenceToken {
  sub        : subscriber id
  tier       : 'free' | 'subscriber'
  features   : string[]      // feature grants
  iat        : issued-at
  exp        : expires-at    // iat + grace window (30 days)
  jti        : token id      // for revocation
  sig        : signature     // server-signed
}
```

- The Desktop app embeds the **public key** and verifies `sig` and `exp` **locally**, with no network call. This is what makes offline use possible.
- The token is refreshed on any successful online call, resetting `exp` to `now + 30 days`. A subscriber who connects **once a month** stays permanently functional offline — including on a plane, which is exactly when the paying customer must not be worse off than the free one.
- On expiry, the app **degrades gracefully to the free tier**. It must never lock out, hide existing data, or discard anything. Gated views show an upsell; the ledger keeps working.

**Honest limitation — revocation lag.** Offline, an expired or cancelled subscription cannot be detected until the grace window lapses. That is accepted. It only affects locally-executed features; anything server-side is refused immediately regardless of token state.

### 5. Local-first with optional sync — replacing the three-mode switch

> **Implemented 2026-09-19.** The refactor is done — see *As built* below.

At the time of writing, `config.mode` was `'odoo' | 'sqlite' | 'mock'`, and `odoo` meant *live queries against the server*. With Mobile in the picture that model breaks: both clients would need the server up simultaneously.

The model becomes:

```
SQLite is ALWAYS the local store          (offline-first survives unchanged)
Cloud sync is an ADDITIONAL capability    (subscribers)
Moneta Mobile syncs through the same path (subscribers)
```

#### As built

`ConnectionConfig` is now:

```typescript
interface ConnectionConfig {
  dataSource: 'local' | 'sandbox';   // which LOCAL store
  serverUrl: string;                 // Moneta Cloud — optional, for sync
  apiToken: string;
}
```

`cloudConfigured` is **derived** from the credentials rather than being a mode. Three behavioural changes:

- `updateAdapter()` points `repository` at SQLite — or Mock for the sandbox — and **never** at `OdooAdapter`.
- `refreshAll()` no longer returns early when the server is unreachable. Cloud work is best-effort and must never prevent local data from loading; the previous implementation blanked the app on an offline launch even though the data was on disk.
- `testCurrentConnection()` probes **Moneta Cloud** rather than the local repository, since the local store needs no connection and probing it always reported success while telling the user nothing.

The two Odoo-touching paths — `syncOdooSettingsToSqlite()` and `migrateFromOdoo()` — already pulled *into* SQLite and needed no change. They were the correct direction all along, which is why this refactor touched four files rather than the eighty-odd call sites it first appeared to threaten.

A saved config in the old shape is migrated on load: `'mock'` → `'sandbox'`, and both `'odoo'` and `'sqlite'` → `'local'` with credentials retained. Both used the local database as the real store; only query routing differed, and that is what changed. Verified against all three legacy shapes, including that an unreachable cloud renders the app rather than blanking it.

### 6. Drop Phase 8; Moneta Cloud is the sync target

Supabase is removed. A second backend with a parallel schema would duplicate every entity and add a third sync target to keep in parity, for no capability the Odoo backend lacks.

**Two consequences to accept deliberately, not discover later:**

- **E2EE is dropped.** Phase 8 promised zero-knowledge backup ("user master password never touches the server"). That is **incompatible with server-side feature enforcement** — the server cannot run premium logic over data it cannot read. Since the server must see the data to gate features, E2EE cannot apply to synced data. Encrypted *backup archives* remain possible; encrypted *live sync* does not.
- **The hard work is not removed, only relocated.** Conflict resolution and the offline mutation queue were Phase 8's difficult items. They are still required — against Odoo instead of Supabase. Sync is platform work, not a headline feature.

### 7. One database per subscriber

Per-subscriber isolation is right for financial data. Two operational commitments follow, and both must be built **before** customers, not after:

- **Migrations scale with subscribers.** Every module change runs against every subscriber DB, with partial-failure states at scale. `odoo_migrator` is the right foundation; this is why it matters.
- **Backups become an operational duty.** Financial records on our infrastructure make their data safety our responsibility. Decide retention and restore-testing now.

### 8. Trial

Subscriber features ship with a **14–30 day trial, no card required**. For a gated feature this is not optional: a rental owner must *feel* the rent roll before paying. A locked panel converts far worse than a working trial.

---

## Consequences

**Positive**

- Offline-first survives; no feature is disabled by connectivity.
- Existing SQLite implementations of gated features remain live, not dead code.
- No second backend, no duplicated schema, no third sync target.
- Billing enforcement sits where it can actually be enforced.

**Negative**

- No E2EE for synced data.
- Sync engine (conflict resolution, mutation queue) must still be built — Phase 8's cost, relocated.
- Per-subscriber DBs create N-way migration and backup obligations.
- Local gates are bypassable; revenue depends on pricing and value, not DRM.
- **Sequencing risk:** if the paid tier's appeal rests mainly on Moneta Mobile, there is no revenue until Mobile ships. Mitigate by shipping **cloud backup** (cheap, answers a real fear) and **partner sharing** (the Odoo backend already has `shared_user_ids` and record rules) before Mobile.

---

## Alternatives considered

| Alternative | Why rejected |
| :--- | :--- |
| Gate on cloud connectivity | Breaks §1.1; strands working code; disables features exactly when offline matters (a landlord at a vacant unit) |
| Gate the ledger core (accounts, register, import) | The free tier would feel like a demo. Loses users before they evaluate depth. |
| Supabase as a second backend | Duplicates every entity; adds a third sync target; no capability Odoo lacks |
| E2EE for synced data | Mutually exclusive with server-side feature enforcement — pick one; this ADR picks enforcement |
| Multi-company single DB instead of per-subscriber DB | Weaker isolation for financial data. Revisit only if per-DB cost forces it; the module already scopes by `user_id` with record rules, so the groundwork exists |
| Client-side licence enforcement only | Unenforceable in a Tauri app. Accepted as a limitation rather than pretended away. |

---

## Open questions

1. **Trial length** — 14 or 30 days?
2. **Cancellation behaviour** — read-only, export-and-lock, or deletion? **Data export on cancellation is non-negotiable** for financial records, and is a trust signal that helps sell the subscription.
3. **Pricing** — and whether the free tier needs value-scaled limits (e.g. N accounts, N years) to lift conversion.
4. **Token signing** — HMAC with a shared secret, or Ed25519 with an embedded public key? The latter is preferable: the app verifies without holding a secret.
5. **Bank feed provider** — Plaid, Salt Edge, or SimpleFIN for SG/MY coverage.
6. **Migration tooling** — what automates N subscriber-DB upgrades, and who is paged when one fails?

---

## References

- [`AGENTS.md`](../../AGENTS.md) §1.1 — offline-first invariant
- [`ROADMAP.md`](../../ROADMAP.md) — Phase 8 (superseded by this ADR)
- [`11_PROPERTY_MORTGAGES_AND_RENTAL.md`](../11_PROPERTY_MORTGAGES_AND_RENTAL.md) — the Landlord Hub this ADR gates
- Odoo `moneta_wealth` — `/api/v1/mobile/*`, the existing cloud surface
