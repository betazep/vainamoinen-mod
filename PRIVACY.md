# Privacy Policy

_Last updated: September 21, 2025_

The Väinämöinen Moderation Helper (the "App") operates through Reddit’s Devvit platform. This policy explains what information the App accesses, how it is used, and how it is stored.

## Information We Access

- **Reddit account basics**: Usernames of community members who interact with the App.
- **Subreddit context**: The name of the subreddit where the App is installed and the IDs of posts or comments on which actions are performed.
- **User flair and karma**: Read to determine eligibility for delegated moderation actions.

The App does not request or store email addresses, passwords, or any other personal identifiers beyond the Reddit username already visible to moderators.

## Information We Store

- **Action history**: Timestamps, usernames, and action labels for delegated moderation events. This data is stored in the Devvit KV store to support rate-limiting, audit logs, and moderator tools.
- **Action counts**: Aggregated totals of each user’s delegated moderation actions, also stored in the Devvit KV store.

No other data is persisted by the App. Stored information is limited to what is required for community moderation features.

## How Information Is Used

- Enforcing rate limits, issuing warnings, and temporary bans for excessive actions.
- Displaying action history and totals to moderators and individual users via in-app forms.
- Restoring defaults or clearing logs when moderators invoke the provided menu tools.

We do not sell, trade, or otherwise transfer information collected by the App.

## Data Retention & Deletion

- Action history keeps up to 20 days of entries. Older entries are purged automatically.
- Moderators can clear all stored logs and counts using the "Clear Action Log" menu option.
- Removing the App or disabling its KV store access will stop further data collection.

## Third Parties & APIs

The App interacts only with Reddit’s official APIs as exposed through Devvit. No third-party services receive the stored data.

## Your Choices

Community members who do not wish to participate can avoid using the delegated moderation menus or contact subreddit moderators to request flair removal or additional restrictions.

## Changes to This Policy

We may update this privacy policy as the App evolves. Material changes will be reflected in the repository and version notes.

## Contact

For questions or concerns, reach out via the Reddit Devs community or open an issue in the public repository.

