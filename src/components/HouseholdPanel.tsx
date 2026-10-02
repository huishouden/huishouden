import { useEffect, useRef, useState, type FormEvent } from 'react';
import { inviteMailto, type Invitation } from '@huishouden/pwa-kit/invite';
import { cardClass, ghostButton, inputClass, linkClass, primaryButton } from '@huishouden/pwa-kit/react/ui';
import { MAX_NAME, type HubActions, type HubState, type ReadyHousehold } from '../hub';

type SignedIn = Extract<HubState, { auth: 'signed-in' }>;

interface Props {
  state: SignedIn;
  actions: HubActions;
  notify: (message: string) => void;
  fail: (message: string) => void;
}

const textLink = 'min-h-11 font-medium text-forest-700 underline underline-offset-4 hover:text-forest-600';

/**
 * The household: starting one, renaming it, who is in it (their own names and photos), and inviting
 * more. Membership here is what every household app checks, so an invite opens all of them at once.
 */
export function HouseholdPanel({ state, actions, notify, fail }: Props) {
  const h = state.household;
  // Right after starting a household, land on the invite field.
  const [created, setCreated] = useState(false);
  const run = async (task: () => Promise<void>, done?: string) => {
    try {
      await task();
      if (done) notify(done);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section id="household" aria-label="Household" aria-live="polite" className={`${cardClass} max-w-2xl p-6`}>
      {h.status === 'loading' && (
        <>
          <h2 className="mb-3 text-xl font-semibold text-forest-700">Household</h2>
          <p className="text-stone-600">Loading…</p>
        </>
      )}
      {h.status === 'error' && (
        <>
          <h2 className="mb-3 text-xl font-semibold text-forest-700">Household</h2>
          <p className="text-red-700">{h.error}</p>
        </>
      )}
      {h.status === 'none' && (
        <NoHousehold me={state.me} suggestedName={h.suggestedName} create={(name) =>
            run(async () => {
              await actions.createHousehold(name);
              setCreated(true);
            })
          }
        />
      )}
      {h.status === 'ready' && <Household key={h.id} me={state.me} household={h} actions={actions} run={run} focusInvite={created} />}
      <p className="mt-4 text-sm text-stone-600">
        Signed in as {state.me} ·{' '}
        <button type="button" className="font-medium text-forest-700 underline underline-offset-4" onClick={() => void actions.signOut()}>
          Sign out
        </button>
      </p>
    </section>
  );
}

function NoHousehold({ me, suggestedName, create }: { me: string; suggestedName: string; create: (name: string) => Promise<void> }) {
  const [naming, setNaming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(suggestedName);
  const input = useRef<HTMLInputElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (naming) {
      input.current?.focus();
      input.current?.select();
    }
  }, [naming]);

  const waiting = (
    <p className="mt-3 text-sm text-stone-600">
      Waiting for an invite? Ask a member to invite <strong>{me}</strong>.
    </p>
  );

  if (!naming) {
    return (
      <>
        <h2 className="mb-3 text-xl font-semibold text-forest-700">Household</h2>
        <p className="mb-3">Start a household for the people you live with. You'll invite them next.</p>
        <button ref={startButton} type="button" className={primaryButton} onClick={() => setNaming(true)}>
          Start a household
        </button>
        {waiting}
      </>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    await create(trimmed.slice(0, MAX_NAME));
    setCreating(false);
  };

  return (
    <>
      <h2 className="mb-3 text-xl font-semibold text-forest-700">Start a household</h2>
      <form onSubmit={submit} className="mb-3">
        <label htmlFor="hh-new-name" className="mb-1.5 block font-medium">
          Name
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id="hh-new-name"
            className={`${inputClass} min-w-[220px] flex-1`}
            value={name}
            maxLength={MAX_NAME}
            required
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className={primaryButton} disabled={creating}>
            {creating ? 'Starting…' : 'Start'}
          </button>
          <button type="button" className={ghostButton} disabled={creating} onClick={() => setNaming(false)}>
            Cancel
          </button>
        </div>
      </form>
      <p className="text-sm text-stone-600">Only you are in it at first. You can rename it any time.</p>
      {waiting}
    </>
  );
}

function Household({
  me,
  household: h,
  actions,
  run,
  focusInvite,
}: {
  focusInvite: boolean;
  me: string;
  household: ReadyHousehold;
  actions: HubActions;
  run: (task: () => Promise<void>, done?: string) => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(h.name);
  const [email, setEmail] = useState('');
  const [invited, setInvited] = useState<Invitation>();
  const [sending, setSending] = useState(false);
  const renameInput = useRef<HTMLInputElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const inviteInput = useRef<HTMLInputElement>(null);
  const solo = h.members.length === 1;

  useEffect(() => {
    if (focusInvite) inviteInput.current?.focus();
  }, [focusInvite]);

  useEffect(() => {
    if (renaming) {
      renameInput.current?.focus();
      renameInput.current?.select();
    }
  }, [renaming]);

  const stopRenaming = () => {
    setRenaming(false);
    setTimeout(() => renameButton.current?.focus());
  };

  return (
    <>
      {renaming ? (
        <form
          className="mb-3"
          onKeyDown={(e) => e.key === 'Escape' && stopRenaming()}
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (name && name !== h.name) void run(() => actions.renameHousehold(name));
            stopRenaming();
          }}
        >
          <label htmlFor="hh-rename-name" className="mb-1.5 block font-medium">
            Household name
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              ref={renameInput}
              id="hh-rename-name"
              className={`${inputClass} min-w-[220px] flex-1`}
              value={newName}
              maxLength={MAX_NAME}
              required
              autoComplete="off"
              onChange={(e) => setNewName(e.target.value)}
            />
            <button type="submit" className={primaryButton}>
              Save
            </button>
            <button type="button" className={ghostButton} onClick={stopRenaming}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-1 flex items-baseline gap-3">
          <h2 className="text-xl font-semibold text-forest-700">{h.name}</h2>
          <button
            ref={renameButton}
            type="button"
            className={`${textLink} text-sm`}
            onClick={() => {
              setNewName(h.name);
              setRenaming(true);
            }}
          >
            Rename
          </button>
        </div>
      )}

      <ul className="mb-4">
        {h.members.map((m) => {
          const p = h.profiles[m];
          const joined = h.joined.includes(m);
          const self = m === me;
          return (
            <li key={m} className="flex items-center gap-3 border-b border-stone-200 py-2.5">
              {p?.photoURL ? (
                <img className="h-10 w-10 shrink-0 rounded-full object-cover" src={p.photoURL} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span aria-hidden="true" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-600 font-semibold text-white">
                  {(p?.name ?? m).charAt(0).toUpperCase()}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col [overflow-wrap:anywhere]">
                <span className="font-semibold">
                  {p?.name ?? m}
                  {self && <span className="font-normal text-stone-600"> (you)</span>}
                </span>
                {p?.name && <span className="text-sm text-stone-600">{m}</span>}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${joined ? 'bg-forest-100 text-forest-700' : 'bg-terracotta-light text-terracotta-dark'}`}
              >
                {joined ? 'Signed in' : 'Invited'}
              </span>
              {!self && (
                <button
                  type="button"
                  className={textLink}
                  onClick={() => {
                    if (confirm(`Remove ${m} from ${h.name}? They lose access to every household app.`)) void run(() => actions.removeMember(m));
                  }}
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {invited && (
        <div role="status" className="mb-4 rounded-xl bg-forest-50 p-4">
          <p className="mb-2">{invited.to} is invited. Let them know by email:</p>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={primaryButton}
              disabled={sending}
              onClick={async () => {
                setSending(true);
                await run(async () => {
                  await actions.sendInviteEmail(invited);
                  setInvited(undefined);
                }, 'Invite email sent.');
                setSending(false);
              }}
            >
              {sending ? 'Sending…' : 'Send invite email'}
            </button>
            <a className={linkClass} href={inviteMailto(invited)}>
              Write it in my mail app
            </a>
            <button type="button" className={`${textLink} inline-flex items-center`} onClick={() => setInvited(undefined)}>
              Not now
            </button>
          </div>
          <p className="text-sm text-stone-600">Sent from your Gmail. Google asks once to let Huishouden send email; it only sends invitations.</p>
        </div>
      )}

      {solo && <p className="mb-3">Invite the people you live with. They'll get every app when they sign in.</p>}
      <form
        className="mb-3 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const to = email.trim();
          if (!to) return;
          void run(async () => {
            const invitation = await actions.invite(to);
            setEmail('');
            setInvited(invitation);
          });
        }}
      >
        <input
          ref={inviteInput}
          type="email"
          className={`${inputClass} min-w-[220px] flex-1`}
          placeholder="Their Google account email"
          aria-label="Their Google account email"
          required
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className={primaryButton}>
          Invite
        </button>
      </form>
      {!solo && <p className="text-sm text-stone-600">An invite gives them every household app the next time they sign in with that account.</p>}
    </>
  );
}
