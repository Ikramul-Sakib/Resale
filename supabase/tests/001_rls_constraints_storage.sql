begin;

select plan(12);

create temporary table test_context (
  user_a uuid not null,
  user_b uuid not null,
  scan_a uuid not null,
  scan_b uuid not null,
  item_a uuid not null
) on commit drop;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, recovery_token,
  email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'rls-user-a@example.test', '', now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'rls-user-b@example.test', '', now(), '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.scans (id, user_id, status, source)
values
  ('10000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1', 'uploaded', 'upload'),
  ('10000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'uploaded', 'upload');

insert into public.identified_items (id, scan_id, user_id, name)
values (
  '20000000-0000-0000-0000-0000000000a1',
  '10000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a1',
  'RLS test item'
);

insert into test_context (user_a, user_b, scan_a, scan_b, item_a)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000b1',
  '10000000-0000-0000-0000-0000000000a1',
  '10000000-0000-0000-0000-0000000000b1',
  '20000000-0000-0000-0000-0000000000a1'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.scans'::regclass),
  true,
  'RLS is enabled on scans'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1"}',
  true
);

select is(
  (select count(*)::integer from public.scans),
  1,
  'user A can read only user A scans'
);

select throws_ok(
  $$insert into public.scans (user_id, status, source)
    values ('00000000-0000-0000-0000-0000000000b1', 'uploaded', 'upload')$$,
  '42501',
  'new row violates row-level security policy for table "scans"',
  'user A cannot insert a scan owned by user B'
);

select lives_ok(
  $$update public.scans set status = 'failed'
    where id = '10000000-0000-0000-0000-0000000000b1'$$,
  'user A cannot update user B scan rows'
);

select lives_ok(
  $$delete from public.scans where id = '10000000-0000-0000-0000-0000000000b1'$$,
  'user A cannot delete user B scan rows'
);

set local role postgres;
select is(
  (select status from public.scans where id = '10000000-0000-0000-0000-0000000000b1'),
  'uploaded',
  'cross-user update did not modify user B scan'
);
select is(
  (select count(*)::integer from public.scans where id = '10000000-0000-0000-0000-0000000000b1'),
  1,
  'cross-user delete did not remove user B scan'
);

select throws_ok(
  $$insert into public.price_estimates (
      identified_item_id, scan_id, user_id, low, typical, high, currency
    ) values (
      '20000000-0000-0000-0000-0000000000a1',
      '10000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000a1',
      100, 90, 120, 'BDT'
    )$$,
  '23514',
  'new row for relation "price_estimates" violates check constraint "price_estimates_ordered_range"',
  'price estimate rejects low greater than typical'
);

select throws_ok(
  $$insert into public.price_estimates (
      identified_item_id, scan_id, user_id, low, typical, high, currency
    ) values (
      '20000000-0000-0000-0000-0000000000a1',
      '10000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000a1',
      50, 120, 90, 'BDT'
    )$$,
  '23514',
  'new row for relation "price_estimates" violates check constraint "price_estimates_ordered_range"',
  'price estimate rejects typical greater than high'
);

insert into storage.objects (id, bucket_id, name, owner_id, metadata)
values (
  gen_random_uuid(),
  'product-images',
  '00000000-0000-0000-0000-0000000000b1/other-user.png',
  '00000000-0000-0000-0000-0000000000b1',
  '{"mimetype":"image/png","size":4}'::jsonb
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1"}',
  true
);

select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'product-images'
      and name = '00000000-0000-0000-0000-0000000000b1/other-user.png'
  ),
  0,
  'user A cannot read user B product images'
);

select throws_ok(
  $$insert into storage.objects (id, bucket_id, name, owner_id, metadata)
    values (
      gen_random_uuid(),
      'product-images',
      '00000000-0000-0000-0000-0000000000b1/forbidden.png',
      '00000000-0000-0000-0000-0000000000a1',
      '{"mimetype":"image/png","size":4}'::jsonb
    )$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'user A cannot write into user B product-image folder'
);

set local role postgres;
select is(
  (select count(*)::integer from public.categories),
  3,
  'reference categories are seeded for development'
);

select * from finish();
rollback;
