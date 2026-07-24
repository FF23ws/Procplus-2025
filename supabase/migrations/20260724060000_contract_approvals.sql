begin;

alter table public.approval_requests
  add column if not exists contract_id uuid references public.contracts(id) on delete cascade;

alter table public.approval_requests
  drop constraint if exists approval_requests_entity_type_check;
alter table public.approval_requests
  add constraint approval_requests_entity_type_check
  check (entity_type in ('procurement','finance','contract'));

alter table public.approval_requests
  drop constraint if exists approval_requests_single_entity;
alter table public.approval_requests
  add constraint approval_requests_single_entity
  check (num_nonnulls(process_id, finance_entry_id, contract_id) = 1);

create unique index if not exists approval_requests_one_pending_contract
on public.approval_requests(contract_id)
where status = 'pending';

create or replace function public.guard_contract_signature_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending_signature'
    and old.status is distinct from new.status
    and not exists (
      select 1 from public.approval_requests r
      where r.contract_id = new.id and r.status = 'approved'
    )
  then
    raise exception 'O documento precisa de aprovação final antes da assinatura.';
  end if;
  return new;
end;
$$;

drop trigger if exists contract_signature_requires_approval on public.contracts;
create trigger contract_signature_requires_approval
before update of status on public.contracts
for each row execute function public.guard_contract_signature_status();

create or replace function public.submit_contract_approval(p_contract_id uuid)
returns public.approval_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.contracts;
  v_request public.approval_requests;
  v_allowed boolean;
begin
  select * into v_contract from public.contracts where id = p_contract_id for update;
  if v_contract.id is null then raise exception 'Documento contratual não encontrado.'; end if;
  if v_contract.status <> 'draft' then raise exception 'Apenas documentos em rascunho podem ser submetidos.'; end if;

  select public.has_organization_role(
    v_contract.organization_id,
    array['owner','admin','procurement_manager','procurement_officer']
  ) into v_allowed;
  if not v_allowed then raise exception 'Não tem permissão para submeter este documento.'; end if;

  select * into v_request from public.approval_requests
  where contract_id = p_contract_id and status = 'pending';
  if v_request.id is not null then return v_request; end if;

  insert into public.approval_requests(
    organization_id, contract_id, entity_type, submitted_by, required_levels
  ) values (
    v_contract.organization_id, v_contract.id, 'contract', auth.uid(), 2
  ) returning * into v_request;
  return v_request;
end;
$$;

create or replace function public.decide_procurement_approval(
  p_request_id uuid,
  p_decision text,
  p_comment text default null
)
returns public.approval_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.approval_requests;
  v_allowed boolean;
begin
  if p_decision not in ('approved','rejected','changes_requested') then
    raise exception 'Decisão inválida.';
  end if;
  select * into v_request from public.approval_requests
  where id = p_request_id for update;
  if v_request.id is null or v_request.status <> 'pending' then
    raise exception 'Este pedido já não está pendente.';
  end if;

  select exists (
    select 1 from public.organization_members m
    where m.organization_id = v_request.organization_id
      and m.user_id = auth.uid() and m.active
      and (
        m.role in ('owner','admin')
        or (v_request.current_level = 1 and v_request.entity_type in ('procurement','contract') and m.role = 'procurement_manager')
        or (v_request.current_level >= 2 and m.role = 'approver')
        or (v_request.entity_type = 'finance' and m.role = 'approver')
      )
  ) into v_allowed;
  if not v_allowed then raise exception 'Não tem permissão para decidir neste nível.'; end if;
  if p_decision <> 'approved' and nullif(trim(p_comment), '') is null then
    raise exception 'A justificação é obrigatória.';
  end if;

  insert into public.approval_decisions(request_id, level, decision, comment, decided_by)
  values (v_request.id, v_request.current_level, p_decision, nullif(trim(p_comment), ''), auth.uid());

  if p_decision = 'approved' and v_request.current_level < v_request.required_levels then
    update public.approval_requests set current_level = current_level + 1
    where id = v_request.id returning * into v_request;
  elsif p_decision = 'approved' then
    update public.approval_requests set status = 'approved', completed_at = now()
    where id = v_request.id returning * into v_request;
    if v_request.entity_type = 'finance' then
      update public.finance_entries set status = 'posted', approved_by = auth.uid(), approved_at = now()
      where id = v_request.finance_entry_id;
    elsif v_request.entity_type = 'contract' then
      update public.contracts set status = 'pending_signature' where id = v_request.contract_id;
    else
      update public.procurement_processes set status = 'published' where id = v_request.process_id;
    end if;
  elsif p_decision = 'changes_requested' then
    update public.approval_requests set status = 'changes_requested', completed_at = now()
    where id = v_request.id returning * into v_request;
    if v_request.entity_type = 'finance' then
      update public.finance_entries set status = 'draft' where id = v_request.finance_entry_id;
    elsif v_request.entity_type = 'contract' then
      update public.contracts set status = 'draft' where id = v_request.contract_id;
    else
      update public.procurement_processes set status = 'draft' where id = v_request.process_id;
    end if;
  else
    update public.approval_requests set status = 'rejected', completed_at = now()
    where id = v_request.id returning * into v_request;
    if v_request.entity_type = 'finance' then
      update public.finance_entries set status = 'cancelled' where id = v_request.finance_entry_id;
    elsif v_request.entity_type = 'contract' then
      update public.contracts set status = 'cancelled' where id = v_request.contract_id;
    else
      update public.procurement_processes set status = 'cancelled' where id = v_request.process_id;
    end if;
  end if;
  return v_request;
end;
$$;

revoke all on function public.submit_contract_approval(uuid) from public;
grant execute on function public.submit_contract_approval(uuid) to authenticated;
revoke all on function public.decide_procurement_approval(uuid,text,text) from public;
grant execute on function public.decide_procurement_approval(uuid,text,text) to authenticated;

commit;
