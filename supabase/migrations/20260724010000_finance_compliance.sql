begin;

create extension if not exists pgcrypto;

create table if not exists public.finance_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  donor text,
  funding_source text,
  base_currency text not null default 'MZN' check (base_currency in ('MZN','USD','EUR','ZAR')),
  approved_budget numeric(18,2) not null default 0 check (approved_budget >= 0),
  start_date date,
  end_date date,
  indirect_cost_rate numeric(7,4) not null default 0 check (indirect_cost_rate between 0 and 100),
  status text not null default 'active' check (status in ('draft','active','closed','suspended')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.finance_projects(id) on delete restrict,
  contract_id uuid references public.contracts(id) on delete set null,
  reference text not null,
  entry_type text not null check (entry_type in ('commitment','expense','advance','exchange_adjustment','indirect_cost','reversal')),
  description text not null,
  document_date date not null default current_date,
  amount numeric(18,2) not null check (amount >= 0),
  currency text not null default 'MZN' check (currency in ('MZN','USD','EUR','ZAR')),
  exchange_rate numeric(18,6) not null default 1 check (exchange_rate > 0),
  amount_mzn numeric(18,2) generated always as (round(amount * exchange_rate, 2)) stored,
  cost_category text,
  donor_line text,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','posted','cancelled')),
  notes text,
  created_by uuid default auth.uid(),
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference)
);

create table if not exists public.finance_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rate_date date not null,
  source_currency text not null,
  target_currency text not null default 'MZN',
  rate numeric(18,6) not null check (rate > 0),
  source text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  unique (organization_id, rate_date, source_currency, target_currency)
);

create table if not exists public.compliance_controls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid references public.procurement_processes(id) on delete cascade,
  contract_id uuid references public.contracts(id) on delete cascade,
  area text not null,
  control_name text not null,
  funding_source text,
  owner_role text,
  status text not null default 'pending' check (status in ('pending','compliant','alert','not_applicable')),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  evidence text,
  due_date date,
  verified_by uuid,
  verified_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.procplus_audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists finance_projects_org_idx on public.finance_projects(organization_id);
create index if not exists finance_entries_org_project_idx on public.finance_entries(organization_id, project_id);
create index if not exists finance_entries_date_idx on public.finance_entries(document_date desc);
create index if not exists finance_entries_status_idx on public.finance_entries(status);
create index if not exists exchange_rates_org_date_idx on public.finance_exchange_rates(organization_id, rate_date desc);
create index if not exists compliance_controls_org_idx on public.compliance_controls(organization_id);
create index if not exists compliance_controls_process_idx on public.compliance_controls(process_id);
create index if not exists compliance_controls_status_idx on public.compliance_controls(status, risk_level);
create index if not exists audit_events_org_date_idx on public.procplus_audit_events(organization_id, created_at desc);

alter table public.finance_projects enable row level security;
alter table public.finance_entries enable row level security;
alter table public.finance_exchange_rates enable row level security;
alter table public.compliance_controls enable row level security;
alter table public.procplus_audit_events enable row level security;

drop policy if exists finance_projects_member_access on public.finance_projects;
create policy finance_projects_member_access on public.finance_projects for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = finance_projects.organization_id and m.user_id = auth.uid() and m.active))
with check (exists (select 1 from public.organization_members m where m.organization_id = finance_projects.organization_id and m.user_id = auth.uid() and m.active));

drop policy if exists finance_entries_member_access on public.finance_entries;
create policy finance_entries_member_access on public.finance_entries for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = finance_entries.organization_id and m.user_id = auth.uid() and m.active))
with check (exists (select 1 from public.organization_members m where m.organization_id = finance_entries.organization_id and m.user_id = auth.uid() and m.active));

drop policy if exists finance_exchange_rates_member_access on public.finance_exchange_rates;
create policy finance_exchange_rates_member_access on public.finance_exchange_rates for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = finance_exchange_rates.organization_id and m.user_id = auth.uid() and m.active))
with check (exists (select 1 from public.organization_members m where m.organization_id = finance_exchange_rates.organization_id and m.user_id = auth.uid() and m.active));

drop policy if exists compliance_controls_member_access on public.compliance_controls;
create policy compliance_controls_member_access on public.compliance_controls for all to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = compliance_controls.organization_id and m.user_id = auth.uid() and m.active))
with check (exists (select 1 from public.organization_members m where m.organization_id = compliance_controls.organization_id and m.user_id = auth.uid() and m.active));

drop policy if exists audit_events_member_read on public.procplus_audit_events;
create policy audit_events_member_read on public.procplus_audit_events for select to authenticated
using (exists (select 1 from public.organization_members m where m.organization_id = procplus_audit_events.organization_id and m.user_id = auth.uid() and m.active));

create or replace function public.procplus_record_finance_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.procplus_audit_events(organization_id, actor_id, action, entity_type, entity_id, details)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id)::text,
    jsonb_build_object('before', case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end, 'after', case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end)
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists finance_projects_audit on public.finance_projects;
create trigger finance_projects_audit after insert or update or delete on public.finance_projects for each row execute function public.procplus_record_finance_audit();
drop trigger if exists finance_entries_audit on public.finance_entries;
create trigger finance_entries_audit after insert or update or delete on public.finance_entries for each row execute function public.procplus_record_finance_audit();
drop trigger if exists compliance_controls_audit on public.compliance_controls;
create trigger compliance_controls_audit after insert or update or delete on public.compliance_controls for each row execute function public.procplus_record_finance_audit();

create or replace view public.finance_project_summary with (security_invoker = true) as
select p.id, p.organization_id, p.code, p.name, p.donor, p.funding_source, p.base_currency,
       p.approved_budget,
       coalesce(sum(case when e.entry_type = 'commitment' and e.status in ('approved','posted') then e.amount_mzn else 0 end),0) as committed_mzn,
       coalesce(sum(case when e.entry_type in ('expense','advance','exchange_adjustment','indirect_cost') and e.status = 'posted' then e.amount_mzn else 0 end),0) as spent_mzn,
       p.approved_budget - coalesce(sum(case when e.entry_type in ('expense','advance','exchange_adjustment','indirect_cost') and e.status = 'posted' then e.amount_mzn else 0 end),0) as available_mzn
from public.finance_projects p
left join public.finance_entries e on e.project_id = p.id and e.status <> 'cancelled'
group by p.id;

grant select, insert, update, delete on public.finance_projects, public.finance_entries, public.finance_exchange_rates, public.compliance_controls to authenticated;
grant select on public.procplus_audit_events, public.finance_project_summary to authenticated;

commit;