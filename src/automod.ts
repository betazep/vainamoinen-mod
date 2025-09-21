import type { Context } from '@devvit/public-api';

const START_MARK = '# --- BEGIN: VAINAMOINEN FLAIR ASSIGNMENTS ---';
const END_MARK = '# --- END: VAINAMOINEN FLAIR ASSIGNMENTS ---';
const STICKY_START_MARK = '# --- BEGIN: VAINAMOINEN STICKY COMMENT ---';
const STICKY_END_MARK = '# --- END: VAINAMOINEN STICKY COMMENT ---';

export type FlairTemplates = {
  babyTemplateId: string;
  mainTemplateId: string;
};

type Thresholds = { baby: number; main: number };

function buildFlairBlock(templates: FlairTemplates, thresholds: Thresholds): string {
  const baby = Math.max(0, Math.floor(thresholds.baby));
  const main = Math.max(0, Math.floor(thresholds.main));
  // Automod expects "> N" to mean ">= N+1". Use the working form.
  const babyGt = baby > 0 ? baby - 1 : 0;
  const mainGt = main > 0 ? main - 1 : 0;
  return [
    START_MARK,
    '# NOTE: Please do not remove the flair assignments;',
    '# You may adjust the threshold values directly below ',
    '#############################################',
    '# Thresholds:',
    `#   Baby Vainamoinen  : >=${baby} subreddit karma`,
    `#   Vainamoinen       : >=${main} subreddit karma`,
    '# Notes:',
    '# - Uses user flair templates (template_id values below).',
    '#############################################',
    '',
    '# --- User flair assignment ---',
    '',
    '---',
    'type: any',
    'moderators_exempt: false',
    'author:',
    `  combined_subreddit_karma: "> ${babyGt}"`,
    '  set_flair:',
    `    template_id: "${templates.babyTemplateId}"       # Baby Vainamoinen`,
    '',
    '---',
    'type: any',
    'moderators_exempt: false',
    'author:',
    `  combined_subreddit_karma: "> ${mainGt}"`,
    '  set_flair:',
    `    template_id: "${templates.mainTemplateId}" # Vainamoinen`,
    END_MARK,
    '',
  ].join('\n');
}

function buildStickiedCommentBlock(subredditName: string): string {
  const subredditTag = `r/${subredditName}`;
  return [
    STICKY_START_MARK,
    '# NOTE: Please do not remove the delegated moderator instructions;',
    '# You may update the text below if your community needs custom wording.',
    '#############################################',
    '# Delegated moderator instructions comment',
    '#############################################',
    '',
    '---',
    'type: submission',
    'action: approve',
    'comment_locked: true',
    'comment_stickied: true',
    'comment: |',
    `  **${subredditTag} runs on shared moderation. Every active user is a moderator.**`,
    '',
    '  **Roles (sub karma = flair)**',
    '  - 500+: Baby Vainamoinen -- Lock/Unlock',
    '  - 2000+: Vainamoinen -- Lock/Unlock, Sticky, Remove/Restore',
    '',
    '  **Actions (on respective three-dot menu)**',
    '  - My Action Log: review your own action history.',
    '  - Lock/Unlock: lock or unlock posts/comments.',
    '  - Sticky/Unsticky (Vainamoinen): highlight or release a post in slot 2.',
    '  - Remove/Restore (Vainamoinen): hide or bring back posts/comments.',
    '',
    '  **Limits**',
    '  - 5 actions per hour, 10 per day. Exceeding triggers warnings, then a 7-day timeout.',
    '',
    '  Thanks for keeping the community fair.',
    '',
    '---',
    STICKY_END_MARK,
    '',
  ].join('\n');
}

export function buildAutomodSnippet(subredditName: string, templates: FlairTemplates, thresholds: Thresholds): string {
  return buildFlairBlock(templates, thresholds) + buildStickiedCommentBlock(subredditName);
}

function asciiSanitize(text: string): string {
  // Allow tabs/newlines and printable ASCII only
  return text.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function mergeBlock(content: string, snippet: string, startMark: string, endMark: string): string {
  const startIdx = content.indexOf(startMark);
  const endIdx = content.indexOf(endMark);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return content.slice(0, startIdx) + snippet + content.slice(endIdx + endMark.length);
  }
  const needsSeparator = content.length > 0 && !content.endsWith('\n');
  const separator = needsSeparator ? '\n\n' : '';
  return content + separator + snippet;
}

