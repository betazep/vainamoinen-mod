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
  appendActionLogEntry,
} from './abuseTracker.js';
import { resultForm } from './forms/resultForm.js';
import { ensureModeratorOrToast, ensureNotBanned, ensureRoleOrToast, warnIfAbusive, isModerator } from './menuGuards.js';
import { isRemoveRestoreCommentsEnabled, isRemoveRestorePostsEnabled } from './menuSettings.js';
import { BABY_FLAIR, MAIN_FLAIR, Role } from './roles.js';
import { isTargetFrozen, toggleTargetFrozen } from './freezeState.js';
import type { FreezeTargetType } from './freezeState.js';
import {
  appendTargetLogEntry,
  clearAllTargetLogs,
  getTargetLogEntries,
  hasUserActedOnTarget,
  markUserActedOnTarget,
} from './targetLogs.js';
import type { TargetLogEntry } from './targetLogs.js';
import {
  randomLockPrefix,
  randomRemovePrefix,
  randomRestorePrefix,
  randomUnlockPrefix,
} from './quotes.js';

type ActionResult = {
  url?: string;
  actionId?: string;
  performed?: boolean;
  skipAbuseTracking?: boolean;
  reason?: string;
  targetType?: FreezeTargetType;
  targetId?: string;
};

const LEGACY_REMOVE_COUNTER_KEYS = ['post-remove-toggle', 'comment-remove-toggle'];
const ACTION_REASON_MAX_LENGTH = 30;
const SINGLE_ACTION_TOAST = 'You may only call Väinämöinen once for this item.';
const PENDING_REASON_PREFIX = 'vainamoinen:pending:reason:';
type ReasonAction =
  | 'post-lock'
  | 'comment-lock'
  | 'post-remove'
  | 'post-restore'
  | 'comment-remove'
  | 'comment-restore';

type ReasonFormData = {
  title?: string;
  description?: string;
};

const reasonForm = Devvit.createForm(
  (data: ReasonFormData) => ({
    title: data.title ?? 'Action Reason',
    description: data.description ?? 'Provide a short reason (30 characters max).',
    acceptLabel: 'Submit',
    cancelLabel: 'Cancel',
    fields: [
      {
        type: 'string',
        name: 'reason',
        label: 'Reason',
        maxLength: ACTION_REASON_MAX_LENGTH,
        placeholder: '30 characters maximum to here^',
        required: true,
      },
    ],
  }),
  async (event, formContext) => {
    const reason = sanitizeReason((event.values.reason as string | undefined) ?? '');
    if (!reason) {
      formContext.ui.showToast('Please provide a reason (max 50 characters).');
      return;
    }
    const username = await formContext.reddit.getCurrentUsername();
    if (!username) {
      formContext.ui.showToast('You must be logged in to perform this action.');
      return;
    }
    const payload = await loadPendingReasonPayload(formContext, username);
    if (!payload) {
      formContext.ui.showToast('This request expired. Please retry.');
      return;
    }
    await deletePendingReasonPayload(formContext, username);
    const { action, targetId, targetType } = payload;
    try {
      switch (action) {
        case 'post-lock':
          await guardAction(
            formContext,
            [Role.Baby, Role.Main],
            () => togglePostLock(formContext, targetId),
            { actionName: 'post-lock', targetType: 'post', targetId, enforceSingleAction: true, reason },
          );
          break;
        case 'comment-lock':
          await guardAction(
            formContext,
            [Role.Baby, Role.Main],
            () => toggleCommentLock(formContext, targetId),
            { actionName: 'comment-lock', targetType: 'comment', targetId, enforceSingleAction: true, reason },
          );
          break;
        case 'post-remove':
          await guardAction(
            formContext,
            [Role.Main],
            () => removePost(formContext, targetId),
            { actionName: 'post-remove', targetType: 'post', targetId, enforceSingleAction: true, reason },
          );
          break;
        case 'post-restore':
          await guardAction(
            formContext,
            [Role.Main],
            () => restorePost(formContext, targetId),
            { actionName: 'post-restore', targetType: 'post', targetId, enforceSingleAction: true, reason },
          );
          break;
        case 'comment-remove':
          await guardAction(
            formContext,
            [Role.Main],
            () => removeComment(formContext, targetId),
            { actionName: 'comment-remove', targetType: 'comment', targetId, enforceSingleAction: true, reason },
          );
          break;
        case 'comment-restore':
          await guardAction(
            formContext,
            [Role.Main],
            () => restoreComment(formContext, targetId),
            { actionName: 'comment-restore', targetType: 'comment', targetId, enforceSingleAction: true, reason },
          );
          break;
        default:
          formContext.ui.showToast('Unknown action.');
      }
    } catch (error) {
      console.error('[vainamoinen] reason form submit failed', error);
      formContext.ui.showToast('Failed to perform action.');
    }
  },
);

