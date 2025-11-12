import type { Context } from '@devvit/public-api';

const HOUR_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const LOG_WINDOW_MS = 20 * DAY_WINDOW_MS; // 20 days
const HOURLY_WARNING_THRESHOLD = 5;
const HOURLY_LAST_WARNING_THRESHOLD = 6;
export const HOURLY_BAN_THRESHOLD = 7;
const DAILY_WARNING_THRESHOLD = 10;
const DAILY_LAST_WARNING_THRESHOLD = 11;
export const DAILY_BAN_THRESHOLD = 12;
const BAN_DURATION_DAYS = 7;

const ABUSE_IGNORED_ACTIONS = new Set(['post-freeze', 'post-unfreeze', 'comment-freeze', 'comment-unfreeze']);

export const ACTION_PREFIX = 'vainamoinen:actions:';
export const ACTION_INDEX_KEY = `${ACTION_PREFIX}index`;
export const ACTION_COUNT_PREFIX = `${ACTION_PREFIX}count:`;

export const LEGACY_ACTION_PREFIX = 'vainamoinen:abuse:';
export const LEGACY_ACTION_INDEX_KEY = `${LEGACY_ACTION_PREFIX}index`;
export const LEGACY_ACTION_COUNT_PREFIX = `${LEGACY_ACTION_PREFIX}count:`;

type AbuseRecord = {
  hourlyCount: number;
  dailyCount: number;
  username?: string;
  banned?: boolean;
};

export type StoredAbuseAction = {
  t: number;
  a?: string;
  u?: string;
};

export function normalizeActionLog(value: unknown): StoredAbuseAction[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === 'number' && Number.isFinite(entry)) {
        return { t: entry } as StoredAbuseAction;
      }
      if (entry && typeof entry === 'object' && 't' in entry) {
        const timestamp = (entry as { t: unknown }).t;
        const action = (entry as { a?: unknown }).a;
        const url = (entry as { u?: unknown }).u;
        if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
          return {
            t: timestamp,
            a: typeof action === 'string' ? action : undefined,
            u: typeof url === 'string' ? url : undefined,
          } as StoredAbuseAction;
        }
      }
      return undefined;
    })
    .filter((entry): entry is StoredAbuseAction => entry !== undefined);
}

export function historyKey(username: string): string {
  return `${ACTION_PREFIX}${username}`;
}

export function actionCountKey(username: string): string {
  return `${ACTION_COUNT_PREFIX}${username}`;
}

export function legacyHistoryKey(username: string): string {
  return `${LEGACY_ACTION_PREFIX}${username}`;
}

export function legacyActionCountKey(username: string): string {
  return `${LEGACY_ACTION_COUNT_PREFIX}${username}`;
}

function shouldIgnoreForAbuse(action?: string): boolean {
  if (!action) return false;
  return ABUSE_IGNORED_ACTIONS.has(action);
}

async function ensureIndex(context: Context, username: string): Promise<void> {
  if (!context.kvStore) return;
  try {
    const next = new Set<string>();
    const currentRaw = await context.kvStore.get(ACTION_INDEX_KEY);
    if (Array.isArray(currentRaw)) {
      for (const entry of currentRaw) {
        if (typeof entry === 'string') next.add(entry);
      }
    }
    const legacyRaw = await context.kvStore.get(LEGACY_ACTION_INDEX_KEY);
    if (Array.isArray(legacyRaw)) {
      for (const entry of legacyRaw) {
        if (typeof entry === 'string') next.add(entry);
      }
    }
    if (!next.has(username)) {
      next.add(username);
    }
    await context.kvStore.put(ACTION_INDEX_KEY, Array.from(next));
  } catch (error) {
    console.error('[vainamoinen] Failed to update action index:', error);
  }
}

async function incrementActionCount(
  context: Context,
  username: string,
  action: string,
): Promise<void> {
  if (!context.kvStore) return;
  const key = actionCountKey(username);
  let stored = (await context.kvStore.get(key)) as Record<string, number> | undefined;
  if (!stored) {
    const legacy = await context.kvStore.get(legacyActionCountKey(username));
    if (legacy && typeof legacy === 'object') {
      stored = legacy as Record<string, number>;
    }
  }
  const counts: Record<string, number> = stored && typeof stored === 'object' ? { ...stored } : {};
  counts[action] = (counts[action] ?? 0) + 1;
  await context.kvStore.put(key, counts);
}

export async function isUserBanned(context: Context, username?: string): Promise<boolean> {
  const user = username ?? (await context.reddit.getCurrentUsername());
  const subredditName = context.subredditName;
  if (!user || !subredditName) return false;
  try {
    const listing = context.reddit.getBannedUsers({ subredditName, username: user, limit: 1, pageSize: 1 });
    const bannedUsers = await listing.all();
    return bannedUsers.length > 0;
  } catch (error) {
    console.error('[vainamoinen] Failed to check ban status:', error);
    return false;
  }
}

