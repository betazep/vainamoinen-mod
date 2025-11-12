# Changelog

All notable changes to this project will be documented in this file. This project adheres to [Semantic Versioning](https://semver.org/).

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
