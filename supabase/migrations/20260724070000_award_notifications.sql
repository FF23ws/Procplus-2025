begin;

create table if not exists public.award_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.procurement_processes(id) on delete cascade,
  bid_id uuid references public.procurement_bids(id) on delete set null,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  notification_reference text not null,
  notified_at timestamptz not null default now(),
  complaint_deadline date not null,
  response_status text not null default 'pending'
    check (response_status in ('pending','accepted','rejected')),
  responded_at timestamptz,
  response_notes text,
  sent_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id),
  unique (organization_id, notification_reference)
);

alter table public.award_notifications enable row level security;

drop policy if exists award_notifications_read on public.award_notifications;
create policy award_notifications_read on public.award_notifications
for select to authenticated
using (public.is_organization_member(organization_id));

create or replace function public.add_business_days(p_start date, p_days integer)
returns date language plpgsql immutable as $$
declare
  v_date date := p_start;
  v_added integer := 0;
begin
  while v_added < p_days loop
    v_date := v_date + 1;
    if extract(isodow from v_date) < 6 then v_added := v_added + 1; end if;
  end loop;
  return v_date;
end;
$$;

create or replace function public.record_award_notification(p_contract_id uuid)
returns public.award_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract public.contracts;
  v_notification public.award_notifications;
  v_bid_id uuid;
  v_allowed boolean;
  v_reference text;
begin
  select * into v_contract from public.contracts where id = p_contract_id for update;
  if v_contract.id is null then raise exception 'Documento contratual não encontrado.'; end if;
  if v_contract.process_id is null then raise exception 'O documento deve estar associado a um processo.'; end if;
  if v_contract.status <> 'draft' then raise exception 'A notificação deve ser registada enquanto o documento está em rascunho.'; end if;

  select public.has_organization_role(
    v_contract.organization_id,
    array['owner','admin','procurement_manager','procurement_officer']
  ) into v_allowed;
  if not v_allowed then raise exception 'Não tem permissão para registar a notificação.'; end if;

  select * into v_notification from public.award_notifications
  where contract_id = p_contract_id;
  if v_notification.id is not null then return v_notification; end if;

  select id into v_bid_id from public.procurement_bids
  where process_id = v_contract.process_id
    and supplier_id = v_contract.supplier_id
    and status = 'recommended'
  limit 1;

  v_reference := 'NADJ-' || extract(year from current_date)::text || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.award_notifications(
    organization_id, process_id, bid_id, contract_id, supplier_id,
    notification_reference, complaint_deadline, sent_by
  ) values (
    v_contract.organization_id, v_contract.process_id, v_bid_id,
    v_contract.id, v_contract.supplier_id, v_reference,
    public.add_business_days(current_date, 3), auth.uid()
  ) returning * into v_notification;
  return v_notification;
end;
$$;

create or replace function public.record_award_response(
  p_notification_id uuid,
  p_response text,
  p_notes text default null
)
returns public.award_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_notification public.award_notifications;
  v_allowed boolean;
begin
  if p_response not in ('accepted','rejected') then raise exception 'Resposta inválida.'; end if;
  select * into v_notification from public.award_notifications
  where id = p_notification_id for update;
  if v_notification.id is null then raise exception 'Notificação não encontrada.'; end if;

  select public.has_organization_role(
    v_notification.organization_id,
    array['owner','admin','procurement_manager','procurement_officer']
  ) into v_allowed;
  if not v_allowed then raise exception 'Não tem permissão para registar a resposta.'; end if;
  if p_response = 'rejected' and nullif(trim(p_notes), '') is null then
    raise exception 'Indique a justificação da rejeição.';
  end if;

  update public.award_notifications set
    response_status = p_response,
    responded_at = now(),
    response_notes = nullif(trim(p_notes), ''),
    updated_at = now()
  where id = p_notification_id returning * into v_notification;
  return v_notification;
end;
$$;

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
  if not exists (
    select 1 from public.award_notifications n
    where n.contract_id = p_contract_id and n.response_status = 'accepted'
  ) then
    raise exception 'Registe a notificação de adjudicação e a aceitação do fornecedor antes da aprovação.';
  end if;

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

revoke all on function public.record_award_notification(uuid) from public;
grant execute on function public.record_award_notification(uuid) to authenticated;
revoke all on function public.record_award_response(uuid,text,text) from public;
grant execute on function public.record_award_response(uuid,text,text) to authenticated;

commit;
