import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { forgetSilentSignIn } from '@huishouden/pwa-kit/auth';
import '@huishouden/pwa-kit/app-bar';
import { auth } from './firebase';

/** The kit's Huishouden app bar: shows who is signed in; sign-in and sign-out happen here. */
export function mountAppBar(bar: HTMLElementTagNameMap['hh-app-bar']) {
  bar.version = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_BUILD_SHA})`;
  onAuthStateChanged(auth, (user) => (bar.user = user));
  bar.addEventListener('hh-sign-in', async () => {
    bar.signingIn = true;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') console.warn('Sign-in failed', e);
    } finally {
      bar.signingIn = false;
    }
  });
  bar.addEventListener('hh-sign-out', async () => {
    await forgetSilentSignIn();
    await signOut(auth);
  });
}
