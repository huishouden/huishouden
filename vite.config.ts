import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { pwaApp } from '@huishouden/pwa-kit/vite';
import registry from './apps.json';

// The apps under their own paths on this site (pwa-kit docs/one-site.md): the portal's worker
// leaves navigations there to the network, so a tile never opens the portal instead of the app.
const otherApps = registry.flatMap((app: { path?: string }) => (app.path && app.path !== '/' ? [app.path] : []));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    pwaApp({
      base: '/',
      otherApps,
      name: 'Huishouden',
      description: "Your household's apps, together in one place",
      url: 'https://huishouden-piekstra.web.app/',
      // Contacts → Share → Huishouden on Android: a contact card becomes a household contact.
      shareTarget: { contacts: true },
      themeColor: '#1b4332',
      backgroundColor: '#faf9f5',
    }),
  ],
});
