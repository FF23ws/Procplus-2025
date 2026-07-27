begin;

create table if not exists public.procurement_exchange_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  base_currency text not null check (base_currency in ('MZN','USD','EUR','ZAR','GBP')),
  quote_currency text not null check (quote_currency in ('MZN','USD','EUR','ZAR','GBP')),
  rate numeric(20,8) not null check (rate > 0),
  rate_type text not null default 'manual'
    check (rate_type in ('manual','quarterly','tranche','contract','donor','bank')),
  source text not null,
  reference text,
  valid_from date not null,
  valid_to date,
  active boolean not null default true,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  check (base_currency <> quote_currency),
  check (valid_to is null or valid_to >= valid_from)
);

create index if not exists procurement_exchange_rates_lookup_idx
on public.procurement_exchange_rates(
  organization_id, base_currency, quote_currency, valid_from desc
) where active;

alter table public.procurement_exchange_rates enable row level security;

drop policy if exists procurement_exchange_rates_read on public.procurement_exchange_rates;
create policy procurement_exchange_rates_read
on public.procurement_exchange_rates for select to authenticated
using (public.is_organization_member(organization_id));

drop policy if exists procurement_exchange_rates_manage on public.procurement_exchange_rates;
create policy procurement_exchange_rates_manage
on public.procurement_exchange_rates for all to authenticated
using (public.has_organization_role(organization_id, array['owner','admin','finance']))
with check (public.has_organization_role(organization_id, array['owner','admin','finance']));

