begin;

alter table public.funding_rules
  add column if not exists funding_source text,
  add column if not exists min_value numeric(18,2) not null default 0,
  add column if not exists threshold numeric(18,2),
  add column if not exists procurement_method text not null default 'request_for_quotation',
  add column if not exists quotations_required integer not null default 1,
  add column if not exists approval_levels integer not null default 1,
  add column if not exists required_documents jsonb not null default '[]'::jsonb,
  add column if not exists publication_required boolean not null default false,
  add column if not exists committee_required boolean not null default false,
  add column if not exists contract_required boolean not null default false,
  add column if not exists min_deadline_days integer not null default 0,
  add column if not exists priority integer not null default 0,
  add column if not exists created_by uuid references public.profiles(id);

update public.funding_rules
set funding_source = coalesce(
  funding_source,
  case origin
    when 'american_government' then 'american_government'
    when 'eu' then 'eu'
    when 'mozambique_government' then 'mozambique_government'
    when 'international' then 'international'
    when 'internal' then 'internal'
    else 'other'
  end
)
where funding_source is null;

alter table public.procurement_processes
  add column if not exists applied_rule_id uuid references public.funding_rules(id),
  add column if not exists rule_snapshot jsonb,
  add column if not exists rule_status text not null default 'not_evaluated',
  add column if not exists rule_evaluated_at timestamptz,
  add column if not exists exception_justification text,
  add column if not exists exception_status text,
  add column if not exists exception_approved_by uuid references public.profiles(id),
  add column if not exists exception_approved_at timestamptz;

create table if not exists public.procurement_rule_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.procurement_processes(id) on delete cascade,
  requirement_code text not null,
  evidence_reference text not null,
  recorded_by uuid not null default auth.uid() references public.profiles(id),
  recorded_at timestamptz not null default now(),
  unique(process_id, requirement_code)
);

alter table public.procurement_rule_evidence enable row level security;

drop policy if exists procurement_rule_evidence_read on public.procurement_rule_evidence;
create policy procurement_rule_evidence_read
on public.procurement_rule_evidence for select to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists procurement_rule_evidence_manage on public.procurement_rule_evidence;
create policy procurement_rule_evidence_manage
on public.procurement_rule_evidence for all to authenticated
using (public.has_organization_role(organization_id, array['owner','admin','procurement_manager','procurement_officer']))
with check (public.has_organization_role(organization_id, array['owner','admin','procurement_manager','procurement_officer']));

create or replace function public.procurement_rule_result(
  p_organization_id uuid,
  p_funding_source text,
  p_estimated_value numeric,
  p_currency text,
  p_method text,
  p_deadline timestamptz,
  p_process_id uuid default null,
  p_target_status text default 'pending_approval'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.funding_rules;
  v_violations jsonb := '[]'::jsonb;
  v_missing_documents jsonb := '[]'::jsonb;
  v_bid_count integer := 0;
  v_document text;
  v_days integer;
begin
  if not public.is_organization_member(p_organization_id) then
    raise exception 'Não tem acesso a esta organização.';
  end if;

  select * into v_rule
  from public.funding_rules r
  where r.organization_id = p_organization_id
    and r.active
    and r.funding_source = p_funding_source
    and upper(r.currency) = upper(p_currency)
    and p_estimated_value >= coalesce(r.min_value, 0)
    and (r.threshold is null or p_estimated_value <= r.threshold)
  order by r.priority desc, r.threshold asc nulls last, r.created_at desc
  limit 1;

  if v_rule.id is null then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'rule_missing',
      'message', format('Não existe regra activa para %s em %s e este valor.', p_funding_source, p_currency)
    ));
    return jsonb_build_object(
      'compliant', false,
      'rule', null,
      'violations', v_violations,
      'missing_documents', v_missing_documents,
      'bid_count', 0
    );
  end if;

  if p_method is distinct from v_rule.procurement_method then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'method_mismatch',
      'message', format('O método obrigatório é %s.', v_rule.procurement_method)
    ));
  end if;

  if v_rule.publication_required and p_method <> 'open_tender' then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'public_tender_required',
      'message', 'Esta faixa exige concurso público.'
    ));
  end if;

  if v_rule.min_deadline_days > 0 then
    if p_deadline is null then
      v_violations := v_violations || jsonb_build_array(jsonb_build_object(
        'code', 'deadline_missing',
        'message', format('Defina um prazo mínimo de %s dias.', v_rule.min_deadline_days)
      ));
    else
      v_days := floor(extract(epoch from (p_deadline - now())) / 86400);
      if v_days < v_rule.min_deadline_days then
        v_violations := v_violations || jsonb_build_array(jsonb_build_object(
          'code', 'deadline_short',
          'message', format('O prazo deve ter pelo menos %s dias; actualmente tem %s.', v_rule.min_deadline_days, greatest(v_days, 0))
        ));
      end if;
    end if;
  end if;

  if p_process_id is not null then
    for v_document in
      select jsonb_array_elements_text(coalesce(v_rule.required_documents, '[]'::jsonb))
    loop
      if not exists (
        select 1 from public.procurement_rule_evidence e
        where e.process_id = p_process_id and e.requirement_code = v_document
      ) then
        v_missing_documents := v_missing_documents || to_jsonb(v_document);
      end if;
    end loop;

    if jsonb_array_length(v_missing_documents) > 0
       and p_target_status in ('pending_approval','published','evaluation','awarded') then
      v_violations := v_violations || jsonb_build_array(jsonb_build_object(
        'code', 'documents_missing',
        'message', 'Existem documentos obrigatórios sem evidência.',
        'documents', v_missing_documents
      ));
    end if;

    select count(*) into v_bid_count
    from public.procurement_bids b
    where b.process_id = p_process_id
      and b.compliance_status <> 'non_compliant'
      and b.status not in ('rejected','withdrawn');

    if p_target_status = 'awarded' and v_bid_count < v_rule.quotations_required then
      v_violations := v_violations || jsonb_build_array(jsonb_build_object(
        'code', 'quotations_missing',
        'message', format('São exigidas %s propostas conformes; existem %s.', v_rule.quotations_required, v_bid_count)
      ));
    end if;
  end if;

  return jsonb_build_object(
    'compliant', jsonb_array_length(v_violations) = 0,
    'rule', jsonb_build_object(
      'id', v_rule.id,
      'name', v_rule.name,
      'funding_source', v_rule.funding_source,
      'currency', v_rule.currency,
      'min_value', v_rule.min_value,
      'threshold', v_rule.threshold,
      'procurement_method', v_rule.procurement_method,
      'quotations_required', v_rule.quotations_required,
      'approval_levels', v_rule.approval_levels,
      'required_documents', v_rule.required_documents,
      'publication_required', v_rule.publication_required,
      'committee_required', v_rule.committee_required,
      'contract_required', v_rule.contract_required,
      'min_deadline_days', v_rule.min_deadline_days
    ),
    'violations', v_violations,
    'missing_documents', v_missing_documents,
    'bid_count', v_bid_count
  );