export async function recordModeratorAction(
  context: Context,
  action?: string,
  url?: string,
): Promise<AbuseRecord | undefined> {
  if (!context.kvStore) return undefined;
  const username = await context.reddit.getCurrentUsername();
  if (!username) return undefined;
  if (await isUserBanned(context, username)) {
    return { hourlyCount: 0, dailyCount: 0, username, banned: true };
  }
  const now = Date.now();
  const hourCutoff = now - HOUR_WINDOW_MS;
  const dayCutoff = now - DAY_WINDOW_MS;
  const key = historyKey(username);
  let storedRaw = await context.kvStore.get(key);
  if (!storedRaw) {
    storedRaw = await context.kvStore.get(legacyHistoryKey(username));
  }
  const stored = normalizeActionLog(storedRaw);
  const trimmed = stored.filter((entry) => entry.t > now - LOG_WINDOW_MS);
  trimmed.push({ t: now, a: action, u: url });
  await context.kvStore.put(key, trimmed);
  await context.kvStore.delete(legacyHistoryKey(username));
  await ensureIndex(context, username);
  if (action) {
    await incrementActionCount(context, username, action);
  }
  const relevantEntries = trimmed.filter((entry) => !shouldIgnoreForAbuse(entry.a));
  const hourlyCount = relevantEntries.filter((entry) => entry.t > hourCutoff).length;
  const dailyCount = relevantEntries.filter((entry) => entry.t > dayCutoff).length;
  return { hourlyCount, dailyCount, username, banned: false };
}

export async function appendActionLogEntry(
  context: Context,
  username: string,
  action: string,
  url?: string,
  incrementCount = true,
): Promise<void> {
  if (!context.kvStore) return;
  const now = Date.now();
  const logCutoff = now - LOG_WINDOW_MS;
  const key = historyKey(username);
  let storedRaw = await context.kvStore.get(key);
  if (!storedRaw) {
    storedRaw = await context.kvStore.get(legacyHistoryKey(username));
  }
  const stored = normalizeActionLog(storedRaw);
  const trimmed = stored.filter((entry) => entry.t > logCutoff);
  trimmed.push({ t: now, a: action, u: url });
  await context.kvStore.put(key, trimmed);
  await context.kvStore.delete(legacyHistoryKey(username));
  await ensureIndex(context, username);
  if (incrementCount) {
    await incrementActionCount(context, username, action);
  }
}

export async function applyBanIfNeeded(
  context: Context,
  username: string,
  exceedHourly: boolean,
  exceedDaily: boolean,
): Promise<boolean> {
  if (!context.kvStore || (!exceedHourly && !exceedDaily)) return false;
  const subredditName = context.subredditName;
  if (!subredditName) return false;
  try {
    await context.reddit.banUser({
      subredditName,
      username,
      duration: BAN_DURATION_DAYS,
      reason: 'Excessive delegated moderation actions',
      note: 'Auto-ban issued by Väinämöinen app',
      message: 'You have been temporarily banned for repeated misuse of delegated moderation actions.',
    });
    return true;
  } catch (error) {
    console.error('[vainamoinen] Failed to ban user for abuse:', error);
    return false;
  }
}

export function getAbuseMessage(hourlyCount: number, dailyCount: number): string | undefined {
  if (hourlyCount >= HOURLY_BAN_THRESHOLD || dailyCount >= DAILY_BAN_THRESHOLD) {
    return 'You have been banned for excessive mod actions use.';
  }
  if (hourlyCount === HOURLY_LAST_WARNING_THRESHOLD || dailyCount === DAILY_LAST_WARNING_THRESHOLD) {
    const threshold = hourlyCount === HOURLY_LAST_WARNING_THRESHOLD ? HOURLY_BAN_THRESHOLD : DAILY_BAN_THRESHOLD;
    const count = hourlyCount === HOURLY_LAST_WARNING_THRESHOLD ? hourlyCount : dailyCount;
    return `Last Warning! Excessive mod actions will trigger a ban. (${count} of ${threshold})`;
  }
  if (hourlyCount >= HOURLY_WARNING_THRESHOLD || dailyCount >= DAILY_WARNING_THRESHOLD) {
    const threshold = hourlyCount >= HOURLY_WARNING_THRESHOLD ? HOURLY_BAN_THRESHOLD : DAILY_BAN_THRESHOLD;
    const count = hourlyCount >= HOURLY_WARNING_THRESHOLD ? hourlyCount : dailyCount;
    return `Warning! Excessive mod actions will trigger a ban. (${count} of ${threshold})`;
  }
  return undefined;
}
