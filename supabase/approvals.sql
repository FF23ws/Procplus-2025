create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  process_id uuid not null references public.procurement_processes(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','rejected','changes_requested','cancelled')),
  current_level integer not null default 1 check (current_level >= 1),
  required_levels integer not null default 2 check (required_levels >= 1),
  submitted_by uuid not null references public.profiles(id),
  submitted_at timestamptz not null default now(),
  completed_at timestamptz
);

create unique index if not exists approval_requests_one_pending_process
on public.approval_requests(process_id)
where status = 'pending';

create table if not exists public.approval_decisions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.approval_requests(id) on delete cascade,
  level integer not null check (level >= 1),
  decision text not null check (decision in ('approved','rejected','changes_requested')),
  comment text,
  decided_by uuid not null references public.profiles(id),
  decided_at timestamptz not null default now(),
  unique (request_id, level)
);

alter table public.approval_requests enable row level security;
alter table public.approval_decisions enable row level security;

drop policy if exists "members view approval requests" on public.approval_requests;
create policy "members view approval requests" on public.approval_requests for select
using (public.is_organization_member(organization_id));

drop policy if exists "members view approval decisions" on public.approval_decisions;
create policy "members view approval decisions" on public.approval_decisions for select
using (
  exists (
    select 1 from public.approval_requests r
    where r.id = approval_decisions.request_id
      and public.is_organization_member(r.organization_id)
  )
);

create or replace function public.open_procurement_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending_approval'
    and (tg_op = 'INSERT' or old.status is distinct from new.status)
    and not exists (
      select 1 from public.approval_requests r
      where r.process_id = new.id and r.status = 'pending'
    )
  then
    insert into public.approval_requests(organization_id, process_id, submitted_by)
    values (new.organization_id, new.id, coalesce(auth.uid(), new.created_by));
  end if;
  return new;
end;
$$;

drop trigger if exists procurement_open_approval on public.procurement_processes;
create trigger procurement_open_approval
after insert or update of status on public.procurement_processes
for each row execute procedure public.open_procurement_approval();

insert into public.approval_requests(organization_id, process_id, submitted_by)
select p.organization_id, p.id, p.created_by
from public.procurement_processes p
where p.status = 'pending_approval'
  and not exists (
    select 1 from public.approval_requests r
    where r.process_id = p.id and r.status = 'pending'
  );

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

  select * into v_request
  from public.approval_requests
  where id = p_request_id
  for update;

  if v_request.id is null or v_request.status <> 'pending' then
    raise exception 'Este pedido já não está pendente.';
  end if;

  select exists (
    select 1 from public.organization_members m
    where m.organization_id = v_request.organization_id
      and m.user_id = auth.uid()
      and m.active
      and (
        m.role in ('owner','admin')
        or (v_request.current_level = 1 and m.role = 'procurement_manager')
        or (v_request.current_level >= 2 and m.role = 'approver')
      )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Não tem permissão para decidir neste nível.';
  end if;

  if p_decision <> 'approved' and nullif(trim(p_comment), '') is null then
    raise exception 'A justificação é obrigatória.';
  end if;

  insert into public.approval_decisions(request_id, level, decision, comment, decided_by)
  values (v_request.id, v_request.current_level, p_decision, nullif(trim(p_comment), ''), auth.uid());

  if p_decision = 'approved' and v_request.current_level < v_request.required_levels then
    update public.approval_requests
    set current_level = current_level + 1
    where id = v_request.id
    returning * into v_request;
  elsif p_decision = 'approved' then
    update public.approval_requests
    set status = 'approved', completed_at = now()
    where id = v_request.id
    returning * into v_request;
    update public.procurement_processes set status = 'published' where id = v_request.process_id;
  elsif p_decision = 'changes_requested' then
    update public.approval_requests
    set status = 'changes_requested', completed_at = now()
    where id = v_request.id
    returning * into v_request;
    update public.procurement_processes set status = 'draft' where id = v_request.process_id;
  else
    update public.approval_requests
    set status = 'rejected', completed_at = now()
    where id = v_request.id
    returning * into v_request;
    update public.procurement_processes set status = 'cancelled' where id = v_request.process_id;
  end if;

  return v_request;
end;
$$;

revoke all on function public.decide_procurement_approval(uuid,text,text) from public;
grant execute on function public.decide_procurement_approval(uuid,text,text) to authenticated;
