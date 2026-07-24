alter type public.organization_role add value if not exists 'contract_manager';

create or replace function public.has_organization_role(p_organization_id uuid,p_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.organization_members m where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.active and m.role::text=any(p_roles));
$$;
revoke all on function public.has_organization_role(uuid,text[]) from public;
grant execute on function public.has_organization_role(uuid,text[]) to authenticated;

drop policy if exists finance_projects_member_access on public.finance_projects;
create policy finance_projects_read on public.finance_projects for select to authenticated using (public.has_organization_role(organization_id,array['owner','admin','finance','auditor','approver','viewer']));
create policy finance_projects_manage on public.finance_projects for all to authenticated using (public.has_organization_role(organization_id,array['owner','admin','finance'])) with check (public.has_organization_role(organization_id,array['owner','admin','finance']));
drop policy if exists finance_entries_member_access on public.finance_entries;
create policy finance_entries_read on public.finance_entries for select to authenticated using (public.has_organization_role(organization_id,array['owner','admin','finance','auditor','approver','viewer']));
create policy finance_entries_manage on public.finance_entries for all to authenticated using (public.has_organization_role(organization_id,array['owner','admin','finance'])) with check (public.has_organization_role(organization_id,array['owner','admin','finance']));
drop policy if exists finance_exchange_rates_member_access on public.finance_exchange_rates;
create policy finance_rates_read on public.finance_exchange_rates for select to authenticated using (public.has_organization_role(organization_id,array['owner','admin','finance','auditor','viewer']));
create policy finance_rates_manage on public.finance_exchange_rates for all to authenticated using (public.has_organization_role(organization_id,array['owner','admin','finance'])) with check (public.has_organization_role(organization_id,array['owner','admin','finance']));
drop policy if exists compliance_controls_member_access on public.compliance_controls;
create policy compliance_controls_read on public.compliance_controls for select to authenticated using (public.has_organization_role(organization_id,array['owner','admin','procurement_manager','procurement_officer','evaluator','approver','finance','auditor','contract_manager','viewer']));
create policy compliance_controls_manage on public.compliance_controls for all to authenticated using (public.has_organization_role(organization_id,array['owner','admin','procurement_manager','auditor'])) with check (public.has_organization_role(organization_id,array['owner','admin','procurement_manager','auditor']));
drop policy if exists documents_member_insert on public.documents;
create policy documents_member_insert on public.documents for insert to authenticated with check (public.has_organization_role(organization_id,array['owner','admin','procurement_manager','procurement_officer','finance','auditor','contract_manager']));
drop policy if exists documents_member_delete on public.documents;
create policy documents_member_delete on public.documents for delete to authenticated using (public.has_organization_role(organization_id,array['owner','admin','procurement_manager','finance','contract_manager']));
