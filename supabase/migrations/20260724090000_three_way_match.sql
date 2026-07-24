begin;

create table if not exists public.contract_deliveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  milestone_id uuid references public.contract_milestones(id) on delete set null,
  delivery_reference text not null,
  delivery_date date not null,
  acceptance_notes text,
  accepted_by uuid not null references public.profiles(id),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, delivery_reference)
);

create table if not exists public.supplier_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contract_id uuid not null references public.contracts(id) on delete cascade,
  delivery_id uuid not null references public.contract_deliveries(id) on delete restrict,
  finance_project_id uuid not null references public.finance_projects(id) on delete restrict,
  finance_entry_id uuid references public.finance_entries(id) on delete set null,
  invoice_number text not null,
  invoice_date date not null,
  amount numeric(18,2) not null check (amount > 0),
  currency text not null check (currency in ('MZN','USD','EUR','ZAR')),
  exchange_rate numeric(18,6) not null default 1 check (exchange_rate > 0),
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','rejected','paid')),
  payment_reference text,
  paid_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

alter table public.contract_deliveries enable row level security;
alter table public.supplier_invoices enable row level security;

create policy contract_deliveries_read on public.contract_deliveries
for select to authenticated using (public.is_organization_member(organization_id));
create policy supplier_invoices_read on public.supplier_invoices
for select to authenticated using (public.is_organization_member(organization_id));

create or replace function public.record_contract_delivery(
  p_contract_id uuid,
  p_milestone_id uuid,
  p_reference text,
  p_delivery_date date,
  p_notes text default null
)
returns public.contract_deliveries
language plpgsql security definer set search_path = public
as $$
declare
  v_contract public.contracts;
  v_delivery public.contract_deliveries;
  v_allowed boolean;
begin
  select * into v_contract from public.contracts where id = p_contract_id;
  if v_contract.id is null then raise exception 'Contrato não encontrado.'; end if;
  if v_contract.status <> 'active' then raise exception 'Apenas contratos activos podem receber entregas.'; end if;
  if nullif(trim(p_reference), '') is null then raise exception 'Indique a referência da guia ou certificado.'; end if;
  if p_milestone_id is not null and not exists (
    select 1 from public.contract_milestones m
    where m.id = p_milestone_id and m.contract_id = p_contract_id
  ) then raise exception 'O marco não pertence a este contrato.'; end if;

  select public.has_organization_role(
    v_contract.organization_id,
    array['owner','admin','procurement_manager','procurement_officer']
  ) into v_allowed;
  if not v_allowed then raise exception 'Não tem permissão para aceitar entregas.'; end if;

  insert into public.contract_deliveries(
    organization_id, contract_id, milestone_id, delivery_reference,
    delivery_date, acceptance_notes, accepted_by
  ) values (
    v_contract.organization_id, v_contract.id, p_milestone_id,
    trim(p_reference), p_delivery_date, nullif(trim(p_notes), ''), auth.uid()
  ) returning * into v_delivery;

  if p_milestone_id is not null then
    update public.contract_milestones set status = 'completed', completed_at = now()
    where id = p_milestone_id;
  end if;
  return v_delivery;
end;
$$;

create or replace function public.submit_supplier_invoice(
  p_contract_id uuid,
  p_delivery_id uuid,
  p_finance_project_id uuid,
  p_invoice_number text,
  p_invoice_date date,
  p_amount numeric,
  p_exchange_rate numeric default 1
)
returns public.supplier_invoices
language plpgsql security definer set search_path = public
as $$
declare
  v_contract public.contracts;
  v_invoice public.supplier_invoices;
  v_entry_id uuid;
  v_existing numeric;
  v_allowed boolean;
