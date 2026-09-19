# ADR 0005 — Open Source and Licence Choice

- **Status:** Accepted
- **Date:** 2026-09-19
- **Related:** [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) (tiers), [ADR 0003](0003-licence-and-billing-topology.md) (enforcement), [ADR 0004](0004-entitlement-matrix-and-lifecycle.md) (pricing and lifecycle)
- **Deciders:** Wilson (ANSIS Pte Ltd)

---

## Context

The question posed was whether to open source Moneta Desktop. Inspection showed the question was already partly answered:

| Repository | Visibility | Licence at the time |
| :--- | :--- | :--- |
| `Moneta_Desktop` | **Public** | **None** — `licenseInfo: null`, no `LICENSE` file |
| `moneta_finance` | Public | LGPL-3.0, with a `LICENSE` file |

So the code was **already publicly visible**. The README additionally claimed *"licensed under the MIT License"* while no such file existed — a claim that granted nothing.

Under default copyright, publicly visible code with no licence means **all rights reserved**: nobody may legally copy, modify, distribute or contribute to it. That is the worst of both positions — full public exposure, none of the benefits of an actual grant. It also contradicted `moneta_finance`, whose roadmap actively invites contributions and pull requests.

A second inconsistency: the Desktop README and `docs/index.md` advertised **"Zero Subscription Cost — Free & Open-Source"** as a competitive advantage in a comparison table benchmarking against YNAB, Monarch and Quicken. The business model agreed in ADR 0001 and ADR 0004 is a **S$9/month subscription**.

---

## Decision

### 1. Moneta Desktop is licensed under Apache-2.0

A `LICENSE` file carrying the canonical Apache License 2.0 text is added, with the copyright notice the appendix prescribes (`Copyright 2026 ANSIS Pte Ltd`), and `"license": "Apache-2.0"` declared in `package.json`.

### 2. The desktop application is free and open source, permanently

No account, no login, no subscription, no telemetry to use it. Every feature runs locally; the free tier is a finished product rather than a trial (ADR 0004 §2).

### 3. The server components remain proprietary

The licence/billing service is server-side and never distributed, so it is inherently ANSIS's. `moneta_finance` remains **LGPL-3.0**, which is Odoo convention and appropriate.

This is an open-core split by nature rather than by contrivance: the desktop app is distributed (so it is open), the service is operated (so it is not).

### 4. Positioning is corrected

The "Zero Subscription Cost" claim is replaced with the accurate split:

> **The desktop app is free and open source, forever. Moneta Cloud — sync, Moneta Mobile, cloud backup — is S$9/month.**

---

## Rationale

### The moat is operational, not legal

Moneta's durable advantages are:

1. **The service** — sync, hosting, Moneta Mobile, backup. Operational, not code.
2. **Regional content** — CPF ceilings, EPF dividends, IRAS reliefs, LHDN rules. These change annually, so a fork inherits the code and none of the upkeep.
3. **Brand and trust.** Material for an application holding financial records.

None of these are protected by withholding source code.

### The code was never secret anyway

ADR 0003 §3 established that a Tauri binary ships its JavaScript to the user, so any client-side gate is patchable. Treating the desktop source as a trade secret bought nothing while costing the goodwill, contributions and distribution that an open repository provides.

### Why Apache-2.0 rather than MIT

Both are permissive and neither restricts a competitor. Apache-2.0 is preferred for two concrete reasons:

- **An explicit patent grant**, which matters to users of financial software.
- **Explicit contribution terms**, so community pull requests can be accepted without a contributor licence agreement.

### What this deliberately does not do

It does not prevent someone forking the application and selling it. That is accepted. A competitor taking that path must still stand up Odoo hosting, build a licence service, ship a mobile app, and maintain Singapore and Malaysia tax content every year — the code is the cheap part.

**Rejected: AGPL-3.0.** Its network clause would oblige anyone running a modified version as a service to publish their changes, which sounds like protection for the cloud tier. But the cloud tier is the *Odoo backend*, which a fork would not be running — so AGPL on the desktop would guard the wrong component while adding adoption friction to a category where users are already wary.

**Rejected: BSL / PolyForm noncommercial.** These restrict commercial competitors effectively, but they are not open source by the OSI definition. Claiming "open source" while using them would be a misrepresentation, and dropping the term forfeits most of the goodwill that motivates the decision in the first place.

**Rejected: remaining closed / all-rights-reserved.** The default state was already unsustainable — publicly visible with no grant — and it forfeits contributions in exactly the area (regional packs) where outside expertise is most valuable.

---

## Consequences

**Positive**

- The repository is now legally coherent: public, licensed, and contributable.
- Contributions are possible in the highest-value area — regional tax and bank-format coverage.
- Open source is a distribution channel for a solo maintainer, and an auditable codebase is a genuine trust signal for software holding financial records.
- The Apache patent grant protects users.

**Negative**

- A competitor may fork. Accepted explicitly, per the rationale above.
- Public issue and pull-request traffic is a real time cost for a solo maintainer, and the project must be prepared to say no.
- **Apache-2.0 is irreversible for released versions** — a future change of direction cannot be applied retroactively to code already published under it.

---

## Implementation

1. Add `LICENSE` (Apache-2.0, with the ANSIS copyright notice)
2. Declare `"license": "Apache-2.0"` in `package.json`
3. Add `CONTRIBUTING.md` covering the two-repository model, the verification steps, the shared-derivation rule, and contribution licensing
4. Correct the "Zero Subscription Cost" claim in `README.md` and `docs/index.md`, and replace the MIT claim with the actual licence

---

## References

- [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) — subscription tiers and cloud sync
- [ADR 0003](0003-licence-and-billing-topology.md) — enforcement (why the client is not secret)
- [ADR 0004](0004-entitlement-matrix-and-lifecycle.md) — entitlement matrix and pricing
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — contributor guide
- [`moneta_finance`](https://github.com/lohwswilson/moneta_finance) — LGPL-3.0 Odoo module