end;
$$;

create or replace function public.preview_procurement_rule(
  p_organization_id uuid,
  p_funding_source text,
  p_estimated_value numeric,
  p_currency text,
  p_method text,
  p_deadline timestamptz default null
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.procurement_rule_result(
    p_organization_id, p_funding_source, p_estimated_value, p_currency,
    p_method, p_deadline, null, 'pending_approval'
  );
$$;

create or replace function public.evaluate_procurement_process(
  p_process_id uuid,
  p_target_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_process public.procurement_processes;
begin
  select * into v_process from public.procurement_processes where id = p_process_id;
  if v_process.id is null then raise exception 'Processo não encontrado.'; end if;
  return public.procurement_rule_result(
    v_process.organization_id, v_process.funding_source, v_process.estimated_value,
    v_process.currency, v_process.procurement_method, v_process.deadline,
    v_process.id, coalesce(p_target_status, v_process.status)
  );
end;
$$;

create or replace function public.set_procurement_rule_evidence(
  p_process_id uuid,
  p_requirement_code text,
  p_evidence_reference text
)
returns public.procurement_rule_evidence
language plpgsql
security definer
set search_path = public
as $$
declare
  v_process public.procurement_processes;
  v_evidence public.procurement_rule_evidence;
begin
  select * into v_process from public.procurement_processes where id = p_process_id;
  if v_process.id is null then raise exception 'Processo não encontrado.'; end if;
  if not public.has_organization_role(v_process.organization_id, array['owner','admin','procurement_manager','procurement_officer']) then
    raise exception 'Não tem permissão para registar evidências.';
  end if;
  if nullif(trim(p_evidence_reference), '') is null then raise exception 'Indique a referência da evidência.'; end if;

  insert into public.procurement_rule_evidence(
    organization_id, process_id, requirement_code, evidence_reference, recorded_by
  ) values (
    v_process.organization_id, v_process.id, p_requirement_code, trim(p_evidence_reference), auth.uid()
  )
  on conflict(process_id, requirement_code)
  do update set evidence_reference = excluded.evidence_reference, recorded_by = auth.uid(), recorded_at = now()
  returning * into v_evidence;
  return v_evidence;
end;
$$;

create or replace function public.transition_procurement_process(
  p_process_id uuid,
  p_target_status text,
  p_exception_justification text default null
)
returns public.procurement_processes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_process public.procurement_processes;
  v_result jsonb;
  v_rule jsonb;
  v_levels integer := 1;
  v_allowed boolean;
begin
  select * into v_process from public.procurement_processes where id = p_process_id for update;
  if v_process.id is null then raise exception 'Processo não encontrado.'; end if;

  select public.has_organization_role(
    v_process.organization_id,
    array['owner','admin','procurement_manager','procurement_officer']
  ) into v_allowed;
  if not v_allowed then raise exception 'Não tem permissão para alterar este processo.'; end if;

  if not (
    (v_process.status = 'draft' and p_target_status in ('pending_approval','cancelled'))
    or (v_process.status = 'pending_approval' and p_target_status in ('draft','cancelled'))
    or (v_process.status = 'published' and p_target_status in ('evaluation','cancelled'))
    or (v_process.status = 'evaluation' and p_target_status in ('awarded','cancelled'))
    or (v_process.status = p_target_status)
  ) then
    raise exception 'Transição de estado não permitida: % → %.', v_process.status, p_target_status;
  end if;

  v_result := public.evaluate_procurement_process(v_process.id, p_target_status);
  v_rule := v_result->'rule';
  v_levels := greatest(coalesce((v_rule->>'approval_levels')::integer, 1), 1);

  if not coalesce((v_result->>'compliant')::boolean, false)
     and p_target_status not in ('draft','cancelled') then
    if p_target_status = 'pending_approval'
       and nullif(trim(p_exception_justification), '') is not null then
      v_levels := greatest(v_levels, 3);
      update public.procurement_processes
      set exception_justification = trim(p_exception_justification),
          exception_status = 'pending',
          applied_rule_id = nullif(v_rule->>'id','')::uuid,
          rule_snapshot = v_rule,
          rule_status = 'exception_pending',
          rule_evaluated_at = now()
      where id = v_process.id;
    elsif v_process.exception_status <> 'approved' then
      raise exception 'Bloqueado pelo motor de regras: %',
        coalesce((
          select string_agg(item->>'message', ' ')
          from jsonb_array_elements(v_result->'violations') item
        ), 'requisitos não cumpridos.');
    end if;
  end if;

  perform set_config('procplus.rule_transition', 'on', true);
  update public.procurement_processes
  set status = p_target_status,
      applied_rule_id = nullif(v_rule->>'id','')::uuid,
      rule_snapshot = v_rule,
      rule_status = case
        when exception_status = 'pending' then 'exception_pending'
        when coalesce((v_result->>'compliant')::boolean, false) then 'compliant'
        else 'exception_approved'
      end,
      rule_evaluated_at = now()
  where id = v_process.id
  returning * into v_process;

  if p_target_status = 'pending_approval' then
    update public.approval_requests
    set required_levels = v_levels
    where process_id = v_process.id and status = 'pending';
  end if;
  return v_process;
end;
$$;

create or replace function public.guard_procurement_rule_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Novos processos devem iniciar como rascunho e passar pelo motor de regras.';
    end if;
    return new;
  end if;
  if old.status is distinct from new.status
     and new.status in ('pending_approval','evaluation','awarded')
     and coalesce(current_setting('procplus.rule_transition', true), '') <> 'on' then
    raise exception 'Utilize o motor de regras para alterar o estado do processo.';
  end if;
  if old.status is distinct from new.status and new.status = 'published'
     and not exists (
       select 1 from public.approval_requests r
       where r.process_id = new.id and r.status = 'approved'
     ) then
    raise exception 'O processo precisa de aprovação final antes da publicação.';
  end if;
  return new;
end;
$$;

drop trigger if exists procurement_rules_guard on public.procurement_processes;
create trigger procurement_rules_guard
before insert or update of status on public.procurement_processes
for each row execute function public.guard_procurement_rule_transition();

create or replace function public.approve_procurement_exception()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status = 'approved' and new.process_id is not null then
    update public.procurement_processes
    set exception_status = case when exception_status = 'pending' then 'approved' else exception_status end,
        exception_approved_by = case when exception_status = 'pending' then auth.uid() else exception_approved_by end,
        exception_approved_at = case when exception_status = 'pending' then now() else exception_approved_at end,
        rule_status = case when exception_status = 'pending' then 'exception_approved' else rule_status end
    where id = new.process_id;
  end if;
  return new;
end;
$$;

drop trigger if exists procurement_exception_after_approval on public.approval_requests;
create trigger procurement_exception_after_approval
after update of status on public.approval_requests
for each row execute function public.approve_procurement_exception();

revoke all on function public.preview_procurement_rule(uuid,text,numeric,text,text,timestamptz) from public;
grant execute on function public.preview_procurement_rule(uuid,text,numeric,text,text,timestamptz) to authenticated;
revoke all on function public.evaluate_procurement_process(uuid,text) from public;
grant execute on function public.evaluate_procurement_process(uuid,text) to authenticated;
revoke all on function public.set_procurement_rule_evidence(uuid,text,text) from public;
grant execute on function public.set_procurement_rule_evidence(uuid,text,text) to authenticated;
revoke all on function public.transition_procurement_process(uuid,text,text) from public;
grant execute on function public.transition_procurement_process(uuid,text,text) to authenticated;

commit;
