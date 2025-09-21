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

export async function warnIfAbusive(
  context: Devvit.Context,
  action?: string,
): Promise<boolean> {
  if (!context.kvStore) return false;
  try {
    const info = await recordModeratorAction(context, action);
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
