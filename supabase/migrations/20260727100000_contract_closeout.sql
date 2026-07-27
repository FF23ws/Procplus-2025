begin;

create table if not exists public.contract_closeouts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  final_acceptance_reference text not null,
  physical_archive_reference text not null,
  digital_archive_reference text not null,
  documents_complete boolean not null default false,
  payment_proofs_archived boolean not null default false,
  assets_registered boolean not null default false,
  assets_not_applicable boolean not null default false,
  closeout_notes text,
  closed_by uuid not null references public.profiles(id),
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (contract_id),
  check (assets_registered or assets_not_applicable)
);

alter table public.contract_closeouts enable row level security;

drop policy if exists contract_closeouts_read on public.contract_closeouts;
create policy contract_closeouts_read on public.contract_closeouts
for select to authenticated
using (public.is_organization_member(organization_id));

create or replace function public.close_contract(
  p_contract_id uuid,
  p_final_acceptance_reference text,
  p_physical_archive_reference text,
  p_digital_archive_reference text,
  p_documents_complete boolean,
  p_payment_proofs_archived boolean,
  p_assets_registered boolean,
  p_assets_not_applicable boolean,
  p_notes text default null
)
returns public.contract_closeouts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.contracts;
  v_closeout public.contract_closeouts;
  v_allowed boolean;
begin
  select * into v_contract from public.contracts where id = p_contract_id for update;
  if v_contract.id is null then raise exception 'Contrato não encontrado.'; end if;
  if v_contract.status <> 'active' then raise exception 'Apenas contratos activos podem ser encerrados.'; end if;

  select public.has_organization_role(
    v_contract.organization_id,
    array['owner','admin','procurement_manager']
  ) into v_allowed;
  if not v_allowed then raise exception 'Não tem permissão para encerrar este contrato.'; end if;

  if not exists (
    select 1 from public.contract_deliveries d where d.contract_id = p_contract_id
  ) then raise exception 'Registe pelo menos uma entrega ou certificado de conclusão.'; end if;
  if exists (
    select 1 from public.contract_milestones m
    where m.contract_id = p_contract_id and m.status not in ('completed','cancelled')
  ) then raise exception 'Existem entregas ou marcos ainda pendentes.'; end if;
  if not exists (
    select 1 from public.supplier_invoices i where i.contract_id = p_contract_id
  ) then raise exception 'Registe e liquide a factura antes do fecho.'; end if;
  if exists (
    select 1 from public.supplier_invoices i
    where i.contract_id = p_contract_id and i.status <> 'paid'
  ) then raise exception 'Existem facturas ainda não pagas.'; end if;

  if nullif(trim(p_final_acceptance_reference), '') is null then
    raise exception 'Indique a referência da aceitação final.';
  end if;
  if nullif(trim(p_physical_archive_reference), '') is null
    or nullif(trim(p_digital_archive_reference), '') is null
  then raise exception 'Indique as referências dos arquivos físico e digital.'; end if;
  if not p_documents_complete or not p_payment_proofs_archived then
    raise exception 'Confirme a completude documental e os comprovativos de pagamento.';
  end if;
  if not p_assets_registered and not p_assets_not_applicable then
    raise exception 'Confirme o registo dos bens ou marque como não aplicável.';
  end if;

  insert into public.contract_closeouts(
    organization_id, contract_id, final_acceptance_reference,
    physical_archive_reference, digital_archive_reference,
    documents_complete, payment_proofs_archived, assets_registered,
    assets_not_applicable, closeout_notes, closed_by
  ) values (
    v_contract.organization_id, v_contract.id, trim(p_final_acceptance_reference),
    trim(p_physical_archive_reference), trim(p_digital_archive_reference),
    p_documents_complete, p_payment_proofs_archived, p_assets_registered,
    p_assets_not_applicable, nullif(trim(p_notes), ''), auth.uid()
  ) returning * into v_closeout;

  update public.contracts set
    status = 'completed',
    end_date = coalesce(end_date, current_date)
  where id = p_contract_id;
  if v_contract.process_id is not null then
    update public.procurement_processes set status = 'closed'
    where id = v_contract.process_id;
  end if;
  return v_closeout;
end;
$$;

revoke all on function public.close_contract(uuid,text,text,text,boolean,boolean,boolean,boolean,text) from public;
grant execute on function public.close_contract(uuid,text,text,text,boolean,boolean,boolean,boolean,text) to authenticated;

commit;
