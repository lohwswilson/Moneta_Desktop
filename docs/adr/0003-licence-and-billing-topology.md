# ADR 0003 — Licence and Billing Topology

- **Status:** Proposed
- **Date:** 2026-09-19
- **Related:** [ADR 0001](0001-subscription-tiers-and-cloud-sync.md), [ADR 0002](0002-moneta-cloud-platform.md)
- **Deciders:** Wilson (ANSIS Pte Ltd)

---

## Context

ADR 0001 established subscription tiers and a locally-verified licence token. ADR 0002 established that Odoo is the platform, narrowed to a sync store plus licensing and billing.

Two facts shape this ADR:

- **Moneta is a product of ANSIS Pte Ltd**, not a separate legal entity. ANSIS's books are already in Odoo.
- **All product features live in Moneta Wealth.** The server computes no features — it stores synced data and administers subscriptions.

The second fact has a consequence that must be confronted, not glossed: **there is no server-side feature logic to enforce.** See §5.

---

## Decision

### 1. One licence database for all subscribers — never per-subscriber

The "one database per subscriber" rule from ADR 0001 applies to **financial data**, not to licensing. Licensing is a **single** database holding every subscriber's subscription, entitlement, invoices and payment state.

At 10,000 subscribers that is 10,000 partners plus roughly 120,000 invoices per year — comfortably within Odoo's operating range. This is one of the few places a shared database is correct: there is no tenant-isolation requirement, because it holds ANSIS's revenue ledger, not subscribers' finances.

**Hard rule:** the licence database must never contain a subscriber's financial data — including "just for testing". That is how tenant isolation erodes.

### 2. Separate licence database, summarised into ANSIS accounting

Moneta is an ANSIS product line, so its revenue belongs in ANSIS's books. Two ways to get it there:

| Option | Mechanism | Trade-off |
| :--- | :--- | :--- |
| **A — Multi-company in the ANSIS database** | Odoo multi-company; inter-company and consolidation come free | Thousands of subscriber partners and ~120k invoices/year land in the operational accounting database |
| **B — Separate licence database + monthly summarised export** | Post a monthly journal summary into ANSIS | Small integration to build; ANSIS's books stay clean and fast |

**Decision: Option B**, with a review threshold.

At scale, Option A puts consumer-scale transaction volume into the database that also runs ANSIS's day-to-day accounting — inflating it, slowing reporting, and making every ANSIS upgrade riskier. The integration cost of Option B is one recurring summary entry, which is standard practice for a high-volume product line feeding a parent ledger.

**Review threshold:** if the subscriber base stays under roughly **200**, Option A is simpler and the integration cost is not worth paying. Above that, Option B. Decide at the point the licence database is provisioned; migrating topology later is disruptive.

### 3. The licence database is the sole authority

It holds:

| Holds | Must never hold |
| :--- | :--- |
| Subscriber and partner records | Any subscriber's financial data |
| Subscriptions, entitlement grants, plan state | Transaction ledgers |
| Invoices, payments, dunning state | Copies of tenant databases |
| The token signing key | Anything covered by ADR 0001 tenant isolation |
| Payment-provider webhook endpoints | |

### 4. Verify tokens locally — no runtime cross-instance calls

The licence database issues signed tokens. **Every verifier validates the signature locally using an embedded public key.** No verifier calls the licence database on a hot path.

```
                  ┌──────────────────────────┐
                  │   Licence database       │
                  │   (authority, signs)     │
                  └────────────┬─────────────┘
                               │ issues signed token
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌────────────────┐ ┌─────────────┐ ┌──────────────────┐
     │ Moneta Wealth │ │ Moneta      │ │ Subscriber Odoo  │
     │ (verify local) │ │ Mobile      │ │ (verify local)   │
     └────────────────┘ └─────────────┘ └──────────────────┘
```

One authority, three independent verifiers, no runtime coupling. This is what keeps a licence-database outage from cascading, and it is the same principle the Desktop app already uses for its 30-day offline grace window (ADR 0001 §4).

Prefer **Ed25519** over HMAC: verifiers then need only a public key and hold no secret.

### 5. Enforcement: the subscription sells the service, not the features

This is the direct consequence of features living in the client.

**Moneta Wealth is a Tauri binary — its JavaScript ships to the user and can be patched.** With no server-side feature logic, there is nothing on the server to refuse a premium operation. A local licence check is therefore a **speed bump, not a lock**, and pretending otherwise would misdirect engineering effort.

The honest position:

1. **The subscription's core value is inherently server-side and therefore inherently enforceable.** Sync, multi-device, cloud backup, Moneta Mobile and bank feeds all require the service. **A non-subscriber does not sync.** That gate cannot be patched away, because there is nothing on the client to patch — the data simply never leaves the machine.
2. **The local licence token gates the UI only.** It selects what to render. It must never be relied upon for security, and the team should not over-invest in defeating tampering. Someone who patches a paid app was not a customer.
3. **Premium domains can be gated at the data layer.** The sync API may refuse premium entity types (e.g. tenants and rent payments) without a valid entitlement. A patched client can still compute them locally, but that data never syncs, never backs up, and never reaches Mobile — which is most of its value.

**Recommendation:** lead the paid tier with what only the service provides — sync, backup, Mobile, bank feeds. Feature gates on locally-executed tools (Landlord Hub, budgets) are a secondary nudge, not the primary value, and should be priced and marketed accordingly.

### 6. Failure domains

The licence database must **not** share a host with the subscriber instances. If one host serves both, a single outage takes down billing *and* every tenant, and during an upgrade window no one can refresh a token.

The 30-day grace window is what makes this resilient: a licence-database outage of hours is a non-event, because subscribers keep working on a cached token and refresh catches up. **Keep the grace window.**

### 7. Back the licence database up as revenue

Losing it means losing the record of who has paid. That is ANSIS's incident, not a customer's. Backup and **restore-testing** belong in the operational calendar with the same rigour as tenant data — arguably more.

### 8. Use Odoo's payment acquirer

Community ships Stripe and PayPal providers. Self-serve subscription purchase, renewals and failed-payment handling come largely from the framework rather than custom code.

---

## Consequences

**Positive**

- One authority with independent local verification; no runtime coupling.
- Subscription billing, invoicing, dunning and tax handling reuse Odoo Accounting.
- The strongest gate — sync itself — is unbypassable.
- ANSIS's operational books stay clean under Option B.

**Negative**

- Feature gates on locally-executed tools are bypassable. Accepted, and mitigated by leading on service value.
- Option B requires a recurring integration (one monthly summarised entry).
- Revocation reaches an offline client only after the grace window lapses (ADR 0001 §4).

---

## Open questions

1. **GST treatment.** Moneta sells digital services to Singapore consumers; Singapore operates an Overseas Vendor Registration regime for digital services with registration thresholds. Whether subscriptions trigger a GST obligation, and how overseas subscribers are invoiced, affects the price point and the invoice format the licence database must produce. **Confirm with ANSIS's accountant.** Raised as a flag, not an assertion.
2. **Trial length** — 14 or 30 days (ADR 0001 open question).
3. **Cancellation behaviour** — data export on cancellation is non-negotiable for financial records; decide between read-only, export-and-lock, and deletion.
4. **Pricing**, and whether the free tier needs value-scaled limits to lift conversion.
5. **Key rotation** — procedure and cadence for the token signing key, given verifiers embed the public key.

---

## References

- [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) — subscription tiers and cloud sync
- [ADR 0002](0002-moneta-cloud-platform.md) — Moneta Cloud platform choice
- [`ROADMAP.md`](../../ROADMAP.md) — Phase 8 (superseded)
