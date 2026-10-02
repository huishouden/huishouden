import type { Household } from '@huishouden/pwa-kit/household';
import { inviteMailto, type Invitation } from '@huishouden/pwa-kit/invite';

export interface MemberProfile {
  name?: string;
  photoURL?: string;
}

export interface PanelMessage {
  kind: 'error' | 'notice';
  text: string;
}

/** Everything the household panel shows. `src/household-panel.ts` derives it from sign-in and Firestore. */
export type PanelView =
  /** Before sign-in is known: nothing yet, so members never glimpse the signed-out introduction. */
  | { status: 'starting' }
  | { status: 'signed-out'; message?: PanelMessage }
  | { status: 'loading'; me: string }
  | { status: 'error'; me: string; error: string }
  | { status: 'none'; me: string; suggestedName: string; creating?: boolean; message?: PanelMessage }
  | {
      status: 'ready';
      me: string;
      household: Pick<Household, 'id' | 'name' | 'members' | 'joined'>;
      profiles: Record<string, MemberProfile>;
      /** The invitation just made, offered for sending by email until dismissed. */
      invited?: Invitation;
      sending?: boolean;
      /** Move focus to the invite field (once, right after starting a household). */
      focusInvite?: boolean;
      message?: PanelMessage;
    };

/** Longest household name the panel accepts. */
export const MAX_NAME = 60;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * `<hh-household>`: the household panel's markup and its small bits of local state (the naming and
 * renaming forms). It holds no data and talks to nothing: set `view`, and it reports what the person
 * asked for as events (`hh-sign-in`, `hh-sign-out`, `hh-create`, `hh-rename`, `hh-invite`,
 * `hh-remove`, `hh-send-invite`, `hh-dismiss-invite`; `detail` carries the name or email). The
 * screenshot tests set `view` directly to show signed-in states without signing in.
 */
export class HhHousehold extends HTMLElement {
  #view: PanelView = { status: 'starting' };
  #naming = false;
  #renaming = false;

  get view() {
    return this.#view;
  }

  set view(next: PanelView) {
    const prev = this.#view;
    if (next.status !== 'none') this.#naming = false;
    if (next.status !== 'ready' || prev.status !== 'ready' || prev.household.id !== next.household.id) this.#renaming = false;
    this.#view = next;
    this.#render();
  }

  connectedCallback() {
    this.#render();
  }

  /** Empties the invite field after an invite went through. */
  clearInvite() {
    const input = this.querySelector<HTMLInputElement>('#hh-invite-email');
    if (input) input.value = '';
  }

  #emit(type: string, detail?: string) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  }

  /** Re-renders, keeping what was typed and where the cursor was. */
  #render() {
    const typed = new Map<string, string>();
    this.querySelectorAll<HTMLInputElement>('input[id]').forEach((i) => typed.set(i.id, i.value));
    const active = this.contains(document.activeElement) ? document.activeElement?.id : undefined;

    this.innerHTML = this.#html();
    this.classList.toggle('panel--intro', this.#view.status === 'signed-out');
    this.hidden = this.#view.status === 'starting';

    for (const [id, value] of typed) {
      const input = this.querySelector<HTMLInputElement>(`#${id}`);
      if (input) input.value = value;
    }
    if (active) this.querySelector<HTMLElement>(`#${active}`)?.focus();
    this.#bind();
  }

