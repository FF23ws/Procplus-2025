import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadReportingDashboard } from './lib/reports.js'
import './dashboard.css'

const statusLabels = { draft: 'Rascunho', pending_approval: 'Aguarda aprovação', published: 'Publicado', evaluation: 'Em avaliação', awarded: 'Adjudicado', cancelled: 'Cancelado', closed: 'Encerrado' }
const money = value => new Intl.NumberFormat('pt-MZ', { style: 'currency', currency: 'MZN', maximumFractionDigits: 0 }).format(Number(value || 0))

export default function DashboardPage() {
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { loadReportingDashboard().then(setWorkspace).catch(cause => setError(cause.message || 'Não foi possível carregar o painel.')) }, [])
  const data = useMemo(() => {
    if (!workspace) return null
    const activeProcesses = workspace.processes.filter(item => !['cancelled', 'closed'].includes(item.status))
    const pending = workspace.approvals.filter(item => item.status === 'pending')
    const processValue = activeProcesses.filter(item => item.currency === 'MZN').reduce((sum, item) => sum + Number(item.estimated_value || 0), 0)
    const compliant = workspace.controls.filter(item => item.status === 'compliant').length
    const compliance = workspace.controls.length ? Math.round((compliant / workspace.controls.length) * 100) : 0
    const approvedBudget = workspace.financeProjects.reduce((sum, item) => sum + Number(item.approved_budget || 0), 0)
    const spent = workspace.financeProjects.reduce((sum, item) => sum + Number(item.spent_mzn || 0), 0)
    const overspent = workspace.financeProjects.filter(item => Number(item.spent_mzn) > Number(item.approved_budget))
    const critical = workspace.controls.filter(item => item.status !== 'compliant' && ['high', 'critical'].includes(item.risk_level))
    return { activeProcesses, pending, processValue, compliance, approvedBudget, spent, overspent, critical }
  }, [workspace])
  if (!workspace) return <main className="dashboard"><div className="empty">{error || 'A carregar a visão geral…'}</div></main>
  return <main className="dashboard live-dashboard">
    <div className="headline"><div><h1>Visão geral</h1><p>Dados actualizados da sua organização.</p></div><button className="primary compact" onClick={() => navigate('/app/concursos')}>+ Novo processo</button></div>
    {error && <p className="alert error">{error}</p>}
    <section className="metrics">
      <article><small>PROCESSOS ACTIVOS</small><strong>{data.activeProcesses.length}</strong><span>{workspace.processes.length} processo(s) no total</span></article>
      <article><small>AGUARDAM APROVAÇÃO</small><strong>{data.pending.length}</strong><span className={data.pending.length ? 'warn' : 'up'}>{data.pending.length ? 'Acção necessária' : 'Sem pendências'}</span></article>
      <article><small>VALOR EM PROCESSO</small><strong>{money(data.processValue)}</strong><span>Processos registados em MZN</span></article>
      <article><small>CONFORMIDADE</small><strong>{data.compliance}%</strong><span className={data.critical.length ? 'warn' : 'up'}>{data.critical.length} risco(s) prioritário(s)</span></article>
    </section>
    <section className="dashboard-finance">
      <article><small>ORÇAMENTO APROVADO</small><strong>{money(data.approvedBudget)}</strong></article>
      <article><small>EXECUÇÃO FINANCEIRA</small><strong>{money(data.spent)}</strong><span>{data.approvedBudget ? Math.round((data.spent / data.approvedBudget) * 100) : 0}% executado</span></article>
      <article className={data.overspent.length ? 'dashboard-danger' : ''}><small>PROJECTOS COM OVERSPENT</small><strong>{data.overspent.length}</strong><span>{data.overspent.length ? 'Requer intervenção' : 'Dentro do orçamento'}</span></article>
    </section>
    <section className="grid">
      <article className="card wide"><div className="card-title"><div><h3>Processos recentes</h3><p>Últimos registos da organização</p></div><button onClick={() => navigate('/app/concursos')}>Ver todos</button></div>
        <div className="table">{workspace.processes.slice(0, 6).map(item => <div className="row" key={item.id}><div><b>{item.title}</b><small>{item.reference}</small></div><strong>{item.currency === 'MZN' ? money(item.estimated_value) : `${Number(item.estimated_value).toLocaleString('pt-MZ')} ${item.currency}`}</strong><span className={`pill ${item.status === 'awarded' ? 'approved' : ''}`}>{statusLabels[item.status] || item.status}</span></div>)}{!workspace.processes.length && <p className="list-empty">Ainda não existem processos.</p>}</div>
      </article>
      <article className="card"><div className="card-title"><div><h3>Acções prioritárias</h3><p>Itens que exigem atenção</p></div></div>
        <div className="dashboard-priorities">
          {data.overspent.map(item => <button key={item.id} onClick={() => navigate('/app/finanças')}><span>!</span><div><b>Overspent em {item.code}</b><small>Rever a execução financeira.</small></div></button>)}
          {data.critical.map(item => <button key={item.id} onClick={() => navigate('/app/conformidade')}><span>!</span><div><b>{item.control_name}</b><small>Risco {item.risk_level} em aberto.</small></div></button>)}
          {data.pending.length > 0 && <button onClick={() => navigate('/app/aprovações')}><span>•</span><div><b>{data.pending.length} aprovação(ões) pendente(s)</b><small>Consultar decisões aguardando validação.</small></div></button>}
          {!data.overspent.length && !data.critical.length && !data.pending.length && <div className="dashboard-clear">✓ Sem acções críticas</div>}
        </div>
      </article>
    </section>
  </main>
}
