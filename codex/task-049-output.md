# Task 049 Output

## Summary

Expanded analytics in:

- `src/app/admin/analytics/page.tsx`
- `src/app/api/admin/data/route.ts`

Implemented:

- Date range pills for 3, 6, 12, and 24 months
- Full-width billing trend chart with projected, actual billed, and backlog lines
- Project status breakdown donut chart
- PM workload horizontal bar chart
- Top customers by backlog horizontal bar chart
- Responsive chart layout updates and empty-state handling
- Analytics API support for `projectStatusBreakdown`, `pmWorkload`, and `topCustomers`

Also widened analytics API access to `ops_manager` alongside `admin`.

## Verification

- Ran `npm run build`
- Build completed successfully
