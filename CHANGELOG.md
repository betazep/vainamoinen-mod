# Changelog

All notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org/).

## 1.3.0 - 2025-12-1

SUMMARY OF CHANGES
1. All post and comment Lock/Unlock, Remove, and Restore actions require a reason for performing the action. This reason is logged by user for the item. Subreddit mods will be moderating "reasons" for basic decency.
2. All posts and comments have an individual Community Mod Log that shows the activity on that object.  Only Subreddit mods can see the users that perform actions. Everyone else can see the actions and listed reasons. (We are not enabling blame and shame - send a mod-mail if you feel there is abuse. Please provide the link to the post.)
3. ONLY ONE ACTION PER POST/COMMENT IS ALLOWED PER PERSON!  You get one vote and you are done.  If you remove and someone restores, then it is restored.  If you lock and someone unlocks, then it is unlocked.  Another privileged user can come along and reinforce your action - and the person who unlocked/restored already made their vote. If you feel the choice was wrong, then report the post to the subreddit moderators using the built-in functionality or via mod mail to restore your post/comment. Sub mods can freeze the state of a post or comment allowing no further community moderator actions. We are the final judge.
4. Cleaned up My Action log, now visible and scroll-able from mobile devices.  You can see the history of everything you have done with reddit short links if you want to go back and check something.  Subreddit mods have access to the whole community and will watch for general abuse.
5. When you supply a reason for Lock/Unlock the reason card will show the current state of the post or comment. Remove and Restore will not allow you to Remove a Removed item or Restore a Restored item.

## 1.2.1 - 2025-11-13

### Removed
- Retired the temporary "Cleanup Remove/Restore Counts" moderator utility now that historical data has been refreshed.

## 1.1.0 - 2025-11-13

### Added
- Split Remove and Restore into dedicated actions with independent tracking and reporting.
- Moderator-only Freeze/Unfreeze buttons for posts and comments, including action-log entries and freeze enforcement.
- Subreddit utility to clean up legacy Remove/Restore count data without touching other metrics.

### Changed
- Action logs and dashboards now show separate Remove vs Restore totals while freeze actions bypass the abuse counter pipeline.

## 1.0.5 - 2025-10-02

### Added
- Log delegated post/comment actions with shortened Reddit permalinks in the action log.
- Record the specific action taken (lock vs unlock, remove vs restore) for each delegated moderation event.
- Added changelog tracking and README reference.

### Changed
- Action log entries now display compact Reddit links.