function sanitizeReason(reason?: string): string | undefined {
  if (!reason) return undefined;
  const trimmed = reason.trim().slice(0, ACTION_REASON_MAX_LENGTH);
  if (!trimmed) return undefined;
  // Allow printable ASCII only to keep logs clean.
  const ascii = trimmed.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
  const singleLine = ascii.replace(/[\r\n\t]+/g, ' ').trim();
  return singleLine || undefined;
}

function formatTimestamp(ts: number): string {
  // Compact UTC display: YY-MM-DD HH:MM:SSZ
  const iso = new Date(ts).toISOString();
  return `${iso.slice(2, 4)}-${iso.slice(5, 7)}-${iso.slice(8, 10)} ${iso.slice(11, 19)}Z`;
}

async function savePendingReasonPayload(
  context: Devvit.Context,
  username: string,
  payload: ReasonFormData & { action: ReasonAction; targetId: string; targetType: FreezeTargetType },
): Promise<void> {
  if (!context.kvStore) return;
  await context.kvStore.put(`${PENDING_REASON_PREFIX}${username}`, payload);
}

async function loadPendingReasonPayload(
  context: Devvit.Context,
  username: string,
): Promise<(ReasonFormData & { action: ReasonAction; targetId: string; targetType: FreezeTargetType }) | undefined> {
  if (!context.kvStore) return undefined;
  const value = await context.kvStore.get(`${PENDING_REASON_PREFIX}${username}`);
  if (value && typeof value === 'object') {
    const raw = value as { action?: ReasonAction; targetId?: string; targetType?: FreezeTargetType };
    if (raw.action && raw.targetId && raw.targetType) {
      return { action: raw.action, targetId: raw.targetId, targetType: raw.targetType };
    }
  }
  return undefined;
}

async function deletePendingReasonPayload(context: Devvit.Context, username: string): Promise<void> {
  if (!context.kvStore) return;
  await context.kvStore.delete(`${PENDING_REASON_PREFIX}${username}`);
}

async function showReasonForm(
  context: Devvit.Context,
  payload: { action: ReasonAction; targetId: string; targetType: FreezeTargetType; title?: string; description?: string },
): Promise<void> {
  const username = await context.reddit.getCurrentUsername();
  if (!username) {
    context.ui.showToast('You must be logged in to perform this action.');
    return;
  }
  if (!context.kvStore) {
    context.ui.showToast('KV Store unavailable.');
    return;
  }
  try {
    await savePendingReasonPayload(context, username, payload);
    context.ui.showForm(reasonForm, {
      title: payload.title ?? 'Action Reason',
      description: payload.description ?? 'Provide a short reason (30 characters max).',
    });
  } catch (error) {
    console.error('[vainamoinen] showReasonForm failed', error, { payload });
    throw error;
  }
}

async function ensureTargetThawed(
  context: Devvit.Context,
  targetType: FreezeTargetType,
  targetId: string,
): Promise<boolean> {
  if (!(await isTargetFrozen(context, targetType, targetId))) {
    return true;
  }
  const noun = targetType === 'post' ? 'post' : 'comment';
  context.ui.showToast(`This ${noun} has been frozen by a moderator.`);
  return false;
}

async function logActionWithoutCounts(
  context: Devvit.Context,
  actionId?: string,
  url?: string,
): Promise<void> {
  if (!actionId) return;
  const username = await context.reddit.getCurrentUsername();
  if (!username) return;
  try {
    await appendActionLogEntry(context, username, actionId, url, undefined, undefined, false);
  } catch (error) {
    console.error('[vainamoinen] failed to log freeze action', error);
  }
}

