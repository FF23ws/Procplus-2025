-- Procplus read-only security audit. This script changes no data.
with public_tables as (
  select c.relname as table_name, c.relrowsecurity as rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
),
rls_gaps as (
  select jsonb_agg(table_name order by table_name) as items
  from public_tables
  where not rls_enabled
    and table_name not in ('spatial_ref_sys')
),
anonymous_policies as (
  select jsonb_agg(jsonb_build_object(
    'table', tablename,
    'policy', policyname,
    'command', cmd
  ) order by tablename, policyname) as items
  from pg_policies
  where schemaname = 'public'
    and ('anon' = any(roles) or 'public' = any(roles))
),
unsafe_definers as (
  select jsonb_agg(p.proname order by p.proname) as items
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, array[]::text[])) setting
      where setting like 'search_path=%'
    )
),
public_buckets as (
  select jsonb_agg(id order by id) as items
  from storage.buckets
  where public
)
select jsonb_build_object(
  'status', case
    when coalesce(jsonb_array_length(rls_gaps.items), 0) = 0
     and coalesce(jsonb_array_length(anonymous_policies.items), 0) = 0
     and coalesce(jsonb_array_length(unsafe_definers.items), 0) = 0
     and coalesce(jsonb_array_length(public_buckets.items), 0) = 0
    then 'PASS' else 'REVIEW_REQUIRED' end,
  'rls_disabled_tables', coalesce(rls_gaps.items, '[]'::jsonb),
  'anonymous_policies', coalesce(anonymous_policies.items, '[]'::jsonb),
  'security_definer_without_search_path', coalesce(unsafe_definers.items, '[]'::jsonb),
  'public_storage_buckets', coalesce(public_buckets.items, '[]'::jsonb)
) as procplus_security_audit
from rls_gaps, anonymous_policies, unsafe_definers, public_buckets;
