create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid references public.procurement_processes(id) on delete set null,
  supplier_id uuid not null references public.suppliers(id),
  contract_number text not null,
  document_type text not null default 'contract' check (document_type in ('contract','purchase_order')),
  title text not null,
  description text,
  total_value numeric(18,2) not null check (total_value >= 0),
  currency text not null default 'MZN',
  start_date date,
  end_date date,
  status text not null default 'draft' check (status in ('draft','pending_signature','active','completed','terminated','cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_number),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.contract_milestones (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  title text not null,
  due_date date not null,
  amount numeric(18,2) not null default 0 check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','in_progress','completed','overdue','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.contract_status_history (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now()
);

alter table public.contracts enable row level security;
alter table public.contract_milestones enable row level security;
alter table public.contract_status_history enable row level security;

drop policy if exists "members view contracts" on public.contracts;
create policy "members view contracts" on public.contracts for select
using (public.is_organization_member(organization_id));

drop policy if exists "contract team creates contracts" on public.contracts;
create policy "contract team creates contracts" on public.contracts for insert
with check (
  created_by = auth.uid() and exists (
    select 1 from public.organization_members m
    where m.organization_id = contracts.organization_id
      and m.user_id = auth.uid() and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer')
  )
);

drop policy if exists "contract team updates contracts" on public.contracts;
create policy "contract team updates contracts" on public.contracts for update
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = contracts.organization_id
      and m.user_id = auth.uid() and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer','finance')
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = contracts.organization_id
      and m.user_id = auth.uid() and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer','finance')
  )
);

drop policy if exists "members view milestones" on public.contract_milestones;
create policy "members view milestones" on public.contract_milestones for select
using (
  exists (
    select 1 from public.contracts c
    where c.id = contract_milestones.contract_id
      and public.is_organization_member(c.organization_id)
  )
);

drop policy if exists "contract team creates milestones" on public.contract_milestones;
create policy "contract team creates milestones" on public.contract_milestones for insert
with check (
  exists (
    select 1 from public.contracts c
    join public.organization_members m on m.organization_id = c.organization_id
    where c.id = contract_milestones.contract_id
      and m.user_id = auth.uid() and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer','finance')
  )
);

drop policy if exists "contract team updates milestones" on public.contract_milestones;
create policy "contract team updates milestones" on public.contract_milestones for update
using (
  exists (
    select 1 from public.contracts c
    join public.organization_members m on m.organization_id = c.organization_id
    where c.id = contract_milestones.contract_id
      and m.user_id = auth.uid() and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer','finance')
  )
);

drop policy if exists "members view contract history" on public.contract_status_history;
create policy "members view contract history" on public.contract_status_history for select
using (
  exists (
    select 1 from public.contracts c
    where c.id = contract_status_history.contract_id
      and public.is_organization_member(c.organization_id)
  )
);

create or replace function public.set_contract_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contract_updated_at on public.contracts;
create trigger contract_updated_at before update on public.contracts
for each row execute procedure public.set_contract_updated_at();

create or replace function public.record_contract_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.contract_status_history(contract_id, from_status, to_status, changed_by)
    values (new.id, case when tg_op = 'INSERT' then null else old.status end, new.status, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists contract_status_history on public.contracts;
create trigger contract_status_history
after insert or update of status on public.contracts
for each row execute procedure public.record_contract_status();
