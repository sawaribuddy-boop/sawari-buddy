# SawariBuddy

Shared-auto platform connecting passengers with auto drivers: **one mobile app for Android and iPhone** (passenger + driver modes), an internal admin web dashboard, and a Supabase backend.

| Part | Tech |
|---|---|
| `apps/mobile` | Expo SDK 57, React Native 0.86, TypeScript (Android + iOS) |
| `apps/admin` | Next.js 16, TypeScript |
| `supabase/` | Postgres 17 migrations, RLS, RPCs, pgTAP tests, seed |
| `packages/*` | shared `constants`, `types`, `domain`, `validation` |

**Status:** Phase 1 (booking engine + skeletons) is implemented. No production UI yet.

## Requirements

- **Node.js 22 LTS**: pinned in [.nvmrc](.nvmrc). With nvm: `nvm install && nvm use`. Other majors are rejected by `engine-strict`.
- **pnpm 10.34.5** via Corepack: `corepack enable`. The version comes from `packageManager` in `package.json`.
- **Docker** (Docker Desktop or Colima) for the local Supabase stack.
- **Testing the app on phones:** Expo Go on a physical Android phone / iPhone, or the Android emulator / iOS Simulator (Android Studio / Xcode).

## Run locally

```bash
nvm use                      # Node 22
corepack enable              # pnpm 10.34.5
pnpm install
pnpm db:start                # local Supabase on ports 55321-55324; applies migrations + seed
pnpm db:test                 # pgTAP database tests
pnpm test                    # unit + concurrency tests (needs db:start)
pnpm typecheck
pnpm mobile                  # Expo dev server (scan the QR with Expo Go)
pnpm admin                   # admin skeleton on http://localhost:3100
```

- `pnpm db:reset` rebuilds the local database from the migrations and seed.
- `pnpm db:types` regenerates `packages/types/src/database.ts`.
- `pnpm db:stop` stops the stack.
- Local Studio is at http://127.0.0.1:55323.

**Seeded local accounts** (password `SawariDev#2026`, local only):

| Role | Accounts |
|---|---|
| Admin | `admin@sawaribuddy.local` |
| Drivers | `raj.kumar@`, `suresh@`, `imran@` (all `@sawaribuddy.local`) |
| Passengers | `priya@`, `neha@`, `rahul@` (all `@sawaribuddy.local`) |

Secrets are never committed. Copy [.env.example](.env.example) to `.env.local` and fill in values from `pnpm exec supabase status`.

## Design docs

- [PROJECT_SPEC.md](PROJECT_SPEC.md): product spec, business rules, edge cases, assumptions
- [ARCHITECTURE.md](ARCHITECTURE.md): mobile (Android + iOS) / admin / Supabase architecture
- [DATABASE_DESIGN.md](DATABASE_DESIGN.md): schema, RLS, booking concurrency, ledger
- [STATE_MACHINES.md](STATE_MACHINES.md): trip, booking, driver availability, issues
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): phases and status
- [docs/reference/ui-concept.png](docs/reference/ui-concept.png): initial UI concept
