begin;
alter table public.approval_requests alter column process_id drop not null;
alter table public.approval_requests add column if not exists finance_entry_id uuid references public.finance_entries(id) on delete cascade;
alter table public.approval_requests add column if not exists entity_type text not null default 'procurement' check (entity_type in ('procurement','finance'));
update public.approval_requests set entity_type='procurement' where process_id is not null;
do $$ begin if not exists (select 1 from pg_constraint where conname='approval_requests_single_entity') then alter table public.approval_requests add constraint approval_requests_single_entity check (num_nonnulls(process_id,finance_entry_id)=1); end if; end $$;
create unique index if not exists approval_requests_one_pending_finance on public.approval_requests(finance_entry_id) where status='pending';
create or replace function public.open_finance_approval() returns trigger language plpgsql security definer set search_path=public as $$
begin if new.status='pending_approval' and (tg_op='INSERT' or old.status is distinct from new.status) and not exists (select 1 from public.approval_requests r where r.finance_entry_id=new.id and r.status='pending') then insert into public.approval_requests(organization_id,finance_entry_id,entity_type,submitted_by) values(new.organization_id,new.id,'finance',coalesce(auth.uid(),new.created_by)); end if; return new; end $$;
drop trigger if exists finance_open_approval on public.finance_entries;
create trigger finance_open_approval after insert or update of status on public.finance_entries for each row execute function public.open_finance_approval();
create or replace function public.enforce_finance_posting_approval() returns trigger language plpgsql set search_path=public as $$
begin if new.status='posted' and (tg_op='INSERT' or old.status is distinct from new.status) and not exists (select 1 from public.approval_requests r where r.finance_entry_id=new.id and r.status='approved') then raise exception 'O lançamento precisa de aprovação final antes do registo.'; end if; return new; end $$;
drop trigger if exists finance_posting_requires_approval on public.finance_entries;
create trigger finance_posting_requires_approval before insert or update of status on public.finance_entries for each row execute function public.enforce_finance_posting_approval();
create or replace function public.decide_procurement_approval(p_request_id uuid,p_decision text,p_comment text default null) returns public.approval_requests language plpgsql security definer set search_path=public as $$
declare v_request public.approval_requests; v_allowed boolean;
begin
  if p_decision not in ('approved','rejected','changes_requested') then raise exception 'Decisão inválida.'; end if;
  select * into v_request from public.approval_requests where id=p_request_id for update;
  if v_request.id is null or v_request.status<>'pending' then raise exception 'Este pedido já não está pendente.'; end if;
  select exists (select 1 from public.organization_members m where m.organization_id=v_request.organization_id and m.user_id=auth.uid() and m.active and (m.role in ('owner','admin','approver') or (v_request.entity_type='procurement' and v_request.current_level=1 and m.role='procurement_manager'))) into v_allowed;
  if not v_allowed then raise exception 'Não tem permissão para decidir neste nível.'; end if;
  if p_decision<>'approved' and nullif(trim(p_comment),'') is null then raise exception 'A justificação é obrigatória.'; end if;
  insert into public.approval_decisions(request_id,level,decision,comment,decided_by) values(v_request.id,v_request.current_level,p_decision,nullif(trim(p_comment),''),auth.uid());
  if p_decision='approved' and v_request.current_level<v_request.required_levels then update public.approval_requests set current_level=current_level+1 where id=v_request.id returning * into v_request;
  elsif p_decision='approved' then update public.approval_requests set status='approved',completed_at=now() where id=v_request.id returning * into v_request; if v_request.entity_type='finance' then update public.finance_entries set status='posted',approved_by=auth.uid(),approved_at=now() where id=v_request.finance_entry_id; else update public.procurement_processes set status='published' where id=v_request.process_id; end if;
  elsif p_decision='changes_requested' then update public.approval_requests set status='changes_requested',completed_at=now() where id=v_request.id returning * into v_request; if v_request.entity_type='finance' then update public.finance_entries set status='draft' where id=v_request.finance_entry_id; else update public.procurement_processes set status='draft' where id=v_request.process_id; end if;
  else update public.approval_requests set status='rejected',completed_at=now() where id=v_request.id returning * into v_request; if v_request.entity_type='finance' then update public.finance_entries set status='cancelled' where id=v_request.finance_entry_id; else update public.procurement_processes set status='cancelled' where id=v_request.process_id; end if; end if;
  return v_request;
end $$;
commit;
