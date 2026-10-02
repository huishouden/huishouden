import { defineConfig } from 'vite';
import { pwaApp } from '@huishouden/pwa-kit/vite';

export default defineConfig({
  plugins: [
    pwaApp({
      name: 'Huishouden',
      description: 'One home screen for the household apps: spending, tasks and groceries.',
      themeColor: '#1b4332',
      backgroundColor: '#faf9f5',
    }),
  ],
});
