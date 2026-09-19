/**
 * Sync conflict resolution — see ADR 0006.
 *
 * Pure decision logic: given what the local and remote sides each know about a
 * record, decide what to do. No I/O, so the whole policy is testable without a
 * database, a server, or a network.
 *
 * The policy is **server-arrival last-write-wins**, with one overriding rule:
 * an unpushed local change always wins.
 */

export interface LocalRecordState {
  /** Whether the record is present in the local database. */
  exists: boolean;
  /** Latest local change time for this record, if the log has one. */
  changed_at?: string;
  /** True when `sync_changes` holds an unpushed entry for this record. */
  hasPendingChange: boolean;
}

export interface RemoteRecordState {
  /** Whether the server currently holds the record. */
  exists: boolean;
  /** Server-assigned modification time — the canonical ordering. */
  write_date?: string;
  /**
   * The server reported this record deleted since the sync cursor.
   *
   * Deletion is an explicit signal, **not** inferred from `exists: false`.
   * Absence is ambiguous: it means either "deleted on another device" or
   * "never pushed from this one", and treating the two alike either resurrects
   * deleted rows or deletes unsynced ones. See ADR 0006 §4.
   */
  deleted?: boolean;
}

export type SyncAction =
  /** Send the local record to the server — local intent wins. */
  | 'push'
  /** Apply the server record locally — the server is newer. */
  | 'pull'
  /** The record was deleted remotely; remove it here. */
  | 'delete-local'
  /** The record was deleted locally; ask the server to remove it. */
  | 'delete-remote'
  /** Already consistent — nothing to do. */
  | 'noop';

export interface ConflictResolution {
  action: SyncAction;
  /** Human-readable justification, for logging and for the sync summary. */
  reason: string;
}

/**
 * Decides what to do with one record.
 *
 * Order of the rules matters and is deliberate — local intent is checked
 * before anything else, because discarding an offline edit the user made
 * deliberately is the one outcome guaranteed to feel like data loss.
 */
export function resolveSyncConflict(
  local: LocalRecordState,
  remote: RemoteRecordState
): ConflictResolution {
  // ---------------------------------------------------------------------
  // 1. An unpushed local change always wins (ADR 0006 §3).
  //
  // The user edited this offline and deliberately. The push happens before
  // the pull (ADR 0006 §2), so the server simply adopts it — no comparison
  // of timestamps is needed, and none should be attempted.
  // ---------------------------------------------------------------------
  if (local.hasPendingChange) {
    return local.exists
      ? { action: 'push', reason: 'local change is unpushed' }
      : { action: 'delete-remote', reason: 'local deletion is unpushed' };
  }

  // ---------------------------------------------------------------------
  // 2. A remote deletion, with no local change contesting it (§4).
  // ---------------------------------------------------------------------
  if (remote.deleted && local.exists) {
    return { action: 'delete-local', reason: 'deleted on another device' };
  }

  // Nothing here, and nothing wanted here.
  if (!local.exists && !remote.exists) {
    return { action: 'noop', reason: 'absent on both sides' };
  }

  // ---------------------------------------------------------------------
  // 3. Created remotely — take it.
  // ---------------------------------------------------------------------
  if (!local.exists && remote.exists) {
    return { action: 'pull', reason: 'created on another device' };
  }

  // Record exists locally with no pending change, but the server says it was
  // deleted and no tombstone arrived — leave it. Absence is not deletion.
  if (!remote.exists) {
    return { action: 'noop', reason: 'no remote record and no deletion reported' };
  }

  // ---------------------------------------------------------------------
  // 4. Both present. Server-arrival last-write-wins (§1).
  // ---------------------------------------------------------------------
  const remoteTs = remote.write_date ?? '';
  const localTs = local.changed_at ?? '';

  // A missing local timestamp means the record has never recorded a change,
  // so the server's version is authoritative by default.
  if (remoteTs && (!localTs || remoteTs > localTs)) {
    return { action: 'pull', reason: 'server is newer' };
  }

  return { action: 'noop', reason: 'local is current' };
}

/**
 * Summarises a batch, so the sync can report what it did rather than only
 * what it changed — ADR 0006 §6 requires an overwrite be visible.
 */
export function summariseResolutions(
  resolutions: ConflictResolution[]
): Record<SyncAction, number> {
  const counts: Record<SyncAction, number> = {
    push: 0,
    pull: 0,
    'delete-local': 0,
    'delete-remote': 0,
    noop: 0,
  };
  for (const r of resolutions) counts[r.action] += 1;
  return counts;
}
