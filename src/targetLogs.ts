import type { Context } from '@devvit/public-api';
import type { FreezeTargetType } from './freezeState.js';
import { LOG_WINDOW_MS } from './abuseTracker.js';

export type TargetLogEntry = {
  t: number;
  a?: string;
  r?: string;
  u?: string;
  user?: string;
};

const TARGET_LOG_PREFIX = 'vainamoinen:target:log:';
const TARGET_ACTOR_PREFIX = 'vainamoinen:target:actors:';
const TARGET_INDEX_KEY = 'vainamoinen:target:index';

function targetLogKey(targetType: FreezeTargetType, targetId: string): string {
  return `${TARGET_LOG_PREFIX}${targetType}:${targetId}`;
}

function targetActorKey(targetType: FreezeTargetType, targetId: string): string {
  return `${TARGET_ACTOR_PREFIX}${targetType}:${targetId}`;
}

function normalizeTargetLog(value: unknown): TargetLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'number' && Number.isFinite(entry)) {
        return { t: entry } as TargetLogEntry;
      }
      if (entry && typeof entry === 'object' && 't' in entry) {
        const timestamp = (entry as { t: unknown }).t;
        const action = (entry as { a?: unknown }).a;
        const reason = (entry as { r?: unknown }).r;
        const url = (entry as { u?: unknown }).u;
        const user = (entry as { user?: unknown }).user;
        if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
          return {
            t: timestamp,
            a: typeof action === 'string' ? action : undefined,
            r: typeof reason === 'string' ? reason : undefined,
            u: typeof url === 'string' ? url : undefined,
            user: typeof user === 'string' ? user : undefined,
          } as TargetLogEntry;
        }
      }
      return undefined;
    })
    .filter((entry): entry is TargetLogEntry => entry !== undefined);
}

export async function appendTargetLogEntry(
  context: Context,
  targetType: FreezeTargetType,
  targetId: string,
  actionId: string,
  reason?: string,
  url?: string,
  username?: string,
): Promise<void> {
  if (!context.kvStore) return;
  const now = Date.now();
  const key = targetLogKey(targetType, targetId);
  const stored = normalizeTargetLog(await context.kvStore.get(key));
  const trimmed = stored.filter((entry) => entry.t > now - LOG_WINDOW_MS);
  trimmed.push({ t: now, a: actionId, r: reason, u: url, user: username });
  await Promise.all([
    context.kvStore.put(key, trimmed),
    addTargetToIndex(context, targetType, targetId),
  ]);
}

export async function getTargetLogEntries(
  context: Context,
  targetType: FreezeTargetType,
  targetId: string,
): Promise<TargetLogEntry[]> {
  if (!context.kvStore) return [];
  const now = Date.now();
  const key = targetLogKey(targetType, targetId);
  const stored = normalizeTargetLog(await context.kvStore.get(key));
  return stored.filter((entry) => entry.t > now - LOG_WINDOW_MS).sort((a, b) => b.t - a.t);
}

export async function hasUserActedOnTarget(
  context: Context,
  targetType: FreezeTargetType,
  targetId: string,
  username: string,
): Promise<boolean> {
  if (!context.kvStore) return false;
  const key = targetActorKey(targetType, targetId);
  const stored = await context.kvStore.get(key);
  if (!Array.isArray(stored)) return false;
  return stored.some((entry) => entry === username);
}

export async function markUserActedOnTarget(
  context: Context,
  targetType: FreezeTargetType,
  targetId: string,
  username: string,
): Promise<void> {
  if (!context.kvStore) return;
  const key = targetActorKey(targetType, targetId);
  const current = await context.kvStore.get(key);
  const next = new Set<string>();
  if (Array.isArray(current)) {
    for (const entry of current) {
      if (typeof entry === 'string') next.add(entry);
    }
  }
  next.add(username);
  await Promise.all([
    context.kvStore.put(key, Array.from(next)),
    addTargetToIndex(context, targetType, targetId),
  ]);
}

type TargetIndexEntry = { type: FreezeTargetType; id: string };

async function addTargetToIndex(context: Context, targetType: FreezeTargetType, targetId: string): Promise<void> {
  if (!context.kvStore) return;
  const raw = await context.kvStore.get(TARGET_INDEX_KEY);
  const next = new Set<string>();
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === 'string') next.add(entry);
    }
  }
  next.add(`${targetType}:${targetId}`);
  await context.kvStore.put(TARGET_INDEX_KEY, Array.from(next));
}

export async function listTrackedTargets(context: Context): Promise<TargetIndexEntry[]> {
  if (!context.kvStore) return [];
  const raw = await context.kvStore.get(TARGET_INDEX_KEY);
  const entries: TargetIndexEntry[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry !== 'string') continue;
      const [type, ...rest] = entry.split(':');
      const id = rest.join(':');
      if ((type === 'post' || type === 'comment') && id) {
        entries.push({ type: type as FreezeTargetType, id });
      }
    }
  }
  return entries;
}

export async function clearAllTargetLogs(context: Context): Promise<void> {
  if (!context.kvStore) return;
  try {
    const targets = await listTrackedTargets(context);
    await Promise.all(
      targets.map(async (target) => {
        await Promise.all([
          context.kvStore?.delete(targetLogKey(target.type, target.id)),
          context.kvStore?.delete(targetActorKey(target.type, target.id)),
        ]);
      }),
    );
  } finally {
    await context.kvStore.delete(TARGET_INDEX_KEY);
  }
}
