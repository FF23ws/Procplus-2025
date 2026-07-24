-- Procplus: permanent document repository with tenant isolation
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  entity_type text not null check (entity_type in ('tender','supplier','contract','approval','organization')),
  entity_name text,
  reference text,
  expires_at date,
  file_name text not null,
  file_size bigint not null default 0 check (file_size >= 0),
  storage_path text not null unique,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists documents_organization_id_idx
  on public.documents (organization_id, created_at desc);
create index if not exists documents_expires_at_idx
  on public.documents (organization_id, expires_at);

alter table public.documents enable row level security;

create or replace function public.procplus_is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and coalesce(m.active, true)
  );
$$;

revoke all on function public.procplus_is_organization_member(uuid) from public;
grant execute on function public.procplus_is_organization_member(uuid) to authenticated;

drop policy if exists "documents_select_for_members" on public.documents;
create policy "documents_select_for_members"
on public.documents for select
to authenticated
using (public.procplus_is_organization_member(organization_id));

drop policy if exists "documents_insert_for_members" on public.documents;
create policy "documents_insert_for_members"
on public.documents for insert
to authenticated
with check (
  public.procplus_is_organization_member(organization_id)
  and created_by = auth.uid()
);

drop policy if exists "documents_update_for_members" on public.documents;
create policy "documents_update_for_members"
on public.documents for update
to authenticated
using (public.procplus_is_organization_member(organization_id))
with check (public.procplus_is_organization_member(organization_id));

drop policy if exists "documents_delete_for_members" on public.documents;
create policy "documents_delete_for_members"
on public.documents for delete
to authenticated
using (public.procplus_is_organization_member(organization_id));

insert into storage.buckets (id, name, public, file_size_limit)
values ('procurement-documents', 'procurement-documents', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "document_objects_select_for_members" on storage.objects;
create policy "document_objects_select_for_members"
on storage.objects for select
to authenticated
using (
  bucket_id = 'procurement-documents'
  and public.procplus_is_organization_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "document_objects_insert_for_members" on storage.objects;
create policy "document_objects_insert_for_members"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'procurement-documents'
  and public.procplus_is_organization_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "document_objects_update_for_members" on storage.objects;
create policy "document_objects_update_for_members"
on storage.objects for update
to authenticated
using (
  bucket_id = 'procurement-documents'
  and public.procplus_is_organization_member(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'procurement-documents'
  and public.procplus_is_organization_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "document_objects_delete_for_members" on storage.objects;
create policy "document_objects_delete_for_members"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'procurement-documents'
  and public.procplus_is_organization_member(((storage.foldername(name))[1])::uuid)
);
