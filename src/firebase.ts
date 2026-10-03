import { initApp } from '@huishouden/pwa-kit/app';

// From VITE_FIREBASE_* build variables: CI sets them from repo variables; locally `bun run env:pull`.
// Auth, observability (the /privacy page), Google API tokens for the invite email, and Firestore with
// the persistent cache and the kit's outbox, like every app.
export const { app, auth, db, googleClientId, signInWithGoogle, signOutEverywhere } = initApp({ app: 'portal', env: import.meta.env });
