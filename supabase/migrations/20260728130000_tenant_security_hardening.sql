begin;

create table if not exists public.tenant_security_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  table_name text not null,
  record_id uuid,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  old_data jsonb,
  new_data jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists tenant_security_events_org_time_idx
on public.tenant_security_events(organization_id, occurred_at desc);

alter table public.tenant_security_events enable row level security;

drop policy if exists tenant_security_events_read on public.tenant_security_events;
create policy tenant_security_events_read
on public.tenant_security_events for select to authenticated
using (public.has_organization_role(
  organization_id,
  array['owner','admin','auditor']
));

revoke all on public.tenant_security_events from anon, authenticated;
grant select on public.tenant_security_events to authenticated;

create or replace function public.prevent_organization_reassignment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.organization_id is distinct from new.organization_id then
    raise exception 'Não é permitido transferir registos entre organizações.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.validate_core_tenant_relations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_related_org uuid;
begin
  if tg_table_name = 'procurement_bids' then
    select organization_id into v_related_org
    from public.procurement_processes where id = new.process_id;
    if v_related_org is distinct from new.organization_id then
      raise exception 'O concurso não pertence à organização da proposta.'
        using errcode = '23514';
    end if;
    select organization_id into v_related_org
    from public.suppliers where id = new.supplier_id;
    if v_related_org is distinct from new.organization_id then
      raise exception 'O fornecedor não pertence à organização da proposta.'
        using errcode = '23514';
    end if;
  elsif tg_table_name = 'contracts' then
    select organization_id into v_related_org
    from public.suppliers where id = new.supplier_id;
    if v_related_org is distinct from new.organization_id then
      raise exception 'O fornecedor não pertence à organização do contrato.'
        using errcode = '23514';
    end if;
    if new.process_id is not null then
      select organization_id into v_related_org
      from public.procurement_processes where id = new.process_id;
      if v_related_org is distinct from new.organization_id then
        raise exception 'O concurso não pertence à organização do contrato.'
          using errcode = '23514';
      end if;
    end if;
  elsif tg_table_name in (
    'supplier_portal_users',
    'supplier_documents',
    'supplier_portal_invitations'
  ) then
    select organization_id into v_related_org
    from public.suppliers where id = new.supplier_id;
    if v_related_org is distinct from new.organization_id then
      raise exception 'O fornecedor não pertence à organização indicada.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.record_tenant_security_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
begin
  insert into public.tenant_security_events (
    organization_id, actor_id, table_name, record_id, operation, old_data, new_data
  ) values (
    nullif(v_row->>'organization_id','')::uuid,
    auth.uid(),
    tg_table_name,
    nullif(v_row->>'id','')::uuid,
    tg_op,
    v_old,
    v_new
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'procurement_processes',
    'suppliers',
    'procurement_bids',
    'contracts',
    'supplier_portal_users',
    'supplier_documents',
    'supplier_portal_invitations'
  ]
  loop
    if to_regclass('public.' || v_table) is not null then
      execute format('drop trigger if exists %I on public.%I', v_table || '_tenant_lock', v_table);
      execute format(
        'create trigger %I before update on public.%I for each row execute function public.prevent_organization_reassignment()',
        v_table || '_tenant_lock', v_table
      );
      execute format('drop trigger if exists %I on public.%I', v_table || '_tenant_audit', v_table);
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function public.record_tenant_security_event()',
        v_table || '_tenant_audit', v_table
      );
    end if;
  end loop;
end;
$$;

drop trigger if exists procurement_bids_tenant_relations on public.procurement_bids;
create trigger procurement_bids_tenant_relations
before insert or update on public.procurement_bids
for each row execute function public.validate_core_tenant_relations();

drop trigger if exists contracts_tenant_relations on public.contracts;
create trigger contracts_tenant_relations
before insert or update on public.contracts
for each row execute function public.validate_core_tenant_relations();

drop trigger if exists supplier_portal_users_tenant_relations on public.supplier_portal_users;
create trigger supplier_portal_users_tenant_relations
before insert or update on public.supplier_portal_users
for each row execute function public.validate_core_tenant_relations();

drop trigger if exists supplier_documents_tenant_relations on public.supplier_documents;
create trigger supplier_documents_tenant_relations
before insert or update on public.supplier_documents
for each row execute function public.validate_core_tenant_relations();

drop trigger if exists supplier_portal_invitations_tenant_relations on public.supplier_portal_invitations;
create trigger supplier_portal_invitations_tenant_relations
before insert or update on public.supplier_portal_invitations
for each row execute function public.validate_core_tenant_relations();

revoke all on function public.prevent_organization_reassignment() from public;
revoke all on function public.validate_core_tenant_relations() from public;
revoke all on function public.record_tenant_security_event() from public;

commit;