function formatPermalink(permalink?: string): string | undefined {
  if (!permalink) return undefined;
  try {
    const url = permalink.startsWith('http://') || permalink.startsWith('https://')
      ? new URL(permalink)
      : new URL(`https://www.reddit.com${permalink}`);
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length >= 5 && segments[0] === 'r' && segments[2] === 'comments') {
      // segments: r/<sub>/comments/<postId>/<slug>/<commentId?>
      const postId = segments[3];
      const commentId = segments[5];
      if (commentId) {
        return `redd.it/comments/${postId}/${commentId}`;
      }
      return `redd.it/${postId}`;
    }
    return `redd.it${url.pathname}`;
  } catch {
    return permalink;
  }
}

async function togglePostLock(context: Devvit.Context, postId: string): Promise<ActionResult | undefined> {
  if (!(await ensureTargetThawed(context, 'post', postId))) {
    return undefined;
  }
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
    performed: true,
  };
}

async function togglePostSticky(context: Devvit.Context, postId: string): Promise<ActionResult | undefined> {
  if (!(await ensureTargetThawed(context, 'post', postId))) {
    return undefined;
  }
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
    performed: true,
  };
}

async function removePost(context: Devvit.Context, postId: string): Promise<ActionResult | undefined> {
  if (!(await ensureTargetThawed(context, 'post', postId))) {
    return undefined;
  }
  const post = await context.reddit.getPostById(postId);
  if (post.isRemoved()) {
    context.ui.showToast('Post is already removed.');
    return { performed: false };
  }
  await post.remove(false);
  context.ui.showToast(`${randomRemovePrefix()} the post is removed.`);
  return {
    url: formatPermalink(post.permalink),
    actionId: 'post-remove',
    performed: true,
  };
}

async function restorePost(context: Devvit.Context, postId: string): Promise<ActionResult | undefined> {
  if (!(await ensureTargetThawed(context, 'post', postId))) {
    return undefined;
  }
  const post = await context.reddit.getPostById(postId);
  if (!post.isRemoved()) {
    context.ui.showToast('Post is not removed.');
    return { performed: false };
  }
  await post.approve();
  context.ui.showToast(`${randomRestorePrefix()} the post is restored.`);
  return {
    url: formatPermalink(post.permalink),
    actionId: 'post-restore',
    performed: true,
  };
}

async function toggleCommentLock(context: Devvit.Context, commentId: string): Promise<ActionResult | undefined> {
  if (!(await ensureTargetThawed(context, 'comment', commentId))) {
    return undefined;
  }
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
    performed: true,
  };
}

async function removeComment(context: Devvit.Context, commentId: string): Promise<ActionResult | undefined> {
  if (!(await ensureTargetThawed(context, 'comment', commentId))) {
    return undefined;
  }
  const comment = await context.reddit.getCommentById(commentId);
  if (comment.isRemoved()) {
    context.ui.showToast('Comment is already removed.');
    return { performed: false };
  }
  await comment.remove(false);
  context.ui.showToast(`${randomRemovePrefix()} the comment is removed.`);
  return {
    url: formatPermalink(comment.permalink),
    actionId: 'comment-remove',
    performed: true,
  };
}

async function restoreComment(context: Devvit.Context, commentId: string): Promise<ActionResult | undefined> {
  if (!(await ensureTargetThawed(context, 'comment', commentId))) {
    return undefined;
  }
  const comment = await context.reddit.getCommentById(commentId);
  if (!comment.isRemoved()) {
    context.ui.showToast('Comment is not removed.');
    return { performed: false };
  }
  await comment.approve();
  context.ui.showToast(`${randomRestorePrefix()} the comment is restored.`);
  return {
    url: formatPermalink(comment.permalink),
    actionId: 'comment-restore',
    performed: true,
  };
}

async function togglePostFreeze(context: Devvit.Context, postId: string): Promise<ActionResult | undefined> {
  const post = await context.reddit.getPostById(postId);
  const frozen = await toggleTargetFrozen(context, 'post', postId);
  context.ui.showToast(
    frozen ? 'Post frozen. Remove/Restore, Lock/Unlock, and Sticky actions are disabled.' : 'Post unfrozen. Actions re-enabled.',
  );
  return {
    url: formatPermalink(post.permalink),
    actionId: frozen ? 'post-freeze' : 'post-unfreeze',
    performed: true,
    skipAbuseTracking: true,
  };
}

