import {
  PRACTICE_CLASS_ID,
  type PadLibrary,
  equationCount,
  sheetsInClass,
  sheetLabel,
} from '../lib/document';

type NavigationProps = {
  library: PadLibrary;
  onSwitchClass: (classId: string) => void;
  onSwitchSheet: (sheetId: string) => void;
  onNewAssignment: () => void;
  onNewPractice: () => void;
};

type ManagementProps = {
  library: PadLibrary;
  onNewClass: () => void;
  onRenameClass: () => void;
  onDuplicateSheet: () => void;
  onDeleteSheet: () => void;
  onDeleteClass: () => void;
};

export function SheetNavigation({
  library,
  onSwitchClass,
  onSwitchSheet,
  onNewAssignment,
  onNewPractice,
}: NavigationProps) {
  const inClass = sheetsInClass(library, library.activeClassId);
  const isPractice = library.activeClassId === PRACTICE_CLASS_ID;

  return (
    <div className="sheet-bar sheet-navigation" role="region" aria-label="Choose class and page">
      <label className="sheet-select-label">
        Current class
        <select
          value={library.activeClassId}
          onChange={(e) => onSwitchClass(e.target.value)}
        >
          {library.classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.id === PRACTICE_CLASS_ID ? ' (free practice)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="sheet-select-label">
        {isPractice ? 'Current practice page' : 'Current assignment'}
        <select
          value={library.activeSheetId}
          onChange={(e) => onSwitchSheet(e.target.value)}
        >
          {inClass.map((s) => (
            <option key={s.id} value={s.id}>
              {sheetLabel(s)} ({equationCount(s)}{' '}
              {equationCount(s) === 1 ? 'equation' : 'equations'})
            </option>
          ))}
        </select>
      </label>

      <div className="toolbar sheet-actions" role="group" aria-label="Create work">
        {isPractice ? (
          <button type="button" onClick={onNewPractice}>
            New practice page
          </button>
        ) : (
          <button type="button" onClick={onNewAssignment}>
            New assignment
          </button>
        )}
      </div>
    </div>
  );
}

export function SheetManagement({
  library,
  onNewClass,
  onRenameClass,
  onDuplicateSheet,
  onDeleteSheet,
  onDeleteClass,
}: ManagementProps) {
  const isPractice = library.activeClassId === PRACTICE_CLASS_ID;

  return (
    <div className="sheet-management">
      <div className="toolbar sheet-actions" role="group" aria-label="Organize work">
        <button type="button" onClick={onNewClass}>
          New class
        </button>
        {!isPractice && (
          <button type="button" onClick={onRenameClass}>
            Rename class
          </button>
        )}
        <button type="button" onClick={onDuplicateSheet}>
          {isPractice ? 'Duplicate practice page' : 'Duplicate assignment'}
        </button>
        <button type="button" onClick={onDeleteSheet}>
          {isPractice ? 'Delete practice page' : 'Delete assignment'}
        </button>
        {!isPractice && (
          <button type="button" onClick={onDeleteClass}>
            Delete class
          </button>
        )}
      </div>
      <p className="hint sheet-hint" aria-hidden="true">
        Practice pages are independent work. Class work is organized into assignments.
      </p>
    </div>
  );
}
