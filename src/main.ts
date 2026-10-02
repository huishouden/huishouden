import { registerSW } from 'virtual:pwa-register';
import '@huishouden/pwa-kit/theme.css';
import './style.css';
import './dutch-word';
import './household-view';
import './tiles-view';
import { mountHouseholdPanel } from './household-panel';
import { mountAppBar } from './app-bar';
import { mountTiles } from './tiles-panel';

registerSW({ immediate: true });

/** The greeting is Dutch; each word explains itself on hover or tap (src/dutch-word.ts). */
const GREETINGS = [
  { until: 12, word: 'Goedemorgen', say: 'KHOO-duh-mor-khun', means: 'Good morning' },
  { until: 18, word: 'Goedemiddag', say: 'KHOO-duh-mid-dahkh', means: 'Good afternoon' },
  { until: 24, word: 'Goedenavond', say: 'KHOO-duh-nah-vont', means: 'Good evening' },
];

function renderGreeting(hour: number) {
  const g = GREETINGS.find((x) => hour < x.until)!;
  const el = document.createElement('hh-word');
  el.setAttribute('say', g.say);
  el.setAttribute('means', g.means);
  el.textContent = g.word;
  document.getElementById('greeting')!.replaceChildren(el);
}

renderGreeting(new Date().getHours());

const tiles = mountTiles(document.querySelector('hh-tiles')!);
mountHouseholdPanel(document.querySelector('hh-household')!, tiles);
mountAppBar(document.querySelector('hh-app-bar')!);
