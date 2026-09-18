# ADR 0004 — Entitlement Matrix and Customer Lifecycle

- **Status:** Proposed
- **Date:** 2026-09-19
- **Related:** [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) (tier composition, licence token), [ADR 0002](0002-moneta-cloud-platform.md), [ADR 0003](0003-licence-and-billing-topology.md)
- **Deciders:** Wilson (ANSIS Pte Ltd)

---

## Context

ADR 0001 defined which *features* sit in which tier. This ADR defines what a tier actually **entitles** a customer to — what they can access, on which surface, for what price, and what happens across the free → paid → cancelled lifecycle.

The model was confirmed 2026-09-19:

> **Non-subscriber:** Moneta Desktop only. Some features unavailable without a subscription. No Moneta Cloud login.
>
> **Subscriber:** Moneta Desktop with full features, plus Moneta Cloud login.

---

## Decision

### 1. Entitlement matrix

| Capability | Non-subscriber | Subscriber |
| :--- | :---: | :---: |
| Moneta Desktop — core ledger, register, reconciliation | ✅ | ✅ |
| Moneta Desktop — manual statement import (CSV/QIF), rules, payee intelligence | ✅ | ✅ |
| Moneta Desktop — recurring bills, net worth, property equity, loans, reports | ✅ | ✅ |
| Moneta Desktop — budgets, goals, cash flow, Landlord Hub, portfolio analytics, tax packs | ❌ | ✅ |
| **Local `.sqlite` export** | ✅ | ✅ |
| Moneta Cloud login (web) | ❌ | ✅ |
| Sync (Desktop ↔ Cloud) | ❌ | ✅ |
| Moneta Mobile | ❌ | ✅ |
| Automated bank feeds | ❌ | ✅ |
| Cloud backup & restore | ❌ | ✅ |
| Partner / spouse access | ❌ | ✅ (see §5) |

**Feature tiering is defined in [ADR 0001 §2](0001-subscription-tiers-and-cloud-sync.md)**; this table defines access, not which features exist.

### 2. Local export is free, permanently

A non-subscriber has no cloud backup, so their local `.sqlite` export is the only protection against losing everything. It is already implemented (`downloadSqliteBackup`).

**This is not a lever to monetise.** It costs nothing to serve, it is the customer's own data, and withholding it would create support burden, lose trust, and invite exactly the resentment that feature gates otherwise avoid.

### 3. Logging in and syncing are separate mechanisms

Worth stating because they fail differently and are frequently conflated:

| | Authenticates | Mechanism |
| :--- | :--- | :--- |
| **Sync** | The *application* | API token / PAT held in Desktop config; runs invisibly and on a schedule |
| **Cloud login** | The *person* | Odoo web session in a browser |

A subscriber may sync indefinitely without ever opening the web UI. **"Can log in to Moneta Cloud" is a capability, not a prerequisite for sync.** A broken login must not stop sync, and vice versa.

### 4. Pricing

$9/month is the proposed subscription price.

| Comparison | Monthly equivalent |
| :--- | :--- |
| YNAB | $9.08 |
| Monarch | $8.25 |
| Copilot | $7.92 |
| Quicken Premier | $5.83 |
| **Moneta** | **$9 (currency TBC)** |

$9 **SGD** (~US$6.70) sits below the market and is competitive. $9 **USD** sits at the top of it. **Currency must be stated explicitly** — see open questions.

**Offer an annual tier** at roughly ten months' price. It improves cash flow, reduces churn, and the annual renewal is the natural moment to deliver the regional tax packs.

### 5. Partner access is included

One additional household member is included in the base price. Partner access is frequently the *actual* trigger for subscribing — a shared budget is a shared decision — and charging separately for it suppresses conversion. The ANSIS portal-user model ($5/user) is B2B economics and does not transfer.

### 6. The upgrade path is a first-class feature

**A free user's local SQLite database must upload to their cloud DB seamlessly on first connect after subscribing.**

This is the highest-leverage moment in the entire funnel: the user has just decided to pay. If subscribing risks their history, requires re-importing, or produces a partial merge, they are lost at the exact point of commitment.

Design and test this before launch. It is not an edge case — it is *the* conversion path, and every free user who converts will traverse it.

### 7. Cancellation

| Stage | Behaviour |
| :--- | :--- |
| Cancellation requested | Sync continues **read-only** for 30 days |
| During the window | Full local export available at any time |
| Window lapses | Cloud copy deleted |

A subscriber must be able to retrieve their data — before or after cancelling. For financial records this is non-negotiable, and it is what makes subscribing feel safe enough to attempt.

### 8. Subscriber provisioning

At purchase, the licence database must automatically:

1. Create the subscriber's Odoo user in their own database
2. Provision their tenant database if not already present
3. Issue the entitlement token (ADR 0001 §4) and the app's sync credential
4. Return credentials to the Desktop app so sync can start

**Build this early.** It is the step that fails silently — the customer pays, nothing works, and the failure surfaces as a support ticket rather than a stack trace.

---

## Consequences

**Positive**

- Clear, publishable entitlement matrix; each tier has a coherent story.
- The upgrade path is treated as a product feature rather than glue.
- Cancellation is trust-preserving, which materially improves willingness to subscribe.

**Negative**

- Including partner access in the base price forgoes per-seat revenue — accepted as a conversion trade.
- A 30-day read-only cancellation window must be implemented and enforced server-side.
- Automated provisioning is a hard dependency of the purchase flow; a failure there is revenue-visible.

---

## Open questions

1. **Currency** — is $9 SGD or USD? This changes market positioning materially.
2. **Annual price and discount** — one free month, or two?
3. **Partner count** — is one additional member right, or should it be two?
4. **Price validation** — the free tier is generous; consider validating $9 against real willingness to pay before hard-coding it into the licence database.
5. **Trial** — length and whether a card is required at signup (ADR 0001 open question, unresolved).

---

## References

- [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) — tier composition, licence token, offline grace period
- [ADR 0002](0002-moneta-cloud-platform.md) — platform choice
- [ADR 0003](0003-licence-and-billing-topology.md) — licence topology and enforcement
- [`ROADMAP.md`](../../ROADMAP.md) — Phase 8 (superseded)
