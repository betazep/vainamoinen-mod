import { Devvit } from '@devvit/public-api';
import type { MenuItemOnPressEvent } from '@devvit/public-api/types/menu-item.js';
import { writeAutomodConfig } from './automod.js';
import {
  ACTION_INDEX_KEY,
  ACTION_PREFIX,
  LEGACY_ACTION_INDEX_KEY,
  actionCountKey,
  historyKey,
  legacyActionCountKey,
  legacyHistoryKey,
  normalizeActionLog,
} from './abuseTracker.js';
import { resultForm } from './forms/resultForm.js';
import { ensureNotBanned, ensureRoleOrToast, warnIfAbusive } from './menuGuards.js';
import { isRemoveRestoreCommentsEnabled, isRemoveRestorePostsEnabled } from './menuSettings.js';
import { BABY_FLAIR, MAIN_FLAIR, Role } from './roles.js';
import {
  randomLockPrefix,
  randomRemovePrefix,
  randomRestorePrefix,
  randomUnlockPrefix,
} from './quotes.js';

type ActionResult = {
  url?: string;
  actionId?: string;
};

function formatPermalink(permalink?: string): string | undefined {
  if (!permalink) return undefined;
  try {
    const url = permalink.startsWith('http://') || permalink.startsWith('https://')
      ? new URL(permalink)
      : new URL(`https://www.reddit.com${permalink}`);
    const segments = url.pathname.split('/').filter(Boolean);
    if (url.hostname === 'www.reddit.com') {
      url.hostname = 'reddit.com';
    }
    if (segments.length >= 5 && segments[0] === 'r' && segments[2] === 'comments') {
      // Drop the human-readable slug segment to keep the permalink short.
      segments.splice(4, 1);
    }
    const trailingSlash = url.pathname.endsWith('/') ? '/' : '';
    const path = segments.join('/');
    let trimmedUrl = path ? `${url.hostname}/${path}${trailingSlash}` : `${url.hostname}${trailingSlash}`;
    if (url.search) trimmedUrl += url.search;
    if (url.hash) trimmedUrl += url.hash;
    return trimmedUrl;
  } catch {
    return permalink;
  }
}

async function togglePostLock(context: Devvit.Context, postId: string): Promise<ActionResult> {
  const post = await context.reddit.getPostById(postId);
  const wasLocked = post.isLocked();
  if (wasLocked) {
    await post.unlock();
    context.ui.showToast(`${randomUnlockPrefix()} the post is unlocked.`);
  } else {
    await post.lock();
    context.ui.showToast(`${randomLockPrefix()} the post is locked.`);
  }
  return {
    url: formatPermalink(post.permalink),
    actionId: wasLocked ? 'post-unlock' : 'post-lock',
  };
}

async function togglePostSticky(context: Devvit.Context, postId: string): Promise<ActionResult> {
  const post = await context.reddit.getPostById(postId);
  if (post.isStickied()) {
    await post.unsticky();
    context.ui.showToast('Post removed from Highlights.');
  } else {
    await post.sticky(2);
    context.ui.showToast('Post added to Highlights.');
  }
  return {
    url: formatPermalink(post.permalink),
    actionId: 'post-sticky-toggle',
  };
}

async function togglePostRemoval(context: Devvit.Context, postId: string): Promise<ActionResult> {
  const post = await context.reddit.getPostById(postId);
  const wasRemoved = post.isRemoved();
  if (wasRemoved) {
    await post.approve();
    context.ui.showToast(`${randomRestorePrefix()} the post is restored.`);
  } else {
    await post.remove(false);
    context.ui.showToast(`${randomRemovePrefix()} the post is removed.`);
  }
  return {
    url: formatPermalink(post.permalink),
    actionId: wasRemoved ? 'post-restore' : 'post-remove',
  };
}

async function toggleCommentLock(context: Devvit.Context, commentId: string): Promise<ActionResult> {
  const comment = await context.reddit.getCommentById(commentId);
  const wasLocked = comment.isLocked();
  if (wasLocked) {
    await comment.unlock();
    context.ui.showToast(`${randomUnlockPrefix()} the comment is unlocked.`);
  } else {
    await comment.lock();
    context.ui.showToast(`${randomLockPrefix()} the comment is locked.`);
  }
  return {
    url: formatPermalink(comment.permalink),
    actionId: wasLocked ? 'comment-unlock' : 'comment-lock',
  };
}

