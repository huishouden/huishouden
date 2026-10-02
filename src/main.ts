import { registerSW } from 'virtual:pwa-register';
import { APPS } from './apps';
import '@piekstra/pwa-kit/theme.css';
import './style.css';
import { mountHouseholdPanel } from './household-panel';

registerSW({ immediate: true });

function greeting(hour: number): string {
  if (hour < 12) return 'Goedemorgen';
  if (hour < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

document.getElementById('greeting')!.textContent = greeting(new Date().getHours());

const nav = document.getElementById('apps')!;
for (const app of APPS) {
  const tile = document.createElement(app.live ? 'a' : 'div');
  tile.className = app.live ? 'tile' : 'tile tile--soon';
  if (tile instanceof HTMLAnchorElement) tile.href = app.url;

  const icon = document.createElement('span');
  icon.className = 'tile__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = app.icon;

  const name = document.createElement('span');
  name.className = 'tile__name';
  name.textContent = app.name;

  const desc = document.createElement('span');
  desc.className = 'tile__desc';
  desc.textContent = app.live ? app.description : 'Coming soon';

  tile.append(icon, name, desc);
  nav.append(tile);
}

mountHouseholdPanel(document.getElementById('household')!);
