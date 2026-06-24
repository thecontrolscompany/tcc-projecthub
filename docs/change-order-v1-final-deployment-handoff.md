# Change Order V1 Final Deployment Handoff

The V1 change-order module is code-complete and validated locally. Final merge/deploy is still blocked until the two live Supabase migrations are applied and verified in production.

## 1. Files Changed Summary

### Migrations
- `supabase/migrations/053_change_order_v1_enum.sql`
- `supabase/migrations/054_change_order_v1_schema.sql`

### Types / Helpers
- `src/types/database.ts`
- `src/lib/change-orders/server.ts`

### API Routes
- `src/app/api/admin/change-orders/route.ts`
- `src/app/api/projects/[projectId]/change-orders/route.ts`
- `src/app/api/projects/[projectId]/change-orders/summary/route.ts`
- `src/app/api/change-orders/[id]/route.ts`
- `src/app/api/change-orders/[id]/status/route.ts`
- `src/app/api/change-orders/[id]/line-items/route.ts`
- `src/app/api/change-orders/[id]/attachments/route.ts`

### UI
- `src/components/project-modal/change-orders-section.tsx`

### Report
- `src/app/reports/change-order/[id]/page.tsx`

### Documentation
- `CONTINUITY.md`

## 2. Migration Application Instructions

Apply these migrations before final merge/deploy:

- `supabase/migrations/053_change_order_v1_enum.sql`
- `supabase/migrations/054_change_order_v1_schema.sql`

Preferred CLI path:

```bash
npx supabase db push
```

Fallback manual path:

1. Open the Supabase Dashboard.
2. Go to SQL Editor.
3. Run `053_change_order_v1_enum.sql`.
4. Then run `054_change_order_v1_schema.sql`.
5. Do not run them out of order.

## 3. Post-Migration SQL Validation Checklist

Run practical SQL checks after the migrations are applied:

- Confirm new columns exist on `change_orders`.
- Confirm these tables exist:
  - `project_change_order_sequences`
  - `change_order_status_history`
  - `change_order_line_items`
  - `change_order_attachments`
- Confirm `cor_number` is populated.
- Confirm `co_number` is populated.
- Confirm `sequence_number` is populated.
- Confirm no `combined` enum/status exists.
- Confirm per-project sequence uniqueness is enforced.
- Confirm the status history trigger works.
- Confirm line-item total recalculation works.
- Confirm legacy statuses were normalized.

Suggested checks:

```sql
select column_name
from information_schema.columns
where table_name = 'change_orders'
order by ordinal_position;

select to_regtype('public.co_status') as co_status_type;

select unnest(enum_range(null::public.co_status));

select *
from public.project_change_order_sequences
order by project_id;

select project_id, cor_number, co_number, sequence_number
from public.change_orders
order by project_id, sequence_number;

select change_order_id, previous_status, new_status, reason, changed_at
from public.change_order_status_history
order by changed_at desc
limit 25;
```

## 4. App Validation Checklist

Manual app test checklist:

- Open a project modal.
- Open Change Orders.
- Create a Draft quick-total COR.
- Confirm COR number appears.
- Create a detailed calculator COR.
- Add labor and material line items.
- Confirm requested total updates.
- Add attachment metadata.
- Mark a COR Submitted.
- Mark a COR Approved.
- Mark a COR Voided with reason.
- Mark a COR Superseded with linked replacement.
- Confirm voided/superseded rows remain visible.
- Confirm numbers are not reused.
- Open print report.
- Confirm customer-safe report fields.
- Confirm internal notes only show for internal users.

## 5. Commands Already Passing

These commands passed during validation:

```bash
npx tsc --noEmit
npm run build
```

Targeted ESLint passed for the feature files, with only the known non-blocking `<img>` warnings in the printable report.

## 6. Known Non-Blockers

- Full repo lint still has unrelated preexisting debt.
- The printable report has two non-blocking `<img>` warnings.
- Browser print remains the PDF path by design.

## 7. Final Release Status

- Code is ready for migration application and user testing.
- Final merge/deploy should wait until the live Supabase migrations are applied and post-migration checks pass.
- No additional feature work is recommended before testing.