async function toggleCommentRemoval(context: Devvit.Context, commentId: string): Promise<ActionResult> {
  const comment = await context.reddit.getCommentById(commentId);
  const wasRemoved = comment.isRemoved();
  if (wasRemoved) {
    await comment.approve();
    context.ui.showToast(`${randomRestorePrefix()} the comment is restored.`);
  } else {
    await comment.remove(false);
    context.ui.showToast(`${randomRemovePrefix()} the comment is removed.`);
  }
  return {
    url: formatPermalink(comment.permalink),
    actionId: wasRemoved ? 'comment-restore' : 'comment-remove',
  };
}

async function ensureFeatureEnabled(
  context: Devvit.Context,
  enabled: boolean,
  disabledMessage: string,
): Promise<boolean> {
  if (enabled) return true;
  context.ui.showToast(disabledMessage);
  return false;
}

async function guardAction(
  context: Devvit.Context,
  allowedRoles: Role[],
  action: () => Promise<ActionResult>,
  actionName?: string,
): Promise<void> {
  const role = await ensureRoleOrToast(context, allowedRoles);
  if (!role) return;
  if (!(await ensureNotBanned(context))) return;
  const result = await action();
  const finalAction = result.actionId ?? actionName;
  if (await warnIfAbusive(context, finalAction, result.url)) {
    return;
  }
}

export async function handlePostLockToggle(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  try {
    await guardAction(context, [Role.Baby, Role.Main], () => togglePostLock(context, event.targetId), 'post-lock');
  } catch {
    context.ui.showToast('Failed to toggle lock');
  }
}

export async function handlePostStickyToggle(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  try {
    await guardAction(context, [Role.Main], () => togglePostSticky(context, event.targetId), 'post-sticky-toggle');
  } catch {
    context.ui.showToast('Failed to toggle sticky');
  }
}

export async function handlePostRemoveToggle(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  const featureEnabled = await isRemoveRestorePostsEnabled(context);
  if (!(await ensureFeatureEnabled(context, featureEnabled, 'Remove/Restore is disabled for posts.'))) {
    return;
  }
  try {
    await guardAction(context, [Role.Main], () => togglePostRemoval(context, event.targetId), 'post-remove');
  } catch {
    context.ui.showToast('Failed to toggle remove/restore');
  }
}

export async function handleCommentLockToggle(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  try {
    await guardAction(context, [Role.Baby, Role.Main], () => toggleCommentLock(context, event.targetId), 'comment-lock');
  } catch {
    context.ui.showToast('Failed to toggle lock');
  }
}

export async function handleCommentRemoveToggle(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  const featureEnabled = await isRemoveRestoreCommentsEnabled(context);
  if (!(await ensureFeatureEnabled(context, featureEnabled, 'Remove/Restore is disabled for comments.'))) {
    return;
  }
  try {
    await guardAction(context, [Role.Main], () => toggleCommentRemoval(context, event.targetId), 'comment-remove');
  } catch {
    context.ui.showToast('Failed to toggle remove/restore');
  }
}

async function ensureFlairTemplates(context: Devvit.Context): Promise<void> {
  const subredditName = context.subredditName!;
  const existing = await context.reddit.getUserFlairTemplates(subredditName);
  const haveMain = existing.some((t) => t.text === MAIN_FLAIR);
  const haveBaby = existing.some((t) => t.text === BABY_FLAIR);

  if (!haveMain) {
    await context.reddit.createUserFlairTemplate({
      subredditName,
      text: MAIN_FLAIR,
      allowableContent: 'text',
      allowUserEdits: false,
    });
  }
  if (!haveBaby) {
    await context.reddit.createUserFlairTemplate({
      subredditName,
      text: BABY_FLAIR,
      allowableContent: 'text',
      allowUserEdits: false,
    });
  }

  if (haveMain && haveBaby) {
    context.ui.showToast('Flair templates already exist.');
  } else {
    context.ui.showToast('Flair templates ensured.');
  }
}

async function ensureAutomodConfig(context: Devvit.Context): Promise<void> {
  const subredditName = context.subredditName!;
  try {
    await context.reddit.getWikiPage(subredditName, 'config/automoderator');
  } catch {
    context.ui.showToast(
      'Automod wiki not found. Create r/' + subredditName + '/wiki/config/automoderator then retry.',
    );
    throw new Error('missing automod wiki');
  }
  const templates = await context.reddit.getUserFlairTemplates(subredditName);
  const main = templates.find((t) => t.text === MAIN_FLAIR);
  const baby = templates.find((t) => t.text === BABY_FLAIR);
  if (!main || !baby) {
    context.ui.showToast('Create the flair templates first.');
    throw new Error('missing flair templates');
  }

  await writeAutomodConfig(context, {
    babyTemplateId: (baby as any).id ?? baby.id,
    mainTemplateId: (main as any).id ?? main.id,
  });
  context.ui.showToast('Automod config updated.');
}