create or replace function public.procurement_currency_conversion(
  p_organization_id uuid,
  p_amount numeric,
  p_from_currency text,
  p_to_currency text,
  p_rate_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rate public.procurement_exchange_rates;
  v_converted numeric;
  v_direction text;
begin
  if not public.is_organization_member(p_organization_id) then
    raise exception 'Não tem acesso a esta organização.';
  end if;
  if upper(p_from_currency) = upper(p_to_currency) then
    return jsonb_build_object(
      'available', true, 'original_amount', p_amount,
      'original_currency', upper(p_from_currency),
      'converted_amount', p_amount, 'converted_currency', upper(p_to_currency),
      'rate', 1, 'direction', 'same_currency', 'rate_id', null
    );
  end if;

  select * into v_rate
  from public.procurement_exchange_rates r
  where r.organization_id = p_organization_id
    and r.active
    and r.base_currency = upper(p_from_currency)
    and r.quote_currency = upper(p_to_currency)
    and r.valid_from <= p_rate_date
    and (r.valid_to is null or r.valid_to >= p_rate_date)
  order by r.valid_from desc, r.created_at desc
  limit 1;

  if v_rate.id is not null then
    v_converted := p_amount * v_rate.rate;
    v_direction := 'direct';
  else
    select * into v_rate
    from public.procurement_exchange_rates r
    where r.organization_id = p_organization_id
      and r.active
      and r.base_currency = upper(p_to_currency)
      and r.quote_currency = upper(p_from_currency)
      and r.valid_from <= p_rate_date
      and (r.valid_to is null or r.valid_to >= p_rate_date)
    order by r.valid_from desc, r.created_at desc
    limit 1;
    if v_rate.id is not null then
      v_converted := p_amount / v_rate.rate;
      v_direction := 'inverse';
    end if;
  end if;

  if v_rate.id is null then
    return jsonb_build_object(
      'available', false, 'original_amount', p_amount,
      'original_currency', upper(p_from_currency),
      'converted_amount', null, 'converted_currency', upper(p_to_currency),
      'rate', null, 'rate_id', null, 'rate_date', p_rate_date,
      'message', format('Não existe taxa válida de %s para %s em %s.', upper(p_from_currency), upper(p_to_currency), p_rate_date)
    );
  end if;

  return jsonb_build_object(
    'available', true,
    'original_amount', p_amount,
    'original_currency', upper(p_from_currency),
    'converted_amount', round(v_converted, 2),
    'converted_currency', upper(p_to_currency),
    'rate', v_rate.rate,
    'rate_id', v_rate.id,
    'direction', v_direction,
    'rate_type', v_rate.rate_type,
    'source', v_rate.source,
    'reference', v_rate.reference,
    'valid_from', v_rate.valid_from,
    'valid_to', v_rate.valid_to,
    'rate_date', p_rate_date
  );
end;
$$;

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
  v_candidate public.funding_rules;
  v_conversion jsonb;
  v_candidate_conversion jsonb;
  v_match_amount numeric;
  v_violations jsonb := '[]'::jsonb;
  v_missing_documents jsonb := '[]'::jsonb;
  v_bid_count integer := 0;
  v_document text;
  v_days integer;
  v_rate_date date := current_date;
begin
  if not public.is_organization_member(p_organization_id) then
    raise exception 'Não tem acesso a esta organização.';
  end if;
  if p_process_id is not null then
    select created_at::date into v_rate_date
    from public.procurement_processes
    where id = p_process_id;
    v_rate_date := coalesce(v_rate_date, current_date);
  end if;

  for v_candidate in
    select *
    from public.funding_rules r
    where r.organization_id = p_organization_id
      and r.active
      and r.funding_source = p_funding_source
    order by r.priority desc, r.threshold asc nulls last, r.created_at desc
  loop
    v_candidate_conversion := public.procurement_currency_conversion(
      p_organization_id, p_estimated_value, upper(p_currency),
      upper(v_candidate.currency), v_rate_date
    );
    if coalesce((v_candidate_conversion->>'available')::boolean, false) then
      v_match_amount := (v_candidate_conversion->>'converted_amount')::numeric;
      if v_match_amount >= coalesce(v_candidate.min_value, 0)
         and (v_candidate.threshold is null or v_match_amount <= v_candidate.threshold) then
        v_rule := v_candidate;
        v_conversion := v_candidate_conversion;
        exit;
      end if;
    elsif v_conversion is null then
      v_conversion := v_candidate_conversion;
    end if;
  end loop;

  if v_rule.id is null then
    if v_conversion is not null and not coalesce((v_conversion->>'available')::boolean, false) then
      v_violations := v_violations || jsonb_build_array(jsonb_build_object(
        'code', 'exchange_rate_missing',
        'message', v_conversion->>'message'
      ));
    else
      v_violations := v_violations || jsonb_build_array(jsonb_build_object(
        'code', 'rule_missing',
        'message', format('Não existe regra activa para %s e este valor.', p_funding_source)
      ));
    end if;
    return jsonb_build_object(
      'compliant', false, 'rule', null, 'conversion', v_conversion,
      'violations', v_violations, 'missing_documents', v_missing_documents, 'bid_count', 0
    );
  end if;

  if p_method is distinct from v_rule.procurement_method then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'method_mismatch', 'message', format('O método obrigatório é %s.', v_rule.procurement_method)
    ));
  end if;
  if v_rule.publication_required and p_method <> 'open_tender' then
    v_violations := v_violations || jsonb_build_array(jsonb_build_object(
      'code', 'public_tender_required', 'message', 'Esta faixa exige concurso público.'
    ));
  end if;
  if v_rule.min_deadline_days > 0 then
    if p_deadline is null then
      v_violations := v_violations || jsonb_build_array(jsonb_build_object(
        'code', 'deadline_missing', 'message', format('Defina um prazo mínimo de %s dias.', v_rule.min_deadline_days)
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
    for v_document in select jsonb_array_elements_text(coalesce(v_rule.required_documents, '[]'::jsonb))
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
        'code', 'documents_missing', 'message', 'Existem documentos obrigatórios sem evidência.',
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
    'conversion', v_conversion,
    'rule', jsonb_build_object(
      'id', v_rule.id, 'name', v_rule.name, 'funding_source', v_rule.funding_source,
      'currency', v_rule.currency, 'min_value', v_rule.min_value, 'threshold', v_rule.threshold,
      'procurement_method', v_rule.procurement_method, 'quotations_required', v_rule.quotations_required,
      'approval_levels', v_rule.approval_levels, 'required_documents', v_rule.required_documents,
      'publication_required', v_rule.publication_required, 'committee_required', v_rule.committee_required,
      'contract_required', v_rule.contract_required, 'min_deadline_days', v_rule.min_deadline_days,
      'evaluated_amount', v_conversion->'converted_amount',
      'exchange_rate', v_conversion
    ),
    'violations', v_violations, 'missing_documents', v_missing_documents, 'bid_count', v_bid_count
  );
end;
$$;

revoke all on function public.procurement_currency_conversion(uuid,numeric,text,text,date) from public;
grant execute on function public.procurement_currency_conversion(uuid,numeric,text,text,date) to authenticated;
grant select, insert, update on public.procurement_exchange_rates to authenticated;

commit;
