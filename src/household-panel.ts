import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { forgetSilentSignIn, signInSilently } from '@huishouden/pwa-kit/auth';
import {
  inviteMember,
  markJoined,
  normalizeEmail,
  removeMember,
  watchHousehold,
  type Household,
  type HouseholdState,
} from '@huishouden/pwa-kit/household';
import { auth, db, googleClientId } from './firebase';

/**
 * The household panel: who is in the household, who is invited, and inviting more. Membership here
 * is what every household app checks, so an invite opens all of them at once.
 */
export function mountHouseholdPanel(root: HTMLElement) {
  let stopWatching: (() => void) | undefined;

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
    render(`
      <h2>${esc(h.name)}</h2>
      <ul class="members">
        ${h.members
          .map((m) => {
            const joined = h.joined.includes(m);
            const self = m === me;
            return `<li>
              <span class="member">${esc(m)}${self ? ' <span class="muted">(you)</span>' : ''}</span>
              <span class="badge ${joined ? 'badge--joined' : 'badge--invited'}">${joined ? 'Signed in' : 'Invited'}</span>
              ${self ? '' : `<button class="link" data-remove="${esc(m)}">Remove</button>`}
            </li>`;
          })
          .join('')}
      </ul>
      <form id="hh-invite" class="invite">
        <input type="email" name="email" placeholder="Their Google account email" required autocomplete="off" />
        <button class="hh-button" type="submit">Invite</button>
      </form>
      <p class="muted small">An invite gives them every household app the next time they sign in with that account.</p>
      ${footer}`);
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
      inviteMember(db, h.id, input.value).then(() => (input.value = '')).catch(showError);
    });
    bindSignOut();
  }

  function bindSignOut() {
    root.querySelector('#hh-sign-out')?.addEventListener('click', async () => {
      await forgetSilentSignIn();
      await signOut(auth);
    });
  }

  function showError(e: unknown) {
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = e instanceof Error ? e.message : String(e);
    root.appendChild(p);
  }

  onAuthStateChanged(auth, (user) => {
    stopWatching?.();
    stopWatching = undefined;
    if (!user?.email) return renderSignedOut();
    const email = user.email;
    stopWatching = watchHousehold(db, email, (state) => {
      renderState(user, state);
      bindSignOut();
      if (state.status === 'ready') void markJoined(db, state.household as Household, email).catch(() => {});
    });
  });

  // Signs in without a click when the browser is signed in to Google and has used this site before.
  if (googleClientId) void signInSilently(auth, googleClientId);
}
