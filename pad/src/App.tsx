import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MATH_TEMPLATES,
  PRACTICE_CLASS_ID,
  type Block,
  type PadLibrary,
  type PadSheet,
  clearSheetContents,
  createClassInLibrary,
  createSheetInLibrary,
  deleteClass,
  deleteSheet,
  downloadTextFile,
  duplicateSheet,
  emptyEquationCount,
  equationCount,
  exportSheetJson,
  formatAnswersText,
  getActiveClass,
  getActiveSheet,
  importSheetIntoLibrary,
  loadLibrary,
  newId,
  PERSONAL_SCOPE,
  parseImportedSheet,
  renameClass,
  resolveActiveBlockId,
  safeFilename,
  saveLibrary,
  switchClass,
  switchSheet,
  blockEditorName,
  blockListName,
  blockProblemLabel,
  updateActiveSheet,
} from './lib/document';
import { toNaturalSpeech } from './lib/latexSpeech';
import { latexParseError, latexToMathML, renderKatexHtml } from './lib/mathml';
import { type UndoEntry, peekUndo, popUndo, pushUndo } from './lib/undo';
import { exportAccessibleHtml } from './lib/accessibleExport';
import { LinearEditor } from './components/LinearEditor';
import { MathPreview } from './components/MathPreview';
import { ReviewPanel } from './components/ReviewPanel';
import { SheetManagement, SheetNavigation } from './components/SheetBar';
import { ConfirmDialog } from './components/ConfirmDialog';
import { HelpDialog } from './components/HelpDialog';
import './App.css';

type SaveState = 'saving' | 'saved' | 'error';
type ClassDialogMode = 'create' | 'rename' | null;
type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

type AppProps = {
  showSkipLink?: boolean;
  entryAnnouncement?: string;
  initialLibrary?: PadLibrary | null;
  /** Which browser storage slot to read and write. Never shared between people. */
  storageScope?: string;
  saveToAccount?: (library: PadLibrary) => Promise<void>;
};

function announce(el: HTMLElement | null, text: string) {
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.textContent = text;
    });
  });
}

function firstBlockId(blocks: Block[]): string {
  const eq = blocks.find((b) => b.type === 'equation');
  return eq?.id || blocks[0]?.id || '';
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return el.isContentEditable;
}

function isEquationShortcutTarget(el: EventTarget | null): boolean {
  return el instanceof HTMLElement && !!el.closest('.edit-pane, .block-list');
}

function invalidEquationCount(sheet: PadSheet): number {
  return sheet.blocks.filter(
    (block) =>
      block.type === 'equation' &&
      !!block.latex.trim() &&
      !!latexParseError(block.latex),
  ).length;
}

function cloneBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => {
    const label = blockProblemLabel(b);
    return b.type === 'equation'
      ? {
          id: b.id,
          type: 'equation' as const,
          latex: b.latex,
          ...(label ? { label } : {}),
        }
      : {
          id: b.id,
          type: 'prose' as const,
          text: b.text,
          ...(label ? { label } : {}),
        };
  });
}

