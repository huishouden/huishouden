import { useCallback, useEffect, useState } from 'react';
import { AppBar } from '@huishouden/pwa-kit/react/app-bar';
import { SectionTabs, Toast, useToast, type Tab } from '@huishouden/pwa-kit/react/ui';
import { APPS, arrangeTiles, type PortalLayout } from './apps';
import { useLiveHub } from './data/live';
import { usePreview } from './data/preview';
import { isMember, type HubState } from './hub';
import { restoringMember } from './memberHint';
import { AppsScreen } from './screens/AppsScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { PRIVACY_PATH } from '@huishouden/pwa-kit/app-bar';
import { trackView } from '@huishouden/pwa-kit/observability';
import { useNow } from './now';

const VERSION = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_BUILD_SHA})`;

type TabId = 'today' | 'calendar' | 'contacts' | 'apps';
const TAB_IDS: TabId[] = ['today', 'calendar', 'contacts', 'apps'];

/**
 * Members get the tabs; everyone else sees Apps (signed out, with what Huishouden is). A device that
 * remembers a member gets them while sign-in restores, so a reload doesn't flash the introduction.
 */
function tabsFor(state: HubState): Tab[] {
  if (!isMember(state) && !restoringMember(state)) return [];
  return [
    { id: 'today', label: 'Today' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'apps', label: 'Apps' },
  ];
}

const onPrivacyPage = () => location.pathname.replace(/\/$/, '') === PRIVACY_PATH;

const tabFromPath = (): TabId | undefined => {
  const id = location.pathname.replace(/^\/|\/$/g, '');
  return TAB_IDS.find((t) => t === id);
};

export default function App() {
  const live = useLiveHub();
  const preview = usePreview();
  const { state, actions } = preview ?? live;
  const { toast, notify, fail, clear } = useToast();
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string>();
  const [chosen, setChosen] = useState<TabId | undefined>(tabFromPath);
  const [privacy, setPrivacy] = useState(onPrivacyPage);
  const now = useNow();
  const hour = new Date(now).getHours();

  // Members land on Today (the wall tablet's view); everyone else on Apps.
  const tabs = tabsFor(state);
  const tab: TabId = tabs.some((t) => t.id === chosen) ? chosen! : tabs.length ? 'today' : 'apps';

  // Someone who just started a household stays on Apps, where they invite the others.
  const householdStatus = state.auth === 'signed-in' ? state.household.status : undefined;
  const [lastStatus, setLastStatus] = useState(householdStatus);
  if (householdStatus !== lastStatus) {
    setLastStatus(householdStatus);
    if (lastStatus === 'none' && householdStatus === 'ready' && !chosen) setChosen('apps');
  }

  useEffect(() => {
    const onPop = () => {
      setChosen(tabFromPath());
      setPrivacy(onPrivacyPage());
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const shown = privacy ? 'privacy' : tab;
  useEffect(() => {
    trackView(shown);
  }, [shown]);

  const choose = (id: string) => {
    setChosen(id as TabId);
    setPrivacy(false);
    history.pushState(null, '', `/${id}`);
    window.scrollTo(0, 0);
  };

  const signIn = useCallback(async () => {
    setSigningIn(true);
    setSignInError(undefined);
    try {
      await actions.signIn();
    } catch (e) {
      setSignInError(e instanceof Error ? e.message : String(e));
    } finally {
      setSigningIn(false);
    }
  }, [actions]);

  const saveLayout = useCallback(
    (layout: PortalLayout, previous: PortalLayout) => {
      const save = (next: PortalLayout) => actions.saveLayout(next).catch((e) => fail(e instanceof Error ? e.message : String(e)));
      void save(layout);
      notify('Saved for everyone in the household.', () => void save(previous));
    },
    [actions, notify, fail],
  );

  const user = state.auth === 'starting' ? undefined : state.auth === 'signed-out' ? null : state.user;
  const ordered = arrangeTiles(APPS, state.layout).all;
  const signedIn = state.auth === 'signed-in' ? state : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-cream font-sans text-stone-800 antialiased">
      <AppBar app="Huishouden" glyph="home" portalUrl="/" version={VERSION} user={user} signingIn={signingIn} onSignIn={signIn} onSignOut={() => void actions.signOut()}>
        <SectionTabs tabs={tabs} tab={privacy ? '' : tab} onTab={choose} />
      </AppBar>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">
        {privacy && <PrivacyScreen />}
        {!privacy && tab === 'apps' && (
          <AppsScreen
            state={state}
            actions={actions}
            apps={APPS}
            hour={hour}
            signInError={signInError}
            onSignIn={signIn}
            onSaveLayout={saveLayout}
            notify={notify}
            fail={fail}
          />
        )}
        {tab === 'today' && (
          <TodayScreen
            agenda={signedIn?.agenda}
            apps={ordered}
            now={now}
            me={signedIn?.me}
            profiles={signedIn?.household.status === 'ready' ? signedIn.household.profiles : undefined}
          />
        )}
        {tab === 'calendar' && <CalendarScreen agenda={signedIn?.agenda} apps={ordered} now={now} />}
        {tab === 'contacts' && <ContactsScreen contacts={signedIn?.contacts} apps={ordered} actions={actions} notify={notify} fail={fail} />}
      </main>
      <footer className="mx-auto w-full max-w-[1200px] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm text-stone-600 sm:px-6">
        <a
          className="inline-flex min-h-11 items-center font-medium text-forest-700 underline-offset-4 hover:underline"
          href={PRIVACY_PATH}
          onClick={(e) => {
            e.preventDefault();
            history.pushState(null, '', PRIVACY_PATH);
            setPrivacy(true);
            window.scrollTo(0, 0);
          }}
        >
          Privacy
        </a>
      </footer>
      <Toast toast={toast} onDone={clear} />
    </div>
  );
}
