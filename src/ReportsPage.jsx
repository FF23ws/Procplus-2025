import { useEffect, useMemo, useState } from 'react'
import { downloadProcurementReport, loadReportingDashboard } from './lib/reports.js'

const fundLabels = {
  internal: 'Fundos próprios',
  eu: 'União Europeia',
  american_government: 'Governo dos Estados Unidos',
  mozambique_government: 'Governo de Moçambique',
  international: 'Financiador internacional',
  other: 'Outro',
}

const statusLabels = {
  draft: 'Rascunho',
  pending_approval: 'Aguarda aprovação',
  published: 'Publicado',
  evaluation: 'Em avaliação',
  awarded: 'Adjudicado',
  cancelled: 'Cancelado',
  closed: 'Encerrado',
}

const money = (value, currency = 'MZN') => new Intl.NumberFormat('pt-MZ', {
  style: 'currency',
  currency,
  maximumFractionDigits: 0,
}).format(value)

const daysUntil = date => date ? Math.ceil((new Date(date) - new Date()) / 86400000) : null

export default function ReportsPage() {
  const [workspace, setWorkspace] = useState(null)
  const [period, setPeriod] = useState('all')
  const [error, setError] = useState('')

  useEffect(() => {
    loadReportingDashboard().then(setWorkspace).catch(err => setError(err.message))
  }, [])

  const processes = useMemo(() => {
    if (!workspace) return []
    if (period === 'all') return workspace.processes
    const months = Number(period)
    const boundary = new Date()
    boundary.setMonth(boundary.getMonth() - months)
    return workspace.processes.filter(item => new Date(item.created_at) >= boundary)
  }, [workspace, period])

  const dashboard = useMemo(() => {
    if (!workspace) return null
    const activeProcesses = processes.filter(item => !['cancelled', 'closed'].includes(item.status))
    const mznValue = activeProcesses.filter(item => item.currency === 'MZN').reduce((sum, item) => sum + Number(item.estimated_value), 0)
    const approved = workspace.approvals.filter(item => item.status === 'approved').length
    const decided = workspace.approvals.filter(item => item.status !== 'pending').length
    const approvalRate = decided ? Math.round((approved / decided) * 100) : 0
    const prequalified = workspace.suppliers.filter(item => item.status === 'prequalified').length
    const activeContracts = workspace.contracts.filter(item => item.status === 'active')
    const contractedMzn = workspace.contracts.filter(item => item.currency === 'MZN' && !['cancelled', 'terminated'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.total_value), 0)
    const approvedBudget = workspace.financeProjects.reduce((sum, item) => sum + Number(item.approved_budget || 0), 0)
    const committedMzn = workspace.financeProjects.reduce((sum, item) => sum + Number(item.committed_mzn || 0), 0)
    const spentMzn = workspace.financeProjects.reduce((sum, item) => sum + Number(item.spent_mzn || 0), 0)
    const compliantControls = workspace.controls.filter(item => item.status === 'compliant').length
    const complianceScore = workspace.controls.length ? Math.round((compliantControls / workspace.controls.length) * 100) : 0

    const alerts = []
    processes.forEach(item => {
      if (!item.deadline && ['published', 'evaluation'].includes(item.status)) alerts.push({ level: 'high', title: `${item.reference} sem prazo`, detail: 'O processo activo não tem prazo para propostas definido.' })
      if (item.procurement_method === 'direct_award') alerts.push({ level: 'medium', title: `${item.reference} por ajuste directo`, detail: 'Confirme se a justificação e a aprovação excepcional estão arquivadas.' })
      if (item.status === 'pending_approval') alerts.push({ level: 'medium', title: `${item.reference} aguarda aprovação`, detail: 'Existe uma decisão pendente no fluxo de aprovação.' })
    })
    workspace.suppliers.forEach(item => {
      const remaining = daysUntil(item.prequalified_until)
      if (item.status === 'prequalified' && remaining !== null && remaining <= 30) alerts.push({ level: remaining < 0 ? 'high' : 'medium', title: `${item.legal_name}: pré‑qualificação ${remaining < 0 ? 'expirada' : 'a expirar'}`, detail: remaining < 0 ? 'Suspenda a utilização ou renove a avaliação.' : `Validade termina dentro de ${remaining} dia(s).` })
    })
    workspace.contracts.forEach(item => {
      const remaining = daysUntil(item.end_date)
      if (item.status === 'active' && remaining !== null && remaining <= 30) alerts.push({ level: remaining < 0 ? 'high' : 'medium', title: `${item.contract_number}: vigência ${remaining < 0 ? 'expirada' : 'a terminar'}`, detail: remaining < 0 ? 'Actualize o estado ou formalize a extensão.' : `O contrato termina dentro de ${remaining} dia(s).` })
      item.contract_milestones?.forEach(milestone => {
        if (!['completed', 'cancelled'].includes(milestone.status) && daysUntil(milestone.due_date) < 0) alerts.push({ level: 'high', title: `${item.contract_number}: entrega em atraso`, detail: milestone.title })
      })
    })
    workspace.financeProjects.forEach(item => {
      if (Number(item.spent_mzn) > Number(item.approved_budget)) alerts.push({ level: 'high', title: `${item.code} com overspent`, detail: `A execução excede o orçamento em ${money(Number(item.spent_mzn) - Number(item.approved_budget))}.` })
    })
    workspace.controls.forEach(item => {
      if (item.status !== 'compliant' && ['high', 'critical'].includes(item.risk_level)) alerts.push({ level: 'high', title: item.control_name, detail: `${item.area}: controlo de risco ${item.risk_level} ainda não conforme.` })
    })
    return { activeProcesses, mznValue, approvalRate, prequalified, activeContracts, contractedMzn, approvedBudget, committedMzn, spentMzn, complianceScore, alerts }
  }, [workspace, processes])

  const funds = useMemo(() => Object.entries(fundLabels).map(([key, label]) => ({
    key,
    label,
    count: processes.filter(item => item.funding_source === key).length,
  })).filter(item => item.count > 0).sort((a, b) => b.count - a.count), [processes])

  const maxFund = Math.max(1, ...funds.map(item => item.count))

  if (!workspace) return <main className="dashboard"><div className="empty">{error || 'A preparar os relatórios…'}</div></main>
  if (!workspace.organization) return <main className="dashboard"><div className="empty"><h2>Sem organização associada</h2></div></main>

  return <main className="dashboard">
    <div className="headline report-headline">
      <div><h1>Relatórios</h1><p>Indicadores de procurement, execução e conformidade da organização.</p></div>
      <div className="report-actions">
        <select value={period} onChange={e => setPeriod(e.target.value)}><option value="all">Todo o período</option><option value="3">Últimos 3 meses</option><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option></select>
        <button className="primary compact" onClick={() => downloadProcurementReport({ ...workspace, processes })}>Exportar relatório consolidado</button>
      </div>
    </div>
    {error && <p className="alert error">{error}</p>}

    <section className="report-metrics">
      <article><small>PROCESSOS ACTIVOS</small><strong>{dashboard.activeProcesses.length}</strong><span>{money(dashboard.mznValue)} em processos MZN</span></article>
      <article><small>TAXA DE APROVAÇÃO</small><strong>{dashboard.approvalRate}%</strong><span>{workspace.approvals.length} pedido(s) registado(s)</span></article>
      <article><small>FORNECEDORES APTOS</small><strong>{dashboard.prequalified}</strong><span>de {workspace.suppliers.length} fornecedor(es)</span></article>
      <article><small>CONTRATOS ACTIVOS</small><strong>{dashboard.activeContracts.length}</strong><span>{money(dashboard.contractedMzn)} contratados em MZN</span></article>
    </section>

    <section className="report-metrics">
      <article><small>ORÇAMENTO APROVADO</small><strong>{money(dashboard.approvedBudget)}</strong><span>{workspace.financeProjects.length} projecto(s) financeiro(s)</span></article>
      <article><small>COMPROMETIDO</small><strong>{money(dashboard.committedMzn)}</strong><span>Compromissos aprovados e registados</span></article>
      <article><small>EXECUTADO</small><strong>{money(dashboard.spentMzn)}</strong><span>{dashboard.approvedBudget ? Math.round((dashboard.spentMzn / dashboard.approvedBudget) * 100) : 0}% do orçamento</span></article>
      <article><small>CONFORMIDADE</small><strong>{dashboard.complianceScore}%</strong><span>{workspace.controls.length} controlo(s) analisado(s)</span></article>
    </section>

    <section className="report-grid">
      <article className="card report-chart">
        <div className="card-title"><div><h3>Processos por origem dos fundos</h3><p>Distribuição no período seleccionado</p></div></div>
        {funds.length === 0 && <div className="list-empty">Sem processos no período.</div>}
        {funds.map(item => <div className="fund-bar" key={item.key}>
          <div><span>{item.label}</span><b>{item.count}</b></div>
          <i><u style={{ width: `${(item.count / maxFund) * 100}%` }} /></i>
        </div>)}
      </article>

      <article className="card compliance-card">
        <div className="card-title"><div><h3>Alertas de conformidade</h3><p>{dashboard.alerts.length} ponto(s) requerem atenção</p></div></div>
        <div className="compliance-alerts">
          {dashboard.alerts.length === 0 && <div className="compliance-clear"><span>✓</span><b>Sem alertas críticos</b><p>Os registos analisados estão dentro dos controlos configurados.</p></div>}
          {dashboard.alerts.slice(0, 8).map((item, index) => <div className={`compliance-alert alert-${item.level}`} key={`${item.title}-${index}`}>
            <span>{item.level === 'high' ? '!' : '•'}</span>
            <div><b>{item.title}</b><p>{item.detail}</p></div>
          </div>)}
        </div>
      </article>
    </section>

    <section className="card report-table-card">
      <div className="card-title"><div><h3>Resumo dos processos</h3><p>Visão consolidada dos procedimentos registados</p></div></div>
      <div className="report-table">
        <div className="report-table-header"><span>Processo</span><span>Financiamento</span><span>Valor</span><span>Estado</span></div>
        {processes.length === 0 && <div className="list-empty">Sem processos no período seleccionado.</div>}
        {processes.slice(0, 10).map(item => <div className="report-table-row" key={item.id}>
          <div><b>{item.title}</b><small>{item.reference}</small></div>
          <span>{fundLabels[item.funding_source]}</span>
          <strong>{money(item.estimated_value, item.currency)}</strong>
          <span className={`process-status status-${item.status}`}>{statusLabels[item.status]}</span>
        </div>)}
      </div>
    </section>
  </main>
}
