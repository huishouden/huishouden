import type { HouseholdApp, PortalLayout } from '../apps';
import { Greeting } from '../components/DutchWord';
import { FoodPanel } from '../components/FoodPanel';
import { HouseholdPanel } from '../components/HouseholdPanel';
import { Intro } from '../components/Intro';
import { Tiles } from '../components/Tiles';
import { can } from '@huishouden/pwa-kit/roles';
import { isMember, myRole, type HubActions, type HubState } from '../hub';

interface Props {
  state: HubState;
  actions: HubActions;
  apps: HouseholdApp[];
  hour: number;
  signInError?: string;
  onSignIn: () => void;
  onSaveLayout: (layout: PortalLayout, previous: PortalLayout) => void;
  notify: (message: string) => void;
  fail: (message: string) => void;
}

/** The apps in the household's order, and the household itself (or, signed out, what Huishouden is). */
export function AppsScreen({ state, actions, apps, hour, signInError, onSignIn, onSaveLayout, notify, fail }: Props) {
  const role = myRole(state);
  return (
    <div className="space-y-8">
      <Greeting hour={hour} />
      <Tiles apps={apps} layout={state.layout} canArrange={isMember(state) && can(role, 'change-settings')} onSave={onSaveLayout} />
      {state.auth === 'signed-out' && <Intro onSignIn={onSignIn} error={signInError} />}
      {state.auth === 'signed-in' && <HouseholdPanel state={state} actions={actions} notify={notify} fail={fail} />}
      {isMember(state) && <FoodPanel household={state.household} food={state.food} actions={actions} fail={fail} canEdit={can(role, 'change-settings')} />}
    </div>
  );
}
