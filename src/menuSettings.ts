import type { Devvit } from '@devvit/public-api';

async function getSettingWithDefault(
  context: Devvit.Context,
  key: string,
  defaultEnabled = true,
): Promise<boolean> {
  const value = await context.settings.get<boolean>(key);
  return value ?? defaultEnabled;
}

export async function isRemoveRestorePostsEnabled(context: Devvit.Context): Promise<boolean> {
  return getSettingWithDefault(context, 'enable-remove-restore-posts');
}

export async function isRemoveRestoreCommentsEnabled(context: Devvit.Context): Promise<boolean> {
  return getSettingWithDefault(context, 'enable-remove-restore-comments');
}