async function toggleCommentFreeze(context: Devvit.Context, commentId: string): Promise<ActionResult | undefined> {
  const comment = await context.reddit.getCommentById(commentId);
  const frozen = await toggleTargetFrozen(context, 'comment', commentId);
  context.ui.showToast(
    frozen
      ? 'Comment frozen. Remove/Restore and Lock/Unlock actions are disabled.'
      : 'Comment unfrozen. Actions re-enabled.',
  );
  return {
    url: formatPermalink(comment.permalink),
    actionId: frozen ? 'comment-freeze' : 'comment-unfreeze',
    performed: true,
    skipAbuseTracking: true,
  };
}

export async function handlePostFreezeToggle(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  if (!(await ensureModeratorOrToast(context))) return;
  try {
    const result = await guardAction(context, undefined, () => togglePostFreeze(context, event.targetId));
    if (result?.performed) {
      await logActionWithoutCounts(context, result.actionId, result.url);
    }
  } catch (error) {
    console.error('[vainamoinen] Failed to toggle post freeze state', error);
    context.ui.showToast('Failed to update post freeze state.');
  }
}

export async function handleCommentFreezeToggle(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  if (!(await ensureModeratorOrToast(context))) return;
  try {
    const result = await guardAction(context, undefined, () => toggleCommentFreeze(context, event.targetId));
    if (result?.performed) {
      await logActionWithoutCounts(context, result.actionId, result.url);
    }
  } catch (error) {
    console.error('[vainamoinen] Failed to toggle comment freeze state', error);
    context.ui.showToast('Failed to update comment freeze state.');
  }
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

type GuardOptions = {
  actionName?: string;
  targetType?: FreezeTargetType;
  targetId?: string;
  enforceSingleAction?: boolean;
  reason?: string;
};

async function guardAction(
  context: Devvit.Context,
  allowedRoles: Role[] | undefined,
  action: () => Promise<ActionResult | undefined>,
  actionNameOrOptions?: string | GuardOptions,
): Promise<ActionResult | undefined> {
  const options: GuardOptions = typeof actionNameOrOptions === 'string' ? { actionName: actionNameOrOptions } : (actionNameOrOptions ?? {});
  if (allowedRoles && allowedRoles.length > 0) {
    const role = await ensureRoleOrToast(context, allowedRoles);
    if (!role) return;
  }
  if (!(await ensureNotBanned(context))) return;
  const { enforceSingleAction, targetId, targetType } = options;
  let username: string | undefined;
  if (enforceSingleAction && targetType && targetId) {
    username = await context.reddit.getCurrentUsername();
    if (!username) {
      context.ui.showToast('You must be logged in to perform this action.');
      return;
    }
    if (await hasUserActedOnTarget(context, targetType, targetId, username)) {
      context.ui.showToast(SINGLE_ACTION_TOAST);
      return;
    }
  }
  const result = await action();
  if (!result) return undefined;
  if (result.performed === false) return result;
  const finalAction = result.actionId ?? options.actionName;
  const reason = sanitizeReason(result.reason ?? options.reason);
  const finalTargetType = result.targetType ?? targetType;
  const finalTargetId = result.targetId ?? targetId;
  const actorUsername = username ?? (await context.reddit.getCurrentUsername());
  const url = result.url;
  if (!result.skipAbuseTracking && finalAction) {
    await warnIfAbusive(context, finalAction, url, reason, finalTargetId);
  }
  if (finalTargetType && finalTargetId && finalAction) {
    await appendTargetLogEntry(context, finalTargetType, finalTargetId, finalAction, reason, url, actorUsername);
    if (enforceSingleAction && username) {
      await markUserActedOnTarget(context, finalTargetType, finalTargetId, username);
    }
  }
  return result;
}

export async function handlePostLockToggle(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  try {
    const post = await context.reddit.getPostById(event.targetId);
    const locked = post.isLocked();
    const title = `Lock/Unlock Reason - Currently: ${locked ? 'Locked' : 'Unlocked'}`;
    const description = locked
      ? 'Provide a short reason for unlock (30 characters max).'
      : 'Provide a short reason for lock (30 characters max).';
    await showReasonForm(context, {
      action: 'post-lock',
      targetId: event.targetId,
      targetType: 'post',
      title,
      description,
    });
  } catch {
    console.error('[vainamoinen] failed to open reason form for post lock');
    context.ui.showToast('Failed to toggle lock');
  }
}

export async function handlePostStickyToggle(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  try {
    await guardAction(
      context,
      [Role.Main],
      () => togglePostSticky(context, event.targetId),
      { actionName: 'post-sticky-toggle', targetType: 'post', targetId: event.targetId, enforceSingleAction: true },
    );
  } catch {
    context.ui.showToast('Failed to toggle sticky');
  }
}

export async function handlePostRemove(event: MenuItemOnPressEvent, context: Devvit.Context): Promise<void> {
  const featureEnabled = await isRemoveRestorePostsEnabled(context);
  if (!(await ensureFeatureEnabled(context, featureEnabled, 'Remove/Restore is disabled for posts.'))) {
    return;
  }
  try {
    await showReasonForm(context, {
      action: 'post-remove',
      targetId: event.targetId,
      targetType: 'post',
      title: 'Reason for Remove',
    });
  } catch {
    console.error('[vainamoinen] failed to open reason form for post remove');
    context.ui.showToast('Failed to remove post.');
  }
}

export async function handlePostRestore(event: MenuItemOnPressEvent, context: Devvit.Context): Promise<void> {
  const featureEnabled = await isRemoveRestorePostsEnabled(context);
  if (!(await ensureFeatureEnabled(context, featureEnabled, 'Remove/Restore is disabled for posts.'))) {
    return;
  }
  try {
    await showReasonForm(context, {
      action: 'post-restore',
      targetId: event.targetId,
      targetType: 'post',
      title: 'Reason for Restore',
    });
  } catch {
    console.error('[vainamoinen] failed to open reason form for post restore');
    context.ui.showToast('Failed to restore post.');
  }
}

export async function handleCommentLockToggle(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  try {
    const comment = await context.reddit.getCommentById(event.targetId);
    const locked = comment.isLocked();
    const title = `Lock/Unlock Reason - Currently: ${locked ? 'Locked' : 'Unlocked'}`;
    const description = locked
      ? 'Provide a short reason for unlock (30 characters max).'
      : 'Provide a short reason for lock (30 characters max).';
    await showReasonForm(context, {
      action: 'comment-lock',
      targetId: event.targetId,
      targetType: 'comment',
      title,
      description,
    });
  } catch {
    console.error('[vainamoinen] failed to open reason form for comment lock');
    context.ui.showToast('Failed to toggle lock');
  }
}

export async function handleCommentRemove(event: MenuItemOnPressEvent, context: Devvit.Context): Promise<void> {
  const featureEnabled = await isRemoveRestoreCommentsEnabled(context);
  if (!(await ensureFeatureEnabled(context, featureEnabled, 'Remove/Restore is disabled for comments.'))) {
    return;
  }
  try {
    await showReasonForm(context, {
      action: 'comment-remove',
      targetId: event.targetId,
      targetType: 'comment',
      title: 'Reason for Remove',
    });
  } catch {
    console.error('[vainamoinen] failed to open reason form for comment remove');
    context.ui.showToast('Failed to remove comment.');
  }
}

export async function handleCommentRestore(event: MenuItemOnPressEvent, context: Devvit.Context): Promise<void> {
  const featureEnabled = await isRemoveRestoreCommentsEnabled(context);
  if (!(await ensureFeatureEnabled(context, featureEnabled, 'Remove/Restore is disabled for comments.'))) {
    return;
  }
  try {
    await showReasonForm(context, {
      action: 'comment-restore',
      targetId: event.targetId,
      targetType: 'comment',
      title: 'Reason for Restore',
    });
  } catch {
    console.error('[vainamoinen] failed to open reason form for comment restore');
    context.ui.showToast('Failed to restore comment.');
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
  'post-freeze': 'Post Frozen',
  'post-unfreeze': 'Post Unfrozen',
  'comment-lock': 'Comment Lock',
  'comment-unlock': 'Comment Unlock',
  'comment-remove': 'Comment Remove',
  'comment-restore': 'Comment Restore',
  'comment-freeze': 'Comment Frozen',
  'comment-unfreeze': 'Comment Unfrozen',
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
  'post-remove': 'Remove',
  'post-restore': 'Restore',
  'comment-lock': 'Lock/Unlock',
  'comment-unlock': 'Lock/Unlock',
  'comment-remove': 'Remove',
  'comment-restore': 'Restore',
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
      const iso = formatTimestamp(entry.t);
      const label = entry.a ? ACTION_LABELS[entry.a] ?? entry.a : undefined;
      const base = label ? `${iso}` : `${iso}`;
      const labelLine = label ? `\n    ${label}` : '';
      const urlLine = entry.u ? `\n    ${entry.u}` : '';
      const reasonLine = entry.r ? `\n    "${entry.r}"` : '';
      return `${base}${labelLine}${urlLine}${reasonLine}`;
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
      const separated = lines.length > 0 ? lines.join('\n-------------------------------\n') : '  (no recorded timestamps)';
      return `${username}\n${separated}`;
    })
    .join('\n\n');
}

