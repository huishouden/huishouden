import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Volume2 } from 'lucide-react';

const HINT = 'A Dutch "g" is a soft throaty sound, like the "ch" in Scottish "loch".';

/**
 * A Dutch word that explains itself on demand: hovering, focusing or tapping it opens a small card
 * with an English sound-alike, the meaning, and a button that says it aloud with the device's own
 * Dutch voice (Web Speech, offline, free). Nothing takes space until it's opened. Tap pins it open
 * until tapped again, tapped elsewhere, or Escape.
 */
export function DutchWord({ word, say, means }: { word: string; say: string; means: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!pinned) return;
    const onClick = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [pinned]);

  const close = () => {
    if (!pinned) setOpen(false);
  };

  return (
    <span
      ref={root}
      className="relative inline-block"
      onPointerLeave={(e) => e.pointerType === 'mouse' && close()}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node)) close();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setPinned(false);
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        lang="nl"
        aria-expanded={open}
        aria-controls={id}
        className="cursor-help rounded-md underline decoration-current/30 decoration-dotted decoration-2 underline-offset-[6px]"
        onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)}
        onFocus={() => setOpen(true)}
        onClick={() => {
          const next = !pinned;
          setPinned(next);
          setOpen(next);
        }}
      >
        {word}
      </button>
      <span
        id={id}
        role="note"
        hidden={!open}
        className="absolute top-[calc(100%+8px)] left-0 z-30 w-max max-w-[min(320px,80vw)] flex-col gap-1.5 rounded-xl bg-white px-4 py-3.5 text-base leading-snug font-normal text-stone-800 shadow-xl [&:not([hidden])]:flex"
      >
        <span className="font-semibold text-forest-700">Say it: {say}</span>
        <span>Means: {means}</span>
        {/g/i.test(word) && <span className="text-sm text-stone-600">{HINT}</span>}
        {canSpeak && (
          <button
            type="button"
            className="mt-1 inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-forest-50 px-3.5 font-semibold text-forest-700 hover:bg-forest-100"
            onClick={(e) => {
              e.stopPropagation();
              speak(word);
            }}
          >
            <Volume2 size={18} aria-hidden="true" /> Hear it
          </button>
        )}
      </span>
    </span>
  );
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

/** The greeting is Dutch; the word explains itself on hover or tap. */
const GREETINGS = [
  { until: 12, word: 'Goedemorgen', say: 'KHOO-duh-mor-khun', means: 'Good morning' },
  { until: 18, word: 'Goedemiddag', say: 'KHOO-duh-mid-dahkh', means: 'Good afternoon' },
  { until: 24, word: 'Goedenavond', say: 'KHOO-duh-nah-vont', means: 'Good evening' },
];

/** `compact`: smaller on phones, where Today's items should start as high as possible. */
export function Greeting({ hour, compact, children }: { hour: number; compact?: boolean; children?: ReactNode }) {
  const g = GREETINGS.find((x) => hour < x.until)!;
  return (
    <h2 className={`${compact ? 'text-2xl sm:text-[clamp(1.75rem,4vw,2.25rem)]' : 'text-[clamp(1.75rem,4vw,2.25rem)]'} font-bold text-forest-700`}>
      <DutchWord word={g.word} say={g.say} means={g.means} />
      {children}
    </h2>
  );
}