export async function handleInitializeFlair(
  _event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  if (!(await ensureNotBanned(context))) return;
  try {
    await ensureFlairTemplates(context);
    await warnIfAbusive(context, 'initialize-flair');
  } catch (error) {
    console.error('Initialize flair templates failed:', error);
    if (error instanceof Error && error.message === 'missing flair templates') return;
    context.ui.showToast('Failed to initialize flair templates.');
  }
}

export async function handleWriteAutomod(
  _event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  if (!(await ensureNotBanned(context))) return;
  try {
    await ensureAutomodConfig(context);
    await warnIfAbusive(context, 'write-automod');
  } catch (error) {
    if (error instanceof Error && (error.message === 'missing automod wiki' || error.message === 'missing flair templates')) {
      return;
    }
    console.error('Write Automod failed:', error);
    context.ui.showToast('Failed to update automod config. Check you have an Automod wiki.');
  }
}

async function runInitialSetup(context: Devvit.Context): Promise<void> {
  try {
    await ensureFlairTemplates(context);
    await ensureAutomodConfig(context);
    context.ui.showToast('Initial setup complete.');
    await warnIfAbusive(context, 'initial-setup');
  } catch (error) {
    console.error('Initial setup failed:', error);
    if (error instanceof Error && error.message === 'missing automod wiki') {
      context.ui.showToast('Automod wiki not found. Create it, then rerun initial setup.');
    } else if (error instanceof Error && error.message === 'missing flair templates') {
      context.ui.showToast('Flair templates missing. Ensure initialization succeeded.');
    } else {
      context.ui.showToast('Initial setup failed. Check console for details.');
    }
  }
}

const ACTION_LABELS: Record<string, string> = {
  'post-lock': 'Post Lock',
  'post-unlock': 'Post Unlock',
  'post-sticky-toggle': 'Post Sticky/Unsticky',
  'post-remove': 'Post Remove',
  'post-restore': 'Post Restore',
  'comment-lock': 'Comment Lock',
  'comment-unlock': 'Comment Unlock',
  'comment-remove': 'Comment Remove',
  'comment-restore': 'Comment Restore',
  // Legacy combined action keys
  'post-lock-toggle': 'Post Lock/Unlock',
  'post-remove-toggle': 'Post Remove/Restore',
  'comment-lock-toggle': 'Comment Lock/Unlock',
  'comment-remove-toggle': 'Comment Remove/Restore',
  'initialize-flair': 'Initialize Flair Templates',
  'write-automod': 'Write Automod Config',
  'ban-hourly': 'Ban (Hourly Threshold)',
  'ban-daily': 'Ban (Daily Threshold)',
  'initial-setup': 'Initial Setup',
};

const ACTION_COUNT_LABELS: Record<string, string> = {
  'post-lock': 'Lock/Unlock',
  'post-unlock': 'Lock/Unlock',
  'post-remove': 'Remove/Restore',
  'post-restore': 'Remove/Restore',
  'comment-lock': 'Lock/Unlock',
  'comment-unlock': 'Lock/Unlock',
  'comment-remove': 'Remove/Restore',
  'comment-restore': 'Remove/Restore',
  // Legacy combined action keys
  'post-lock-toggle': 'Lock/Unlock',
  'post-remove-toggle': 'Remove/Restore',
  'comment-lock-toggle': 'Lock/Unlock',
  'comment-remove-toggle': 'Remove/Restore',
  'post-sticky-toggle': 'Sticky/Unsticky',
  'initialize-flair': 'Initialize Flair Templates',
  'write-automod': 'Write Automod Config',
  'ban-hourly': 'ActionBanCount',
  'ban-daily': 'ActionBanCount',
  'initial-setup': 'Initial Setup',
};

function formatActionEntries(entriesValue: unknown): string[] {
  const entries = normalizeActionLog(entriesValue)
    .sort((a, b) => b.t - a.t)
    .map((entry) => {
      const iso = new Date(entry.t).toISOString();
      const label = entry.a ? ACTION_LABELS[entry.a] ?? entry.a : undefined;
      const base = label ? `${iso} — ${label}` : iso;
      if (entry.u) {
        return `${base}\n    ${entry.u}`;
      }
      return base;
    });
  return entries;
}

