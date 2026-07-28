begin;

create table if not exists public.supplier_portal_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'primary_contact' check (role in ('primary_contact','contributor')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (supplier_id, user_id)
);

create table if not exists public.supplier_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  document_type text not null check (document_type in (
    'registration','license','nuit','inss','bank','statutes','experience',
    'references','price_list','integrity','other'
  )),
  name text not null,
  storage_path text not null unique,
  expires_at date,
  review_status text not null default 'submitted'
    check (review_status in ('submitted','valid','rejected','expired')),
  review_notes text,
  uploaded_by uuid not null default auth.uid() references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz
);

create index if not exists supplier_portal_users_user_idx
on public.supplier_portal_users(user_id, active);
create index if not exists supplier_documents_supplier_idx
on public.supplier_documents(supplier_id, uploaded_at desc);

alter table public.supplier_portal_users enable row level security;
alter table public.supplier_documents enable row level security;

create or replace function public.is_supplier_portal_user(p_supplier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.supplier_portal_users spu
    where spu.supplier_id = p_supplier_id
      and spu.user_id = auth.uid()
      and spu.active
  );
$$;

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

  insert into public.supplier_portal_users (organization_id, supplier_id, user_id)
  select s.organization_id, s.id, auth.uid()
  from public.suppliers s
  where lower(s.email) = v_email
  on conflict (supplier_id, user_id) do update set active = true;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

drop policy if exists supplier_portal_users_own on public.supplier_portal_users;
create policy supplier_portal_users_own
on public.supplier_portal_users for select to authenticated
using (user_id = auth.uid() or public.has_organization_role(
  organization_id, array['owner','admin','procurement_manager','procurement_officer','evaluator','auditor']
));

drop policy if exists supplier_documents_read on public.supplier_documents;
create policy supplier_documents_read
on public.supplier_documents for select to authenticated
using (
  public.is_supplier_portal_user(supplier_id)
  or public.has_organization_role(
    organization_id, array['owner','admin','procurement_manager','procurement_officer','evaluator','auditor']
  )
);

drop policy if exists supplier_documents_portal_insert on public.supplier_documents;
create policy supplier_documents_portal_insert
on public.supplier_documents for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and public.is_supplier_portal_user(supplier_id)
  and exists (
    select 1 from public.suppliers s
    where s.id = supplier_id and s.organization_id = organization_id
  )
);

drop policy if exists supplier_documents_internal_manage on public.supplier_documents;
create policy supplier_documents_internal_manage
on public.supplier_documents for all to authenticated
using (public.has_organization_role(
  organization_id, array['owner','admin','procurement_manager','procurement_officer','evaluator']
))
with check (public.has_organization_role(
  organization_id, array['owner','admin','procurement_manager','procurement_officer','evaluator']
));

drop policy if exists suppliers_portal_read on public.suppliers;
create policy suppliers_portal_read
on public.suppliers for select to authenticated
using (public.is_supplier_portal_user(id));

drop policy if exists suppliers_portal_update on public.suppliers;
create policy suppliers_portal_update
on public.suppliers for update to authenticated
using (public.is_supplier_portal_user(id))
with check (public.is_supplier_portal_user(id));

create or replace function public.protect_supplier_assessment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_supplier_portal_user(old.id)
     and not public.has_organization_role(old.organization_id, array[
       'owner','admin','procurement_manager','procurement_officer','evaluator'
     ]) then
    new.organization_id := old.organization_id;
    new.supplier_code := old.supplier_code;
    new.status := old.status;
    new.risk_level := old.risk_level;
    new.score := old.score;
    new.prequalified_until := old.prequalified_until;
    new.notes := old.notes;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_supplier_assessment on public.suppliers;
create trigger protect_supplier_assessment
before update on public.suppliers
for each row execute function public.protect_supplier_assessment_fields();

drop policy if exists procurement_processes_supplier_portal_read on public.procurement_processes;
create policy procurement_processes_supplier_portal_read
on public.procurement_processes for select to authenticated
using (
  status in ('published','evaluation','awarded','closed')
  and exists (
    select 1 from public.supplier_portal_users spu
    where spu.organization_id = procurement_processes.organization_id
      and spu.user_id = auth.uid() and spu.active
  )
);

drop policy if exists procurement_bids_supplier_read on public.procurement_bids;
create policy procurement_bids_supplier_read
on public.procurement_bids for select to authenticated
using (public.is_supplier_portal_user(supplier_id));

drop policy if exists procurement_bids_supplier_insert on public.procurement_bids;
create policy procurement_bids_supplier_insert
on public.procurement_bids for insert to authenticated
with check (
  created_by = auth.uid()
  and public.is_supplier_portal_user(supplier_id)
  and exists (
    select 1 from public.procurement_processes p
    where p.id = process_id
      and p.organization_id = organization_id
      and p.status = 'published'
      and (p.deadline is null or p.deadline > now())
  )
);

create or replace function public.protect_supplier_bid_evaluation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_supplier_portal_user(new.supplier_id)
     and not public.has_organization_role(new.organization_id, array[
       'owner','admin','procurement_manager','procurement_officer','evaluator'
     ]) then
    new.compliance_status := 'pending';
    new.technical_score := null;
    new.financial_score := null;
    new.evaluation_notes := null;
    new.status := 'received';
    new.evaluated_by := null;
    new.evaluated_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_supplier_bid_evaluation on public.procurement_bids;
create trigger protect_supplier_bid_evaluation
before insert or update on public.procurement_bids
for each row execute function public.protect_supplier_bid_evaluation();

drop policy if exists contracts_supplier_portal_read on public.contracts;
create policy contracts_supplier_portal_read
on public.contracts for select to authenticated
using (public.is_supplier_portal_user(supplier_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'supplier-documents',
  'supplier-documents',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

drop policy if exists supplier_files_read on storage.objects;
create policy supplier_files_read
on storage.objects for select to authenticated
using (
  bucket_id = 'supplier-documents'
  and (
    public.is_supplier_portal_user((storage.foldername(name))[1]::uuid)
    or exists (
      select 1 from public.suppliers s
      where s.id = (storage.foldername(name))[1]::uuid
        and public.is_organization_member(s.organization_id)
    )
  )
);

drop policy if exists supplier_files_upload on storage.objects;
create policy supplier_files_upload
on storage.objects for insert to authenticated
with check (
  bucket_id = 'supplier-documents'
  and public.is_supplier_portal_user((storage.foldername(name))[1]::uuid)
);

grant select on public.supplier_portal_users to authenticated;
grant select, insert, update on public.supplier_documents to authenticated;
grant execute on function public.is_supplier_portal_user(uuid) to authenticated;
grant execute on function public.claim_supplier_portal_access() to authenticated;

commit;
