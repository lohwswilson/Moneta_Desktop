# ADR 0004 — Entitlement Matrix and Customer Lifecycle

- **Status:** Proposed
- **Date:** 2026-09-19
- **Related:** [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) (tier composition, licence token), [ADR 0002](0002-moneta-cloud-platform.md), [ADR 0003](0003-licence-and-billing-topology.md)
- **Deciders:** Wilson (ANSIS Pte Ltd)

---

## Context

ADR 0001 defined which *features* sit in which tier. This ADR defines what a tier actually **entitles** a customer to — what they can access, on which surface, for what price, and what happens across the free → paid → cancelled lifecycle.

The model was confirmed 2026-09-19:

> **Non-subscriber:** Moneta Wealth only. Some features unavailable without a subscription. No Moneta Cloud login.
>
> **Subscriber:** Moneta Wealth with full features, plus Moneta Cloud login.

---

## Decision

### 1. Entitlement matrix

| Capability | Non-subscriber | Subscriber |
| :--- | :---: | :---: |
| Moneta Wealth — core ledger, register, reconciliation | ✅ | ✅ |
| Moneta Wealth — manual statement import (CSV/QIF), rules, payee intelligence | ✅ | ✅ |
| Moneta Wealth — recurring bills, net worth, property equity, loans, reports | ✅ | ✅ |
| Moneta Wealth — budgets, goals, cash flow, Landlord Hub, portfolio analytics, tax packs | ❌ | ✅ |
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

### 4. Pricing and unit economics

**S$9 SGD per month** is the subscription price (currency confirmed 2026-09-19).

#### 4.1 Market position

| | SGD/month equivalent |
| :--- | ---: |
| YNAB | ~12.20 |
| Monarch | ~11.10 |
| Copilot | ~10.60 |
| Quicken Premier | ~7.80 |
| **Moneta** | **9.00** |

Roughly **25% below YNAB**. That is a defensible discount position for a new entrant with a generous free tier, but it leaves materially less headroom for per-subscriber cost than the incumbents enjoy.

**Pricing is hard to raise once set.** If S$12 proves necessary after sync and Mobile demonstrably work, existing subscribers will resist. Consider launching at the intended long-term price rather than discounting and climbing.

#### 4.2 Payment fees strongly favour annual billing

Stripe Singapore is approximately **3.4% + S$0.50** per charge:

| | Fee | Share of revenue |
| :--- | ---: | ---: |
| Monthly (S$9) | S$0.81 | **9.0%** |
| Annual (S$108) | S$4.17 | **3.9%** |

Monthly billing sends 9% of every payment to the processor, driven mostly by the fixed S$0.50. **Annual more than halves that**, improves cash flow, sharply reduces churn, and places the renewal moment where the regional tax packs land.

**Recommendation: annual at ~S$90 (two months free) is the default and the headline.** Monthly remains available, not promoted.

#### 4.3 Unit economics

> **All figures below are estimates with stated assumptions. They are recorded so they can be corrected as real provider quotes and hosting measurements arrive — not as settled fact.**

**Assumptions**

| Assumption | Value | Confidence |
| :--- | :--- | :--- |
| Base size when measured | 100 subscribers | — |
| Compute / hosting share per subscriber | S$2.00 | Medium — depends on DB density per instance |
| Backup and storage | S$0.30 | High — personal finance data is kilobytes |
| Bank feeds, per connected account | S$1.00–1.50/month | **Low — no provider quote obtained** |
| Typical connections per subscriber | 2–3 | Medium |
| Stripe fee, monthly billing | 3.4% + S$0.50 | High — published rate |
| Support cost | Excluded | Not yet quantified |
| Development cost | Excluded | See §4.4 |

**Per subscriber, per month**

| Line | With bank feeds | Without bank feeds |
| :--- | ---: | ---: |
| Revenue | 9.00 | 9.00 |
| Payment fees (monthly billing) | (0.81) | (0.81) |
| Compute / hosting share | (2.00) | (2.00) |
| Backup and storage | (0.30) | (0.30) |
| **Bank feeds** (2–3 connections) | **(3.00)** | **—** |
| **Contribution margin** | **2.89 (32%)** | **5.89 (65%)** |

A 32% gross margin before support and before the founder's own time is **too thin for a solo operator**. The whole question is the difference between those two columns.

#### 4.4 Break-even

Fixed infrastructure — a subscriber instance plus the separate licence host ADR 0003 requires — is estimated at **S$200–250/month**.

| Scenario | Contribution | Break-even subscribers |
| :--- | ---: | ---: |
| With bank feeds | S$2.89 | ~70–85 |
| Without bank feeds | S$5.89 | ~35–45 |

Infrastructure break-even is therefore in the **tens**, not hundreds — encouraging.

**But this excludes the founder's time.** Twenty hours a month across development and support, at even S$50/hour opportunity cost, is S$1,000/month — moving break-even to **170–250 subscribers**. That is the threshold that actually matters, and it should be confronted rather than assumed away.

#### 4.5 The bank feed cost risk

Bank feeds are billed **per connected account, per month** — the only line that scales with usage rather than subscriber count. Everything else is effectively fixed.

This makes feeds the single decision that determines whether S$9 works. Two further risks compound it:

- **Coverage.** Plaid's Singapore coverage is limited and Salt Edge partial. Bank feeds may be both expensive *and* difficult to deliver for DBS/OCBC/UOB — which was the primary recommended conversion driver (§ADR 0001 §2).
- **Unlimited promise.** An unlimited feed entitlement at S$9 is an open-ended cost commitment against a fixed price.

**Recommendation:** cap included connections (e.g. two), or reserve feeds for a future higher tier, or price them once a real provider quote exists. **Do not launch unlimited feeds at S$9.**

#### 4.6 Implications

1. **Push annual.** S$90/year as the default and headline.
2. **Cap or defer bank feeds** until a provider quote exists.
3. **Resolve SG coverage before promising feeds at all.** If DBS/OCBC/UOB cannot be served economically, the paid tier must lean harder on sync, backup and Mobile for its value story.
4. **Keep the free tier free to serve.** It is local-only by design and costs nothing per user. That is what makes a generous free tier affordable — protect it.
5. **Re-run these numbers** with a real feed quote, real hosting measurements, and a support estimate before finalising price.

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

1. **Bank feed provider and cost** — the highest-priority unknown. Obtain a real quote and confirm Singapore coverage for DBS/OCBC/UOB before feeds are promised in any tier (§4.5).
2. **Annual price and discount** — S$90 (two months free) is recommended; confirm.
3. **Partner count** — is one additional member right, or should it be two?
4. **Price validation** — the free tier is generous and S$9 is 25% below YNAB. Consider validating willingness to pay before hard-coding the price into the licence database, since raising it later is difficult.
5. **Trial** — length and whether a card is required at signup. Unresolved across ADR 0001 and this ADR; for a feature-gated tier it matters more than the gate.
6. **Support cost** — not yet quantified, and excluded from §4.3. A sync-plus-feeds product generates tickets; estimate before finalising price.

---

## References

- [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) — tier composition, licence token, offline grace period
- [ADR 0002](0002-moneta-cloud-platform.md) — platform choice
- [ADR 0003](0003-licence-and-billing-topology.md) — licence topology and enforcement
- [`ROADMAP.md`](../../ROADMAP.md) — Phase 8 (superseded)
