import type { Devvit } from '@devvit/public-api';
import { getUserRole } from './flair.js';
import { Role } from './roles.js';
import { randomPermissionQuote } from './quotes.js';
import {
  appendActionLogEntry,
  applyBanIfNeeded,
  DAILY_BAN_THRESHOLD,
  getAbuseMessage,
  HOURLY_BAN_THRESHOLD,
  isUserBanned,
  recordModeratorAction,
} from './abuseTracker.js';

export async function ensureRoleOrToast(
  context: Devvit.Context,
  allowed: Role[],
): Promise<Role | undefined> {
  const role = await getUserRole(context);
  if (!allowed.includes(role)) {
    context.ui.showToast(randomPermissionQuote());
    return undefined;
  }
  return role;
}

export async function ensureNotBanned(context: Devvit.Context): Promise<boolean> {
  if (await isUserBanned(context)) {
    context.ui.showToast('You are currently banned from this community.');
    return false;
  }
  return true;
}

export async function ensureModeratorOrToast(context: Devvit.Context): Promise<boolean> {
  const subredditName = context.subredditName;
  const user = await context.reddit.getCurrentUser();
  if (!subredditName || !user) {
    context.ui.showToast('Only moderators can use this action.');
    return false;
  }
  try {
    const permissions = await user.getModPermissionsForSubreddit(subredditName);
    if (permissions.length === 0) {
      context.ui.showToast('Only moderators can use this action.');
      return false;
    }
    return true;
  } catch (error) {
    console.error('[vainamoinen] failed to confirm moderator permissions', error);
    context.ui.showToast('Unable to verify moderator permissions.');
    return false;
  }
}

export async function warnIfAbusive(
  context: Devvit.Context,
  action?: string,
  url?: string,
): Promise<boolean> {
  if (!context.kvStore) return false;
  try {
    const info = await recordModeratorAction(context, action, url);
    if (!info) return false;
    const { hourlyCount, dailyCount, username, banned } = info;
    const message = getAbuseMessage(hourlyCount, dailyCount);
    if (!message) return false;
    if (banned) {
      context.ui.showToast('You are currently banned from this community.');
      return true;
    }
    const exceedHourly = hourlyCount >= HOURLY_BAN_THRESHOLD;
    const exceedDaily = dailyCount >= DAILY_BAN_THRESHOLD;
    if ((exceedHourly || exceedDaily) && username) {
      const bannedNow = await applyBanIfNeeded(context, username, exceedHourly, exceedDaily);
      if (bannedNow) {
        if (exceedHourly) {
          await appendActionLogEntry(context, username, 'ban-hourly');
        }
        if (exceedDaily) {
          await appendActionLogEntry(context, username, 'ban-daily');
        }
        context.ui.showToast(message);
        return true;
      }
    }
    context.ui.showToast(message);
    return exceedHourly || exceedDaily;
  } catch (error) {
    console.error('[vainamoinen] abuse tracker failed:', error);
    return false;
  }
}
