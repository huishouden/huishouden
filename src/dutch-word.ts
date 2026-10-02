/**
 * <hh-word say="KHOO-duh-mor-khun" means="Good morning">Goedemorgen</hh-word>
 *
 * A Dutch word that explains itself on demand: hovering, focusing or tapping it opens a small card
 * with an English sound-alike, the meaning, and a button that says it aloud with the device's own
 * Dutch voice (Web Speech, offline, free). Nothing takes space until it's opened.
 */

const HINT = 'A Dutch "g" is a soft throaty sound, like the "ch" in Scottish "loch".';

let counter = 0;

export class HhWord extends HTMLElement {
  private card?: HTMLDivElement;
  private trigger?: HTMLButtonElement;

  connectedCallback() {
    if (this.trigger) return;
    const word = this.textContent?.trim() ?? '';
    const id = `hh-word-${++counter}`;
    this.textContent = '';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'hh-word__trigger';
    trigger.textContent = word;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', id);
    trigger.setAttribute('lang', 'nl');

    const card = document.createElement('div');
    card.className = 'hh-word__card';
    card.id = id;
    card.hidden = true;
    card.setAttribute('role', 'note');
    const say = this.getAttribute('say') ?? '';
    const means = this.getAttribute('means') ?? '';
    card.innerHTML = `
      <span class="hh-word__say"></span>
      <span class="hh-word__means"></span>
      ${/g/i.test(word) ? `<span class="hh-word__hint">${HINT}</span>` : ''}`;
    card.querySelector('.hh-word__say')!.textContent = `Say it: ${say}`;
    card.querySelector('.hh-word__means')!.textContent = `Means: ${means}`;

    if ('speechSynthesis' in window) {
      const listen = document.createElement('button');
      listen.type = 'button';
      listen.className = 'hh-word__listen';
      listen.innerHTML =
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg><span>Hear it</span>';
      listen.addEventListener('click', (e) => {
        e.stopPropagation();
        speak(word);
      });
      card.append(listen);
    }

    let pinned = false;
    const open = () => {
      card.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    };
    const close = () => {
      if (pinned) return;
      card.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    };
    trigger.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && open());
    this.addEventListener('pointerleave', (e) => e.pointerType === 'mouse' && close());
    trigger.addEventListener('focus', open);
    this.addEventListener('focusout', (e) => {
      if (!this.contains(e.relatedTarget as Node)) close();
    });
    // Tap (or click) pins it open until tapped again, tapped elsewhere, or Escape.
    trigger.addEventListener('click', () => {
      pinned = !pinned;
      if (pinned) open();
      else {
        card.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('click', (e) => {
      if (pinned && !this.contains(e.target as Node)) {
        pinned = false;
        close();
      }
    });
    this.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        pinned = false;
        close();
        trigger.focus();
      }
    });

    this.append(trigger, card);
    this.trigger = trigger;
    this.card = card;
  }
}

function speak(text: string) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'nl-NL';
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith('nl'));
  if (voice) utterance.voice = voice;
  utterance.rate = 0.85;
  synth.speak(utterance);
}

if (!customElements.get('hh-word')) customElements.define('hh-word', HhWord);
