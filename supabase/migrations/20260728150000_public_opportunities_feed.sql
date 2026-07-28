begin;

alter table public.procurement_processes
  add column if not exists visibility text not null default 'registered'
    check (visibility in ('public','registered','prequalified','invited','internal')),
  add column if not exists category text,
  add column if not exists location text,
  add column if not exists show_estimated_value boolean not null default false,
  add column if not exists published_at timestamptz;

create index if not exists procurement_public_feed_idx
on public.procurement_processes(visibility, status, deadline, published_at desc);

create table if not exists public.procurement_process_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.procurement_processes(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  invited_by uuid not null default auth.uid() references public.profiles(id),
  invited_at timestamptz not null default now(),
  unique(process_id, supplier_id)
);

alter table public.procurement_process_invitations enable row level security;

create policy procurement_process_invitations_internal_manage
on public.procurement_process_invitations for all to authenticated
using (public.has_organization_role(
  organization_id, array['owner','admin','procurement_manager','procurement_officer']
))
with check (public.has_organization_role(
  organization_id, array['owner','admin','procurement_manager','procurement_officer']
));

create policy procurement_process_invitations_supplier_read
on public.procurement_process_invitations for select to authenticated
using (public.is_supplier_portal_user(supplier_id));

grant select, insert, update, delete on public.procurement_process_invitations to authenticated;

create or replace function public.set_procurement_publication_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists procurement_publication_date on public.procurement_processes;
create trigger procurement_publication_date
before insert or update of status on public.procurement_processes
for each row execute function public.set_procurement_publication_date();

update public.procurement_processes
set published_at = coalesce(published_at, created_at)
where status in ('published','evaluation','awarded','closed')
  and published_at is null;

create or replace function public.list_public_procurement_opportunities()
returns table (
  id uuid,
  organization_name text,
  reference text,
  title text,
  description text,
  procurement_method text,
  funding_source text,
  category text,
  location text,
  estimated_value numeric,
  currency text,
  deadline timestamptz,
  status text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    o.name,
    p.reference,
    p.title,
    p.description,
    p.procurement_method,
    p.funding_source,
    p.category,
    p.location,
    case when p.show_estimated_value then p.estimated_value else null end,
    case when p.show_estimated_value then p.currency else null end,
    p.deadline,
    p.status,
    coalesce(p.published_at, p.created_at)
  from public.procurement_processes p
  join public.organizations o on o.id = p.organization_id
  where p.visibility = 'public'
    and p.status in ('published','evaluation','awarded','closed')
  order by
    case when p.status = 'published' and (p.deadline is null or p.deadline > now()) then 0 else 1 end,
    coalesce(p.published_at, p.created_at) desc;
$$;

revoke all on function public.list_public_procurement_opportunities() from public;
grant execute on function public.list_public_procurement_opportunities() to anon, authenticated;

drop policy if exists procurement_processes_supplier_portal_read on public.procurement_processes;
create policy procurement_processes_supplier_portal_read
on public.procurement_processes for select to authenticated
using (
  status in ('published','evaluation','awarded','closed')
  and exists (
    select 1
    from public.supplier_portal_users spu
    join public.suppliers supplier on supplier.id = spu.supplier_id
    where spu.organization_id = procurement_processes.organization_id
      and spu.user_id = auth.uid()
      and spu.active
      and (
        procurement_processes.visibility in ('public','registered')
        or (
          procurement_processes.visibility = 'prequalified'
          and supplier.status = 'prequalified'
          and (supplier.prequalified_until is null or supplier.prequalified_until >= current_date)
        )
        or (
          procurement_processes.visibility = 'invited'
          and exists (
            select 1 from public.procurement_process_invitations invitation
            where invitation.process_id = procurement_processes.id
              and invitation.supplier_id = spu.supplier_id
          )
        )
      )
  )
);

commit;
