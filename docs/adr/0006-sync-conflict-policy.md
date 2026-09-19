# ADR 0006 — Sync Conflict Policy

- **Status:** Accepted
- **Date:** 2026-09-19
- **Related:** [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) §5 (local-first), [ADR 0002](0002-moneta-cloud-platform.md), [ADR 0003](0003-licence-and-billing-topology.md)
- **Deciders:** Wilson (ANSIS Pte Ltd)

---

## Context

Stage 3 of the sync platform. Every earlier stage exists to make this decision possible: ADR 0001 §5 made SQLite the always-local store, and Stage 2 records local changes in an append-only log written by triggers.

What remains is the rule for when the same record has changed on two sides. It cannot be deferred, because the sync engine's shape follows from it.

**The realistic conflict profile.** Moneta Wealth is used by one person across two or three devices, occasionally offline. Genuine conflicts — the same field of the same record edited on two devices while both were offline — are rare. This matters: a policy that is merely *adequate* for rare conflicts and much cheaper to build beats an elaborate one, provided its failure mode is visible rather than silent.

---

## Decision

### 1. Server-arrival last-write-wins

The **server stamps the canonical modification time** when it applies a change. That timestamp, not the client's, orders the record.

**Why not the client's clock.** The obvious design compares the client's `changed_at` against the server's. That makes ordering depend on every subscriber's system clock — a device with a badly-set clock would silently win every conflict, overwriting good data from correct devices. Server-assigned time removes the dependency entirely.

### 2. Push before pull

Local intent is applied first, then the server's state fills in. This gives an unambiguous reading of "last write": the device that synced most recently is the last writer, which for a single user is also the most recent *intent*.

### 3. An unpushed local change always wins

If a record has a pending change in `sync_changes`, it is pushed regardless of timestamps. The user made that edit deliberately and offline; discarding it in favour of a server copy they may never have seen is the one outcome guaranteed to feel like data loss.

### 4. Deletions are tombstones, and require server support

A deletion is a first-class change and follows the same rule. **This imposes a requirement on Stage 4 that was not previously identified:**

> The server must expose deletions explicitly. Odoo's `unlink` removes rows, so a deleted record is simply *absent* from a query — indistinguishable from a record that was never pushed. Absence cannot be read as deletion.

The natural mechanism is Odoo's built-in **`active` flag**: archive (`active = False`) rather than unlink, so the record remains queryable and its removal is reportable. A dedicated "deleted since cursor" endpoint is the alternative.

Without this, a record deleted on one device is **resurrected** by the next pull from a device that still has it. That is not a rare edge case — it is the default behaviour of every delete.

### 5. Millisecond timestamps

SQLite's `datetime('now')` has **one-second resolution**, so two changes in the same second compare equal and the tie-break decides arbitrarily. The change log should use `strftime('%Y-%m-%dT%H:%M:%fZ','now')` instead.

### 6. A losing local edit is reported, never silent

When an incoming change overwrites a record the user edited on this device, that is surfaced — "changed on another device" — rather than applied quietly. The policy is allowed to lose an edit; it is not allowed to lose it invisibly.

### 7. Field-level merge is rejected

Merging per field is more "correct" in the abstract, but its failure mode is **subtle corruption**: a record with half of one device's values and half of the other's, which no one notices until a balance is wrong. Whole-record replacement produces an outcome a user can see and understand. Revisit only if real conflicts prove common, which for a single user they should not.

---

## Consequences

**Positive**

- No dependency on client clocks; a misconfigured device cannot corrupt ordering.
- The policy fits in one paragraph, so a user can be told what happened in one sentence.
- Failure is visible: the outcome is always one side's whole record, or a reported overwrite.

**Negative**

- An edit made *earlier* but synced *later* wins. Accepted: for one user, later sync is a reasonable proxy for later intent.
- Concurrent edits to the same record lose one side entirely. Accepted, with reporting (rule 6).
- **Requires Stage 4 changes** — server-side tombstones (rule 4) and millisecond-resolution change timestamps (rule 5).
- Last-write-wins cannot be "upgraded" later without changing recorded history; this is a durable commitment.

---

## Alternatives considered

| Alternative | Why rejected |
| :--- | :--- |
| Client-timestamp LWW | Ordering depends on subscriber clocks; one wrong clock silently wins every conflict |
| Server always wins | Offline edits would be discarded — the exact data loss this policy exists to prevent |
| Client always wins | A second device's changes would never arrive; effectively no sync |
| Field-level merge | Failure mode is silent corruption rather than a visible overwrite (§7) |
| Vector clocks / CRDTs | Genuine complexity for a conflict profile that is rare in practice; the cost is paid by every record, forever |

---

## Open questions

1. **Where is the "changed on another device" notice surfaced?** A per-record badge, a sync summary, or both. Not yet designed.
2. **Does the user get a choice on overwrite?** A prompt would be safer but would block sync on user input; the current decision reports after the fact.
3. **Should tombstones expire?** An unbounded tombstone list grows forever. A retention window is likely needed, with the caveat that a device offline longer than the window can resurrect data.

---

## References

- [`src/lib/data/syncConflict.ts`](../../src/lib/data/syncConflict.ts) — the policy as a pure function
- [ADR 0001](0001-subscription-tiers-and-cloud-sync.md) — local-first and the sync platform stages
- [ADR 0003](0003-licence-and-billing-topology.md) — where the server sits