function buildActionLogSnapshot(entries: Array<{ key: string; lines: string[] }>): string {
  if (entries.length === 0) {
    return 'No action log entries found.';
  }
  return entries
    .map((entry) => {
      const username = entry.key.replace(ACTION_PREFIX, '');
      const lines = entry.lines.map((line) => `  - ${line}`);
      const body = lines.length > 0 ? lines.join('\n') : '  (no recorded timestamps)';
      return `${username}\n${body}`;
    })
    .join('\n\n');
}

export async function handleViewActionLog(
  _event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  if (!(await ensureNotBanned(context))) return;
  if (!context.kvStore) {
    context.ui.showToast('KV Store unavailable in this context.');
    return;
  }
  try {
    const usernames = await loadTrackedUsernames(context);
    const actionEntries = await Promise.all(
      usernames.map(async (username) => {
        let value = await context.kvStore?.get(historyKey(username));
        if (!value) {
          value = await context.kvStore?.get(legacyHistoryKey(username));
        }
        const lines = formatActionEntries(value);
        return { key: historyKey(username), lines };
      }),
    );
    const entriesWithLines = actionEntries.filter((entry) => entry.lines.length > 0);
    entriesWithLines.sort((a, b) => a.key.localeCompare(b.key));
    const snapshot = buildActionLogSnapshot(entriesWithLines);
    context.ui.showForm(resultForm, {
      title: 'Action Log',
      description: 'Snapshot of action log data stored in the KV store.',
      fields: [
        {
          type: 'paragraph',
          name: 'action-log',
          label: 'Recorded timestamps (UTC)',
          defaultValue: snapshot,
          lineHeight: 12,
          disabled: true,
        },
      ],
    });
  } catch (error) {
    console.error('[vainamoinen] failed to load action log', error);
    context.ui.showToast('Failed to load action log. Check console for details.');
  }
}

async function clearActionLogData(context: Devvit.Context): Promise<void> {
  if (!context.kvStore) {
    context.ui.showToast('KV Store unavailable in this context.');
    return;
  }
  const usernames = await loadTrackedUsernames(context);
  await Promise.all(
    usernames.map(async (username) => {
      try {
        await context.kvStore?.delete(historyKey(username));
        await context.kvStore?.delete(legacyHistoryKey(username));
      } catch (deleteError) {
        console.error('[vainamoinen] failed to delete action history for user', username, deleteError);
      }
    }),
  );
  context.ui.showToast('Action log cleared (counts preserved).');
  console.log('[vainamoinen] action log cleared by moderator', { usernamesCleared: usernames });
}

const confirmClearActionLogForm = Devvit.createForm(
  () => ({
    title: 'Confirm Log Clear',
    description: 'Are you sure you want to clear all current log entries for all users? This will not clear action counts.',
    acceptLabel: 'OK',
    cancelLabel: 'Cancel',
    fields: [],
  }),
  async (_event, formContext) => {
    await clearActionLogData(formContext);
  },
);

export async function handleClearActionLog(
  _event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  if (!(await ensureNotBanned(context))) return;
  if (!context.kvStore) {
    context.ui.showToast('KV Store unavailable in this context.');
    return;
  }
  context.ui.showForm(confirmClearActionLogForm, {});
}

const initialSetupForm = Devvit.createForm(
  () => ({
    title: 'Initial Setup',
    description:
      'This will create the Väinämöinen and Baby Väinämöinen user flair for the community - if they do not already exist. It will also create the Automod entry that sets the flair limits for the user flair (500 / 2000), and the autoresponder stickied comment on new posts that explains delegated moderation.\n\nPlease note that the Automod file must already exist. Press Cancel now if you need to create it. It is safe to rerun this setup to return to defaults.\n\nPress OK if you are ready to setup the app.',
    acceptLabel: 'OK',
    cancelLabel: 'Cancel',
    fields: [],
  }),
  async (_event, formContext) => {
    await runInitialSetup(formContext);
  },
);

export async function handleInitialSetup(
  _event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  if (!(await ensureNotBanned(context))) return;
  context.ui.showForm(initialSetupForm, {});
}