function formatTargetActionEntries(entries: TargetLogEntry[], showUser: boolean): string {
  if (entries.length === 0) {
    return 'No actions recorded for this item.';
  }
  return entries
    .map((entry) => {
      const iso = formatTimestamp(entry.t);
      const label = entry.a ? ACTION_LABELS[entry.a] ?? entry.a : 'Action';
      const reason = entry.r ?? 'No reason provided.';
      const userLine = showUser && entry.user ? `\n    ${entry.user}` : '';
      return `  - ${iso}${userLine}\n    ${label}\n    "${reason}"`;
    })
    .join('\n-------------------------------\n');
}

async function handleViewTargetActionLog(
  context: Devvit.Context,
  targetType: FreezeTargetType,
  targetId: string,
): Promise<void> {
  if (!context.kvStore) {
    context.ui.showToast('KV Store unavailable in this context.');
    return;
  }
  try {
    const entries = await getTargetLogEntries(context, targetType, targetId);
    const isMod = await isModerator(context);
    const body = formatTargetActionEntries(entries, isMod);
    context.ui.showForm(resultForm, {
      title: 'Community Mod Log',
      description: targetType === 'post'
        ? 'Actions taken on this post.\n\nContact one of the Subreddit Moderators if you believe there is abuse. You may also report the post using Reddit\'s built-in functionality.'
        : 'Actions taken on this comment.\n\nContact one of the Subreddit Moderators if you believe there is abuse. You may also report the comment using Reddit\'s built-in functionality.',
      fields: [
        {
          type: 'paragraph',
          name: 'cm-actions',
          label: 'Recent actions',
          defaultValue: body,
          lineHeight: 12,
        },
      ],
    });
  } catch (error) {
    console.error('[vainamoinen] failed to load target action log', error);
    context.ui.showToast('Failed to load actions for this item.');
  }
}

