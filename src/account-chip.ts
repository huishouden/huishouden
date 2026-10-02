import { onAuthStateChanged, signOut } from 'firebase/auth';
import { forgetSilentSignIn } from '@piekstra/pwa-kit/auth';
import { auth } from './firebase';

/**
 * Header avatar showing who is signed in: the Google profile photo (initial as fallback). Tapping it
 * shows the account and a sign-out button. Hidden while signed out.
 */
export function mountAccountChip(root: HTMLElement) {
  onAuthStateChanged(auth, (user) => {
    root.replaceChildren();
    root.hidden = !user;
    if (!user) return;

    const button = document.createElement('button');
    button.className = 'hh-avatar';
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-label', `Signed in as ${user.email ?? 'you'}`);
    button.title = user.email ?? '';
    if (user.photoURL) {
      const img = document.createElement('img');
      img.src = user.photoURL;
      img.alt = '';
      // Google profile photos refuse requests that carry a referrer from another site.
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.replaceWith(initial(user.displayName ?? user.email ?? '?'));
      button.append(img);
    } else {
      button.append(initial(user.displayName ?? user.email ?? '?'));
    }

    const menu = document.createElement('div');
    menu.className = 'hh-account-menu';
    menu.hidden = true;
    const who = document.createElement('p');
    who.textContent = user.email ?? '';
    const out = document.createElement('button');
    out.className = 'hh-button hh-button--quiet';
    out.textContent = 'Sign out';
    out.onclick = async () => {
      await forgetSilentSignIn();
      await signOut(auth);
    };
    menu.append(who, out);

    button.onclick = () => (menu.hidden = !menu.hidden);
    document.addEventListener('click', (e) => {
      if (!root.contains(e.target as Node)) menu.hidden = true;
    });
    root.append(button, menu);
  });
}

function initial(name: string) {
  const span = document.createElement('span');
  span.textContent = name.trim().charAt(0).toUpperCase();
  return span;
}
