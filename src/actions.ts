import type { Context } from '@devvit/public-api';

// Helpers to operate on Posts and Comments by Thing IDs from menu events

export async function lockPost(context: Context, postId: string): Promise<void> {
  const post = await context.reddit.getPostById(postId);
  await post.lock();
}

export async function unlockPost(context: Context, postId: string): Promise<void> {
  const post = await context.reddit.getPostById(postId);
  await post.unlock();
}

export async function removePost(context: Context, postId: string): Promise<void> {
  const post = await context.reddit.getPostById(postId);
  await post.remove(false);
}

export async function restorePost(context: Context, postId: string): Promise<void> {
  const post = await context.reddit.getPostById(postId);
  await post.approve();
}

export async function lockComment(context: Context, commentId: string): Promise<void> {
  const comment = await context.reddit.getCommentById(commentId);
  await comment.lock();
}

export async function unlockComment(context: Context, commentId: string): Promise<void> {
  const comment = await context.reddit.getCommentById(commentId);
  await comment.unlock();
}

export async function removeComment(context: Context, commentId: string): Promise<void> {
  const comment = await context.reddit.getCommentById(commentId);
  await comment.remove(false);
}

export async function restoreComment(context: Context, commentId: string): Promise<void> {
  const comment = await context.reddit.getCommentById(commentId);
  await comment.approve();
}
