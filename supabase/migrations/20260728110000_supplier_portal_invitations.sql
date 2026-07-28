begin;

create table if not exists public.supplier_portal_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  email text not null,
  role text not null default 'primary_contact'
    check (role in ('primary_contact','contributor')),
  status text not null default 'pending'
    check (status in ('pending','accepted','cancelled','expired')),
  invited_by uuid not null default auth.uid() references public.profiles(id),
  invited_at timestamptz not null default now(),
  last_sent_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists supplier_portal_invitation_pending_email_idx
on public.supplier_portal_invitations(supplier_id, lower(email))
where status = 'pending';

create index if not exists supplier_portal_invitations_supplier_idx
on public.supplier_portal_invitations(supplier_id, created_at desc);

alter table public.supplier_portal_users
  add column if not exists last_access_at timestamptz;

alter table public.supplier_portal_invitations enable row level security;

drop policy if exists supplier_portal_invitations_internal_read on public.supplier_portal_invitations;
create policy supplier_portal_invitations_internal_read
on public.supplier_portal_invitations for select to authenticated
using (public.has_organization_role(
  organization_id,
  array['owner','admin','procurement_manager','procurement_officer','evaluator','auditor']
));

drop policy if exists supplier_portal_invitations_internal_manage on public.supplier_portal_invitations;
create policy supplier_portal_invitations_internal_manage
on public.supplier_portal_invitations for all to authenticated
using (public.has_organization_role(
  organization_id,
  array['owner','admin','procurement_manager','procurement_officer']
))
with check (public.has_organization_role(
  organization_id,
  array['owner','admin','procurement_manager','procurement_officer']
));

drop policy if exists supplier_portal_users_internal_manage on public.supplier_portal_users;
create policy supplier_portal_users_internal_manage
on public.supplier_portal_users for update to authenticated
using (public.has_organization_role(
  organization_id,
  array['owner','admin','procurement_manager','procurement_officer']
))
with check (public.has_organization_role(
  organization_id,
  array['owner','admin','procurement_manager','procurement_officer']
));

create or replace function public.claim_supplier_portal_access()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_count integer := 0;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Sessão de fornecedor inválida.';
  end if;

  update public.supplier_portal_invitations
  set status = 'expired'
  where status = 'pending' and expires_at <= now();

  insert into public.supplier_portal_users (
    organization_id, supplier_id, user_id, role, active, last_access_at
  )
  select invitation.organization_id, invitation.supplier_id, auth.uid(),
         invitation.role, true, now()
  from public.supplier_portal_invitations invitation
  where lower(invitation.email) = v_email
    and invitation.status = 'pending'
    and invitation.expires_at > now()
  on conflict (supplier_id, user_id) do update
  set role = excluded.role, active = true, last_access_at = now();

  get diagnostics v_count = row_count;

  update public.supplier_portal_invitations
  set status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  where lower(email) = v_email
    and status = 'pending'
    and expires_at > now();

  update public.supplier_portal_users
  set last_access_at = now()
  where user_id = auth.uid() and active;

  return v_count;
end;
$$;

grant select, insert, update on public.supplier_portal_invitations to authenticated;
grant update on public.supplier_portal_users to authenticated;
grant execute on function public.claim_supplier_portal_access() to authenticated;

commit;
