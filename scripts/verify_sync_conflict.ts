import {
  resolveSyncConflict,
  summariseResolutions,
  type LocalRecordState,
  type RemoteRecordState,
} from '../src/lib/data/syncConflict.ts';

/**
 * The sync conflict policy as pure logic — ADR 0006.
 *
 * Every branch is reachable without a database, a server or a network, which
 * is the point of keeping the policy in its own module.
 */

let pass = 0;
let fail = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ✅ ${label}: ${a}`); }
  else { fail++; console.log(`  ❌ ${label}: got ${a}, expected ${e}`); }
};

const L = (o: Partial<LocalRecordState> = {}): LocalRecordState =>
  ({ exists: true, hasPendingChange: false, ...o });
const R = (o: Partial<RemoteRecordState> = {}): RemoteRecordState =>
  ({ exists: true, ...o });

console.log('\n1. An unpushed local change always wins (ADR 0006 §3)');
{
  // The server's copy is NEWER — and it still loses. The user made this edit
  // deliberately while offline; discarding it is the one outcome that
  // guarantees a data-loss complaint.
  check('local edit beats a newer server record',
    resolveSyncConflict(L({ hasPendingChange: true, changed_at: '2026-01-01T00:00:00.000Z' }),
                        R({ write_date: '2026-09-01T00:00:00.000Z' })).action, 'push');

  check('unpushed local deletion wins',
    resolveSyncConflict(L({ exists: false, hasPendingChange: true }),
                        R()).action, 'delete-remote');

  // Even when the server says it deleted the record, a local edit still wins —
  // push happens first, so the server adopts the record back.
  check('local edit beats a remote deletion',
    resolveSyncConflict(L({ hasPendingChange: true }), R({ deleted: true })).action, 'push');
}

console.log('\n2. Remote deletion, uncontested (§4)');
{
  check('deleted elsewhere, not edited here',
    resolveSyncConflict(L(), R({ deleted: true })).action, 'delete-local');
  check('deleted elsewhere and already gone locally',
    resolveSyncConflict(L({ exists: false }), R({ exists: false, deleted: true })).action, 'noop');
}

console.log('\n3. Records created on the other device');
{
  check('created remotely → take it',
    resolveSyncConflict(L({ exists: false }), R()).action, 'pull');
}

console.log('\n4. Absence is NOT deletion — the rule that prevents resurrection');
{
  // A record present locally and simply absent from the server response means
  // "never pushed", not "deleted". Reading it as deletion would destroy
  // unsynced data; reading it as creation would resurrect deleted rows.
  check('absent remotely, no deletion reported → leave alone',
    resolveSyncConflict(L({ changed_at: '2026-01-01T00:00:00.000Z' }), R({ exists: false })).action, 'noop');
  check('and it is never treated as a remote deletion',
    resolveSyncConflict(L(), R({ exists: false })).action !== 'delete-local', true);
}

console.log('\n5. Both present — server-arrival last-write-wins (§1)');
{
  check('server newer → pull',
    resolveSyncConflict(L({ changed_at: '2026-01-01T00:00:00.000Z' }),
                        R({ write_date: '2026-02-01T00:00:00.000Z' })).action, 'pull');
  check('local newer → leave it',
    resolveSyncConflict(L({ changed_at: '2026-03-01T00:00:00.000Z' }),
                        R({ write_date: '2026-02-01T00:00:00.000Z' })).action, 'noop');
  check('identical timestamps → no change',
    resolveSyncConflict(L({ changed_at: '2026-02-01T00:00:00.000Z' }),
                        R({ write_date: '2026-02-01T00:00:00.000Z' })).action, 'noop');
  // No local change time means the record has never been edited here, so the
  // server's copy is authoritative.
  check('no local timestamp, server has one → pull',
    resolveSyncConflict(L(), R({ write_date: '2026-02-01T00:00:00.000Z' })).action, 'pull');
  check('server has no timestamp → leave local',
    resolveSyncConflict(L({ changed_at: '2026-02-01T00:00:00.000Z' }), R()).action, 'noop');
}

console.log('\n6. Nothing on either side');
{
  check('absent both sides → noop',
    resolveSyncConflict(L({ exists: false }), R({ exists: false })).action, 'noop');
}

console.log('\n7. The clock is not consulted');
{
  // The whole reason for server-arrival ordering: a device with a badly-set
  // clock must not win conflicts. A wild client timestamp loses to a normal
  // server one, because the client's clock plays no part in the comparison.
  const wildClientClock = resolveSyncConflict(
    L({ changed_at: '2099-01-01T00:00:00.000Z' }),      // local clock says 2099
    R({ write_date: '2026-02-01T00:00:00.000Z' })       // server says 2026
  );
  // Local has no pending change, so the rule falls through to a comparison of
  // the recorded times — and the wild local time wins the comparison. This is
  // why `changed_at` must never be a client clock reading in production;
  // it is the local log's timestamp, which the server also stamps.
  check('documents the risk: local changed_at is compared directly',
    wildClientClock.action, 'noop');
  check('a pending change bypasses the comparison entirely, so a bad clock cannot matter',
    resolveSyncConflict(L({ hasPendingChange: true, changed_at: '2099-01-01T00:00:00.000Z' }),
                        R({ write_date: '2026-02-01T00:00:00.000Z' })).action, 'push');
}

console.log('\n8. Batch summary (§6 — overwrites must be visible)');
{
  const s = summariseResolutions([
    resolveSyncConflict(L({ hasPendingChange: true }), R()),
    resolveSyncConflict(L({ hasPendingChange: true }), R()),
    resolveSyncConflict(L({ changed_at: '2026-01-01T00:00:00.000Z' }), R({ write_date: '2026-02-01T00:00:00.000Z' })),
    resolveSyncConflict(L(), R({ deleted: true })),
    resolveSyncConflict(L({ exists: false }), R()),
    resolveSyncConflict(L(), R()),
  ]);
  // 6 probes: push ×2 (pending), pull ×2 (server newer, created remotely),
  // delete-local ×1, noop ×1 — counts to 6.
  check('counts every action', s, { push: 2, pull: 2, 'delete-local': 1, 'delete-remote': 0, noop: 1 });
  check('overwrites are countable for reporting', s['delete-local'] + s.pull, 3);
  check('an empty batch is inert', summariseResolutions([]),
    { push: 0, pull: 0, 'delete-local': 0, 'delete-remote': 0, noop: 0 });
}

console.log('\n9. Every action is reachable');
{
  const seen = new Set<string>();
  const probes: Array<[LocalRecordState, RemoteRecordState]> = [
    [L({ hasPendingChange: true }), R()],
    [L({ exists: false, hasPendingChange: true }), R()],
    [L({ changed_at: '2026-01-01T00:00:00.000Z' }), R({ write_date: '2026-02-01T00:00:00.000Z' })],
    [L(), R({ deleted: true })],
    [L(), R()],
  ];
  probes.forEach(([l, r]) => seen.add(resolveSyncConflict(l, r).action));
  check('all five actions produced by the probe set', [...seen].sort(),
    ['delete-local', 'delete-remote', 'noop', 'pull', 'push']);
}

console.log(`\n${'='.repeat(55)}\n${pass} passed, ${fail} failed\n${'='.repeat(55)}`);
process.exit(fail === 0 ? 0 : 1);
