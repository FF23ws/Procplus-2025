begin;
create table if not exists public.procurement_bids (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.procurement_processes(id) on delete cascade, supplier_id uuid not null references public.suppliers(id) on delete restrict,
  bid_reference text not null, submitted_at timestamptz not null default now(), amount numeric(18,2) not null check(amount>=0),
  currency text not null default 'MZN' check(currency in ('MZN','USD','EUR','ZAR')), validity_date date,
  compliance_status text not null default 'pending' check(compliance_status in ('pending','compliant','non_compliant')),
  technical_score numeric(5,2) check(technical_score between 0 and 100), financial_score numeric(5,2) check(financial_score between 0 and 100),
  total_score numeric(5,2) generated always as (round(coalesce(technical_score,0)*0.70+coalesce(financial_score,0)*0.30,2)) stored,
  evaluation_notes text, status text not null default 'received' check(status in ('received','under_review','evaluated','recommended','rejected','withdrawn')),
  evaluated_by uuid, evaluated_at timestamptz, created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(process_id,supplier_id), unique(organization_id,bid_reference)
);
create index if not exists procurement_bids_org_process_idx on public.procurement_bids(organization_id,process_id);
create index if not exists procurement_bids_score_idx on public.procurement_bids(process_id,total_score desc);
alter table public.procurement_bids enable row level security;
create policy procurement_bids_read on public.procurement_bids for select to authenticated using(public.has_organization_role(organization_id,array['owner','admin','procurement_manager','procurement_officer','evaluator','approver','auditor','viewer']));
create policy procurement_bids_manage on public.procurement_bids for all to authenticated using(public.has_organization_role(organization_id,array['owner','admin','procurement_manager','procurement_officer','evaluator'])) with check(public.has_organization_role(organization_id,array['owner','admin','procurement_manager','procurement_officer','evaluator']));
drop trigger if exists procurement_bids_audit on public.procurement_bids;
create trigger procurement_bids_audit after insert or update or delete on public.procurement_bids for each row execute function public.procplus_record_finance_audit();
grant select,insert,update,delete on public.procurement_bids to authenticated;
commit;
