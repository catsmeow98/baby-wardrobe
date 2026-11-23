# Baby Wardrobe

A web app that tracks what a baby owns, plans what they will need for each size, and turns the gaps into a shopping list.
Stack: Next.js (TypeScript), Supabase (Postgres, auth, row-level security, storage), Tailwind CSS, Vercel.

## Status

This is build-plan **phase 1** (project setup, schema, authentication, row-level security) plus the core wardrobe
rules from phases 2 to 4, so they can be validated before any screens depend on them.

| Piece | State |
| --- | --- |
| Database schema, defaults, RLS, goal views, shopping functions, private photo bucket | Written and **tested** against Postgres 16 (`npm run test:db`) |
| Size, fit, goal and shopping rules in `src/lib/domain` | Written and **tested** (`npm run test:unit`), typechecked under `strict` |
| Next.js app: sign up, sign in, reset password, children page, route protection | Written, **not yet installed, built or run**. Expect to fix small compile or API issues on first `npm install && npm run build` |
| Closet, goals, shopping screens, photo upload | Not started (phases 2 to 4). The behavior is prototyped in the clickable prototype |
| Forecast, brand fit feedback, goal survey | Not started (phases 6 to 8). Prototyped; logic to be ported and validated |

The tests need no Supabase account. The database tests run the migrations on a plain local Postgres with a small stand-in
for Supabase's `auth` and `storage` schemas (`supabase/tests/00_supabase_stub.sql`).

## Setup

1. `cp .env.example .env.local`, then fill in your Supabase project URL and anon key.
2. Apply the schema to your project. With the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.
   Or paste the files in `supabase/migrations` into the SQL editor, in order.
3. In Supabase, Authentication > URL configuration, add `http://localhost:3000/auth/callback` (and your preview and
   production URLs) to the redirect allow-list.
4. `npm install`, then `npm run dev`.

Never put the service-role key in this app. Everything runs as the signed-in user, and row-level security does the protecting.

## Tests

- `npm run test:unit` runs the domain and redirect-safety tests with `tsx`.
- `npm run test:db` creates a throwaway database, applies the migrations, and runs `supabase/tests/10_rls_and_rules.test.sql`.
  It needs `psql` and a reachable Postgres 15 or newer (set `PGHOST`, `PGPORT`, `PGUSER`).

The database tests cover: signup creates a profile; defaults are read-only; one account cannot read, change, delete or
attach to another account's children, items, goals, shopping, receipts, photos or storage objects; signed-out users get
nothing; fit ranges cannot run backwards or cross size systems; goal progress and incoming quantities follow the rules;
partial deliveries never double count; deleting an account removes its data.

## Design decisions worth knowing

- **Sizes are grouped.** A range and its top size are the same size (3-6M = 6M, 6-9M = 9M, 9-12M = 12M, 12-18M = 18M,
  18-24M = 24M, 0-3M = 3M). Goals, fit ranges, filters and shopping use the group. An item keeps the exact tag label it was
  given (`size_labels`). This differs from the spec's single `label_size_id` into `sizes`.
- **Owned** quantity counts active and stored items that are not unusable and whose fit range includes the goal size.
  Pieces with an unknown fit never count. **Incoming** is ordered minus received on open orders for the same category and size.
  **Remaining** is `max(0, target - owned - incoming)`. Overall progress per size caps each goal at its target.
- **Receiving a delivery** is one database function (`receive_shopping_item`) that adds the inventory, writes a receipt and
  updates the order in a single transaction. It cannot receive more than is outstanding.
- **Photos** go in the private `wardrobe-photos` bucket under `{user_id}/...` and are shown through signed URLs.
- Each rating of brand fit (`inventory_items.fit_feedback`) is stored now so the forecast phases can use it later.