function aggregateActionCounts(value: unknown): Array<[string, number]> {
  const counts = (value && typeof value === 'object') ? (value as Record<string, unknown>) : {};
  const aggregated = new Map<string, number>();
  let bannedTotal = 0;
  for (const [action, raw] of Object.entries(counts)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    const label = ACTION_COUNT_LABELS[action] ?? action;
    if (label === 'ActionBanCount') {
      bannedTotal += raw;
      continue;
    }
    aggregated.set(label, (aggregated.get(label) ?? 0) + raw);
  }
  aggregated.set('ActionBanCount', bannedTotal);
  return Array.from(aggregated.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function formatActionCountsForDisplay(counts: Array<[string, number]>): string {
  if (counts.length === 0) {
    return 'No actions recorded yet.';
  }
  const lines = counts.map(([label, count]) => `  - ${label}: ${count}`);
  if (!lines.some((line) => line.includes('ActionBanCount'))) {
    lines.push('  - ActionBanCount: 0');
  }
  return lines.join('\n');
}

function buildActionCountSnapshot(entries: Array<{ username: string; counts: Array<[string, number]> }>): string {
  if (entries.length === 0) {
    return 'No action counts recorded.';
  }
  return entries
    .map((entry) => {
      const lines = entry.counts.map(([label, count]) => `  - ${label}: ${count}`);
      if (!lines.some((line) => line.includes('ActionBanCount'))) {
        lines.push('  - ActionBanCount: 0');
      }
      return `${entry.username}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}

export async function handleViewActionCounts(
  _event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  if (!(await ensureNotBanned(context))) return;
  if (!context.kvStore) {
    context.ui.showToast('KV Store unavailable in this context.');
    return;
  }
  try {
    const usernames = await loadTrackedUsernames(context);
    const entries = await Promise.all(
      usernames.map(async (username) => {
        let value = await context.kvStore?.get(actionCountKey(username));
        if (!value) {
          value = await context.kvStore?.get(legacyActionCountKey(username));
        }
        const counts = aggregateActionCounts(value);
        return { username, counts };
      }),
    );
    const filtered = entries.filter((entry) => entry.counts.length > 0);
    filtered.sort((a, b) => a.username.localeCompare(b.username));
    const snapshot = buildActionCountSnapshot(filtered);
    context.ui.showForm(resultForm, {
      title: 'Action Counts',
      description: 'All-time action counters stored in the KV store.',
      fields: [
        {
          type: 'paragraph',
          name: 'action-counts',
          label: 'Totals',
          defaultValue: snapshot,
          lineHeight: 12,
          disabled: true,
        },
      ],
    });
  } catch (error) {
    console.error('[vainamoinen] failed to load action counts', error);
    context.ui.showToast('Failed to load action counts. Check console for details.');
  }
}

export async function handleViewMyActionLog(
  _event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  // Banned users should still be able to view their own actions.
  if (!context.kvStore) {
    context.ui.showToast('KV Store unavailable in this context.');
    return;
  }
  const username = await context.reddit.getCurrentUsername();
  if (!username) {
    context.ui.showToast('You must be logged in to view your actions.');
    return;
  }
  try {
    let logValue = await context.kvStore.get(historyKey(username));
    if (!logValue) {
      logValue = await context.kvStore.get(legacyHistoryKey(username));
    }
    const logLines = formatActionEntries(logValue);
    let countValue = await context.kvStore.get(actionCountKey(username));
    if (!countValue) {
      countValue = await context.kvStore.get(legacyActionCountKey(username));
    }
    const counts = aggregateActionCounts(countValue);
    const countsText = formatActionCountsForDisplay(counts);
    const logText = logLines.length
      ? logLines.map((line) => `  - ${line}`).join('\n')
      : 'No actions recorded in the past 20 days.';
    context.ui.showForm(resultForm, {
      title: 'My Actions',
      description: 'Your action history and totals.',
      fields: [
        {
          type: 'paragraph',
          name: 'my-action-counts',
          label: 'Lifetime totals',
          defaultValue: countsText,
          lineHeight: 12,
          disabled: true,
        },
        {
          type: 'paragraph',
          name: 'my-action-log',
          label: 'Recent actions (last 20 days)',
          defaultValue: logText,
          lineHeight: 12,
          disabled: true,
        },
      ],
    });
  } catch (error) {
    console.error('[vainamoinen] failed to load personal action log', error);
    context.ui.showToast('Failed to load your action log.');
  }
}
async function loadTrackedUsernames(context: Devvit.Context): Promise<string[]> {
  if (!context.kvStore) return [];
  const result = new Set<string>();
  const currentRaw = await context.kvStore.get(ACTION_INDEX_KEY);
  if (Array.isArray(currentRaw)) {
    for (const entry of currentRaw) {
      if (typeof entry === 'string') result.add(entry);
    }
  }
  const legacyRaw = await context.kvStore.get(LEGACY_ACTION_INDEX_KEY);
  if (Array.isArray(legacyRaw)) {
    for (const entry of legacyRaw) {
      if (typeof entry === 'string') result.add(entry);
    }
  }
  return Array.from(result);
}
