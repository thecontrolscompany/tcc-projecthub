# Task 031 Output

- Added [supabase/migrations/010_quote_requests.sql](/c:/Users/TimothyCollins/dev/tcc-projecthub/supabase/migrations/010_quote_requests.sql) for the `quote_requests` table and RLS. This migration was not run.
- Added `QuoteRequestStatus` and `QuoteRequest` in [src/types/database.ts](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/types/database.ts).
- Replaced the `/quotes` stub in [src/app/quotes/page.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/quotes/page.tsx) with a server-routed admin/public workflow backed by [src/components/quotes-page-client.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/quotes-page-client.tsx).
- Added public submit API in [src/app/api/quotes/submit/route.ts](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/api/quotes/submit/route.ts) and admin update API in [src/app/api/quotes/update/route.ts](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/app/api/quotes/update/route.ts).
- Updated [src/components/sidebar-nav.tsx](/c:/Users/TimothyCollins/dev/tcc-projecthub/src/components/sidebar-nav.tsx) so Quotes is visible to `admin` and `customer`.
- `npm run build` completed successfully.
