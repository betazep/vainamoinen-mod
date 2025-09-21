const LOCK_PREFIXES: readonly string[] = [
  'Väinämöinen seals the circle and',
  'Väinämöinen fastens the runes and',
  'Väinämöinen sets the ward and',
  'Väinämöinen closes the gate and',
  'Väinämöinen binds the winds and',
  'Väinämöinen draws the knot and',
  'Väinämöinen stills the waters and',
  'Väinämöinen lowers his staff and',
  'Väinämöinen hushes the forest and',
  'Väinämöinen marks the boundary and',
];

const UNLOCK_PREFIXES: readonly string[] = [
  'Väinämöinen loosens the knot and',
  'Väinämöinen lifts the latch and',
  'Väinämöinen opens the gate and',
  'Väinämöinen breaks the seal and',
  'Väinämöinen unbinds the winds and',
  'Väinämöinen clears the ward and',
  'Väinämöinen parts the reeds and',
  'Väinämöinen raises the bar and',
  'Väinämöinen releases the catch and',
  'Väinämöinen frees the path and',
];

const REMOVE_PREFIXES: readonly string[] = [
  'Väinämöinen sweeps the path and',
  'Väinämöinen cuts the thistle and',
  'Väinämöinen sends it to the deeps and',
  'Väinämöinen folds it into dusk and',
  'Väinämöinen strikes the clutter and',
  'Väinämöinen clears the reeds and',
  'Väinämöinen banishes the noise and',
  'Väinämöinen carries it away and',
  'Väinämöinen turns the page and',
  'Väinämöinen quiets the trouble and',
];

const RESTORE_PREFIXES: readonly string[] = [
  'Väinämöinen lifts it from the lake and',
  'Väinämöinen brightens the coals and',
  'Väinämöinen returns what was lost and',
  'Väinämöinen rights the ledger and',
  'Väinämöinen opens the way again and',
  'Väinämöinen calls it back and',
  'Väinämöinen smooths the water and',
  'Väinämöinen clears the shadow and',
  'Väinämöinen mends the thread and',
  'Väinämöinen sets it upright and',
];

// Quotes for insufficient permission: encourage growth before calling Väinämöinen
const PERMISSION_QUOTES: readonly string[] = [
  'Grow your craft a little more before calling Väinämöinen.',
  'Walk a few more leagues before seeking Väinämöinen.',
  'Earn a steadier hand before invoking Väinämöinen.',
  'Gather wiser runes before asking Väinämöinen.',
  'Temper your will—Väinämöinen awaits the ready.',
  'Learn the quieter songs before you call Väinämöinen.',
  'Let your roots deepen, then seek Väinämöinen.',
  'A bit more dawn, then Väinämöinen will answer.',
  'Hone your path; Väinämöinen aids the prepared.',
  'Gain a touch more lore before summoning Väinämöinen.',
  'Ripen your wisdom—Väinämöinen comes to the seasoned.',
  'Collect a few more stars before calling Väinämöinen.',
  'Steady your stride; Väinämöinen walks with the ready.',
  'Let your circle be stronger, then beckon Väinämöinen.',
  'Another lesson yet—then call for Väinämöinen.',
];

function randomOf(arr: readonly string[]): string {
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

export function randomLockPrefix(): string {
  return randomOf(LOCK_PREFIXES);
}

export function randomUnlockPrefix(): string {
  return randomOf(UNLOCK_PREFIXES);
}

export function randomRemovePrefix(): string {
  return randomOf(REMOVE_PREFIXES);
}

export function randomRestorePrefix(): string {
  return randomOf(RESTORE_PREFIXES);
}

export function randomPermissionQuote(): string {
  return randomOf(PERMISSION_QUOTES);
}
