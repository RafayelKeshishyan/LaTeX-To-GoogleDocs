import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import App from '../App';
import type { PadLibrary } from '../lib/document';
import {
  PERSONAL_SCOPE,
  accountScope,
  libraryHasContent,
  librarySignature,
  loadStoredLibrary,
  saveLibrary,
} from '../lib/document';
import { loadCloudLibrary, saveCloudLibrary } from '../lib/cloudWorkspace';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import './CloudWorkspace.css';

type AccountIntent = 'sign-in' | 'create';

type Profile = {
  display_name: string;
};

const PERSONAL_MODE_KEY = 'digimath-pad-workspace-mode';

function rememberedPersonalMode(): boolean {
  try {
    return localStorage.getItem(PERSONAL_MODE_KEY) === 'personal';
  } catch {
    return false;
  }
}

function rememberPersonalMode(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(PERSONAL_MODE_KEY, 'personal');
    else localStorage.removeItem(PERSONAL_MODE_KEY);
  } catch {
    // The Pad's own save warning handles unavailable browser storage.
  }
}

function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (/invalid login credentials|invalid credentials/.test(message)) {
    return 'The email or password is incorrect.';
  }
  if (/email not confirmed/.test(message)) {
    return 'Confirm your email before signing in.';
  }
  if (/already registered|already exists/.test(message)) {
    return 'An account already exists for this email. Try signing in.';
  }
  if (/rate limit|too many requests/.test(message)) {
    return 'Too many account attempts. Wait a few minutes and try again.';
  }
  if (/network|fetch/.test(message)) {
    return 'The account service could not be reached. Check your connection and try again.';
  }
  return 'The account request could not be completed. Try again.';
}

function WorkspaceSkipLink() {
  function skipToLinear(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const editor = document.querySelector<HTMLTextAreaElement>('.linear-editor textarea');
    if (editor) {
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
      return;
    }
    document
      .querySelector<HTMLButtonElement>('.prose-edit .toolbar button')
      ?.click();
  }

  return (
    <a className="skip-link" href="#linear-focus-target" onClick={skipToLinear}>
      Skip to Linear
    </a>
  );
}

function AuthScreen({ onUsePersonal }: { onUsePersonal: () => void }) {
  const [intent, setIntent] = useState<AccountIntent>('sign-in');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    document.title = `${intent === 'sign-in' ? 'Sign in' : 'Create an account'} — Digi Math Pad`;
  }, [intent]);

  function showResult(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  function changeIntent(next: AccountIntent) {
    setIntent(next);
    setMessage('');
    setIsError(false);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const client = getSupabase();

    try {
      if (intent === 'sign-in') {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const name = displayName.trim();
        if (!name) {
          showResult('Enter your name.', true);
          return;
        }
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name, role: 'student' },
          },
        });
        if (error) throw error;
        if (!data.session) {
          showResult('Account created. Check your email to confirm it, then sign in.');
        }
      }
    } catch (error) {
      showResult(friendlyAuthError(error), true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell" aria-labelledby="account-heading">
      <section className="auth-card">
        <p className="product-name">Digi Math Pad</p>
        <h1 id="account-heading" ref={headingRef} tabIndex={-1}>
          {intent === 'sign-in' ? 'Sign in' : 'Create an account'}
        </h1>
        <p className="auth-lead">
          Sign in to save practice across devices, or continue with personal practice saved
          only in this browser.
        </p>

        <button type="button" className="personal-mode-button" onClick={onUsePersonal}>
          Continue with personal practice
        </button>

        <div className="account-choice" role="group" aria-label="Account action">
          <button
            type="button"
            aria-pressed={intent === 'sign-in'}
            onClick={() => changeIntent('sign-in')}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={intent === 'create'}
            onClick={() => changeIntent('create')}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={(e) => void submit(e)}>
          {intent === 'create' && (
            <>
              <label htmlFor="account-name">Name</label>
              <input
                id="account-name"
                value={displayName}
                autoComplete="name"
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </>
          )}

          <label htmlFor="account-email">Email</label>
          <input
            id="account-email"
            type="email"
            value={email}
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="account-password">Password</label>
          <input
            id="account-password"
            type="password"
            value={password}
            autoComplete={intent === 'sign-in' ? 'current-password' : 'new-password'}
            minLength={8}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
            required
          />
          <p id="password-hint" className="hint">
            At least 8 characters.
          </p>

          {message && (
            <p
              className={isError ? 'account-message error' : 'account-message'}
              role={isError ? 'alert' : 'status'}
            >
              {message}
            </p>
          )}

          <button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : intent === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </main>
  );
}

