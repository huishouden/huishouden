import { cardClass, primaryButton } from '@huishouden/pwa-kit/react/ui';

const STEPS = [
  'Sign in with your Google account.',
  'Start a household, or join the one you were invited to.',
  'Open any app. Add it to your home screen to keep it close.',
];

/** Signed out: what Huishouden is and how to start, kept short so the tiles stay the main thing. */
export function Intro({ onSignIn, error }: { onSignIn: () => void; error?: string }) {
  return (
    <section id="household" aria-label="About Huishouden" className={`${cardClass} grid gap-x-12 gap-y-4 p-6 md:grid-cols-2`}>
      <div>
        <h2 className="mb-3 text-xl font-semibold text-forest-700">Simple shared apps for running a home together</h2>
        <p className="mb-3">Huishouden keeps the everyday running of a home in one place, shared by everyone who lives there. It's free.</p>
        <p className="mb-3 text-sm text-stone-600">A household's information is visible only to its members.</p>
        <button type="button" className={primaryButton} onClick={onSignIn}>
          Sign in with Google
        </button>
        {error && (
          <p role="alert" className="mt-3 text-red-700">
            {error}
          </p>
        )}
      </div>
      <div>
        <h3 className="mb-3 font-semibold">How it works</h3>
        <ol className="grid gap-3 [counter-reset:step]">
          {STEPS.map((step) => (
            <li
              key={step}
              className="flex items-baseline gap-3 [counter-increment:step] before:inline-flex before:h-7 before:w-7 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-forest-50 before:text-sm before:font-semibold before:text-forest-700 before:content-[counter(step)]"
            >
              {step}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
