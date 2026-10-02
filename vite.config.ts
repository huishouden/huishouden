import { defineConfig } from 'vite';
import { pwaApp } from '@huishouden/pwa-kit/vite';

export default defineConfig({
  plugins: [
    pwaApp({
      name: 'Huishouden',
      description: "Your household's apps, together in one place",
      url: 'https://huishouden-piekstra.web.app',
      themeColor: '#1b4332',
      backgroundColor: '#faf9f5',
    }),
  ],
});
