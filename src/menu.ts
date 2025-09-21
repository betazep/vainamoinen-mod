import type { Devvit } from '@devvit/public-api';
import {
  handleCommentLockToggle,
  handleCommentRemoveToggle,
  handlePostLockToggle,
  handlePostRemoveToggle,
  handlePostStickyToggle,
  handleInitialSetup,
  handleClearActionLog,
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

  // Post: Remove/Restore toggle (Approve)
  Devvit.addMenuItem({
    location: 'post',
    label: 'Remove/Restore',
    onPress: handlePostRemoveToggle,
  });

  // Comment: Lock/Unlock toggle
  Devvit.addMenuItem({
    location: 'comment',
    label: 'Lock/Unlock',
    onPress: handleCommentLockToggle,
  });

  // Comment: Remove/Restore toggle (Approve)
  Devvit.addMenuItem({
    location: 'comment',
    label: 'Remove/Restore',
    onPress: handleCommentRemoveToggle,
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