function AccountLoadingScreen() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    document.title = 'Loading account — Digi Math Pad';
  }, []);

  return (
    <main className="auth-shell" aria-busy="true" aria-labelledby="loading-account-heading">
      <section className="auth-card">
        <h1 id="loading-account-heading" ref={headingRef} tabIndex={-1}>
          Digi Math Pad
        </h1>
        <p role="status">Loading account…</p>
      </section>
    </main>
  );
}

type WorkspaceState =
  | { status: 'loading' }
  | { status: 'ready'; library: PadLibrary | null }
  /** A first sign-in on a browser that already holds personal practice work. */
  | { status: 'first-run'; personal: PadLibrary }
  /** The account and this browser hold different work, so the student chooses. */
  | { status: 'conflict'; cloud: PadLibrary; local: PadLibrary }
  | { status: 'error' };

function sameWork(a: PadLibrary, b: PadLibrary): boolean {
  return librarySignature(a) === librarySignature(b);
}

type Resolution =
  | { kind: 'use-cloud'; library: PadLibrary }
  | { kind: 'use-local'; library: PadLibrary }
  | { kind: 'conflict'; cloud: PadLibrary; local: PadLibrary }
  | { kind: 'first-run'; personal: PadLibrary }
  | { kind: 'empty' };

/**
 * Decides which copy of the work to open. A side holding no typed work never
 * replaces a side that does, so the student is only asked about a real clash.
 */
function resolveWork(cloud: PadLibrary | null, local: PadLibrary | null): Resolution {
  if (cloud && local && !sameWork(cloud, local)) {
    const localHasWork = libraryHasContent(local);
    const cloudHasWork = libraryHasContent(cloud);
    if (localHasWork && cloudHasWork) return { kind: 'conflict', cloud, local };
    if (localHasWork) return { kind: 'use-local', library: local };
    return { kind: 'use-cloud', library: cloud };
  }
  if (cloud) return { kind: 'use-cloud', library: cloud };
  if (local) return { kind: 'use-local', library: local };

  const personal = loadStoredLibrary(PERSONAL_SCOPE);
  if (personal && libraryHasContent(personal)) return { kind: 'first-run', personal };
  return { kind: 'empty' };
}

function workSummary(library: PadLibrary): string {
  const equations = library.sheets.reduce(
    (total, sheet) => total + sheet.blocks.filter((b) => b.type === 'equation').length,
    0,
  );
  const pages = library.sheets.length;
  return `${pages} ${pages === 1 ? 'page' : 'pages'}, ${equations} ${
    equations === 1 ? 'equation' : 'equations'
  }`;
}

function ChoiceScreen({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    document.title = `${heading} — Digi Math Pad`;
  }, [heading]);

  return (
    <main className="auth-shell" aria-labelledby="workspace-choice-heading">
      <section className="auth-card">
        <h1 id="workspace-choice-heading" ref={headingRef} tabIndex={-1}>
          {heading}
        </h1>
        {children}
      </section>
    </main>
  );
}

function FirstRunChoice({
  personal,
  onCopy,
  onStartEmpty,
}: {
  personal: PadLibrary;
  onCopy: () => void;
  onStartEmpty: () => void;
}) {
  return (
    <ChoiceScreen heading="Start your account workspace">
      <p className="auth-lead">
        This browser has personal practice work that is not part of any account: {workSummary(personal)}.
        Copy it into your account, or start with an empty workspace. Personal practice is kept
        either way.
      </p>
      <div className="workspace-choice-actions">
        <button type="button" onClick={onCopy}>
          Copy personal practice into my account
        </button>
        <button type="button" onClick={onStartEmpty}>
          Start with an empty workspace
        </button>
      </div>
    </ChoiceScreen>
  );
}

