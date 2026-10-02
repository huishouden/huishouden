import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfigFromEnv } from '@huishouden/pwa-kit/firebase';
import { configureGoogleTokens } from '@huishouden/pwa-kit/google-token';

// From VITE_FIREBASE_* build variables: CI sets them from repo variables; locally `bun run env:pull`.
export const app = initializeApp(firebaseConfigFromEnv(import.meta.env));
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleClientId: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;
// The invite email's Gmail token comes from Google Identity Services with this OAuth client, not from Firebase sign-in.
configureGoogleTokens({ clientId: googleClientId });