begin
  select * into v_contract from public.contracts where id = p_contract_id;
  if v_contract.id is null or v_contract.status <> 'active' then
    raise exception 'O contrato deve estar activo.';
  end if;
  if not exists (
    select 1 from public.contract_deliveries d
    where d.id = p_delivery_id and d.contract_id = p_contract_id
  ) then raise exception 'A factura exige uma entrega aceite deste contrato.'; end if;
  if not exists (
    select 1 from public.finance_projects p
    where p.id = p_finance_project_id and p.organization_id = v_contract.organization_id
  ) then raise exception 'Projecto financeiro inválido.'; end if;

  select public.has_organization_role(
    v_contract.organization_id,
    array['owner','admin','finance']
  ) into v_allowed;
  if not v_allowed then raise exception 'A factura deve ser registada pela equipa financeira.'; end if;

  select coalesce(sum(amount), 0) into v_existing
  from public.supplier_invoices
  where contract_id = p_contract_id and status <> 'rejected';
  if p_amount <= 0 or v_existing + p_amount > v_contract.total_value then
    raise exception 'O total das facturas excede o valor do contrato.';
  end if;

  insert into public.finance_entries(
    organization_id, project_id, reference, entry_type, description,
    document_date, amount, currency, exchange_rate, status, created_by
  ) values (
    v_contract.organization_id, p_finance_project_id, trim(p_invoice_number),
    'expense', 'Pagamento ' || v_contract.contract_number || ' · Factura ' || trim(p_invoice_number),
    p_invoice_date, p_amount, v_contract.currency, coalesce(p_exchange_rate, 1),
    'pending_approval', auth.uid()
  ) returning id into v_entry_id;

  insert into public.supplier_invoices(
    organization_id, contract_id, delivery_id, finance_project_id,
    finance_entry_id, invoice_number, invoice_date, amount, currency,
    exchange_rate, created_by
  ) values (
    v_contract.organization_id, v_contract.id, p_delivery_id, p_finance_project_id,
    v_entry_id, trim(p_invoice_number), p_invoice_date, p_amount,
    v_contract.currency, coalesce(p_exchange_rate, 1), auth.uid()
  ) returning * into v_invoice;
  return v_invoice;
end;
$$;

create or replace function public.sync_supplier_invoice_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'posted' and old.status is distinct from new.status then
    update public.supplier_invoices set status = 'approved', updated_at = now()
    where finance_entry_id = new.id;
  elsif new.status = 'cancelled' and old.status is distinct from new.status then
    update public.supplier_invoices set status = 'rejected', updated_at = now()
    where finance_entry_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists finance_sync_supplier_invoice on public.finance_entries;
create trigger finance_sync_supplier_invoice
after update of status on public.finance_entries
for each row execute function public.sync_supplier_invoice_status();

create or replace function public.record_supplier_payment(
  p_invoice_id uuid,
  p_payment_reference text
)
returns public.supplier_invoices
language plpgsql security definer set search_path = public
as $$
declare
  v_invoice public.supplier_invoices;
  v_allowed boolean;
begin
  select * into v_invoice from public.supplier_invoices
  where id = p_invoice_id for update;
  if v_invoice.id is null or v_invoice.status <> 'approved' then
    raise exception 'A factura precisa de aprovação financeira antes do pagamento.';
  end if;
  if nullif(trim(p_payment_reference), '') is null then
    raise exception 'Indique a referência do pagamento.';
  end if;
  select public.has_organization_role(
    v_invoice.organization_id, array['owner','admin','finance']
  ) into v_allowed;
  if not v_allowed then raise exception 'Não tem permissão para registar pagamentos.'; end if;

  update public.supplier_invoices set
    status = 'paid', payment_reference = trim(p_payment_reference),
    paid_at = now(), updated_at = now()
  where id = p_invoice_id returning * into v_invoice;
  return v_invoice;
end;
$$;

grant execute on function public.record_contract_delivery(uuid,uuid,text,date,text) to authenticated;
grant execute on function public.submit_supplier_invoice(uuid,uuid,uuid,text,date,numeric,numeric) to authenticated;
grant execute on function public.record_supplier_payment(uuid,text) to authenticated;

commit;
