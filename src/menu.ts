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
  handleClearActionLog,
  handleCleanupRemoveRestoreCounts,
  handleViewActionLog,
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

  // Post: Sticky/Unsticky toggle
  Devvit.addMenuItem({
    location: 'post',
    label: 'Sticky/Unsticky',
    onPress: handlePostStickyToggle,
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

  // Post: Freeze/Unfreeze (Moderator only)
  Devvit.addMenuItem({
    location: 'post',
    label: 'Freeze/Unfreeze State (Mod)',
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

  // Comment: Freeze/Unfreeze (Moderator only)
  Devvit.addMenuItem({
    location: 'comment',
    label: 'Freeze/Unfreeze State (Mod)',
    onPress: handleCommentFreezeToggle,
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
    label: 'View Action Log',
    forUserType: 'moderator',
    onPress: handleViewActionLog,
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'Clear Action Log',
    forUserType: 'moderator',
    onPress: handleClearActionLog,
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'Cleanup Remove/Restore Counts',
    forUserType: 'moderator',
    onPress: handleCleanupRemoveRestoreCounts,
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'View Action Counts',
    forUserType: 'moderator',
    onPress: handleViewActionCounts,
  });

  Devvit.addMenuItem({
    location: 'subreddit',
    label: 'My Action Log',
    onPress: handleViewMyActionLog,
  });

}
