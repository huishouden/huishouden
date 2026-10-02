import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { forgetSilentSignIn, signInSilently } from '@huishouden/pwa-kit/auth';
import {
  inviteMember,
  markJoined,
  normalizeEmail,
  removeMember,
  saveMyProfile,
  watchHousehold,
  watchProfiles,
  type Household,
  type HouseholdState,
  type Profile,
} from '@huishouden/pwa-kit/household';
import { inviteMailto, sendInviteEmail, type Invitation } from '@huishouden/pwa-kit/invite';
import { auth, db, googleClientId } from './firebase';

/**
 * The household panel: who is in the household, who is invited, and inviting more. Membership here
 * is what every household app checks, so an invite opens all of them at once.
 */
export function mountHouseholdPanel(root: HTMLElement) {
  let stopWatching: (() => void) | undefined;
  let stopProfiles: (() => void) | undefined;
  let profiles = new Map<string, Profile>();
  let last: { user: User; state: HouseholdState } | undefined;
  /** The invitation just made, offered for sending by email until dismissed. */
  let justInvited: Invitation | undefined;

  const render = (html: string) => (root.innerHTML = html);
  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  function renderSignedOut() {
    render(`
      <h2>Household</h2>
      <p class="muted">Sign in to see who's in the household and invite others.</p>
      <button class="hh-button" id="hh-sign-in">Sign in with Google</button>`);
    root.querySelector('#hh-sign-in')!.addEventListener('click', () => {
      signInWithPopup(auth, new GoogleAuthProvider()).catch((e) => showError(e));
    });
  }

  function renderState(user: User, state: HouseholdState) {
    const me = normalizeEmail(user.email ?? '');
    const footer = `<p class="muted small">Signed in as ${esc(me)} · <button class="link" id="hh-sign-out">Sign out</button></p>`;
    if (state.status === 'loading') return render(`<h2>Household</h2><p class="muted">Loading…</p>${footer}`);
    if (state.status === 'error') return render(`<h2>Household</h2><p class="error">${esc(state.error.message)}</p>${footer}`);
    if (state.status === 'none') {
      return render(`
        <h2>Household</h2>
        <p>You're not in a household yet. Ask a member to invite <strong>${esc(me)}</strong> here.</p>${footer}`);
    }
    const h = state.household;
    const typed = (root.querySelector<HTMLInputElement>('#hh-invite input')?.value) ?? '';
    render(`
      <h2>${esc(h.name)}</h2>
      <ul class="members">
        ${h.members
          .map((m) => {
            const joined = h.joined.includes(m);
            const self = m === me;
            const p = profiles.get(m);
            const avatar = p?.photoURL
              ? `<img class="hh-avatar" src="${esc(p.photoURL)}" alt="" referrerpolicy="no-referrer" />`
              : `<span class="hh-avatar member__initial" aria-hidden="true">${esc((p?.name ?? m).charAt(0).toUpperCase())}</span>`;
            return `<li>
              ${avatar}
              <span class="member">
                <span class="member__name">${esc(p?.name ?? m)}${self ? ' <span class="muted">(you)</span>' : ''}</span>
                ${p?.name ? `<span class="member__email muted small">${esc(m)}</span>` : ''}
              </span>
              <span class="badge ${joined ? 'badge--joined' : 'badge--invited'}">${joined ? 'Signed in' : 'Invited'}</span>
              ${self ? '' : `<button class="link" data-remove="${esc(m)}">Remove</button>`}
            </li>`;
          })
          .join('')}
      </ul>
      ${
        justInvited
          ? `<div class="invite-sent" role="status">
              <p>${esc(justInvited.to)} is invited. Let them know by email:</p>
              <div class="invite-sent__actions">
                <button class="hh-button" id="hh-send-invite">Send invite email</button>
                <a class="link" href="${esc(inviteMailto(justInvited))}">Write it in my mail app</a>
                <button class="link" id="hh-dismiss-invite">Not now</button>
              </div>
              <p class="muted small">Sent from your Gmail. Google asks once to let Huishouden send email; it only sends invitations.</p>
            </div>`
          : ''
      }
      <form id="hh-invite" class="invite">
        <input type="email" name="email" placeholder="Their Google account email" required autocomplete="off" />
        <button class="hh-button" type="submit">Invite</button>
      </form>
      <p class="muted small">An invite gives them every household app the next time they sign in with that account.</p>
      ${footer}`);
    root.querySelector<HTMLInputElement>('#hh-invite input')!.value = typed;
    root.querySelector('#hh-send-invite')?.addEventListener('click', async (e) => {
      const button = e.currentTarget as HTMLButtonElement;
      button.disabled = true;
      button.textContent = 'Sending…';
      try {
        await sendInviteEmail(auth, justInvited!);
        justInvited = undefined;
        rerender();
        showNotice('Invite email sent.');
      } catch (err) {
        button.disabled = false;
        button.textContent = 'Send invite email';
        showError(err);
      }
    });
    root.querySelector('#hh-dismiss-invite')?.addEventListener('click', () => {
      justInvited = undefined;
      rerender();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((b) =>
      b.addEventListener('click', () => {
        const email = b.dataset.remove!;
        if (confirm(`Remove ${email} from ${h.name}? They lose access to every household app.`)) {
          removeMember(db, h.id, email).catch(showError);
        }
      }),
    );
    root.querySelector<HTMLFormElement>('#hh-invite')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = (e.currentTarget as HTMLFormElement).elements.namedItem('email') as HTMLInputElement;
      const to = normalizeEmail(input.value);
      inviteMember(db, h.id, to)
        .then(() => {
          input.value = '';
          const self = profiles.get(me);
          justInvited = { to, from: self?.name ?? user.displayName ?? me, householdName: h.name, url: location.origin };
          rerender();
        })
        .catch(showError);
    });
    bindSignOut();
  }

  function bindSignOut() {
    root.querySelector('#hh-sign-out')?.addEventListener('click', async () => {
      await forgetSilentSignIn();
      await signOut(auth);
    });
  }

  function rerender() {
    if (last) renderState(last.user, last.state);
    bindSignOut();
  }

  function showNotice(text: string) {
    const p = document.createElement('p');
    p.className = 'notice';
    p.setAttribute('role', 'status');
    p.textContent = text;
    root.appendChild(p);
  }

  function showError(e: unknown) {
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = e instanceof Error ? e.message : String(e);
    root.appendChild(p);
  }

  onAuthStateChanged(auth, (user) => {
    stopWatching?.();
    stopProfiles?.();
    stopWatching = stopProfiles = undefined;
    profiles = new Map();
    justInvited = undefined;
    if (!user?.email) return renderSignedOut();
    const email = user.email;
    let householdId: string | undefined;
    stopWatching = watchHousehold(db, email, (state) => {
      last = { user, state };
      rerender();
      if (state.status !== 'ready') return;
      const household = state.household as Household;
      void markJoined(db, household, email).catch(() => {});
      if (household.id === householdId) return;
      householdId = household.id;
      stopProfiles?.();
      // Members' names and photos come from their own sign-ins; record ours for the others.
      void saveMyProfile(db, household.id, user).catch(() => {});
      stopProfiles = watchProfiles(db, household.id, (next) => {
        profiles = next;
        rerender();
      });
    });
  });

  // Signs in without a click when the browser is signed in to Google and has used this site before.
  if (googleClientId) void signInSilently(auth, googleClientId);
}
