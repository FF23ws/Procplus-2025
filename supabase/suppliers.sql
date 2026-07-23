create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_code text not null,
  legal_name text not null,
  trading_name text,
  nuit text,
  email text not null,
  phone text not null,
  address text,
  country_code text not null default 'MZ',
  supplier_type text not null default 'company' check (supplier_type in ('company','individual','ngo')),
  categories text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','under_review','prequalified','rejected','suspended','expired')),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high')),
  score numeric(5,2) not null default 0 check (score between 0 and 100),
  prequalified_until date,
  notes text,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, supplier_code)
);

create unique index if not exists suppliers_organization_nuit_unique
on public.suppliers (organization_id, nuit)
where nuit is not null;

create table if not exists public.supplier_status_history (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  from_status text,
  to_status text not null,
  score numeric(5,2),
  risk_level text,
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now()
);

alter table public.suppliers enable row level security;
alter table public.supplier_status_history enable row level security;

drop policy if exists "members view suppliers" on public.suppliers;
create policy "members view suppliers" on public.suppliers for select
using (public.is_organization_member(organization_id));

drop policy if exists "procurement team creates suppliers" on public.suppliers;
create policy "procurement team creates suppliers" on public.suppliers for insert
with check (
  created_by = auth.uid() and exists (
    select 1 from public.organization_members m
    where m.organization_id = suppliers.organization_id
      and m.user_id = auth.uid() and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer')
  )
);

drop policy if exists "procurement team updates suppliers" on public.suppliers;
create policy "procurement team updates suppliers" on public.suppliers for update
using (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = suppliers.organization_id
      and m.user_id = auth.uid() and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer','evaluator')
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.organization_id = suppliers.organization_id
      and m.user_id = auth.uid() and m.active
      and m.role in ('owner','admin','procurement_manager','procurement_officer','evaluator')
  )
);

drop policy if exists "members view supplier history" on public.supplier_status_history;
create policy "members view supplier history" on public.supplier_status_history for select
using (
  exists (
    select 1 from public.suppliers s
    where s.id = supplier_status_history.supplier_id
      and public.is_organization_member(s.organization_id)
  )
);

create or replace function public.set_supplier_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists supplier_updated_at on public.suppliers;
create trigger supplier_updated_at before update on public.suppliers
for each row execute procedure public.set_supplier_updated_at();

create or replace function public.record_supplier_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.supplier_status_history(supplier_id, from_status, to_status, score, risk_level, changed_by)
    values (new.id, case when tg_op = 'INSERT' then null else old.status end, new.status, new.score, new.risk_level, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_status_history on public.suppliers;
create trigger supplier_status_history
after insert or update of status on public.suppliers
for each row execute procedure public.record_supplier_status();