export async function writeAutomodConfig(context: Context, templates: FlairTemplates): Promise<void> {
  const subredditName = context.subredditName!;
  const page = 'config/automoderator';
  const defaultThresholds: Thresholds = { baby: 500, main: 2000 };
  const flairBlock = asciiSanitize(buildFlairBlock(templates, defaultThresholds));
  const stickyBlock = asciiSanitize(buildStickiedCommentBlock(subredditName));
  const fullSnippet = asciiSanitize(buildAutomodSnippet(subredditName, templates, defaultThresholds));
  // Try update existing page
  try {
    const wiki = await context.reddit.getWikiPage(subredditName, page);
    const existing = wiki.content ?? '';
    const withFlair = mergeBlock(existing, flairBlock, START_MARK, END_MARK);
    const merged = mergeBlock(withFlair, stickyBlock, STICKY_START_MARK, STICKY_END_MARK);
    if (merged !== existing) {
      await context.reddit.updateWikiPage({
        subredditName,
        page,
        content: asciiSanitize(merged),
        reason: asciiSanitize('Update Vainamoinen automod configuration'),
      });
    }
    return;
  } catch {
    // Create page if missing
    await context.reddit.createWikiPage({
      subredditName,
      page,
      content: fullSnippet,
      reason: asciiSanitize('Initialize Vainamoinen automod configuration'),
    });
  }
}

export async function writeAutomodConfigWithThresholds(
  context: Context,
  templates: FlairTemplates,
  thresholds: Thresholds,
): Promise<void> {
  const subredditName = context.subredditName!;
  const page = 'config/automoderator';
  const flairBlock = asciiSanitize(buildFlairBlock(templates, thresholds));
  const stickyBlock = asciiSanitize(buildStickiedCommentBlock(subredditName));
  const fullSnippet = asciiSanitize(buildAutomodSnippet(subredditName, templates, thresholds));
  try {
    const wiki = await context.reddit.getWikiPage(subredditName, page);
    const existing = wiki.content ?? '';
    const withFlair = mergeBlock(existing, flairBlock, START_MARK, END_MARK);
    const merged = mergeBlock(withFlair, stickyBlock, STICKY_START_MARK, STICKY_END_MARK);
    if (merged !== existing) {
      await context.reddit.updateWikiPage({
        subredditName,
        page,
        content: asciiSanitize(merged),
        reason: asciiSanitize('Update Vainamoinen automod configuration'),
      });
    }
  } catch {
    await context.reddit.createWikiPage({
      subredditName,
      page,
      content: fullSnippet,
      reason: asciiSanitize('Initialize Vainamoinen automod configuration'),
    });
  }
}

export async function readAutomodThresholds(context: Context): Promise<Thresholds | undefined> {
  const subredditName = context.subredditName!;
  try {
    const wiki = await context.reddit.getWikiPage(subredditName, 'config/automoderator');
    const content = wiki.content ?? '';
    const begin = content.indexOf(START_MARK);
    const end = content.indexOf(END_MARK);
    const block = begin !== -1 && end !== -1 && end > begin ? content.slice(begin, end) : content;
    // Try to parse from comment lines first
    const babyComment = /Baby\s+V(?:ä|a)in(?:ä|a)m(?:ö|o)inen\s*:\s*>=\s*(\d+)/i.exec(block);
    const mainComment = /\bV(?:ä|a)in(?:ä|a)m(?:ö|o)inen\s*:\s*>=\s*(\d+)/i.exec(block);
    if (babyComment && mainComment) {
      return { baby: Number(babyComment[1]), main: Number(mainComment[1]) };
    }
    // Fallback: parse from combined_subreddit_karma lines supporting > and >=
    const re = /combined_subreddit_karma:\s*"\s*>\s*=?\s*(\d+)\s*"/ig;
    const m1 = re.exec(block);
    const m2 = re.exec(block);
    if (m1 && m2) {
      return { baby: Number(m1[1]), main: Number(m2[1]) };
    }
  } catch {
    // ignore
  }
  return undefined;
}