export async function handleViewPostActionsLog(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  await handleViewTargetActionLog(context, 'post', event.targetId);
}

export async function handleViewCommentActionsLog(
  event: MenuItemOnPressEvent,
  context: Devvit.Context,
): Promise<void> {
  await handleViewTargetActionLog(context, 'comment', event.targetId);
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
  await clearAllTargetLogs(context);
  await context.kvStore.delete(ACTION_INDEX_KEY);
  await context.kvStore.delete(LEGACY_ACTION_INDEX_KEY);
  context.ui.showToast('Action log cleared (counts preserved).');
  console.log('[vainamoinen] action log cleared by moderator', { usernamesCleared: usernames });
}

function cloneNumericCounts(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const result: Record<string, number> = {};
  let hasEntry = false;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      result[key] = raw;
      hasEntry = true;
    }
  }
  return hasEntry ? result : undefined;
}

async function stripLegacyCountsAtKey(context: Devvit.Context, key: string): Promise<boolean> {
  if (!context.kvStore) return false;
  const counts = cloneNumericCounts(await context.kvStore.get(key));
  if (!counts) return false;
  let changed = false;
  for (const legacyKey of LEGACY_REMOVE_COUNTER_KEYS) {
    if (legacyKey in counts) {
      delete counts[legacyKey];
      changed = true;
    }
  }
  if (!changed) return false;
  if (Object.keys(counts).length === 0) {
    await context.kvStore.delete(key);
  } else {
    await context.kvStore.put(key, counts);
  }
  return true;
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
      ? logLines.map((line) => `  - ${line}`).join('\n-------------------------------\n')
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
        },
        {
          type: 'paragraph',
          name: 'my-action-log',
          label: 'Recent actions (last 20 days)',
          defaultValue: logText,
          lineHeight: 12,
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