  #html(): string {
    const v = this.#view;
    if (v.status === 'starting') return '';
    const message = 'message' in v && v.message
      ? `<p class="${v.message.kind}" role="${v.message.kind === 'error' ? 'alert' : 'status'}">${esc(v.message.text)}</p>`
      : '';
    if (v.status === 'signed-out') return this.#intro() + message;
    const footer = `<p class="muted small">Signed in as ${esc(v.me)} · <button class="link" id="hh-sign-out">Sign out</button></p>`;
    if (v.status === 'loading') return `<h2>Household</h2><p class="muted">Loading…</p>${footer}`;
    if (v.status === 'error') return `<h2>Household</h2><p class="error">${esc(v.error)}</p>${footer}`;
    if (v.status === 'none') return this.#none(v) + message + footer;
    return this.#household(v) + message + footer;
  }

  #intro(): string {
    return `
      <div class="intro">
        <div class="intro__about">
          <h2>Simple shared apps for running a home together</h2>
          <p>Huishouden keeps the everyday running of a home in one place, shared by everyone who lives there. It's free.</p>
          <p class="muted small">A household's information is visible only to its members.</p>
          <button class="hh-button" id="hh-sign-in">Sign in with Google</button>
        </div>
        <div class="intro__how">
          <h3>How it works</h3>
          <ol class="steps">
            <li>Sign in with your Google account.</li>
            <li>Start a household, or join the one you were invited to.</li>
            <li>Open any app. Add it to your home screen to keep it close.</li>
          </ol>
        </div>
      </div>`;
  }

  #none(v: Extract<PanelView, { status: 'none' }>): string {
    const waiting = `<p class="muted small">Waiting for an invite? Ask a member to invite <strong>${esc(v.me)}</strong>.</p>`;
    if (!this.#naming) {
      return `
        <h2>Household</h2>
        <p>Start a household for the people you live with. You'll invite them next.</p>
        <p><button class="hh-button" id="hh-start">Start a household</button></p>
        ${waiting}`;
    }
    return `
      <h2>Start a household</h2>
      <form id="hh-create" class="name-form">
        <label for="hh-new-name">Name</label>
        <div class="name-form__row">
          <input id="hh-new-name" name="name" value="${esc(v.suggestedName)}" maxlength="${MAX_NAME}" required autocomplete="off" />
          <button class="hh-button" type="submit"${v.creating ? ' disabled' : ''}>${v.creating ? 'Starting…' : 'Start'}</button>
          <button class="hh-button hh-button--quiet" type="button" id="hh-create-cancel"${v.creating ? ' disabled' : ''}>Cancel</button>
        </div>
      </form>
      <p class="muted small">Only you are in it at first. You can rename it any time.</p>
      ${waiting}`;
  }

  #household(v: Extract<PanelView, { status: 'ready' }>): string {
    const h = v.household;
    const solo = h.members.length === 1;
    const head = this.#renaming
      ? `<form id="hh-rename-form" class="name-form">
          <label for="hh-rename-name">Household name</label>
          <div class="name-form__row">
            <input id="hh-rename-name" name="name" value="${esc(h.name)}" maxlength="${MAX_NAME}" required autocomplete="off" />
            <button class="hh-button" type="submit">Save</button>
            <button class="hh-button hh-button--quiet" type="button" id="hh-rename-cancel">Cancel</button>
          </div>
        </form>`
      : `<div class="panel__head"><h2>${esc(h.name)}</h2><button class="link small" id="hh-rename">Rename</button></div>`;
    const members = h.members
      .map((m) => {
        const joined = h.joined.includes(m);
        const self = m === v.me;
        const p = v.profiles[m];
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
      .join('');
    const invited = v.invited
      ? `<div class="invite-sent" role="status">
          <p>${esc(v.invited.to)} is invited. Let them know by email:</p>
          <div class="invite-sent__actions">
            <button class="hh-button" id="hh-send-invite"${v.sending ? ' disabled' : ''}>${v.sending ? 'Sending…' : 'Send invite email'}</button>
            <a class="link" href="${esc(inviteMailto(v.invited))}">Write it in my mail app</a>
            <button class="link" id="hh-dismiss-invite">Not now</button>
          </div>
          <p class="muted small">Sent from your Gmail. Google asks once to let Huishouden send email; it only sends invitations.</p>
        </div>`
      : '';
    return `
      ${head}
      <ul class="members">${members}</ul>
      ${invited}
      ${solo ? `<p>Invite the people you live with. They'll get every app when they sign in.</p>` : ''}
      <form id="hh-invite" class="invite">
        <input id="hh-invite-email" type="email" name="email" placeholder="Their Google account email" aria-label="Their Google account email" required autocomplete="off" />
        <button class="hh-button" type="submit">Invite</button>
      </form>
      ${solo ? '' : `<p class="muted small">An invite gives them every household app the next time they sign in with that account.</p>`}`;
  }

  #bind() {
    const on = (selector: string, type: string, handler: (e: Event) => void) =>
      this.querySelector(selector)?.addEventListener(type, handler);
    const v = this.#view;

    on('#hh-sign-in', 'click', () => this.#emit('hh-sign-in'));
    on('#hh-sign-out', 'click', () => this.#emit('hh-sign-out'));

    on('#hh-start', 'click', () => {
      this.#naming = true;
      this.#render();
      const input = this.querySelector<HTMLInputElement>('#hh-new-name')!;
      input.focus();
      input.select();
    });
    on('#hh-create-cancel', 'click', () => {
      this.#naming = false;
      this.#render();
      this.querySelector<HTMLElement>('#hh-start')?.focus();
    });
    on('#hh-create', 'submit', (e) => {
      e.preventDefault();
      const name = this.querySelector<HTMLInputElement>('#hh-new-name')!.value.trim();
      if (name) this.#emit('hh-create', name);
    });

    on('#hh-rename', 'click', () => {
      this.#renaming = true;
      this.#render();
      const input = this.querySelector<HTMLInputElement>('#hh-rename-name')!;
      input.focus();
      input.select();
    });
    const stopRenaming = () => {
      this.#renaming = false;
      this.#render();
      this.querySelector<HTMLElement>('#hh-rename')?.focus();
    };
    on('#hh-rename-cancel', 'click', stopRenaming);
    on('#hh-rename-form', 'keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape') stopRenaming();
    });
    on('#hh-rename-form', 'submit', (e) => {
      e.preventDefault();
      const name = this.querySelector<HTMLInputElement>('#hh-rename-name')!.value.trim();
      const current = v.status === 'ready' ? v.household.name : '';
      if (name && name !== current) this.#emit('hh-rename', name);
      stopRenaming();
    });

    on('#hh-invite', 'submit', (e) => {
      e.preventDefault();
      this.#emit('hh-invite', this.querySelector<HTMLInputElement>('#hh-invite-email')!.value);
    });
    on('#hh-send-invite', 'click', () => this.#emit('hh-send-invite'));
    on('#hh-dismiss-invite', 'click', () => this.#emit('hh-dismiss-invite'));
    this.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((b) =>
      b.addEventListener('click', () => {
        const email = b.dataset.remove!;
        const name = v.status === 'ready' ? v.household.name : 'the household';
        if (confirm(`Remove ${email} from ${name}? They lose access to every household app.`)) this.#emit('hh-remove', email);
      }),
    );

    if (v.status === 'ready' && v.focusInvite) this.querySelector<HTMLInputElement>('#hh-invite-email')?.focus();
  }
}

customElements.define('hh-household', HhHousehold);

declare global {
  interface HTMLElementTagNameMap {
    'hh-household': HhHousehold;
  }
}
