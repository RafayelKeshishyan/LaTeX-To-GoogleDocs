export type ProseBlock = { id: string; type: 'prose'; text: string; label?: string };
export type EquationBlock = { id: string; type: 'equation'; latex: string; label?: string };
export type Block = ProseBlock | EquationBlock;

export type SheetKind = 'practice' | 'assignment';

export type CourseClass = {
  id: string;
  name: string;
  createdAt: string;
};

export type PadSheet = {
  id: string;
  title: string;
  blocks: Block[];
  createdAt: string;
  updatedAt: string;
  /** null / practice class = free practice; otherwise a course class */
  classId: string;
  kind: SheetKind;
  /** Last equation or note the student was on */
  activeBlockId?: string;
};

export type PadLibrary = {
  version: 4;
  activeSheetId: string;
  activeClassId: string;
  classes: CourseClass[];
  sheets: PadSheet[];
};

/** Built-in free-practice “class” — cannot be deleted. */
export const PRACTICE_CLASS_ID = 'class-practice';

/** @deprecated */
export type PadDocument = {
  title: string;
  blocks: Block[];
  updatedAt: string;
};

export function newId(prefix = 'b'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createEmptyBlocks(): Block[] {
  return [{ id: newId(), type: 'equation', latex: '' }];
}

export function practiceClass(): CourseClass {
  return { id: PRACTICE_CLASS_ID, name: 'Practice', createdAt: nowIso() };
}

export function createSheet(
  title = 'Practice',
  classId: string = PRACTICE_CLASS_ID,
  kind: SheetKind = classId === PRACTICE_CLASS_ID ? 'practice' : 'assignment',
): PadSheet {
  const t = nowIso();
  return {
    id: newId('sheet'),
    title,
    blocks: createEmptyBlocks(),
    createdAt: t,
    updatedAt: t,
    classId,
    kind,
  };
}

export function createEmptyDocument(): PadDocument {
  const sheet = createSheet('Practice');
  return {
    title: sheet.title,
    blocks: sheet.blocks,
    updatedAt: sheet.updatedAt,
  };
}

export function createLibrary(): PadLibrary {
  const sheet = createSheet('Free practice', PRACTICE_CLASS_ID, 'practice');
  return {
    version: 4,
    activeSheetId: sheet.id,
    activeClassId: PRACTICE_CLASS_ID,
    classes: [practiceClass()],
    sheets: [sheet],
  };
}

export const MATH_TEMPLATES: { label: string; latex: string }[] = [
  { label: 'x squared', latex: 'x^2' },
  { label: 'Square root example', latex: 'y=\\sqrt{x + 3}' },
  { label: 'Three fourths', latex: '\\frac{3}{4}' },
  { label: 'Quadratic formula', latex: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}' },
  { label: 'Pythagorean', latex: 'a^2 + b^2 = c^2' },
  { label: 'Distance', latex: '\\sqrt{x^2 + y^2}' },
];

const STORAGE_V4 = 'digimath-pad-library-v4';
const STORAGE_V3 = 'digimath-pad-library-v3';
const STORAGE_V2 = 'digimath-pad-document-v2';

/**
 * Browser storage is split per person: personal practice keeps the original key,
 * and every signed-in account gets its own key so shared computers never mix work.
 */
export const PERSONAL_SCOPE = 'personal';

export function accountScope(userId: string): string {
  return `account:${userId}`;
}

function libraryKey(scope: string): string {
  return scope === PERSONAL_SCOPE ? STORAGE_V4 : `${STORAGE_V4}:${scope}`;
}

function ensurePracticeClass(classes: CourseClass[]): CourseClass[] {
  if (classes.some((c) => c.id === PRACTICE_CLASS_ID)) return classes;
  return [practiceClass(), ...classes];
}

function normalizeSheet(s: Partial<PadSheet> & { blocks?: Block[] }): PadSheet {
  const classId = s.classId || PRACTICE_CLASS_ID;
  const rawBlocks = s.blocks?.length ? s.blocks : createEmptyBlocks();
  const blocks = rawBlocks.map(normalizeBlock);
  const activeBlockId =
    s.activeBlockId && blocks.some((block) => block.id === s.activeBlockId)
      ? s.activeBlockId
      : undefined;
  return {
    id: s.id || newId('sheet'),
    title: s.title || 'Untitled',
    blocks,
    createdAt: s.createdAt || nowIso(),
    updatedAt: s.updatedAt || nowIso(),
    classId,
    kind: s.kind || (classId === PRACTICE_CLASS_ID ? 'practice' : 'assignment'),
    activeBlockId,
  };
}

function normalizeBlock(b: Block): Block {
  const label =
    typeof b.label === 'string' ? b.label.trim().slice(0, 24) || undefined : undefined;
  if (b.type === 'equation') {
    return { id: b.id, type: 'equation', latex: b.latex || '', ...(label ? { label } : {}) };
  }
  return { id: b.id, type: 'prose', text: b.text || '', ...(label ? { label } : {}) };
}

/** Optional worksheet number from the teacher packet (1.2, 3a, …). */
export function blockProblemLabel(block: Block | null | undefined): string {
  return (block?.label || '').trim();
}

function equationOrdinal(blocks: Block[], id: string): number {
  const eqs = blocks.filter((b) => b.type === 'equation');
  return Math.max(eqs.findIndex((b) => b.id === id) + 1, 1);
}

function noteOrdinal(blocks: Block[], id: string): number {
  const notes = blocks.filter((b) => b.type === 'prose');
  return Math.max(notes.findIndex((b) => b.id === id) + 1, 1);
}

/** List / editor name: "1.2", "Equation 2", or "Note 1". */
export function blockListName(blocks: Block[], id: string): string {
  const block = blocks.find((b) => b.id === id);
  if (!block) return 'Item';
  if (block.type === 'equation') {
    const custom = blockProblemLabel(block);
    if (custom) return custom;
    return `Equation ${equationOrdinal(blocks, id)}`;
  }
  return `Note ${noteOrdinal(blocks, id)}`;
}

export function resolveActiveBlockId(sheet: PadSheet): string {
  if (sheet.activeBlockId && sheet.blocks.some((block) => block.id === sheet.activeBlockId)) {
    return sheet.activeBlockId;
  }
  const equation = sheet.blocks.find((block) => block.type === 'equation');
  return equation?.id || sheet.blocks[0]?.id || '';
}

export function normalizeLibrary(raw: unknown): PadLibrary | null {
  if (!raw || typeof raw !== 'object') return null;
  const lib = raw as Partial<PadLibrary> & { version?: number; sheets?: unknown[] };
  if (!Array.isArray(lib.sheets) || !lib.sheets.length) return null;

  const classes = ensurePracticeClass(
    Array.isArray(lib.classes)
      ? lib.classes.map((c) => ({
          id: c.id || newId('class'),
          name: c.name || 'Class',
          createdAt: c.createdAt || nowIso(),
        }))
      : [practiceClass()],
  );

  const sheets = lib.sheets.map((s) => normalizeSheet(s as PadSheet));
  const activeSheetId =
    sheets.find((s) => s.id === lib.activeSheetId)?.id || sheets[0].id;
  const activeSheet = sheets.find((s) => s.id === activeSheetId)!;
  const activeClassId =
    classes.find((c) => c.id === lib.activeClassId)?.id ||
    activeSheet.classId ||
    PRACTICE_CLASS_ID;

  return {
    version: 4,
    activeSheetId,
    activeClassId,
    classes,
    sheets,
  };
}

function migrateV3(raw: string): PadLibrary | null {
  try {
    const old = JSON.parse(raw) as {
      version?: number;
      activeSheetId?: string;
      sheets?: Array<Partial<PadSheet>>;
    };
    if (!old.sheets?.length) return null;
    const sheets = old.sheets.map((s) =>
      normalizeSheet({
        ...s,
        classId: PRACTICE_CLASS_ID,
        kind: 'practice',
      }),
    );
    return {
      version: 4,
      activeSheetId: sheets.find((s) => s.id === old.activeSheetId)?.id || sheets[0].id,
      activeClassId: PRACTICE_CLASS_ID,
      classes: [practiceClass()],
      sheets,
    };
  } catch {
    return null;
  }
}

/** Saved work for one scope, or null when that person has nothing stored yet. */
export function loadStoredLibrary(scope: string = PERSONAL_SCOPE): PadLibrary | null {
  try {
    const raw = localStorage.getItem(libraryKey(scope));
    if (!raw) return null;
    return normalizeLibrary(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** True when a library holds typed work rather than only empty starter blocks. */
export function libraryHasContent(library: PadLibrary): boolean {
  return library.sheets.some((sheet) =>
    sheet.blocks.some((block) =>
      (block.type === 'equation' ? block.latex : block.text).trim().length > 0,
    ),
  );
}

/** Content fingerprint that ignores timestamps, so saves alone never look like edits. */
export function librarySignature(library: PadLibrary): string {
  return JSON.stringify(
    library.sheets.map((sheet) => [
      sheet.title,
      sheet.blocks.map((block) => [
        block.type,
        block.label || '',
        block.type === 'equation' ? block.latex : block.text,
      ]),
    ]),
  );
}

export function loadLibrary(scope: string = PERSONAL_SCOPE): PadLibrary {
  const stored = loadStoredLibrary(scope);
  if (stored) return stored;

  if (scope === PERSONAL_SCOPE) {
    try {
      const v3 = localStorage.getItem(STORAGE_V3);
      if (v3) {
        const migrated = migrateV3(v3);
        if (migrated) {
          saveLibrary(migrated, scope);
          return migrated;
        }
      }

      const v2 = localStorage.getItem(STORAGE_V2);
      if (v2) {
        const doc = JSON.parse(v2) as PadDocument;
        if (doc?.blocks?.length) {
          const sheet = normalizeSheet({
            title: doc.title || 'Practice',
            blocks: doc.blocks,
            classId: PRACTICE_CLASS_ID,
            kind: 'practice',
          });
          const lib: PadLibrary = {
            version: 4,
            activeSheetId: sheet.id,
            activeClassId: PRACTICE_CLASS_ID,
            classes: [practiceClass()],
            sheets: [sheet],
          };
          saveLibrary(lib, scope);
          return lib;
        }
      }
    } catch {
      /* fall through to a fresh library */
    }
  }

  const fresh = createLibrary();
  saveLibrary(fresh, scope);
  return fresh;
}

export function saveLibrary(library: PadLibrary, scope: string = PERSONAL_SCOPE): void {
  const next: PadLibrary = {
    ...library,
    version: 4,
    classes: ensurePracticeClass(library.classes),
    sheets: library.sheets.map((s) => normalizeSheet(s)),
  };
  const active = next.sheets.find((s) => s.id === next.activeSheetId);
  if (active) active.updatedAt = nowIso();
  localStorage.setItem(libraryKey(scope), JSON.stringify(next));
}

export function getActiveSheet(library: PadLibrary): PadSheet {
  return (
    library.sheets.find((s) => s.id === library.activeSheetId) || library.sheets[0]
  );
}

export function getActiveClass(library: PadLibrary): CourseClass {
  return (
    library.classes.find((c) => c.id === library.activeClassId) ||
    library.classes.find((c) => c.id === PRACTICE_CLASS_ID) ||
    practiceClass()
  );
}

export function sheetsInClass(library: PadLibrary, classId: string): PadSheet[] {
  return library.sheets.filter((s) => s.classId === classId);
}

export function updateActiveSheet(
  library: PadLibrary,
  patch: Partial<Pick<PadSheet, 'title' | 'blocks' | 'classId' | 'kind' | 'activeBlockId'>>,
): PadLibrary {
  const sheets = library.sheets.map((s) =>
    s.id === library.activeSheetId
      ? { ...s, ...patch, updatedAt: nowIso() }
      : s,
  );
  return { ...library, sheets };
}

export function switchClass(library: PadLibrary, classId: string): PadLibrary {
  if (!library.classes.some((c) => c.id === classId)) return library;
  const inClass = sheetsInClass(library, classId);
  if (inClass.length) {
    return {
      ...library,
      activeClassId: classId,
      activeSheetId: inClass[0].id,
    };
  }
  // Empty class — create a starter sheet
  const kind: SheetKind = classId === PRACTICE_CLASS_ID ? 'practice' : 'assignment';
  const title = kind === 'practice' ? 'Free practice' : 'Assignment 1';
  const sheet = createSheet(title, classId, kind);
  return {
    ...library,
    activeClassId: classId,
    activeSheetId: sheet.id,
    sheets: [...library.sheets, sheet],
  };
}

export function createClassInLibrary(
  library: PadLibrary,
  name: string,
): { library: PadLibrary; course: CourseClass } {
  const course: CourseClass = {
    id: newId('class'),
    name: name.trim() || 'New class',
    createdAt: nowIso(),
  };
  const sheet = createSheet('Assignment 1', course.id, 'assignment');
  return {
    course,
    library: {
      ...library,
      classes: [...library.classes, course],
      activeClassId: course.id,
      activeSheetId: sheet.id,
      sheets: [...library.sheets, sheet],
    },
  };
}

export function renameClass(
  library: PadLibrary,
  classId: string,
  name: string,
): PadLibrary {
  if (classId === PRACTICE_CLASS_ID) return library;
  return {
    ...library,
    classes: library.classes.map((c) =>
      c.id === classId ? { ...c, name: name.trim() || c.name } : c,
    ),
  };
}

export function deleteClass(library: PadLibrary, classId: string): PadLibrary {
  if (classId === PRACTICE_CLASS_ID) return library;
  if (library.classes.length <= 1) return library;
  const classes = library.classes.filter((c) => c.id !== classId);
  const sheets = library.sheets.filter((s) => s.classId !== classId);
  let nextSheets = sheets;
  if (!nextSheets.length) {
    nextSheets = [createSheet('Free practice', PRACTICE_CLASS_ID, 'practice')];
  }
  const activeClassId =
    library.activeClassId === classId ? PRACTICE_CLASS_ID : library.activeClassId;
  const inClass = nextSheets.filter((s) => s.classId === activeClassId);
  const activeSheetId = inClass[0]?.id || nextSheets[0].id;
  return {
    ...library,
    classes: ensurePracticeClass(classes),
    sheets: nextSheets,
    activeClassId,
    activeSheetId,
  };
}

export function createSheetInLibrary(
  library: PadLibrary,
  title?: string,
  opts?: { classId?: string; kind?: SheetKind },
): { library: PadLibrary; sheet: PadSheet } {
  const classId = opts?.classId || library.activeClassId || PRACTICE_CLASS_ID;
  const kind =
    opts?.kind ||
    (classId === PRACTICE_CLASS_ID ? 'practice' : 'assignment');
  const defaultTitle =
    kind === 'practice'
      ? `Practice ${sheetsInClass(library, classId).length + 1}`
      : `Assignment ${sheetsInClass(library, classId).length + 1}`;
  const sheet = createSheet(title || defaultTitle, classId, kind);
  return {
    sheet,
    library: {
      ...library,
      activeClassId: classId,
      activeSheetId: sheet.id,
      sheets: [...library.sheets, sheet],
    },
  };
}

export function switchSheet(library: PadLibrary, sheetId: string): PadLibrary {
  const sheet = library.sheets.find((s) => s.id === sheetId);
  if (!sheet) return library;
  return {
    ...library,
    activeSheetId: sheetId,
    activeClassId: sheet.classId,
  };
}

export function renameSheet(
  library: PadLibrary,
  sheetId: string,
  title: string,
): PadLibrary {
  return {
    ...library,
    sheets: library.sheets.map((s) =>
      s.id === sheetId ? { ...s, title, updatedAt: nowIso() } : s,
    ),
  };
}

export function duplicateSheet(
  library: PadLibrary,
  sheetId: string,
): { library: PadLibrary; sheet: PadSheet } {
  const source = library.sheets.find((s) => s.id === sheetId);
  if (!source) {
    return { library, sheet: getActiveSheet(library) };
  }
  const t = nowIso();
  const sheet: PadSheet = {
    id: newId('sheet'),
    title: `${source.title} (copy)`,
    blocks: source.blocks.map((b) =>
      b.type === 'equation'
        ? {
            id: newId(),
            type: 'equation' as const,
            latex: b.latex,
            ...(blockProblemLabel(b) ? { label: blockProblemLabel(b) } : {}),
          }
        : {
            id: newId(),
            type: 'prose' as const,
            text: b.text,
            ...(blockProblemLabel(b) ? { label: blockProblemLabel(b) } : {}),
          },
    ),
    createdAt: t,
    updatedAt: t,
    classId: source.classId,
    kind: source.kind,
  };
  if (!sheet.blocks.length) sheet.blocks = createEmptyBlocks();
  return {
    sheet,
    library: {
      ...library,
      activeSheetId: sheet.id,
      activeClassId: sheet.classId,
      sheets: [...library.sheets, sheet],
    },
  };
}

export function deleteSheet(library: PadLibrary, sheetId: string): PadLibrary {
  const target = library.sheets.find((s) => s.id === sheetId);
  const classId = target?.classId || library.activeClassId;
  const remaining = library.sheets.filter((s) => s.id !== sheetId);

  if (!remaining.length) {
    const fresh = createSheet('Free practice', PRACTICE_CLASS_ID, 'practice');
    return {
      version: 4,
      activeSheetId: fresh.id,
      activeClassId: PRACTICE_CLASS_ID,
      classes: ensurePracticeClass(library.classes),
      sheets: [fresh],
    };
  }

  const inClass = remaining.filter((s) => s.classId === classId);
  if (!inClass.length) {
    // Last sheet in class removed — stay in class with a new blank assignment/practice
    const kind: SheetKind = classId === PRACTICE_CLASS_ID ? 'practice' : 'assignment';
    const blank = createSheet(
      kind === 'practice' ? 'Free practice' : 'Assignment 1',
      classId,
      kind,
    );
    return {
      ...library,
      sheets: [...remaining, blank],
      activeSheetId: blank.id,
      activeClassId: classId,
    };
  }

  const activeSheetId =
    library.activeSheetId === sheetId ? inClass[0].id : library.activeSheetId;
  return { ...library, sheets: remaining, activeSheetId, activeClassId: classId };
}

export function clearSheetContents(sheet: PadSheet): PadSheet {
  const blocks = createEmptyBlocks();
  return {
    ...sheet,
    blocks,
    activeBlockId: blocks[0]?.id,
    updatedAt: nowIso(),
  };
}

export function equationCount(sheet: PadSheet): number {
  return sheet.blocks.filter((b) => b.type === 'equation').length;
}

export function emptyEquationCount(sheet: PadSheet): number {
  return sheet.blocks.filter((b) => b.type === 'equation' && !b.latex.trim()).length;
}

export function exportSheetJson(sheet: PadSheet): string {
  return JSON.stringify(
    {
      format: 'digimath-pad-sheet',
      version: 2,
      exportedAt: nowIso(),
      sheet,
    },
    null,
    2,
  );
}

export function parseImportedSheet(raw: string): PadSheet | null {
  try {
    const data = JSON.parse(raw) as {
      sheet?: Partial<PadSheet>;
      title?: string;
      blocks?: Block[];
    };
    if (data.sheet?.blocks) {
      return normalizeSheet({
        ...data.sheet,
        id: newId('sheet'),
        blocks: data.sheet.blocks.map(reIdBlock),
        classId: data.sheet.classId || PRACTICE_CLASS_ID,
      });
    }
    if (data.blocks?.length) {
      return normalizeSheet({
        title: data.title || 'Imported',
        blocks: data.blocks.map(reIdBlock),
        classId: PRACTICE_CLASS_ID,
        kind: 'practice',
      });
    }
  } catch {
    return null;
  }
  return null;
}

function reIdBlock(b: Block): Block {
  const label = blockProblemLabel(b);
  if (b.type === 'equation') {
    return {
      id: newId(),
      type: 'equation',
      latex: b.latex,
      ...(label ? { label } : {}),
    };
  }
  return {
    id: newId(),
    type: 'prose',
    text: b.text,
    ...(label ? { label } : {}),
  };
}

export function importSheetIntoLibrary(
  library: PadLibrary,
  sheet: PadSheet,
): PadLibrary {
  const classId = sheet.classId || library.activeClassId || PRACTICE_CLASS_ID;
  const normalized = normalizeSheet({ ...sheet, classId });
  const classes = library.classes.some((c) => c.id === classId)
    ? library.classes
    : [
        ...library.classes,
        { id: classId, name: 'Imported class', createdAt: nowIso() },
      ];
  return {
    ...library,
    classes: ensurePracticeClass(classes),
    activeSheetId: normalized.id,
    activeClassId: classId,
    sheets: [...library.sheets, normalized],
  };
}

export function formatAnswersText(sheet: PadSheet): string {
  const lines: string[] = [`# ${sheet.title}`, ''];
  let eq = 0;
  let note = 0;
  for (const b of sheet.blocks) {
    if (b.type === 'prose') {
      note += 1;
      const custom = blockProblemLabel(b);
      lines.push(custom ? `Note ${custom}:` : `Note ${note}:`);
      lines.push(b.text.trim() || '(empty)');
      lines.push('');
    } else {
      eq += 1;
      const custom = blockProblemLabel(b);
      lines.push(custom ? `${custom}:` : `Equation ${eq}:`);
      lines.push(b.latex.trim() || '(empty)');
      lines.push('');
    }
  }
  return lines.join('\n').trim() + '\n';
}

export function downloadTextFile(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function safeFilename(title: string): string {
  return (
    title
      .trim()
      .replace(/[^\w\s-]+/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'digimath-sheet'
  );
}

export function sheetLabel(sheet: PadSheet): string {
  const tag = sheet.kind === 'assignment' ? 'Assignment' : 'Practice';
  return `${tag}: ${sheet.title}`;
}
