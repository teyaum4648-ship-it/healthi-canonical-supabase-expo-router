begin;
select plan(6);

select ok((select relrowsecurity from pg_class where oid = 'public.canonical_product_cache'::regclass), 'canonical product cache has RLS enabled');
select ok(not has_table_privilege('anon', 'public.canonical_product_cache', 'select'), 'anonymous clients cannot read canonical product cache');
select ok(not has_table_privilege('authenticated', 'public.canonical_product_cache', 'select'), 'authenticated clients cannot read canonical product cache directly');
select ok(not has_table_privilege('authenticated', 'public.canonical_product_cache', 'insert'), 'authenticated clients cannot write canonical product cache');
select ok(has_table_privilege('service_role', 'public.canonical_product_cache', 'select'), 'service role can read canonical product cache');
select ok(has_table_privilege('service_role', 'public.canonical_product_cache', 'insert'), 'service role can write canonical product cache');

select * from finish();
rollback;
