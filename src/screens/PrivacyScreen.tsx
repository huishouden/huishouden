import { cardClass } from '@huishouden/pwa-kit/react/ui';
import { useEffect, useRef, type ReactNode } from 'react';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold text-stone-800">{title}</h2>
      {children}
    </section>
  );
}

/** What the apps collect and why, in plain words. Linked from every app's account menu. */
export function PrivacyScreen() {
  // A new page in the same document: name it and move focus to it, so screen readers announce it.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const before = document.title;
    document.title = 'Privacy · Huishouden';
    heading.current?.focus();
    return () => {
      document.title = before;
    };
  }, []);
  return (
    <article className={`${cardClass} mx-auto max-w-[720px] space-y-6 p-6 text-base leading-relaxed text-stone-800 sm:p-8`}>
      <header className="space-y-2">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold text-stone-800 outline-none">
          Privacy
        </h1>
        <p>Huishouden is a set of free apps for running a household. This is what they keep, what they send and why.</p>
      </header>

      <Section title="Your household's information">
        <p>
          What you add (lists, logs, bills, contacts, reminders) is stored in your household's own space and is visible only to the members of your
          household. It is never sold or used for advertising. Apps that read your Gmail or Calendar do so only after you
          allow it, from your own browser.
        </p>
      </Section>

      <Section title="What the apps send to help fix problems">
        <ul className="list-disc space-y-1 pl-6">
          <li>Errors: when something breaks, which app and version, and what failed, with addresses and ids taken out.</li>
          <li>Speed: how long screens take to load and respond.</li>
          <li>Anonymous usage counts: which screens and features are used, counted per visit.</li>
          <li>Your country and region (for example, a state), worked out from the connection. Your device type and browser.</li>
        </ul>
      </Section>

      <Section title="What they never send">
        <p>
          Your name, email address, your household or anything in it, anything you type, or your precise location. No cookies or stored ids are used for
          these reports, so nothing links one visit to the next, and nothing is used for advertising.
        </p>
      </Section>

      <Section title="If your browser asks not to be tracked">
        <p>
          When your browser sends Global Privacy Control (or Do Not Track), the apps don't send usage counts. Error and speed reports still go: they keep
          the apps working and contain nothing about you.
        </p>
      </Section>

      <Section title="Who provides the services">
        <ul className="list-disc space-y-1 pl-6">
          <li>Google Firebase: sign-in, your household's data, and hosting the apps.</li>
          <li>New Relic: the error, speed and usage reports, kept for a short time.</li>
          <li>Cloudflare: sending the notifications you turn on.</li>
          <li>Google (Gmail, Calendar, Contacts): only when you allow it, from your browser.</li>
        </ul>
      </Section>

      <p className="text-stone-600">
        The apps' code is public, including{' '}
        <a className="font-medium text-forest-700 underline underline-offset-4" href="https://github.com/huishouden/pwa-kit/blob/main/docs/observability.md">
          exactly what the reports contain
        </a>
        .
      </p>
    </article>
  );
}
