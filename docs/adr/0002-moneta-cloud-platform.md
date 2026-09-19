# ADR 0002 — Moneta Cloud Platform Choice

- **Status:** Proposed
- **Date:** 2026-09-19
- **Related:** [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) (tiers and sync), ADR 0003 (licence topology)
- **Deciders:** Wilson (ANSIS Pte Ltd)

---

## Context

Moneta Cloud is the hosted backend for Moneta Wealth and Moneta Mobile. ADR 0001 established that it is the existing Odoo 18 `moneta_wealth_odoo` deployment rather than a new service, and dropped Supabase.

This ADR records the platform decision and — importantly — the **narrowed role** Odoo plays in the product.

**Moneta is a product of ANSIS Pte Ltd**, not a separate legal entity. ANSIS already operates an Odoo hosting business with an established pricing model (SGD $200/month per instance per client company; first 5 internal users free; $30/month additional internal users; $5/month portal users; covering managed cloud, PostgreSQL, SSL, daily backups, 99.9% SLA and security patching).

---

## Decision

### 1. Odoo 18 remains the platform

| Factor | Assessment |
| :--- | :--- |
| **Existing asset** | `moneta_wealth` ships a 45-route `/api/v1/mobile/*` surface and models every entity (accounts, transactions, budgets, bills, goals, securities, lots, properties, tenants, rent payments, loans) plus SG/MY satellites |
| **Existing competence** | ANSIS already runs Odoo hosting with SLA, backups and security patching. Moneta Cloud is a new instance of an operating business, not a new capability |
| **Migration experience** | BYQ6, SYC, SG07, SYC5 and `odoo_migrator` — the team knows where Odoo hurts before committing rather than after |
| **Multi-database is Odoo's design centre** | Odoo's own SaaS is many databases on shared infrastructure |
| **Accounting reuse** | Subscription invoicing, revenue recognition, dunning and tax handling come from Odoo Accounting rather than being rebuilt |

### 2. Odoo's role: headless engine, sync store, billing, and admin console

Odoo is responsible for four things:

1. **Headless domain engine** — all data models, ORM constraints, multi-currency handling, and scheduled automations (quotes, recurring rules) live in `moneta_core`
2. **Sync store** — the canonical cloud copy of subscriber data via `/api/v1/mobile/*`
3. **Licensing and billing** — subscriptions, entitlement, invoicing (see ADR 0003)
4. **Admin and audit console** — standard Odoo list/form views for system administration, debugging, and customer support

> **Amended 2026-09-19.** Decoupled consumer UI/UX from Odoo. **Moneta Wealth (Desktop & Mobile) is the exclusive consumer product surface.** Custom OWL dashboards and consumer web UI development in Odoo are retired. This eliminates the dual-frontend maintenance burden while strictly retaining data model, calculation, and API parity (recorded as revised AGENTS.md Invariant 9).

The division of responsibility is clean:

- **Consumer UI/UX**: 100% in Moneta Wealth (Svelte 5 + WebAssembly SQLite). Fast, modern, offline-first.
- **Data & Computation Parity**: Shared math modules (`goalMath.ts`, `loanMath.ts`, `portfolioMath.ts`, `propertyMath.ts`) mirror their Python counterparts in `moneta_core/models/`.
- **Odoo Web UI**: Strictly standard admin views for inspecting tables, managing PATs, running cron jobs, and resolving customer support issues.

### 3. Many subscriber databases on shared instances — never per-tenant provisioning

Personal finance data is small. **Do not extrapolate the ANSIS per-instance model to Moneta**: $200/month per instance is B2B economics for a client company with internal staff, and the consumer price band is $10–15/month (YNAB $109/year, Monarch $100/year).

| | Per-tenant instance | Shared instance, many DBs |
| :--- | :--- | :--- |
| Cost at B2C pricing | Unviable by an order of magnitude | Marginal cost in low single-digit dollars |
| Provisioning | Manual per subscriber | Automated |
| Upgrades | Separate lifecycle each | One server, many DBs |

This is the difference between a viable business and one that bleeds on hosting. Odoo is designed for the right-hand column.

### 4. Pin the major version; skip releases

Odoo ships a major version annually. With N subscriber databases, every upgrade is N migrations — and now the failures are customers', not the team's.

- **Pin to 18.0.** Upgrade every 2–3 years, or earlier only for security.
- **Do not chase versions.** A newer Odoo is not a product feature.
- **Automate multi-database migration** before onboarding customers. Extend `odoo_migrator` into orchestration with per-database status and retry — the failure mode at scale is partial completion, not total failure.
- **Canary one database first.** Never fleet-wide.
- Re-evaluate Odoo Enterprise's official upgrade service once there are paying customers, checking that per-user pricing does not break B2C margins.

### 5. LGPL position

Odoo Community is **LGPLv3**, which has **no network copyleft** — that is AGPL, which Odoo does not use. Running Odoo Community as a commercial service does **not** require publishing your work. `moneta_wealth_odoo` is ANSIS's own code and may be licensed as ANSIS chooses.

The obligation attaches only if **Odoo core itself** is modified. Keep all customisation in addons, never in core — which the codebase already does.

---

## Consequences

**Positive**

- Existing models, API surface, operational tooling and competence are reused rather than rebuilt.
- Subscription billing, invoicing and tax handling come from Odoo Accounting.
- No second backend, no duplicated schema, no third sync target (per ADR 0001).
- Cross-system parity maintenance is removed from the roadmap.

**Negative**

- Version-upgrade risk now scales with subscriber count — mitigated by pinning and automation, not eliminated.
- Odoo is heavyweight for what is now a sync-plus-billing role; some ORM overhead is paid for capability that is only partly used.
- Tenant isolation depends on per-database separation, so migrations and backups multiply.

---

## Alternatives considered

| Alternative | Why rejected |
| :--- | :--- |
| Supabase / Postgres plus a custom API | Rebuilds every model and business rule, loses Odoo Accounting and the web client, reintroduces the dual-schema parity problem ADR 0001 rejected |
| Custom backend (Node/Django/FastAPI) | Maximum control, maximum work. Discards a working, tested API surface to arrive years behind |
| PocketBase / Appwrite / Firebase | Weak financial data modelling; vendor lock-in on the system of record |
| One Odoo instance per subscriber | Economically unviable at B2C pricing |
| Chasing each Odoo major version | Multiplies migration risk for no product benefit |

---

## Open questions

1. **Hosting provider and sizing** for the shared subscriber instance(s) — and the point at which a second instance is added.
2. **Per-database resource envelope** — the subscriber count at which a shared instance saturates.
3. **Tenant backup retention** — and where restore testing sits in the operational calendar.
4. **Whether the Odoo web UI is offered at all**, or left as an internal support tool.

---

## References

- [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) — subscription tiers and cloud sync
- [ADR 0003](0003-licence-and-billing-topology.md) — licence and billing topology
- [`ROADMAP.md`](../../ROADMAP.md) — Phase 8 (superseded)
