import { defineConfig } from 'vite';
import { pwaApp } from '@piekstra/pwa-kit/vite';

export default defineConfig({
  plugins: [
    pwaApp({
      name: 'Huishouden',
      description: 'One home screen for the household apps: spending, tasks and groceries.',
      themeColor: '#1f3a2e',
      backgroundColor: '#f6f1e7',
    }),
  ],
});
