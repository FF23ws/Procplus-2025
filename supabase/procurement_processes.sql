create table if not exists public.procurement_processes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reference text not null,
  title text not null,
  description text,
  procurement_method text not null check (procurement_method in ('request_for_quotation','open_tender','restricted_tender','direct_award')),
  funding_source text not null check (funding_source in ('internal','eu','american_government','mozambique_government','international','other')),
  estimated_value numeric(18,2) not null check (estimated_value >= 0),
  currency text not null default 'MZN',
  deadline timestamptz,
  status text not null default 'draft' check (status in ('draft','pending_approval','published','evaluation','awarded','cancelled','closed')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, reference)
);

create table if not exists public.procurement_status_history (
  id uuid primary key default gen_random_uuid(),
  process_id uuid not null references public.procurement_processes(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now()
);

alter table public.procurement_processes enable row level security;
alter table public.procurement_status_history enable row level security;

drop policy if exists "members view procurement processes" on public.procurement_processes;
create policy "members view procurement processes"
on public.procurement_processes for select
using (public.is_organization_member(organization_id));

drop policy if exists "procurement team creates processes" on public.procurement_processes;
create policy "procurement team creates processes"
on public.procurement_processes for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.organization_members m
    where m.organization_id = procurement_processes.organization_id
      and m.user_id = auth.uid()
      and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer')
  )
);

drop policy if exists "procurement team updates processes" on public.procurement_processes;
create policy "procurement team updates processes"
on public.procurement_processes for update
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = procurement_processes.organization_id
      and m.user_id = auth.uid()
      and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer')
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = procurement_processes.organization_id
      and m.user_id = auth.uid()
      and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer')
  )
);

drop policy if exists "members view process history" on public.procurement_status_history;
create policy "members view process history"
on public.procurement_status_history for select
using (
  exists (
    select 1 from public.procurement_processes p
    where p.id = procurement_status_history.process_id
      and public.is_organization_member(p.organization_id)
  )
);

create or replace function public.set_procurement_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists procurement_process_updated_at on public.procurement_processes;
create trigger procurement_process_updated_at
before update on public.procurement_processes
for each row execute procedure public.set_procurement_updated_at();

create or replace function public.record_procurement_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.procurement_status_history(process_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'INSERT' then null else old.status end, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists procurement_process_status_history on public.procurement_processes;
create trigger procurement_process_status_history
after insert or update of status on public.procurement_processes
for each row execute procedure public.record_procurement_status();
