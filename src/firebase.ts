import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { firebaseConfigFromEnv } from '@huishouden/pwa-kit/firebase';
import { initFirestore } from '@huishouden/pwa-kit/firestore';
import { configureGoogleTokens } from '@huishouden/pwa-kit/google-token';
import { startObservability } from '@huishouden/pwa-kit/observability';

// Error, speed and anonymous usage reports (the /privacy page); off without VITE_NEWRELIC_*.
startObservability({ app: 'portal', env: import.meta.env });

// From VITE_FIREBASE_* build variables: CI sets them from repo variables; locally `bun run env:pull`.
export const app = initializeApp(firebaseConfigFromEnv(import.meta.env));
export const auth = getAuth(app);
// Persistent cache, like every app: the portal opens with the last data offline. Writes come from
// @huishouden/pwa-kit/firestore, so one made just before the app closes is kept.
export const db = initFirestore(app, { auth });
export const googleClientId: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;
// The invite email's Gmail token comes from Google Identity Services with this OAuth client, not from Firebase sign-in.
configureGoogleTokens({ clientId: googleClientId });
