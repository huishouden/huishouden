import { useCallback, useEffect, useState } from 'react';
import { AppBar } from '@huishouden/pwa-kit/react/app-bar';
import { SectionTabs, Toast, useToast, type Tab } from '@huishouden/pwa-kit/react/ui';
import { APPS, arrangeTiles, type PortalLayout } from './apps';
import { useLiveHub } from './data/live';
import { usePreview } from './data/preview';
import { isMember, type HubState } from './hub';
import { AppsScreen } from './screens/AppsScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { ContactsScreen } from './screens/ContactsScreen';
import { TodayScreen } from './screens/TodayScreen';
import { useNow } from './now';

const VERSION = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_BUILD_SHA})`;

type TabId = 'today' | 'calendar' | 'contacts' | 'apps';
const TAB_IDS: TabId[] = ['today', 'calendar', 'contacts', 'apps'];

/** Members get the tabs; everyone else sees Apps (signed out, with what Huishouden is). */
function tabsFor(state: HubState): Tab[] {
  if (!isMember(state)) return [];
  return [
    { id: 'today', label: 'Today' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'contacts', label: 'Contacts' },
    { id: 'apps', label: 'Apps' },
  ];
}

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
    const onPop = () => setChosen(tabFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const choose = (id: string) => {
    setChosen(id as TabId);
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

  return (
    <div className="flex min-h-dvh flex-col bg-cream font-sans text-stone-800 antialiased">
      <AppBar app="Huishouden" glyph="home" portalUrl="/" version={VERSION} user={user} signingIn={signingIn} onSignIn={signIn} onSignOut={() => void actions.signOut()}>
        <SectionTabs tabs={tabs} tab={tab} onTab={choose} />
      </AppBar>
      <main className="mx-auto w-full max-w-[1200px] px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-8">
        {tab === 'apps' && (
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
        {tab === 'today' && state.auth === 'signed-in' && <TodayScreen agenda={state.agenda} apps={ordered} now={now} />}
        {tab === 'calendar' && state.auth === 'signed-in' && <CalendarScreen agenda={state.agenda} apps={ordered} now={now} />}
        {tab === 'contacts' && state.auth === 'signed-in' && (
          <ContactsScreen contacts={state.contacts} apps={ordered} actions={actions} notify={notify} fail={fail} />
        )}
      </main>
      <Toast toast={toast} onDone={clear} />
    </div>
  );
}
