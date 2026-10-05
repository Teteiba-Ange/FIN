/**
 * lib/sync/queue
 * ─────────────────────────────────────────────────────────────────────────────
 * A write-ahead queue for health-log writes.
 *
 * The problem it solves: every symptom, cycle and mood entry used to be written
 * only to AsyncStorage, so a reinstall or a new phone erased all of it. Writing
 * straight to the server instead would trade that for a worse failure — a
 * tracking app is used on buses and in waiting rooms, and a save that fails
 * because there's no signal is a save the user has to remember to redo.
 *
 * So: write locally first, enqueue the intent, and drain the queue whenever
 * the app is in a position to. The local write is what the user sees; the
 * queue is what makes it durable.
 *
 * Two properties make this safe:
 *
 *   - Every operation carries a client-generated entity id, and the server
 *     upserts on it. Replaying an operation is a no-op rather than a duplicate,
 *     so we can retry blindly without tracking what the server has already seen.
 *   - The server reports each operation in a batch separately. A malformed
 *     entry from an older app version is `rejected` and dropped; a transient
 *     failure is `retry` and kept. Without that distinction, one bad row would
 *     block the queue forever.
 *
 * Deliberately no NetInfo dependency. Flushes are triggered by the moments that
 * actually matter — after a write, when the app returns to the foreground, and
 * when a screen that shows this data comes into focus — which covers the real
 * cases without adding a native module for connectivity polling.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiService } from "@/lib/api";

const QUEUE_KEY = "pcos_sync_queue";

/** Beyond this the backlog is unrecoverable noise; oldest are dropped first. */
const MAX_QUEUE = 500;

/** Matches the server's per-request cap. */
const MAX_BATCH = 100;

/** After this many transient failures an operation is abandoned. */
const MAX_ATTEMPTS = 8;

export type LogKind = "symptom" | "cycle" | "mood";
export type LogAction = "save" | "delete";

export type QueuedOperation = {
  opId: string;
  kind: LogKind;
  action: LogAction;
  payload: Record<string, unknown>;
  attempts: number;
  queuedAt: string;
};

type SyncResult = {
  opId: string;
  status: "ok" | "rejected" | "retry";
  error?: string;
};

/** Collision-resistant enough for a per-device id, with no extra dependency. */
export function uid(prefix = ""): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${random}`;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

async function readQueue(): Promise<QueuedOperation[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A corrupt queue must not wedge the app. Local data is still intact;
    // the next pull reconciles against the server.
    console.warn("[SYNC] Queue unreadable — discarding");
    return [];
  }
}

async function writeQueue(operations: QueuedOperation[]): Promise<void> {
  const trimmed =
    operations.length > MAX_QUEUE ? operations.slice(-MAX_QUEUE) : operations;
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.warn("[SYNC] Could not persist queue:", error);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function enqueue(
  kind: LogKind,
  action: LogAction,
  payload: Record<string, unknown>
): Promise<void> {
  const queue = await readQueue();

  // A later write for the same entity supersedes an earlier queued one —
  // logging then editing then deleting offline should send one delete, not
  // three operations the server has to resolve in order.
  const entityId = payload.id;
  const filtered = entityId
    ? queue.filter((op) => !(op.kind === kind && op.payload.id === entityId))
    : queue;

  filtered.push({
    opId: uid("op-"),
    kind,
    action,
    payload,
    attempts: 0,
    queuedAt: new Date().toISOString(),
  });

  await writeQueue(filtered);
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

let flushing: Promise<number> | null = null;

/**
 * Sends everything queued. Returns how many operations remain afterwards.
 *
 * Concurrent callers share one in-flight flush — screen focus, app foreground
 * and a fresh write can all fire within the same tick, and three overlapping
 * flushes would send the same operations three times.
 */
export function flush(): Promise<number> {
  if (flushing) return flushing;

  flushing = (async () => {
    try {
      const queue = await readQueue();
      if (queue.length === 0) return 0;

      // No session means nothing to sync to; the queue waits for sign-in.
      const token = await apiService.getToken();
      if (!token) return queue.length;

      const batch = queue.slice(0, MAX_BATCH);

      let results: SyncResult[];
      try {
        const response = await apiService.syncLogs(
          batch.map(({ opId, kind, action, payload }) => ({
            opId,
            kind,
            action,
            payload,
          }))
        );
        results = response?.results ?? [];
      } catch (error) {
        // Network or server-wide failure — the whole batch stays queued, and
        // attempt counts rise so a permanently failing op eventually stops.
        const bumped = queue.map((op) =>
          batch.some((b) => b.opId === op.opId)
            ? { ...op, attempts: op.attempts + 1 }
            : op
        );
        const surviving = bumped.filter((op) => op.attempts < MAX_ATTEMPTS);

        const abandoned = bumped.length - surviving.length;
        if (abandoned > 0) {
          console.warn(`[SYNC] Abandoned ${abandoned} operation(s) after ${MAX_ATTEMPTS} attempts`);
        }

        await writeQueue(surviving);
        throw error;
      }

      const settled = new Set(
        results.filter((r) => r.status === "ok" || r.status === "rejected").map((r) => r.opId)
      );

      for (const r of results) {
        if (r.status === "rejected") {
          // Permanently invalid — it will never succeed, so drop it rather
          // than retrying forever. Worth surfacing: it means a bad write.
          console.warn(`[SYNC] Server rejected ${r.opId}: ${r.error}`);
        }
      }

      const remaining = queue
        .filter((op) => !settled.has(op.opId))
        .map((op) =>
          batch.some((b) => b.opId === op.opId)
            ? { ...op, attempts: op.attempts + 1 }
            : op
        )
        .filter((op) => op.attempts < MAX_ATTEMPTS);

      await writeQueue(remaining);
      return remaining.length;
    } finally {
      flushing = null;
    }
  })();

  return flushing;
}

/** Drops everything queued. Used on logout, so one user's writes can't leak into the next session. */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY).catch(() => {});
}
