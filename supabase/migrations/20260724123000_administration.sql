-- Procplus administration: funding rules and audit trail
create table if not exists public.funding_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  funding_source text not null,
  threshold numeric(18,2) not null default 0,
  currency text not null default 'MZN',
  quotations_required integer not null default 3 check (quotations_required between 0 and 10),
  approval_levels integer not null default 1 check (approval_levels between 1 and 5),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid default auth.uid() references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- Compatibility with earlier Procplus funding_rules schemas.
alter table public.funding_rules add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table public.funding_rules add column if not exists name text;
alter table public.funding_rules add column if not exists funding_source text;
alter table public.funding_rules add column if not exists threshold numeric(18,2) default 0;
alter table public.funding_rules add column if not exists currency text default 'MZN';
alter table public.funding_rules add column if not exists quotations_required integer default 3;
alter table public.funding_rules add column if not exists approval_levels integer default 1;
alter table public.funding_rules add column if not exists active boolean default true;
alter table public.funding_rules add column if not exists created_by uuid references auth.users(id);
alter table public.funding_rules add column if not exists created_at timestamptz default now();

alter table public.funding_rules enable row level security;
alter table public.audit_logs enable row level security;
create index if not exists funding_rules_org_idx on public.funding_rules(organization_id,active);
create index if not exists audit_logs_org_idx on public.audit_logs(organization_id,created_at desc);
drop policy if exists "funding_rules_member_read" on public.funding_rules;
create policy "funding_rules_member_read" on public.funding_rules for select to authenticated using (public.procplus_is_organization_member(organization_id));
drop policy if exists "funding_rules_admin_write" on public.funding_rules;
create policy "funding_rules_admin_write" on public.funding_rules for all to authenticated using (public.procplus_is_organization_member(organization_id)) with check (public.procplus_is_organization_member(organization_id) and created_by=auth.uid());
drop policy if exists "audit_logs_member_read" on public.audit_logs;
create policy "audit_logs_member_read" on public.audit_logs for select to authenticated using (public.procplus_is_organization_member(organization_id));
drop policy if exists "audit_logs_member_insert" on public.audit_logs;
create policy "audit_logs_member_insert" on public.audit_logs for insert to authenticated with check (public.procplus_is_organization_member(organization_id) and actor_id=auth.uid());
create or replace function public.log_funding_rule_change() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,details)
  values(coalesce(new.organization_id,old.organization_id),auth.uid(),case when tg_op='INSERT' then 'Regra criada' when tg_op='UPDATE' then 'Regra actualizada' else 'Regra removida' end,'funding_rule',coalesce(new.id,old.id)::text,jsonb_build_object('operation',tg_op));
  return coalesce(new,old);
end; $$;
drop trigger if exists funding_rule_audit on public.funding_rules;
create trigger funding_rule_audit after insert or update or delete on public.funding_rules for each row execute function public.log_funding_rule_change();
