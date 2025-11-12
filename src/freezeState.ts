import type { Devvit } from '@devvit/public-api';

export type FreezeTargetType = 'post' | 'comment';

const FREEZE_PREFIX = 'vainamoinen:freeze:';

function freezeKey(targetType: FreezeTargetType, targetId: string): string {
  return `${FREEZE_PREFIX}${targetType}:${targetId}`;
}

export async function isTargetFrozen(
  context: Devvit.Context,
  targetType: FreezeTargetType,
  targetId: string,
): Promise<boolean> {
  if (!context.kvStore) return false;
  const value = await context.kvStore.get(freezeKey(targetType, targetId));
  return Boolean(value);
}

export async function setTargetFrozen(
  context: Devvit.Context,
  targetType: FreezeTargetType,
  targetId: string,
  frozen: boolean,
): Promise<void> {
  if (!context.kvStore) {
    throw new Error('KV Store unavailable');
  }
  const key = freezeKey(targetType, targetId);
  if (frozen) {
    await context.kvStore.put(key, true);
  } else {
    await context.kvStore.delete(key);
  }
}

export async function toggleTargetFrozen(
  context: Devvit.Context,
  targetType: FreezeTargetType,
  targetId: string,
): Promise<boolean> {
  if (!context.kvStore) {
    throw new Error('KV Store unavailable');
  }
  const next = !(await isTargetFrozen(context, targetType, targetId));
  await setTargetFrozen(context, targetType, targetId, next);
  return next;
}