function ConflictChoice({
  cloud,
  local,
  onKeepLocal,
  onKeepCloud,
}: {
  cloud: PadLibrary;
  local: PadLibrary;
  onKeepLocal: () => void;
  onKeepCloud: () => void;
}) {
  return (
    <ChoiceScreen heading="Two versions of your work">
      <p className="auth-lead">
        Your account and this browser hold different work. Choose which version to keep. The
        other version is replaced, so download a backup first if you need both.
      </p>
      <div className="workspace-choice-actions">
        <button type="button" onClick={onKeepLocal}>
          Keep this browser&apos;s work ({workSummary(local)})
        </button>
        <button type="button" onClick={onKeepCloud}>
          Keep my account&apos;s work ({workSummary(cloud)})
        </button>
      </div>
    </ChoiceScreen>
  );
}

function WorkspaceLoading() {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    document.title = 'Loading saved work — Digi Math Pad';
  }, []);

  return (
    <main className="workspace-loading" aria-busy="true" aria-labelledby="workspace-loading-heading">
      <h1 id="workspace-loading-heading" ref={headingRef} tabIndex={-1}>
        Loading saved work
      </h1>
      <p role="status">Loading your account workspace…</p>
    </main>
  );
}

function SignedInWorkspace({ session }: { session: Session }) {
  const userId = session.user.id;
  const scope = accountScope(userId);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceState>({ status: 'loading' });
  const [cloudRecovered, setCloudRecovered] = useState(false);
  const [retryBusy, setRetryBusy] = useState(false);
  const [retryMessage, setRetryMessage] = useState('');
  /** Changing this remounts the editor, which is how restored work replaces an empty session. */
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    let active = true;
    void loadCloudLibrary(userId).then(
      (cloud) => {
        if (!active) return;
        const resolved = resolveWork(cloud, loadStoredLibrary(scope));

        switch (resolved.kind) {
          case 'conflict':
            setWorkspace({ status: 'conflict', cloud: resolved.cloud, local: resolved.local });
            return;
          case 'first-run':
            setWorkspace({ status: 'first-run', personal: resolved.personal });
            return;
          case 'use-cloud':
            saveLibrary(resolved.library, scope);
            setWorkspace({ status: 'ready', library: resolved.library });
            return;
          case 'use-local':
            void saveCloudLibrary(userId, resolved.library).catch(() => undefined);
            setWorkspace({ status: 'ready', library: resolved.library });
            return;
          default:
            setWorkspace({ status: 'ready', library: null });
        }
      },
      (error) => {
        console.error('Cloud workspace load failed.', error);
        if (active) setWorkspace({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [userId, scope]);

  function startWorkspace(library: PadLibrary | null) {
    if (library) saveLibrary(library, scope);
    setWorkspace({ status: 'ready', library });
  }

  /**
   * Retrying never discards typed work. When the student has typed something the editor
   * stays mounted as-is; a real clash becomes a choice instead of a silent overwrite.
   */
  function retryCloud() {
    setRetryBusy(true);
    setRetryMessage('');
    void loadCloudLibrary(userId).then(
      (cloud) => {
        setRetryBusy(false);
        const resolved = resolveWork(cloud, loadStoredLibrary(scope));

        if (resolved.kind === 'conflict') {
          setWorkspace({ status: 'conflict', cloud: resolved.cloud, local: resolved.local });
          return;
        }
        if (resolved.kind === 'use-cloud') {
          saveLibrary(resolved.library, scope);
          setCloudRecovered(true);
          setEditorKey((key) => key + 1);
          setWorkspace({ status: 'ready', library: resolved.library });
          return;
        }
        if (resolved.kind === 'use-local') {
          void saveCloudLibrary(userId, resolved.library).catch(() => undefined);
        }
        setCloudRecovered(true);
        setRetryMessage('Your account is available again. Work is saved to your account.');
      },
      (error) => {
        console.error('Cloud workspace retry failed.', error);
        setRetryBusy(false);
        setRetryMessage(
          'Your account still could not be reached. Keep working. This browser is saving your work.',
        );
      },
    );
  }

  useEffect(() => {
    let active = true;
    const client = getSupabase();
    void client
      .from('profiles')
      .select('display_name')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setProfileError(true);
        else setProfile(data as Profile);
      });
    return () => {
      active = false;
    };
  }, [session.user.id]);

  const saveWorkspace = useCallback(
    (library: PadLibrary) => saveCloudLibrary(userId, library),
    [userId],
  );

  if (workspace.status === 'loading') return <WorkspaceLoading />;

  if (workspace.status === 'first-run') {
    return (
      <FirstRunChoice
        personal={workspace.personal}
        onCopy={() => startWorkspace(workspace.personal)}
        onStartEmpty={() => startWorkspace(null)}
      />
    );
  }

  if (workspace.status === 'conflict') {
    return (
      <ConflictChoice
        cloud={workspace.cloud}
        local={workspace.local}
        onKeepLocal={() => {
          void saveCloudLibrary(userId, workspace.local).catch(() => undefined);
          setCloudRecovered(true);
          startWorkspace(workspace.local);
        }}
        onKeepCloud={() => {
          setCloudRecovered(true);
          startWorkspace(workspace.cloud);
        }}
      />
    );
  }

  const cloudAvailable = workspace.status === 'ready' || cloudRecovered;
  const showCloudError = workspace.status === 'error' && !cloudRecovered;

  return (
    <>
      <WorkspaceSkipLink />
      <section className="account-bar" aria-labelledby="signed-in-heading">
        <div>
          <p id="signed-in-heading" className="account-bar-title">Account</p>
          <p>
            Signed in as {profile?.display_name || session.user.email || 'user'}.
          </p>
          {profileError && (
            <p className="account-message error" role="alert">
              Your account profile could not be loaded.
            </p>
          )}
          {showCloudError && (
            <div className="account-message error" role="alert">
              <p>
                Your account could not be reached. Work is saved in this browser only. Download a
                backup to protect it.
              </p>
              <button type="button" onClick={retryCloud} disabled={retryBusy}>
                {retryBusy ? 'Checking…' : 'Try my account again'}
              </button>
            </div>
          )}
          {retryMessage && <p role="status">{retryMessage}</p>}
          {!showCloudError && (
            <p className="hint">Practice pages and notes are saved to your account.</p>
          )}
        </div>
        <button type="button" onClick={() => void getSupabase().auth.signOut()}>
          Sign out
        </button>
      </section>
      <App
        key={editorKey}
        showSkipLink={false}
        initialLibrary={workspace.status === 'ready' ? workspace.library : null}
        storageScope={scope}
        saveToAccount={cloudAvailable ? saveWorkspace : undefined}
        entryAnnouncement={
          workspace.status !== 'ready'
            ? 'Signed in. Your account could not be reached. Work is saved in this browser.'
            : editorKey > 0
              ? 'Your account is available again. Your saved work is open.'
              : 'Signed in. Work is saved to your account.'
        }
      />
    </>
  );
}

function PersonalWorkspace({ onReturn }: { onReturn: () => void }) {
  return (
    <>
      <WorkspaceSkipLink />
      <section className="account-bar" aria-labelledby="personal-practice-heading">
        <div>
          <p id="personal-practice-heading" className="account-bar-title">
            Personal practice
          </p>
          <p>Work is saved only in this browser. Download a backup before switching devices.</p>
        </div>
        <button type="button" onClick={onReturn}>
          Return to account sign-in
        </button>
      </section>
      <App
        showSkipLink={false}
        storageScope={PERSONAL_SCOPE}
        entryAnnouncement="Personal practice. Saved only in this browser."
      />
    </>
  );
}

export default function CloudWorkspace() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [personalMode, setPersonalMode] = useState(rememberedPersonalMode);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = getSupabase();
    void client.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        rememberPersonalMode(false);
        setPersonalMode(false);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) return <App />;
  if (personalMode) {
    return (
      <PersonalWorkspace
        onReturn={() => {
          rememberPersonalMode(false);
          setPersonalMode(false);
        }}
      />
    );
  }
  if (session === undefined) {
    return <AccountLoadingScreen />;
  }
  if (!session) {
    return (
      <AuthScreen
        onUsePersonal={() => {
          rememberPersonalMode(true);
          setPersonalMode(true);
        }}
      />
    );
  }
  return <SignedInWorkspace session={session} />;
}
