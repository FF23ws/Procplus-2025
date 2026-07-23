alter table public.profiles add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

create unique index if not exists profiles_email_lower_idx
on public.profiles (lower(email))
where email is not null;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.organization_role not null default 'viewer',
  status text not null default 'pending' check (status in ('pending','accepted','cancelled')),
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (organization_id, email)
);

alter table public.organization_invitations enable row level security;

create or replace function public.is_organization_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and active
  );
$$;

create or replace function public.can_manage_organization(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and active
      and role in ('owner','admin')
  );
$$;

drop policy if exists "member organizations" on public.organizations;
drop policy if exists "manage organizations" on public.organizations;
create policy "member organizations" on public.organizations
for select using (public.is_organization_member(id));
create policy "manage organizations" on public.organizations
for update using (public.can_manage_organization(id))
with check (public.can_manage_organization(id));

drop policy if exists "member memberships" on public.organization_members;
drop policy if exists "organization memberships visible" on public.organization_members;
drop policy if exists "organization memberships manageable" on public.organization_members;
create policy "organization memberships visible" on public.organization_members
for select using (public.is_organization_member(organization_id));
create policy "organization memberships manageable" on public.organization_members
for update using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

drop policy if exists "organization profiles visible" on public.profiles;
create policy "organization profiles visible" on public.profiles
for select using (
  id = auth.uid() or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs
      on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid()
      and mine.active
      and theirs.user_id = profiles.id
      and theirs.active
  )
);

drop policy if exists "organization invitations visible" on public.organization_invitations;
drop policy if exists "organization invitations manageable" on public.organization_invitations;
create policy "organization invitations visible" on public.organization_invitations
for select using (public.can_manage_organization(organization_id));
create policy "organization invitations manageable" on public.organization_invitations
for all using (public.can_manage_organization(organization_id))
with check (public.can_manage_organization(organization_id));

create or replace function public.invite_organization_member(
  p_organization_id uuid,
  p_email text,
  p_role public.organization_role
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user uuid;
begin
  if not public.can_manage_organization(p_organization_id) then
    raise exception 'Sem permissão para gerir esta organização';
  end if;

  select id into target_user
  from public.profiles
  where lower(email) = lower(trim(p_email));

  if target_user is not null then
    insert into public.organization_members (organization_id, user_id, role, active)
    values (p_organization_id, target_user, p_role, true)
    on conflict (organization_id, user_id)
    do update set role = excluded.role, active = true;

    update public.organization_invitations
    set status = 'accepted'
    where organization_id = p_organization_id
      and lower(email) = lower(trim(p_email));

    return jsonb_build_object('status','added');
  end if;

  insert into public.organization_invitations
    (organization_id, email, role, invited_by)
  values
    (p_organization_id, lower(trim(p_email)), p_role, auth.uid())
  on conflict (organization_id, email)
  do update set role = excluded.role, status = 'pending', invited_by = auth.uid(), created_at = now();

  return jsonb_build_object('status','pending');
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles(id, full_name, email)
  values(new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email)
  on conflict (id) do update set email = excluded.email;

  insert into public.organization_members (organization_id, user_id, role, active)
  select organization_id, new.id, role, true
  from public.organization_invitations
  where lower(email) = lower(new.email) and status = 'pending'
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invitations
  set status = 'accepted'
  where lower(email) = lower(new.email) and status = 'pending';

  return new;
end;
$$;
