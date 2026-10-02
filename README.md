# Huishouden

The household's front door: one installable PWA that opens the other household apps.

![Huishouden portal on a tablet](docs/screenshots/home.png)

_Screenshot of the live site, refreshed by CI after each deploy._

| App | URL | Repo |
|---|---|---|
| Huishouden (this) | https://huishouden-piekstra.web.app | piekstra/huishouden |
| Spending | https://huishouden-spending.web.app | piekstra/huishouden-spending |
| Tasks & Groceries | https://huishouden-tasks.web.app | piekstra/household-tasks |

Every app follows [STANDARDS.md](STANDARDS.md). Each app is its own repo and its own Firebase Hosting site in project `huishouden-piekstra`.
Add or rename an app in `src/apps.ts`; set `live: true` once it is deployed.

## Develop

```sh
bun install
bun run dev      # http://localhost:3001
bun run lint && bun run build
bun run icons    # after editing public/icon.svg
```

## Deploy

Merges to `main` deploy through `.github/workflows/ci.yml` using Workload Identity
Federation (repo variables `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`). Pull requests only build.
