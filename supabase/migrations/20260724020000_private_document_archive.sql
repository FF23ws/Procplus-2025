begin;
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  entity_type text not null check (entity_type in ('tender','supplier','contract','approval','organization','finance','compliance','payment','other')),
  entity_name text, reference text, expires_at date, file_name text not null,
  file_size bigint not null default 0 check (file_size >= 0), mime_type text,
  storage_path text not null unique, uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists documents_org_created_idx on public.documents(organization_id, created_at desc);
create index if not exists documents_reference_idx on public.documents(organization_id, reference);
create index if not exists documents_expiry_idx on public.documents(organization_id, expires_at);
alter table public.documents enable row level security;
drop policy if exists documents_member_read on public.documents;
create policy documents_member_read on public.documents for select to authenticated using (exists (select 1 from public.organization_members m where m.organization_id=documents.organization_id and m.user_id=auth.uid() and m.active));
drop policy if exists documents_member_insert on public.documents;
create policy documents_member_insert on public.documents for insert to authenticated with check (exists (select 1 from public.organization_members m where m.organization_id=documents.organization_id and m.user_id=auth.uid() and m.active));
drop policy if exists documents_member_delete on public.documents;
create policy documents_member_delete on public.documents for delete to authenticated using (exists (select 1 from public.organization_members m where m.organization_id=documents.organization_id and m.user_id=auth.uid() and m.active));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('procurement-documents','procurement-documents',false,20971520,array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','image/jpeg','image/png']) on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists procurement_documents_member_read on storage.objects;
create policy procurement_documents_member_read on storage.objects for select to authenticated using (bucket_id='procurement-documents' and exists (select 1 from public.organization_members m where m.organization_id::text=(storage.foldername(name))[1] and m.user_id=auth.uid() and m.active));
drop policy if exists procurement_documents_member_insert on storage.objects;
create policy procurement_documents_member_insert on storage.objects for insert to authenticated with check (bucket_id='procurement-documents' and exists (select 1 from public.organization_members m where m.organization_id::text=(storage.foldername(name))[1] and m.user_id=auth.uid() and m.active));
drop policy if exists procurement_documents_member_delete on storage.objects;
create policy procurement_documents_member_delete on storage.objects for delete to authenticated using (bucket_id='procurement-documents' and exists (select 1 from public.organization_members m where m.organization_id::text=(storage.foldername(name))[1] and m.user_id=auth.uid() and m.active));
grant select,insert,delete on public.documents to authenticated;
commit;
