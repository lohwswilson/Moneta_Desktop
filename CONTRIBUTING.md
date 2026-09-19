# Contributing to Moneta Wealth

Thanks for considering a contribution. This is a personal finance application, so correctness matters more than speed — a wrong balance is worse than a missing feature.

---

## The two-repository model

Moneta Wealth is one half of a pair. **Every feature ships on both sides** — that is a hard rule, not a preference:

| Repository | Role | Licence |
| :--- | :--- | :--- |
| [`Moneta_Wealth`](https://github.com/lohwswilson/Moneta_Wealth) | The application. All product features live here. | Apache-2.0 |
| [`moneta_finance`](https://github.com/lohwswilson/moneta_finance) | Odoo 18 module. Sync store, licensing, and the same features for subscribers who use the web backend. | LGPL-3.0 |

A Desktop-only feature is **incomplete**. Subscribers log into the Odoo backend directly and must find a complete system there. Pull requests adding a feature to one side without the other will be asked to add the other half before merging.

Odoo-module PRs target the **`18.0`** branch, as that repo's own guide describes.

---

## Contributions that are most valuable

**Regional tax and contribution packs.** This is the project's real differentiator and the area where a contributor with local knowledge beats anything we can do alone. CPF and EPF rules, IRAS reliefs, LHDN Borang BE, UK CGT/ISA — all change annually and all benefit from someone who actually files in that jurisdiction.

**Bank statement formats.** The app recognises DBS/POSB, OCBC, UOB and Standard Chartered CSV/QIF exports. If your bank's export breaks the parser, a sample file (redacted) plus the fix is genuinely useful. Automated bank feeds are unavailable in Singapore — see [ADR 0004](docs/adr/0004-entitlement-matrix-and-lifecycle.md) — so **excellent manual import is the product**, not a stopgap.

**Correctness fixes with a test.** If you find a figure that is wrong, an assertion in the matching `scripts/verify_*.ts` plus the fix is the ideal contribution.

**Bug reports with reproduction.** Include what you did, what you expected, what happened, and your data source (`My Ledger` or `Demo Sandbox`) and whether Moneta Cloud was connected. These matter: a bug in one may not appear in the others.

---

## Before you open a pull request

```bash
npm run check     # must report 0 errors, 0 warnings
npm run build

node --experimental-strip-types scripts/verify_goal_math.ts
node --experimental-strip-types scripts/verify_portfolio_math.ts
node --experimental-strip-types scripts/verify_loan_math.ts
node --experimental-strip-types scripts/verify_property_math.ts
node --experimental-strip-types scripts/verify_sync_tracking.ts
node --experimental-strip-types scripts/verify_sync_conflict.ts
```

Then two checks that have both caught real defects:

```bash
# Route parity — every client call must have a server route.
# A mismatch fails only at runtime, and only when connected to Moneta Cloud.
grep -o "mobile/[a-z_/]*" src/lib/api/odooApi.ts | sort -u

# Doc references — every component should appear somewhere in docs/
for f in src/lib/components/*.svelte; do n=$(basename "$f"); \
  grep -rq "$n" docs/ README.md AGENTS.md ARCHITECTURE.md || echo "UNDOCUMENTED: $n"; done
```

**And run the app.** `npm run dev`, then open `http://localhost:5173`. Compilation and assertions cover logic; they cannot catch a view that renders blank or a modal that will not close. More than one defect has shipped past a green test suite and been found in thirty seconds of looking at the screen.

---

## Code conventions

The full set is in [`AGENTS.md`](AGENTS.md). The ones that most often catch people out:

- **Svelte 5 runes only.** `$state`, `$derived`, `$props`, `$effect`. No `writable()`, no `on:click` — use `onclick`.
- **One derivation, one place.** Any figure the Odoo module also computes is implemented **once** in `src/lib/data/*Math.ts` and called from every adapter. Never reimplement it per adapter. Each shared module's docstring names its Odoo counterpart — that citation is a **maintenance contract**: changing one obliges changing the other.
- **Implement in all three adapters.** `sqliteAdapter`, `mockAdapter` and `odooAdapter`. Interface methods are optional (`?`) so a missing implementation degrades to an empty list rather than failing loudly — an adapter left behind looks like "no data", not "not implemented".
- **Wire names, not ORM names.** The Odoo mobile API translates field names: the ORM field is `transaction_date`, the JSON key is `date`. A client type must match the **wire** name.
- **Never let a derived figure render wrong silently.** A wrong amortization number still displays. If you touch such a figure, add or update its assertion.

The [feature delivery checklist](AGENTS.md#4-feature-delivery-checklist) in `AGENTS.md` walks the full sequence for a new feature, Odoo side first.

---

## Licensing of contributions

Moneta Wealth is licensed under **Apache-2.0**. By submitting a pull request you agree that your contribution is licensed under the same terms — which is what allows the project to accept contributions without a separate contributor agreement.

Please only submit work you have the right to contribute. If you are porting from another project, check its licence first: code under a copyleft licence incompatible with Apache-2.0 cannot be merged into the desktop app. The Odoo module is LGPL-3.0 and follows Odoo's own conventions.

---

## Reporting security issues

Please do not open a public issue for a vulnerability. This application handles personal financial records; report privately to the maintainer and allow time for a fix before disclosure.
