import type { Context } from '@devvit/public-api';
import { BABY_FLAIR, MAIN_FLAIR, Role } from './roles.js';

export async function getUserRole(context: Context): Promise<Role> {
  const user = await context.reddit.getCurrentUser();
  const subreddit = context.subredditName;
  if (!user || !subreddit) return Role.None;

  const flair = await user.getUserFlairBySubreddit(subreddit);
  const flairText = flair?.flairText?.trim();
  if (!flairText) return Role.None;

  if (flairText === MAIN_FLAIR) return Role.Main;
  if (flairText === BABY_FLAIR) return Role.Baby;
  return Role.None;
}

