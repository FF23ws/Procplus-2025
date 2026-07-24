begin;

create table if not exists public.contract_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  issuance_deadline date not null,
  organization_signed_by uuid references public.profiles(id),
  organization_signatory_name text,
  organization_signed_at timestamptz,
  organization_evidence_reference text,
  supplier_signatory_name text,
  supplier_signed_at timestamptz,
  supplier_evidence_reference text,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id)
);

alter table public.contract_signatures enable row level security;

drop policy if exists contract_signatures_read on public.contract_signatures;
create policy contract_signatures_read on public.contract_signatures
for select to authenticated
using (public.is_organization_member(organization_id));

create or replace function public.open_contract_signature_package()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer;
begin
  if new.status = 'pending_signature'
    and old.status is distinct from new.status
  then
    v_days := case when new.document_type = 'purchase_order' then 1 else 5 end;
    insert into public.contract_signatures(
      organization_id, contract_id, issuance_deadline
    ) values (
      new.organization_id, new.id, public.add_business_days(current_date, v_days)
    ) on conflict (contract_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists contract_open_signature_package on public.contracts;
create trigger contract_open_signature_package
after update of status on public.contracts
for each row execute function public.open_contract_signature_package();

create or replace function public.guard_contract_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active'
    and old.status is distinct from new.status
    and not exists (
      select 1 from public.contract_signatures s
      where s.contract_id = new.id
        and s.organization_signed_at is not null
        and s.supplier_signed_at is not null
    )
  then
    raise exception 'São necessárias as assinaturas da organização e do fornecedor.';
  end if;
  return new;
end;
$$;

drop trigger if exists contract_activation_requires_signatures on public.contracts;
create trigger contract_activation_requires_signatures
before update of status on public.contracts
for each row execute function public.guard_contract_activation();

create or replace function public.record_contract_signature(
  p_contract_id uuid,
  p_party text,
  p_signatory_name text,
  p_evidence_reference text
)
returns public.contract_signatures
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.contracts;
  v_signature public.contract_signatures;
  v_allowed boolean;
begin
  if p_party not in ('organization','supplier') then raise exception 'Parte signatária inválida.'; end if;
  if nullif(trim(p_signatory_name), '') is null then raise exception 'Indique o nome do signatário.'; end if;
  if nullif(trim(p_evidence_reference), '') is null then raise exception 'Indique a referência do comprovativo.'; end if;

  select * into v_contract from public.contracts where id = p_contract_id for update;
  if v_contract.id is null then raise exception 'Documento contratual não encontrado.'; end if;
  if v_contract.status <> 'pending_signature' then raise exception 'O documento não está na fase de assinatura.'; end if;

  select public.has_organization_role(
    v_contract.organization_id,
    array['owner','admin','procurement_manager','procurement_officer','approver']
  ) into v_allowed;
  if not v_allowed then raise exception 'Não tem permissão para registar assinaturas.'; end if;

  select * into v_signature from public.contract_signatures
  where contract_id = p_contract_id for update;
  if v_signature.id is null then raise exception 'Pacote de assinatura não encontrado.'; end if;

  if p_party = 'organization' then
    if v_signature.organization_signed_at is not null then
      raise exception 'A assinatura da organização já foi registada.';
    end if;
    update public.contract_signatures set
      organization_signed_by = auth.uid(),
      organization_signatory_name = trim(p_signatory_name),
      organization_signed_at = now(),
      organization_evidence_reference = trim(p_evidence_reference),
      updated_at = now()
    where id = v_signature.id returning * into v_signature;
  else
    if v_signature.supplier_signed_at is not null then
      raise exception 'A assinatura do fornecedor já foi registada.';
    end if;
    update public.contract_signatures set
      supplier_signatory_name = trim(p_signatory_name),
      supplier_signed_at = now(),
      supplier_evidence_reference = trim(p_evidence_reference),
      updated_at = now()
    where id = v_signature.id returning * into v_signature;
  end if;

  if v_signature.organization_signed_at is not null
    and v_signature.supplier_signed_at is not null
  then
    update public.contract_signatures set activated_at = now(), updated_at = now()
    where id = v_signature.id returning * into v_signature;
    update public.contracts set
      status = 'active',
      start_date = coalesce(start_date, current_date)
    where id = p_contract_id;
  end if;
  return v_signature;
end;
$$;

revoke all on function public.record_contract_signature(uuid,text,text,text) from public;
grant execute on function public.record_contract_signature(uuid,text,text,text) to authenticated;

commit;
