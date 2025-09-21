# Väinämöinen Community Moderator

This is an app that delegates moderation powers to established community members based on subreddit-specific user flair.

## Highlights

- Delegated actions: Lock/Unlock, Sticky/Unsticky, and Remove/Restore on posts and comments.
- Role-based access: "Baby Väinämöinen" and "Väinämöinen" flair thresholds enforced at click time.
- Automated setup: one-click menu task seeds flair templates, Automod karma rules, and a stickied onboarding comment for every new submission.
- Abuse protections: rate-limited action tracker with automatic warnings and 7-day bans for repeated abuse, plus moderator dashboards for audit and cleanup.

## Installing & Setting Up

1. Install the app on your subreddit. (This will add u/vainamoinen-mod as a moderator.) 
2. Create `r/<sub>/wiki/config/automoderator` if it does not already exist.
3. From the subreddit context menu run **“Väinämöinen Initial Setup.”**
   - Ensures the two flair templates exist (no-op if already present).
   - Writes or refreshes the Automod block that assigns flair by combined subreddit karma and injects the default stickied guidance comment.
4. Rerun the setup any time to restore the defaults.

### Runtime Configuration

- Installation settings (per subreddit):
  - `enable-remove-restore-posts`
  - `enable-remove-restore-comments`
  - Use these to turn off or on the ability for remove/restore on either posts or comments.


## Delegated Experience

- Baby Väinämöinen (≥500 subreddit karma): Lock/Unlock.
- Väinämöinen (≥2000 subreddit karma): Lock/Unlock, Sticky/Unsticky, Remove/Restore.
- Anyone without the required flair still sees the menu item, but receives a motivational toast instead of action.
- Anti-abuse tracker warns at 5/10 actions (hour/day), issues a final warning at 6/11, and auto-bans for 7/12 within the same windows.

### Moderator Utilities

- **View Action Log** – timestamped action history per user (last 20 days).
- **View Action Counts** – lifetime totals of each delegated action.
- **Clear Action Log** – deletes stored timestamps while retaining cumulative counts.

### User Utilities
- **My Action Log** – available to everyone for personal accountability.

## Development

- For your own app, change devvit.yaml app name to your app name.
- Working node environment (dev-env: node 24.8.0 / npm 11.6.0)
- Playtest: `npm run dev`
- Upload: `npm run deploy`
- Production: `npm run launch`

## Limitations & Notes

- It doesn't seem Devvit can hide menu items by flair, so enforcement happens during `onPress`.
- Users must be logged in; otherwise, actions are declined.
- Automod wiki operations require the bot account to retain wiki permission.
- Sticky posts use highlight slot 2 by default.

## Learn More

- GitHub: https://github.com/betazep/vainamoinen-mod
- Published: https://developers.reddit.com/apps/vainamoinen-mod
- Devvit docs: https://developers.reddit.com/docs/
- Dev portal: https://developers.reddit.com/my/apps

## Acknowledgements

This app was developed with assistance from ChatGPT Codex in Visual Studio as well as help from the Reddit Devs Community (Special thank you to https://github.com/PitchforkAssistant!)

## Policies

- [MIT License](https://github.com/betazep/vainamoinen-mod/blob/master/LICENSE)
- [Privacy Policy](https://github.com/betazep/vainamoinen-mod/blob/master/PRIVACY.md)
- [Terms & Conditions](https://github.com/betazep/vainamoinen-mod/blob/master/TERMS.md)
