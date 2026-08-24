-- Persist typed product-family metadata across outbox workers and retries.
alter table public.execute_notification_outbox add column if not exists product_family text check(product_family is null or product_family in('furnishing','hpm','guidebook_studio','investment_intelligence'));
create index if not exists execute_notification_outbox_product_family_idx on public.execute_notification_outbox(product_family,delivery_status,created_at);
