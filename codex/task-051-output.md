# Task 051 Output

## Summary

Implemented the quote-to-project conversion workflow:

- Added joined project data to admin quote loading in `src/app/quotes/page.tsx`
- Added linked badges, linked project display, and a convert-to-project modal in `src/components/quotes-page-client.tsx`
- Added secure project conversion route in `src/app/api/admin/convert-quote-to-project/route.ts`
- Extended `QuoteRequest` typing in `src/types/database.ts` to include the linked project join

The conversion flow now:

- Shows a prominent convert button for won quotes without a linked project
- Pre-fills project name, address, and estimated income from the quote
- Creates or reuses the customer
- Generates the next `YYYY-NNN` job number
- Creates the project, seeds a current billing period, and links the quote to the project

## Verification

- Ran `npm run build`
- Build completed successfully
