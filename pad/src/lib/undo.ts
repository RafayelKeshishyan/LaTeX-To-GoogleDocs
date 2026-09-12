export type UndoEntry =
  | {
      type: 'blocks';
      sheetId: string;
      before: import('./document').Block[];
      focusBlockId: string;
      message: string;
    }
  | {
      type: 'sheet-delete';
      libraryBefore: import('./document').PadLibrary;
      focusBlockId?: string;
      message: string;
    };

const MAX = 40;

export function pushUndo(stack: UndoEntry[], entry: UndoEntry): UndoEntry[] {
  return [...stack, entry].slice(-MAX);
}

export function popUndo(stack: UndoEntry[]): {
  stack: UndoEntry[];
  entry: UndoEntry | null;
} {
  if (!stack.length) return { stack, entry: null };
  const entry = stack[stack.length - 1];
  return { stack: stack.slice(0, -1), entry };
}

export function peekUndo(stack: UndoEntry[]): UndoEntry | null {
  return stack.at(-1) || null;
}
