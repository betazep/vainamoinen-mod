import type { Devvit } from '@devvit/public-api';
import {
  handleCommentFreezeToggle,
  handleCommentLockToggle,
  handleCommentRemove,
  handleCommentRestore,
  handlePostFreezeToggle,
  handlePostLockToggle,
  handlePostRemove,
  handlePostRestore,
  handlePostStickyToggle,
  handleInitialSetup,
  handleViewCommentActionsLog,
  handleViewPostActionsLog,
  handleClearActionLog,
  handleViewActionLog,
  handleViewActionLogByTarget,
  handleViewActionLogByTargetPublic,
  handleViewActionCounts,
  handleViewMyActionLog,
} from './menuHandlers.js';

export function registerMenuItems(Devvit: typeof import('@devvit/public-api').Devvit): void {
  // Post: Lock/Unlock toggle
  Devvit.addMenuItem({
    location: 'post',
    label: 'Lock/Unlock',
    onPress: handlePostLockToggle,
  });

  // Post: Remove (Approve)
  Devvit.addMenuItem({
    location: 'post',
    label: 'Remove',
    onPress: handlePostRemove,
  });

  // Post: Restore (Approve)
  Devvit.addMenuItem({
    location: 'post',
    label: 'Restore',
    onPress: handlePostRestore,
  });

  // Post: Community Mod Log
  Devvit.addMenuItem({
    location: 'post',
    label: 'Community Mod Log',
    onPress: handleViewPostActionsLog,
  });

  // Post: Sticky/Unsticky toggle
  Devvit.addMenuItem({
    location: 'post',
    label: 'Sticky/Unsticky',
    onPress: handlePostStickyToggle,
  });

  // Post: Freeze/Unfreeze (Moderator only)
  Devvit.addMenuItem({
    location: 'post',
    label: 'Un/Freeze State (Sub Mod)',
    onPress: handlePostFreezeToggle,
  });

  // Comment: Lock/Unlock toggle
  Devvit.addMenuItem({
    location: 'comment',
    label: 'Lock/Unlock',
    onPress: handleCommentLockToggle,
  });

  // Comment: Remove (Approve)
  Devvit.addMenuItem({
    location: 'comment',
    label: 'Remove',
    onPress: handleCommentRemove,
  });

  // Comment: Restore (Approve)
  Devvit.addMenuItem({
    location: 'comment',
    label: 'Restore',
    onPress: handleCommentRestore,
  });

  // Comment: Community Mod Log
  Devvit.addMenuItem({
    location: 'comment',
    label: 'Community Mod Log',
    onPress: handleViewCommentActionsLog,
  });

  // Comment: Freeze/Unfreeze (Moderator only)
  Devvit.addMenuItem({
    location: 'comment',
    label: 'Un/Freeze State (Sub Mod)',
    onPress: handleCommentFreezeToggle,
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'My Action Log',
    onPress: handleViewMyActionLog,
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'CM Action Log (Full)',
    onPress: handleViewActionLogByTargetPublic,
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'Mod Action Log (User)',
    forUserType: 'moderator',
    onPress: handleViewActionLog,
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'Mod Action Log (Post)',
    forUserType: 'moderator',
    onPress: handleViewActionLogByTarget,
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'Mod Action Counts',
    forUserType: 'moderator',
    onPress: handleViewActionCounts,
  });

  // Subreddit: Moderator-only initial setup
  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'Väinämöinen Initial Setup',
    forUserType: 'moderator',
    onPress: handleInitialSetup,
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'Clear Action Log (warning)',
    forUserType: 'moderator',
    onPress: handleClearActionLog,
  });

}
