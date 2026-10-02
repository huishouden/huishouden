# Huishouden

The household's hub: one installable PWA with the day across every household app, the household's
calendar and contacts, and the apps themselves.

![Today on a tablet](docs/screenshots/today.png)

_Screenshots of the live site with invented data, refreshed by CI after each deploy._

| App | URL | Repo |
|---|---|---|
| Huishouden (this) | https://huishouden-piekstra.web.app | huishouden/portal |
| Every other app | `https://<site>.web.app` | `huishouden/<repo>`, listed in `apps.json` |

Every app follows [STANDARDS.md](STANDARDS.md). Each app is its own repo and its own Firebase Hosting site in project `huishouden-piekstra`.
Every app is listed once, in `apps.json`: the tiles come from it, `contactRoles` says which apps show
contacts (and the roles they offer), and `infra/apps.conf` reads it to provision hosting. Its order is
the default tile order: simple everyday apps first, Spending (which needs setup) after them, Baby (not
for every household) last.

## Tabs

Members of a household get four tabs; everyone else sees Apps, with what Huishouden is and how to start.

| Tab | Shows |
|---|---|
| Today (`/today`, members' default) | The wall-tablet glance: overdue things first, then today's, then the next two days, from every app's items in `households/{id}/agenda` (`@huishouden/pwa-kit/agenda`, `todayItems`); one line per app with what is overdue and coming up this week. Each item opens its app. |
| Calendar (`/calendar`) | Overdue items, then every day from today with something on it (`agendaDays`), filtered by app. |
| Contacts (`/contacts`) | Every household contact (`households/{id}/contacts`), whichever apps show it, grouped by role and tagged with its apps; added and edited with the kit's contact dialog. A new contact shows in no app (or in the app being filtered) until apps are chosen with Apps on its card. |
| Apps (`/apps`) | The Dutch greeting (the word explains itself on hover or tap), the tiles, and the household: start one, rename it, members with their own names and photos, invites with an email from the inviter's Gmail; and Food: who eats at home (every member, plus people without an account), their diets, allergies, foods to avoid and a note, and the kitchen basics recipes may assume, saved in `households/{id}/settings/food` (`@huishouden/pwa-kit/food`) for Tasks' meal ideas and later apps. |

![Calendar](docs/screenshots/calendar.png)
![Contacts](docs/screenshots/contacts.png)

## Tiles

A household's members can arrange its tiles (Arrange, under the tiles): move apps earlier or later,
or hide them. The layout is saved in `households/{id}/settings/portal` (`order` and `hidden`, app
repo names; rules in huishouden/rules), so every member sees it on every device. Apps the layout
doesn't mention, such as apps added later, follow the ordered ones in registry order. Hidden apps
stay one tap away under More apps. Signed-out visitors see the default.

![Arranging the apps](docs/screenshots/tiles-arrange.png)
![Food preferences](docs/screenshots/food.png)

## Code

React 19, Tailwind v4 and the kit's UI (`@huishouden/pwa-kit/react/*`). `src/data/live.ts` turns
sign-in and Firestore into one `HubState` (`src/hub.ts`) and the actions that change it; the screens
only render that state. Tests can't sign in to Google, so the smoke and screenshot tests hand the app
invented state with `window.__hubPreview(state)` (`src/data/preview.ts`, `e2e/fixtures/hub.ts`);
its actions then change only that state in the tab, never Firestore.

## Privacy

Household data lives in the household's own Firestore documents, visible only to its members.
To catch problems early, the app sends reports to New Relic (free tier) through
`@huishouden/pwa-kit/observability`: errors (emails, ids, query strings and long numbers removed),
Core Web Vitals and page loads, the app version, device type, and the country and region New Relic
derives from the request; and anonymous usage counts per visit: `create household`, `invite member`, `send invite email`, `arrange apps`, `add contact`, `save food preferences`, and which tab is open. Households are counted by a
hash of the id. No names, emails, entries, free text or precise location, and no cookie or stored
id: nothing links one visit to the next. When the browser sends Global Privacy Control or Do Not
Track, usage counts are skipped; errors and speed still go. Builds without the `VITE_NEWRELIC_*`
repo variables (local, staging) send nothing. The page people see is
[huishouden-piekstra.web.app/privacy](https://huishouden-piekstra.web.app/privacy); details in pwa-kit
[docs/observability.md](https://github.com/huishouden/pwa-kit/blob/main/docs/observability.md).

## Develop

```sh
bun install
bun run env:pull # the public Firebase web config, into .env.local
bun run dev      # http://localhost:3001
bun run lint && bun run test && bun run build
BASE_URL=http://localhost:4173 bun run e2e   # against `bun run preview`
bun run icons    # after editing public/icon.svg
```

## Deploy

Merges to `main` deploy through `.github/workflows/ci.yml` using Workload Identity
Federation (repo variables `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`). Pull requests only build.
