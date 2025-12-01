import { Devvit, SettingScope } from '@devvit/public-api';
import { registerMenuItems } from './menu.js';

Devvit.configure({ redditAPI: true, kvStore: true });

// Installation settings for this app
Devvit.addSettings([
  {
    type: 'boolean',
    name: 'enable-remove-restore-posts',
    label: 'Enable Remove/Restore for Posts',
    scope: SettingScope.Installation,
  },
  {
    type: 'boolean',
    name: 'enable-remove-restore-comments',
    label: 'Enable Remove/Restore for Comments',
    scope: SettingScope.Installation,
  },
]);

registerMenuItems(Devvit);

export default Devvit;