export default function App({
  showSkipLink = true,
  entryAnnouncement,
  initialLibrary,
  storageScope = PERSONAL_SCOPE,
  saveToAccount,
}: AppProps) {
  const boot = useMemo(() => {
    const library = initialLibrary || loadLibrary(storageScope);
    const sheet = getActiveSheet(library);
    return { library, activeId: resolveActiveBlockId(sheet) };
  }, [initialLibrary, storageScope]);

  const [library, setLibrary] = useState<PadLibrary>(boot.library);
  const [activeId, setActiveId] = useState(boot.activeId);
  const [previewFocus, setPreviewFocus] = useState(0);
  const [previewActive, setPreviewActive] = useState(false);
  const [linearFocus, setLinearFocus] = useState(0);
  const [linearCaret, setLinearCaret] = useState<'start' | 'end'>('end');
  const [proseFocus, setProseFocus] = useState(0);
  const [proseCaret, setProseCaret] = useState<'start' | 'end'>('end');
  const [showTemplates, setShowTemplates] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [classDialogMode, setClassDialogMode] = useState<ClassDialogMode>(null);
  const [classNameDraft, setClassNameDraft] = useState('');
  const [classNameError, setClassNameError] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const proseRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadButtonRef = useRef<HTMLButtonElement>(null);
  const reviewButtonRef = useRef<HTMLButtonElement>(null);
  const reviewOpenerRef = useRef<HTMLElement | null>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const helpOpenerRef = useRef<HTMLElement | null>(null);
  const classDialogRef = useRef<HTMLDialogElement>(null);
  const classNameRef = useRef<HTMLInputElement>(null);
  const classDialogOpenerRef = useRef<HTMLElement | null>(null);
  const confirmationOpenerRef = useRef<HTMLElement | null>(null);
  const saveErrorAnnouncedRef = useRef(false);
  const entryAnnouncedRef = useRef(false);
  const linearTipShownRef = useRef(false);
  const libraryRef = useRef(library);
  const remoteSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const remoteSaveTokenRef = useRef(0);

  useEffect(() => {
    libraryRef.current = library;
  }, [library]);

  const sheet = useMemo(() => getActiveSheet(library), [library]);
  const active = useMemo(
    () => sheet.blocks.find((b) => b.id === activeId) || null,
    [sheet.blocks, activeId],
  );
  const isPractice = sheet.kind === 'practice';
  const workType = isPractice ? 'practice page' : 'assignment';
  const workNameLabel = isPractice ? 'Practice page name' : 'Assignment name';
  const saveStatusText =
    saveState === 'saving'
      ? saveToAccount
        ? 'Saving to your account…'
        : 'Saving locally…'
      : saveState === 'error'
        ? saveToAccount
          ? 'Not saved to your account. Download a backup to protect your work.'
          : 'Not saved. Download a backup to protect your work.'
        : saveToAccount
          ? 'Saved to your account.'
          : 'Saved locally.';

  const editorName = active ? blockEditorName(sheet.blocks, active.id) : 'Write';

  const saveSnapshot = useCallback(
    (snapshot: PadLibrary, showMessage = false): boolean => {
      let localSaved = true;
      try {
        saveLibrary(snapshot, storageScope);
      } catch {
        localSaved = false;
      }

      if (saveToAccount) {
        setSaveState('saving');
        const token = ++remoteSaveTokenRef.current;
        const task = remoteSaveChainRef.current
          .catch(() => undefined)
          .then(() => saveToAccount(snapshot));
        remoteSaveChainRef.current = task;
        void task.then(
          () => {
            if (token !== remoteSaveTokenRef.current) return;
            setSaveState('saved');
            saveErrorAnnouncedRef.current = false;
            if (showMessage) announce(statusRef.current, 'Saved to your account.');
          },
          () => {
            if (token !== remoteSaveTokenRef.current) return;
            setSaveState('error');
            if (!saveErrorAnnouncedRef.current || showMessage) {
              saveErrorAnnouncedRef.current = true;
              announce(
                statusRef.current,
                'Changes could not be saved to your account. A browser copy may still be available. Download a backup to protect your work.',
              );
            }
          },
        );
        return true;
      }

      if (!localSaved) {
        setSaveState('error');
        saveErrorAnnouncedRef.current = true;
        announce(
          statusRef.current,
          'Your changes could not be saved in this browser. Download a backup to protect your work.',
        );
        return false;
      }

      setSaveState('saved');
      saveErrorAnnouncedRef.current = false;
      if (showMessage) announce(statusRef.current, 'Saved locally.');
      return true;
    },
    [saveToAccount, storageScope],
  );

  useEffect(() => {
    titleRef.current?.focus();
    if (entryAnnouncement && !entryAnnouncedRef.current) {
      entryAnnouncedRef.current = true;
      announce(statusRef.current, entryAnnouncement);
    }
  }, [entryAnnouncement]);

  useEffect(() => {
    setLibrary((current) => {
      const s = getActiveSheet(current);
      if (!activeId || s.activeBlockId === activeId) return current;
      if (!s.blocks.some((block) => block.id === activeId)) return current;
      return updateActiveSheet(current, { activeBlockId: activeId });
    });
  }, [activeId]);

  useEffect(() => {
    document.title = `${sheet.title} — Digi Math Pad`;
  }, [sheet.title]);

  useEffect(() => {
    if (!linearFocus || linearTipShownRef.current) return;
    const TIP_KEY = 'digimath-pad-linear-tip-v1';
    try {
      if (localStorage.getItem(TIP_KEY)) {
        linearTipShownRef.current = true;
        return;
      }
    } catch {
      /* ignore */
    }
    linearTipShownRef.current = true;
    try {
      localStorage.setItem(TIP_KEY, '1');
    } catch {
      /* ignore */
    }
    const timer = window.setTimeout(() => {
      announce(
        statusRef.current,
        'Tip: Alt+Enter hears math. Alt+Up or Alt+Down changes equation.',
      );
    }, 700);
    return () => window.clearTimeout(timer);
  }, [linearFocus]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveSnapshot(library);
    }, 250);
    return () => window.clearTimeout(t);
  }, [library, saveSnapshot]);

  useEffect(() => {
    const dialog = classDialogRef.current;
    if (!dialog) return;
    if (classDialogMode) {
      if (!dialog.open) dialog.showModal();
      requestAnimationFrame(() => {
        classNameRef.current?.focus();
        classNameRef.current?.select();
      });
    } else if (dialog.open) {
      dialog.close();
    }
  }, [classDialogMode]);

  useEffect(() => {
    if (!proseFocus) return;
    const el = proseRef.current;
    if (!el) return;
    el.focus();
    const pos = proseCaret === 'start' ? 0 : el.value.length;
    el.setSelectionRange(pos, pos);
  }, [proseFocus, proseCaret]);

  const handlersRef = useRef({
    addEquationOrFocus: (_latex?: string) => false as boolean,
    addNote: () => {},
    removeActive: () => {},
    persist: (_show?: boolean) => {},
    returnToEditor: () => {},
    pasteAsEquation: () => {},
    copyAll: () => {},
    undo: () => {},
    openReview: () => {},
    closeReview: () => {},
    moveActiveBlock: (_direction: -1 | 1, _stayInList?: boolean) => {},
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;

      if (e.key === 'Escape') {
        const ae = document.activeElement;
        if (ae instanceof Element && ae.closest('.math-preview')) {
          e.preventDefault();
          handlersRef.current.returnToEditor();
          return;
        }
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === '=' || e.code === 'Equal')) {
        e.preventDefault();
        e.stopPropagation();
        handlersRef.current.addEquationOrFocus();
        return;
      }

      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.code === 'KeyN' || e.key.toLowerCase() === 'n')
      ) {
        e.preventDefault();
        e.stopPropagation();
        handlersRef.current.addNote();
        return;
      }

      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.code === 'KeyR' || e.key.toLowerCase() === 'r')
      ) {
        e.preventDefault();
        e.stopPropagation();
        handlersRef.current.openReview();
        return;
      }

      if (e.altKey && e.key === 'Delete' && isEquationShortcutTarget(e.target)) {
        e.preventDefault();
        handlersRef.current.removeActive();
        return;
      }

      if (
        e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        (e.key === 'ArrowUp' || e.key === 'ArrowDown') &&
        isEquationShortcutTarget(e.target)
      ) {
        e.preventDefault();
        e.stopPropagation();
        handlersRef.current.moveActiveBlock(e.key === 'ArrowUp' ? -1 : 1);
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.code === 'KeyV' || e.key.toLowerCase() === 'v') &&
        isEquationShortcutTarget(e.target)
      ) {
        e.preventDefault();
        handlersRef.current.pasteAsEquation();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.code === 'KeyC' || e.key.toLowerCase() === 'c')
      ) {
        e.preventDefault();
        handlersRef.current.copyAll();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') &&
        !e.shiftKey
      ) {
        if (isTypingTarget(e.target)) return; // native text undo
        e.preventDefault();
        handlersRef.current.undo();
        return;
      }
      // App-level undo even while Linear is focused (after delete/clear/sheet ops).
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        (e.code === 'KeyZ' || e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handlersRef.current.undo();
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        (e.code === 'KeyS' || e.key.toLowerCase() === 's')
      ) {
        e.preventDefault();
        handlersRef.current.persist();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  function commitLibrary(next: PadLibrary, focusBlockId?: string) {
    setPreviewActive(false);
    setSaveState('saving');
    const s = getActiveSheet(next);
    const id =
      (focusBlockId && s.blocks.some((block) => block.id === focusBlockId) && focusBlockId) ||
      (s.blocks.some((block) => block.id === activeId) ? activeId : '') ||
      resolveActiveBlockId(s);
    const withFocus =
      s.activeBlockId === id ? next : updateActiveSheet(next, { activeBlockId: id });
    setLibrary(withFocus);
    setActiveId(id);
  }

  function requestLinearFocus(caret: 'start' | 'end' = 'end') {
    setLinearCaret(caret);
    setLinearFocus((n) => n + 1);
  }

  function requestLinearFocusIfNeeded() {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement && focused.closest('.linear-editor'))) {
      requestLinearFocus();
    }
  }

  function requestProseFocus(caret: 'start' | 'end' = 'end') {
    setProseCaret(caret);
    setProseFocus((n) => n + 1);
  }

  function returnToEditor() {
    setPreviewActive(false);
    if (active?.type === 'equation') {
      requestLinearFocus();
    } else if (active?.type === 'prose') {
      requestProseFocus();
    }
  }

  function persist(showMessage = true): boolean {
    return saveSnapshot(library, showMessage);
  }

  function setTitle(title: string) {
    commitLibrary(updateActiveSheet(library, { title }));
  }

  function recordBlocksUndo(message: string, focusBlockId = activeId) {
    setUndoStack((stack) =>
      pushUndo(stack, {
        type: 'blocks',
        sheetId: sheet.id,
        before: cloneBlocks(sheet.blocks),
        focusBlockId,
        message,
      }),
    );
  }

  function setEquationError(id: string, latex: string) {
    const parseError = latex.trim() ? latexParseError(latex) : null;
    setValidationErrors((current) => {
      if (parseError) {
        if (current[id] === parseError) return current;
        return { ...current, [id]: parseError };
      }
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    return parseError;
  }

  function validateLeavingBlock(id: string | null | undefined) {
    if (!id) return;
    const block = sheet.blocks.find((item) => item.id === id);
    if (block?.type === 'equation') setEquationError(block.id, block.latex);
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    setValidationErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
    const blocks = sheet.blocks.map((b) =>
      b.id === id ? ({ ...b, ...patch } as Block) : b,
    );
    commitLibrary(updateActiveSheet(library, { blocks }), id);
  }

  function addEquationOrFocus(latex = '', label = ''): boolean {
    if (!latex && active?.type === 'equation' && !active.latex.trim()) {
      requestLinearFocus();
      announce(
        statusRef.current,
        'Current equation is empty. Type before adding another.',
      );
      return false;
    }

    const custom = label.trim();
    const block: Block = {
      id: newId(),
      type: 'equation',
      latex,
      ...(custom ? { label: custom.slice(0, 24) } : {}),
    };
    const idx = sheet.blocks.findIndex((b) => b.id === activeId);
    const nextBlocks = [...sheet.blocks];
    nextBlocks.splice(idx >= 0 ? idx + 1 : nextBlocks.length, 0, block);
    recordBlocksUndo('New equation removed');
    const next = updateActiveSheet(library, { blocks: nextBlocks });
    commitLibrary(next, block.id);
    requestLinearFocus();
    return true;
  }

  function duplicateActive() {
    if (!active) return;
    if (active.type === 'equation') {
      if (!active.latex.trim()) {
        requestLinearFocus();
        announce(
          statusRef.current,
          'Empty equation not duplicated.',
        );
        return;
      }
      if (addEquationOrFocus(active.latex, blockProblemLabel(active))) {
        announce(statusRef.current, 'Equation duplicated.');
      }
      return;
    }
    const custom = blockProblemLabel(active);
    const block: Block = {
      id: newId(),
      type: 'prose',
      text: active.text,
      ...(custom ? { label: custom } : {}),
    };
    const idx = sheet.blocks.findIndex((b) => b.id === activeId);
    const nextBlocks = [...sheet.blocks];
    nextBlocks.splice(idx + 1, 0, block);
    recordBlocksUndo('Duplicated note removed');
    commitLibrary(updateActiveSheet(library, { blocks: nextBlocks }), block.id);
    requestProseFocus();
    announce(statusRef.current, 'Note duplicated.');
  }

  function addNote() {
    const block: Block = { id: newId(), type: 'prose', text: '' };
    recordBlocksUndo('New note removed');
    const idx = sheet.blocks.findIndex((b) => b.id === activeId);
    const nextBlocks = [...sheet.blocks];
    nextBlocks.splice(idx >= 0 ? idx + 1 : nextBlocks.length, 0, block);
    commitLibrary(updateActiveSheet(library, { blocks: nextBlocks }), block.id);
    requestProseFocus();
    announce(statusRef.current, 'New note.');
  }

  function editBlock(id: string) {
    if (id !== activeId) validateLeavingBlock(activeId);
    setActiveId(id);
    const block = sheet.blocks.find((b) => b.id === id);
    if (block?.type === 'equation') {
      setEquationError(block.id, block.latex);
      requestLinearFocus();
    } else if (block?.type === 'prose') {
      requestProseFocus();
    }
  }

  function removeActive() {
    if (!active) return;

    const hasContent =
      active.type === 'equation' ? !!active.latex.trim() : !!active.text.trim();
    if (hasContent) {
      const label = blockListName(sheet.blocks, active.id);
      requestConfirmation({
        title: `Remove ${label}?`,
        message: 'The item will be removed. You can restore it with Control+Shift+Z.',
        confirmLabel: 'Remove',
        onConfirm: performRemoveActive,
      });
      return;
    }

    performRemoveActive();
  }

  function performRemoveActive() {
    if (!active) return;

    const removedLabel = blockListName(sheet.blocks, active.id);
    recordBlocksUndo(`${removedLabel} restored`, active.id);

    if (sheet.blocks.length <= 1) {
      const blank: Block = { id: newId(), type: 'equation', latex: '' };
      commitLibrary(updateActiveSheet(library, { blocks: [blank] }), blank.id);
      requestLinearFocus();
      announce(statusRef.current, 'Cleared. Undo with Control+Shift+Z.');
      return;
    }

    const idx = sheet.blocks.findIndex((b) => b.id === active.id);
    const nextBlocks = sheet.blocks.filter((b) => b.id !== active.id);
    const nextActive = nextBlocks[Math.min(idx, nextBlocks.length - 1)];
    commitLibrary(updateActiveSheet(library, { blocks: nextBlocks }), nextActive.id);
    if (nextActive.type === 'equation') requestLinearFocus();
    else requestProseFocus();
    announce(statusRef.current, `Removed ${removedLabel}. Undo with Control+Shift+Z.`);
  }

  function undo() {
    const { stack, entry } = popUndo(undoStack);
    if (!entry) {
      announce(statusRef.current, 'Nothing to undo.');
      return;
    }
    setUndoStack(stack);
    if (entry.type === 'blocks') {
      let nextLibrary = libraryRef.current;
      if (nextLibrary.activeSheetId !== entry.sheetId) {
        nextLibrary = switchSheet(nextLibrary, entry.sheetId);
      }
      const focusId =
        entry.focusBlockId &&
        entry.before.some((block) => block.id === entry.focusBlockId)
          ? entry.focusBlockId
          : firstBlockId(entry.before);
      commitLibrary(
        updateActiveSheet(
          { ...nextLibrary, activeSheetId: entry.sheetId },
          { blocks: entry.before },
        ),
        focusId,
      );
      const restored = entry.before.find((block) => block.id === focusId);
      if (restored?.type === 'equation') requestLinearFocus();
      else if (restored?.type === 'prose') requestProseFocus();
      else titleRef.current?.focus();
      announce(statusRef.current, entry.message);
      return;
    }
    if (entry.type === 'sheet-delete') {
      commitLibrary(entry.libraryBefore, entry.focusBlockId);
      titleRef.current?.focus();
      announce(statusRef.current, entry.message);
    }
  }

  async function pasteAsEquation() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) {
        announce(statusRef.current, 'Clipboard is empty.');
        return;
      }
      addEquationOrFocus(text);
      announce(statusRef.current, `Pasted as new equation. ${toNaturalSpeech(text)}`);
    } catch {
      announce(
        statusRef.current,
        'Could not read clipboard. Paste into Linear with Control+V.',
      );
    }
  }

  async function copyAll() {
    const text = formatAnswersText(sheet);
    try {
      await navigator.clipboard.writeText(text);
      announce(
        statusRef.current,
        `Copied all answers. ${equationCount(sheet)} equations.`,
      );
    } catch {
      announce(statusRef.current, 'Could not copy all answers.');
    }
  }

  function openReview() {
    validateLeavingBlock(activeId);
    reviewOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setReviewOpen(true);
    const firstProblem = sheet.blocks.find(
      (block) =>
        block.type === 'equation' &&
        (!block.latex.trim() || Boolean(latexParseError(block.latex))),
    );
    const firstEq = firstProblem || sheet.blocks.find((block) => block.type === 'equation');
    if (firstEq) setActiveId(firstEq.id);
  }

  function closeReview() {
    setReviewOpen(false);
    requestAnimationFrame(() =>
      (reviewOpenerRef.current || reviewButtonRef.current)?.focus(),
    );
  }

  function onSwitchSheet(sheetId: string) {
    validateLeavingBlock(activeId);
    const next = switchSheet(library, sheetId);
    const s = getActiveSheet(next);
    commitLibrary(next, resolveActiveBlockId(s));
    setReviewOpen(false);
    titleRef.current?.focus();
  }

  function onSwitchClass(classId: string) {
    validateLeavingBlock(activeId);
    const next = switchClass(library, classId);
    const s = getActiveSheet(next);
    commitLibrary(next, resolveActiveBlockId(s));
    setReviewOpen(false);
    titleRef.current?.focus();
  }

  function requestConfirmation(options: Confirmation) {
    confirmationOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setConfirmation(options);
  }

  function cancelConfirmation() {
    setConfirmation(null);
    requestAnimationFrame(() => confirmationOpenerRef.current?.focus());
  }

  function acceptConfirmation() {
    const action = confirmation?.onConfirm;
    const opener = confirmationOpenerRef.current;
    setConfirmation(null);
    action?.();
    // Export/copy confirms may leave focus on body; restore unless the action moved it.
    requestAnimationFrame(() => {
      const ae = document.activeElement;
      if (!(ae instanceof HTMLElement) || ae === document.body) {
        opener?.focus();
      }
    });
  }

  function openClassDialog(mode: Exclude<ClassDialogMode, null>) {
    classDialogOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setClassNameDraft(mode === 'rename' ? getActiveClass(library).name : '');
    setClassNameError('');
    setClassDialogMode(mode);
  }

  function closeClassDialog(restoreFocus = true) {
    classDialogRef.current?.close();
    setClassDialogMode(null);
    setClassNameError('');
    if (restoreFocus) {
      requestAnimationFrame(() => classDialogOpenerRef.current?.focus());
    }
  }

  function submitClassDialog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = classNameDraft.trim();
    if (!name) {
      setClassNameError('Enter a class name.');
      announce(statusRef.current, 'Enter a class name.');
      classNameRef.current?.focus();
      return;
    }

    if (classDialogMode === 'create') {
      const { library: next, course } = createClassInLibrary(library, name);
      closeClassDialog(false);
      commitLibrary(next, firstBlockId(getActiveSheet(next).blocks));
      setReviewOpen(false);
      setUndoStack([]);
      requestAnimationFrame(() => titleRef.current?.focus());
      announce(statusRef.current, `Class ${course.name}. Assignment 1.`);
      return;
    }

    if (classDialogMode === 'rename') {
      const next = renameClass(library, library.activeClassId, name);
      commitLibrary(next, activeId);
      closeClassDialog();
      announce(statusRef.current, `Class renamed ${name}.`);
    }
  }

  function onNewAssignment() {
    const { library: next, sheet: created } = createSheetInLibrary(library, undefined, {
      classId: library.activeClassId,
      kind: 'assignment',
    });
    commitLibrary(next, firstBlockId(created.blocks));
    setReviewOpen(false);
    setUndoStack([]);
    titleRef.current?.focus();
    announce(statusRef.current, `New assignment ${created.title}.`);
  }

  function onNewPractice() {
    const { library: next, sheet: created } = createSheetInLibrary(library, undefined, {
      classId: PRACTICE_CLASS_ID,
      kind: 'practice',
    });
    commitLibrary(next, firstBlockId(created.blocks));
    setReviewOpen(false);
    setUndoStack([]);
    titleRef.current?.focus();
    announce(statusRef.current, `New practice page ${created.title}.`);
  }

  function onDuplicateSheet() {
    const { library: next, sheet: created } = duplicateSheet(library, sheet.id);
    commitLibrary(next, firstBlockId(created.blocks));
    setReviewOpen(false);
    setUndoStack([]);
    announce(statusRef.current, `Duplicated. ${created.title}.`);
    titleRef.current?.focus();
  }

  function onDeleteSheet() {
    const workType = sheet.kind === 'practice' ? 'practice page' : 'assignment';
    requestConfirmation({
      title: `Delete ${workType}?`,
      message: `${sheet.title} will be deleted. You can restore it with Control+Shift+Z.`,
      confirmLabel: `Delete ${workType}`,
      onConfirm: performDeleteSheet,
    });
  }

  function performDeleteSheet() {
    setUndoStack((stack) =>
      pushUndo(stack, {
        type: 'sheet-delete',
        libraryBefore: structuredClone(library),
        focusBlockId: activeId,
        message: `${sheet.title} restored`,
      }),
    );
    const next = deleteSheet(library, sheet.id);
    const s = getActiveSheet(next);
    commitLibrary(next, firstBlockId(s.blocks));
    setReviewOpen(false);
    announce(statusRef.current, `Deleted. Now ${s.title}.`);
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  function onDeleteClass() {
    if (library.activeClassId === PRACTICE_CLASS_ID) return;
    const cls = getActiveClass(library);
    requestConfirmation({
      title: 'Delete class?',
      message: `${cls.name} and all of its assignments will be deleted. You can restore them with Control+Shift+Z.`,
      confirmLabel: 'Delete class',
      onConfirm: performDeleteClass,
    });
  }

  function performDeleteClass() {
    if (library.activeClassId === PRACTICE_CLASS_ID) return;
    setUndoStack((stack) =>
      pushUndo(stack, {
        type: 'sheet-delete',
        libraryBefore: structuredClone(library),
        focusBlockId: firstBlockId(getActiveSheet(library).blocks),
        message: `${getActiveClass(library).name} class restored`,
      }),
    );
    const next = deleteClass(library, library.activeClassId);
    const s = getActiveSheet(next);
    commitLibrary(next, firstBlockId(s.blocks));
    setReviewOpen(false);
    announce(statusRef.current, `Class deleted. Now ${getActiveClass(next).name}.`);
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  function continueWithEmptyAnswers(actionLabel: string, proceed: () => void) {
    const empty = emptyEquationCount(sheet);
    if (!empty) {
      proceed();
      return;
    }
    requestConfirmation({
      title: `${actionLabel} with empty answers?`,
      message: `${empty} ${empty === 1 ? 'equation is' : 'equations are'} empty. You can continue or return to add answers.`,
      confirmLabel: `${actionLabel} anyway`,
      onConfirm: proceed,
    });
  }

  function exportPrint() {
    if (invalidEquationCount(sheet)) {
      openReview();
      return;
    }
    continueWithEmptyAnswers('Print', performPrint);
  }

  function performPrint() {
    persist(false);
    window.print();
  }

  function downloadJson() {
    downloadTextFile(
      `${safeFilename(sheet.title)}.digimath.json`,
      exportSheetJson(sheet),
    );
    announce(statusRef.current, 'Backup downloaded.');
  }

  function downloadAccessibleHtml() {
    if (invalidEquationCount(sheet)) {
      openReview();
      return;
    }
    continueWithEmptyAnswers('Download', performAccessibleHtmlDownload);
  }

  function performAccessibleHtmlDownload() {
    downloadTextFile(
      `${safeFilename(sheet.title)}.html`,
      exportAccessibleHtml(sheet),
      'text/html;charset=utf-8',
    );
    announce(statusRef.current, 'Accessible HTML downloaded.');
  }

  function downloadWord() {
    if (invalidEquationCount(sheet)) {
      openReview();
      return;
    }
    continueWithEmptyAnswers('Download Word', () => void performWordDownload());
  }

  async function performWordDownload() {
    try {
      persist(false);
      const { createWordDocumentBlob, downloadWordBlob } = await import('./lib/wordExport');
      const blob = await createWordDocumentBlob(sheet);
      downloadWordBlob(`${safeFilename(sheet.title)}.docx`, blob);
      announce(statusRef.current, 'Word document downloaded.');
    } catch (error) {
      console.error('Word export failed.', error);
      announce(
        statusRef.current,
        'Could not create the Word document. Download accessible HTML or a backup instead.',
      );
    }
  }

  function onImportFile(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImportedSheet(String(reader.result || ''));
      if (!parsed) {
        announce(statusRef.current, 'Could not import that file.');
        return;
      }
      const next = importSheetIntoLibrary(library, parsed);
      commitLibrary(next, firstBlockId(parsed.blocks));
      setReviewOpen(false);
      announce(
        statusRef.current,
        `Imported ${parsed.title}. ${equationCount(parsed)} equations.`,
      );
    };
    reader.readAsText(file);
  }

  function commitPreview() {
    if (active?.type !== 'equation') return;
    if (!active.latex.trim()) {
      const message = 'Type an equation before hearing the math.';
      setValidationErrors((current) => ({ ...current, [active.id]: message }));
      announce(statusRef.current, message);
      requestLinearFocusIfNeeded();
      return;
    }
    const parseErr = latexParseError(active.latex);
    if (parseErr) {
      setValidationErrors((current) => ({ ...current, [active.id]: parseErr }));
      announce(statusRef.current, `Equation not ready. ${parseErr}`);
      requestLinearFocusIfNeeded();
      return;
    }
    setValidationErrors((current) => {
      if (!current[active.id]) return current;
      const next = { ...current };
      delete next[active.id];
      return next;
    });
    setPreviewActive(true);
    setPreviewFocus((n) => n + 1);
  }

  async function copyLatex() {
    if (active?.type !== 'equation' || !active.latex.trim()) {
      announce(statusRef.current, 'Nothing to copy.');
      return;
    }
    try {
      await navigator.clipboard.writeText(active.latex);
      announce(statusRef.current, 'Source copied.');
    } catch {
      announce(statusRef.current, 'Could not copy. Select Linear and copy manually.');
    }
  }

  async function copyMathML() {
    if (active?.type !== 'equation' || !active.latex.trim()) {
      announce(statusRef.current, 'No equation to copy.');
      return;
    }
    const mathml = latexToMathML(active.latex);
    if (!mathml) {
      announce(statusRef.current, 'Could not build MathML.');
      return;
    }
    try {
      await navigator.clipboard.writeText(mathml);
      announce(statusRef.current, 'MathML copied.');
    } catch {
      announce(statusRef.current, 'Could not copy MathML.');
    }
  }

  function applyTemplate(latex: string) {
    const apply = () => {
      if (active?.type === 'equation') {
        recordBlocksUndo('Template change undone', active.id);
        updateBlock(active.id, { latex });
        requestLinearFocus();
      } else {
        addEquationOrFocus(latex);
      }
      announce(statusRef.current, `Template. ${toNaturalSpeech(latex)}`);
    };

    if (active?.type === 'equation' && active.latex.trim() && active.latex !== latex) {
      requestConfirmation({
        title: 'Replace this equation?',
        message: 'Replace the current equation with this example? You can undo with Control+Shift+Z.',
        confirmLabel: 'Replace equation',
        onConfirm: apply,
      });
      return;
    }
    apply();
  }

  function moveActiveBlock(direction: -1 | 1, stayInList = false) {
    const idx = sheet.blocks.findIndex((block) => block.id === activeId);
    const currentIndex = idx < 0 ? 0 : idx;

    let nextIndex = currentIndex;
    if (stayInList) {
      nextIndex = Math.min(
        sheet.blocks.length - 1,
        Math.max(0, currentIndex + direction),
      );
    } else {
      // From Linear/note editing: jump to the next equation only.
      let i = currentIndex + direction;
      while (i >= 0 && i < sheet.blocks.length) {
        if (sheet.blocks[i]?.type === 'equation') {
          nextIndex = i;
          break;
        }
        i += direction;
      }
    }

    const next = sheet.blocks[nextIndex];
    if (!next) return;
    if (nextIndex === currentIndex) {
      announce(statusRef.current, direction < 0 ? 'First item.' : 'Last item.');
      return;
    }

    validateLeavingBlock(sheet.blocks[currentIndex]?.id);
    setPreviewActive(false);
    setActiveId(next.id);
    if (stayInList) {
      requestAnimationFrame(() => listRef.current?.focus());
      return;
    }

    if (next.type === 'equation') {
      requestLinearFocus(direction < 0 ? 'end' : 'start');
    } else {
      requestProseFocus(direction < 0 ? 'end' : 'start');
    }
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveActiveBlock(1, true);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveActiveBlock(-1, true);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      const first = sheet.blocks[0];
      if (first) {
        validateLeavingBlock(activeId);
        setActiveId(first.id);
      }
      requestAnimationFrame(() => listRef.current?.focus());
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      const last = sheet.blocks.at(-1);
      if (last) {
        validateLeavingBlock(activeId);
        setActiveId(last.id);
      }
      requestAnimationFrame(() => listRef.current?.focus());
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      editBlock(activeId);
      return;
    }
    if (e.key === 'Delete') {
      e.preventDefault();
      removeActive();
    }
  }

  function skipToWorkList(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    validateLeavingBlock(activeId);
    listRef.current?.focus();
  }

  function clearCurrentSheet() {
    const workType = sheet.kind === 'practice' ? 'practice page' : 'assignment';
    requestConfirmation({
      title: `Clear this ${workType}?`,
      message: `All answers in ${sheet.title} will be cleared. You can restore them with Control+Shift+Z.`,
      confirmLabel: `Clear ${workType}`,
      onConfirm: performClearCurrentSheet,
    });
  }

  function performClearCurrentSheet() {
    const workType = sheet.kind === 'practice' ? 'practice page' : 'assignment';
    recordBlocksUndo(`${workType} contents restored`, activeId);
    const blocks = clearSheetContents(sheet).blocks;
    commitLibrary(updateActiveSheet(library, { blocks }), blocks[0].id);
    titleRef.current?.focus();
    announce(statusRef.current, `${workType} cleared. Focus on ${workType} name.`);
  }

  function titleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (active?.type === 'equation') {
        requestLinearFocus();
        // Quiet: the field name is enough.
      } else if (active?.type === 'prose') {
        requestProseFocus();
      } else {
        addEquationOrFocus();
      }
    }
  }

  function onSkipToLinear(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (active?.type !== 'equation') addEquationOrFocus();
    else {
      requestLinearFocus();
    }
  }

  function openHelp() {
    helpOpenerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setHelpOpen(true);
  }

  function closeHelp() {
    setHelpOpen(false);
    requestAnimationFrame(() =>
      (helpOpenerRef.current || helpButtonRef.current)?.focus(),
    );
  }

  useEffect(() => {
    handlersRef.current = {
      addEquationOrFocus,
      addNote,
      removeActive,
      persist,
      returnToEditor,
      pasteAsEquation,
      copyAll: async () => {
        if (invalidEquationCount(sheet)) {
          openReview();
          return;
        }
        continueWithEmptyAnswers('Copy', () => void copyAll());
      },
      undo,
      openReview,
      closeReview,
      moveActiveBlock,
    };
  });

  return (
    <div className="app">
      {showSkipLink && (
        <a className="skip-link" href="#linear-focus-target" onClick={onSkipToLinear}>
          Skip to Linear
        </a>
      )}

      <header className="top">
        <div className="brand">
          <p className="product-name" id="app-name">
            Digi Math Pad
          </p>
          <p className="tagline">Practice Linear math with NVDA, JAWS, or VoiceOver</p>
        </div>
        <div className="title-area">
          <h1 id="work-heading">{sheet.title}</h1>
          <label className="title-field">
            {workNameLabel}
            <input
              ref={titleRef}
              type="text"
              value={sheet.title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={titleKeyDown}
            />
          </label>
          <p className="hint title-hint" aria-hidden="true">
            Names this {workType}. Press Enter for Linear.
          </p>
          <p
            id="save-state"
            className={`save-state ${saveState === 'error' ? 'error' : ''}`}
          >
            {saveStatusText}
          </p>
        </div>
        <SheetNavigation
          library={library}
          onSwitchClass={onSwitchClass}
          onSwitchSheet={onSwitchSheet}
          onNewAssignment={onNewAssignment}
          onNewPractice={onNewPractice}
        />
        <button
          ref={helpButtonRef}
          type="button"
          className="help-open-button"
          onClick={openHelp}
          aria-haspopup="dialog"
          aria-expanded={helpOpen}
        >
          Quick help
        </button>
      </header>

      <div
        ref={statusRef}
        className="status-live"
        role="status"
        aria-atomic="true"
      />

      <dialog
        ref={classDialogRef}
        className="class-dialog"
        aria-labelledby="class-dialog-heading"
        onCancel={(e) => {
          e.preventDefault();
          closeClassDialog();
        }}
      >
        <form onSubmit={submitClassDialog}>
          <h2 id="class-dialog-heading">
            {classDialogMode === 'rename' ? 'Rename class' : 'Create a class'}
          </h2>
          <p className="hint" aria-hidden="true">
            Use the course name, such as Algebra 1 or Chemistry.
          </p>
          <label htmlFor="class-name">Class name</label>
          <input
            ref={classNameRef}
            id="class-name"
            type="text"
            value={classNameDraft}
            onChange={(e) => {
              setClassNameDraft(e.target.value);
              if (classNameError) setClassNameError('');
            }}
            aria-describedby={classNameError ? 'class-name-error' : undefined}
            aria-invalid={classNameError ? 'true' : undefined}
          />
          {classNameError && (
            <p id="class-name-error" className="field-error">
              {classNameError}
            </p>
          )}
          <div className="toolbar" role="group" aria-label="Class name actions">
            <button type="submit">
              {classDialogMode === 'rename' ? 'Save class name' : 'Create class'}
            </button>
            <button type="button" onClick={() => closeClassDialog()}>
              Cancel
            </button>
          </div>
        </form>
      </dialog>

      <HelpDialog open={helpOpen} onClose={closeHelp} />

      <ConfirmDialog
        open={Boolean(confirmation)}
        title={confirmation?.title || ''}
        message={confirmation?.message || ''}
        confirmLabel={confirmation?.confirmLabel || 'Continue'}
        onConfirm={acceptConfirmation}
        onCancel={cancelConfirmation}
      />

      <ReviewPanel
        sheet={sheet}
        activeId={activeId}
        open={reviewOpen}
        onClose={closeReview}
        onJump={(id) => {
          editBlock(id);
          setReviewOpen(false);
        }}
        onHighlight={setActiveId}
      />

      <main id="main" className="layout" aria-labelledby="work-heading">
        <section className="edit-pane" aria-labelledby="edit-heading">
          <h2 id="edit-heading">{editorName}</h2>

          {active?.type === 'equation' ? (
            <>
              <div id="linear-focus-target">
                <LinearEditor
                  latex={active.latex}
                  onChange={(latex) => updateBlock(active.id, { latex })}
                  onCommit={commitPreview}
                  accessibleName={editorName}
                  error={validationErrors[active.id]}
                  focusRequest={linearFocus}
                  caret={linearCaret}
                />
              </div>
              <div className="problem-label-field">
                <label htmlFor="problem-label">Problem number</label>
                <input
                  id="problem-label"
                  type="text"
                  value={active.label || ''}
                  maxLength={24}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Optional, e.g. 1.2"
                  onChange={(e) =>
                    updateBlock(active.id, {
                      label: e.target.value.slice(0, 24),
                    })
                  }
                />
                <p className="hint" aria-hidden="true">
                  Match your worksheet (1.2, 3a). Leave blank for Equation numbers.
                </p>
              </div>
              <a className="skip-link" href="#work-list" onClick={skipToWorkList}>
                Skip to Your work
              </a>

              <h2>Hear math</h2>
              <p className="hint" aria-hidden="true">
                Alt+Enter opens Professional math for your screen reader. Escape returns to
                Linear.
              </p>
              <MathPreview
                latex={active.latex}
                active={previewActive}
                focusToken={previewFocus}
                onFocusFallback={() =>
                  announce(
                    statusRef.current,
                    'Hear math.',
                  )
                }
              />

              <div className="toolbar" role="group" aria-label="Equation actions">
                <button type="button" onClick={commitPreview}>
                  Hear math <span className="kbd" aria-hidden="true">Alt+Enter</span>
                </button>
                <button type="button" onClick={() => addEquationOrFocus()}>
                  Add equation <span className="kbd" aria-hidden="true">Alt+=</span>
                </button>
                <button type="button" onClick={addNote}>
                  New note <span className="kbd" aria-hidden="true">Alt+N</span>
                </button>
                <button type="button" onClick={removeActive}>
                  Remove equation <span className="kbd" aria-hidden="true">Alt+Delete</span>
                </button>
              </div>

              <details className="kbd-help equation-more-actions">
                <summary>More equation actions</summary>
                <div className="toolbar" role="group" aria-label="More equation actions">
                  <button type="button" onClick={copyLatex}>
                    Copy source
                  </button>
                  <button type="button" onClick={copyMathML}>
                    Copy MathML
                  </button>
                  <button type="button" onClick={duplicateActive}>
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => void pasteAsEquation()}
                  >
                    Paste as equation{' '}
                    <span className="kbd" aria-hidden="true">Ctrl+Shift+V</span>
                  </button>
                </div>
              </details>

              <button
                type="button"
                className="templates-toggle"
                aria-expanded={showTemplates}
                aria-controls={showTemplates ? 'practice-examples' : undefined}
                onClick={() => setShowTemplates((v) => !v)}
              >
                {showTemplates ? 'Hide practice examples' : 'Show practice examples'}
              </button>
              {showTemplates && (
                <ul id="practice-examples" className="templates">
                  {MATH_TEMPLATES.map((t) => (
                    <li key={t.latex}>
                      <button type="button" onClick={() => applyTemplate(t.latex)}>
                        {t.label}
                        <code aria-hidden="true">{t.latex}</code>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : active?.type === 'prose' ? (
            <div className="prose-edit">
              <label htmlFor="prose-focus-target">Note text</label>
              <textarea
                ref={proseRef}
                id="prose-focus-target"
                className="prose-input"
                rows={6}
                value={active.text}
                aria-label={editorName}
                onChange={(e) => updateBlock(active.id, { text: e.target.value })}
              />
              <div className="problem-label-field">
                <label htmlFor="problem-label-note">Problem number</label>
                <input
                  id="problem-label-note"
                  type="text"
                  value={active.label || ''}
                  maxLength={24}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Optional, e.g. 1.2"
                  onChange={(e) =>
                    updateBlock(active.id, {
                      label: e.target.value.slice(0, 24),
                    })
                  }
                />
                <p className="hint" aria-hidden="true">
                  Match your worksheet (1.2, 3a). Leave blank for Note numbers.
                </p>
              </div>
              <div className="toolbar" role="group" aria-label="Note actions">
                <button type="button" onClick={addNote}>
                  New note <span className="kbd" aria-hidden="true">Alt+N</span>
                </button>
                <button type="button" onClick={() => addEquationOrFocus()}>
                  New equation <span className="kbd" aria-hidden="true">Alt+=</span>
                </button>
                <button type="button" onClick={duplicateActive}>
                  Duplicate
                </button>
                <button type="button" onClick={removeActive}>
                  Remove <span className="kbd" aria-hidden="true">Alt+Delete</span>
                </button>
              </div>
              <a className="skip-link" href="#work-list" onClick={skipToWorkList}>
                Skip to Your work
              </a>
            </div>
          ) : (
            <p className="hint" aria-hidden="true">Press Alt+Equals to start an equation.</p>
          )}
        </section>

        <section className="doc-pane" aria-labelledby="doc-heading">
          <h2 id="doc-heading">Your work</h2>
          <details className="kbd-help organize-pages">
            <summary>Organize pages</summary>
            <SheetManagement
              library={library}
              onNewClass={() => openClassDialog('create')}
              onRenameClass={() => openClassDialog('rename')}
              onDuplicateSheet={onDuplicateSheet}
              onDeleteSheet={onDeleteSheet}
              onDeleteClass={onDeleteClass}
            />
          </details>
          <p className="hint" aria-hidden="true">
            Your work is the worksheet in order. Arrows browse. Enter edits.
          </p>
          <ul
            ref={listRef}
            id="work-list"
            className="block-list"
            role="listbox"
            tabIndex={0}
            aria-label="Worksheet answers"
            aria-activedescendant={activeId}
            onKeyDown={onListKeyDown}
          >
            {sheet.blocks.map((block) => {
              const selected = block.id === activeId;
              const label = blockListName(sheet.blocks, block.id);
              if (block.type === 'prose') {
                const preview = block.text.trim() || 'empty';
                return (
                  <li
                    key={block.id}
                    id={block.id}
                    role="option"
                    data-block-id={block.id}
                    className={`block-select${selected ? ' selected' : ''}`}
                    aria-selected={selected}
                    aria-label={`${label} ${preview}`}
                    onClick={() => editBlock(block.id)}
                  >
                    {label}
                    <span className="block-preview" aria-hidden="true">
                      {block.text.trim() ? block.text : '(empty)'}
                    </span>
                  </li>
                );
              }

              const parseError = block.latex.trim() ? latexParseError(block.latex) : null;
              const spoken = !block.latex.trim()
                ? 'empty'
                : parseError
                  ? `invalid. ${parseError}`
                  : toNaturalSpeech(block.latex);
              return (
                <li
                  key={block.id}
                  id={block.id}
                  role="option"
                  data-block-id={block.id}
                  className={`block-select${selected ? ' selected' : ''}`}
                  aria-selected={selected}
                  aria-label={`${label} ${spoken}`}
                  onClick={() => editBlock(block.id)}
                >
                  {label}
                  {block.latex.trim() ? (
                    <span className="block-preview" aria-hidden="true">
                      {block.latex}
                    </span>
                  ) : (
                    <span className="block-preview empty" aria-hidden="true">
                      (empty)
                    </span>
                  )}
                  {parseError && (
                    <span className="block-preview empty" aria-hidden="true">
                      invalid
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="toolbar" role="group" aria-label="Selected item actions">
            <button type="button" onClick={() => addEquationOrFocus()}>
              New equation <span className="kbd" aria-hidden="true">Alt+=</span>
            </button>
            <button type="button" onClick={addNote}>
              New note <span className="kbd" aria-hidden="true">Alt+N</span>
            </button>
            <button
              type="button"
              onClick={duplicateActive}
              aria-label={
                active
                  ? `Duplicate ${blockListName(sheet.blocks, active.id)}`
                  : 'Duplicate selected item'
              }
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={removeActive}
              aria-label={
                active
                  ? `Remove ${blockListName(sheet.blocks, active.id)}`
                  : 'Remove selected item'
              }
            >
              Remove <span className="kbd" aria-hidden="true">Delete</span>
            </button>
          </div>
          <div className="toolbar" role="group" aria-label="Page actions">
            <button type="button" onClick={() => persist()}>
              Save draft <span className="kbd" aria-hidden="true">Ctrl+S</span>
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={!undoStack.length}
              aria-label={
                undoStack.length
                  ? peekUndo(undoStack)?.message
                    ? `Undo: ${peekUndo(undoStack)?.message}`
                    : 'Undo'
                  : 'Undo unavailable'
              }
            >
              Undo <span className="kbd" aria-hidden="true">Ctrl+Shift+Z</span>
            </button>
            <button type="button" onClick={clearCurrentSheet}>
              Clear {workType}
            </button>
          </div>

          <div className="toolbar" role="group" aria-label="Review">
            <button
              ref={reviewButtonRef}
              type="button"
              onClick={openReview}
              aria-expanded={reviewOpen}
              aria-controls="review-panel"
            >
              Review answers <span className="kbd" aria-hidden="true">Alt+R</span>
            </button>
          </div>

          <details className="kbd-help export-tools">
            <summary>{isPractice ? 'Export and backup' : 'Download copies'}</summary>
            <p className="hint" aria-hidden="true">
              Save draft keeps your work here. These buttons make a downloadable copy.
            </p>
            <div
              className="toolbar"
              role="group"
              aria-label={isPractice ? 'Export and backup' : 'Download copies'}
            >
              <button
                type="button"
                onClick={() => {
                  void handlersRef.current.copyAll();
                }}
              >
                Copy all answers <span className="kbd" aria-hidden="true">Ctrl+Shift+C</span>
              </button>
              <button type="button" onClick={exportPrint}>
                Print / visual PDF
              </button>
              <button type="button" onClick={downloadWord}>
                Download Word
              </button>
              <button type="button" onClick={downloadJson}>
                Download backup
              </button>
              <button type="button" onClick={downloadAccessibleHtml}>
                Download accessible HTML
              </button>
              <button
                ref={uploadButtonRef}
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload backup
              </button>
              <input
                ref={fileInputRef}
                type="file"
                tabIndex={-1}
                accept="application/json,.json,.digimath.json"
                className="file-input"
                aria-label="Upload digimath JSON backup"
                onChange={(e) => {
                  onImportFile(e.target.files?.[0] || null);
                  e.target.value = '';
                  requestAnimationFrame(() => uploadButtonRef.current?.focus());
                }}
              />
            </div>
          </details>
        </section>
      </main>

      <footer className="foot">
        <p>Accessible Linear practice for NVDA, JAWS, and VoiceOver.</p>
      </footer>

      <div className="print-only">
        <h1>{sheet.title}</h1>
        {sheet.blocks.map((b) =>
          b.type === 'prose' ? (
            <p key={b.id}>{b.text}</p>
          ) : (
            <div
              key={b.id}
              className="print-math"
              dangerouslySetInnerHTML={{
                __html: renderKatexHtml(b.latex).html || `<code>${b.latex}</code>`,
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}
