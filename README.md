# SawariBuddy

Shared-auto platform connecting passengers with auto drivers.

- **Mobile** (passenger + driver): React Native, Expo, TypeScript
- **Admin**: Next.js, TypeScript
- **Backend**: Supabase (Postgres, Auth, Realtime, Edge Functions, Storage)

Status: Phase 0 — discovery and architecture. See the design docs as they are added.

## Design docs (Phase 0)

- [PROJECT_SPEC.md](PROJECT_SPEC.md) — product spec, business rules, edge cases, assumptions
- [ARCHITECTURE.md](ARCHITECTURE.md) — mobile (Android + iOS) / admin / Supabase architecture
- [DATABASE_DESIGN.md](DATABASE_DESIGN.md) — schema, RLS, booking concurrency, ledger
- [STATE_MACHINES.md](STATE_MACHINES.md) — trip, booking, driver availability, issues
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — phased plan, Phase 1 in detail
- [docs/reference/ui-concept.png](docs/reference/ui-concept.png) — initial UI concept
