import { useMemo, useState } from 'react'

const controls = [
  { id: 1, area: 'Aquisição', control: 'Mínimo de três cotações', fund: 'União Europeia', owner: 'Procurement', status: 'Conforme', evidence: '3 cotações anexadas' },
  { id: 2, area: 'Aprovação', control: 'Aprovação conforme matriz de autoridade', fund: 'Fundos próprios', owner: 'Direcção', status: 'Pendente', evidence: 'Aguarda aprovação final' },
  { id: 3, area: 'Fornecedor', control: 'Declaração de conflito de interesses', fund: 'Governo Americano', owner: 'Compliance', status: 'Alerta', evidence: 'Documento não anexado' },
  { id: 4, area: 'Contrato', control: 'Contrato e ordem de compra assinados', fund: 'Light for the World', owner: 'Gestor do contrato', status: 'Conforme', evidence: 'Contrato activo' },
  { id: 5, area: 'Pagamento', control: 'Entrega validada antes do pagamento', fund: 'União Europeia', owner: 'Finanças', status: 'Conforme', evidence: 'Auto de recepção' },
]

const audit = [
  { time: '24 Jul · 13:42', user: 'Fernando Francisco', action: 'Publicou o módulo financeiro', entity: 'Sistema' },
  { time: '24 Jul · 12:58', user: 'Administrador', action: 'Actualizou regra de três cotações', entity: 'Regra UE' },
  { time: '24 Jul · 11:31', user: 'Procurement Officer', action: 'Submeteu processo para aprovação', entity: 'PP-2026-014' },
  { time: '23 Jul · 16:20', user: 'Finance Officer', action: 'Validou compromisso orçamental', entity: 'PO-2026-031' },
]

export default function CompliancePage() {
  const [fund, setFund] = useState('all')
  const [status, setStatus] = useState('all')
  const visible = useMemo(() => controls.filter(item => (fund === 'all' || item.fund === fund) && (status === 'all' || item.status === status)), [fund, status])
  const compliant = controls.filter(item => item.status === 'Conforme').length
  const pending = controls.filter(item => item.status === 'Pendente').length
  const alerts = controls.filter(item => item.status === 'Alerta').length
  const score = Math.round((compliant / controls.length) * 100)

  return <main className="dashboard compliance-page">
    <div className="headline compliance-headline">
      <div><p className="eyebrow green">GOVERNAÇÃO E CONTROLO</p><h1>Conformidade e auditoria</h1><p>Verifique regras, evidências, aprovações e alterações em cada processo.</p></div>
      <button className="primary compact">Exportar dossier de auditoria</button>
    </div>

    <section className="compliance-metrics">
      <article><small>ÍNDICE DE CONFORMIDADE</small><strong>{score}%</strong><span className="up">Controlos verificados</span></article>
      <article><small>CONTROL0S CONFORMES</small><strong>{compliant}</strong><span>de {controls.length} controlos</span></article>
      <article><small>PENDENTES</small><strong>{pending}</strong><span className="warn">Requer acompanhamento</span></article>
      <article className={alerts ? 'metric-danger' : ''}><small>ALERTAS CRÍTICOS</small><strong>{alerts}</strong><span>Acção necessária</span></article>
    </section>

    <section className="compliance-grid">
      <article className="card control-card">
        <div className="control-toolbar">
          <div><h3>Matriz de controlos</h3><small>Requisitos por financiador e etapa do processo</small></div>
          <select value={fund} onChange={event => setFund(event.target.value)}><option value="all">Todos os financiadores</option>{[...new Set(controls.map(item => item.fund))].map(item => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos os estados</option><option>Conforme</option><option>Pendente</option><option>Alerta</option></select>
        </div>
        <div className="control-list">{visible.map(item => <div className="control-row" key={item.id}>
          <span className={`control-icon control-${item.status.toLowerCase()}`}>{item.status === 'Conforme' ? '✓' : item.status === 'Pendente' ? '…' : '!'}</span>
          <div><b>{item.control}</b><small>{item.area} · {item.fund}</small><p>{item.evidence}</p></div>
          <span>{item.owner}</span>
          <span className={`process-status compliance-${item.status.toLowerCase()}`}>{item.status}</span>
        </div>)}</div>
      </article>

      <article className="card risk-card">
        <div className="card-title"><div><h3>Riscos prioritários</h3><p>Excepções que podem afectar a elegibilidade.</p></div></div>
        <div className="risk-item high"><span>ALTO</span><div><b>Conflito de interesses em falta</b><p>O processo não deve avançar para adjudicação sem a declaração assinada.</p></div></div>
        <div className="risk-item medium"><span>MÉDIO</span><div><b>Aprovação final pendente</b><p>O compromisso só deve ser assumido após validação da autoridade competente.</p></div></div>
        <div className="risk-item low"><span>BAIXO</span><div><b>Taxa cambial por confirmar</b><p>Validar a taxa de liquidação antes do relatório ao financiador.</p></div></div>
      </article>
    </section>

    <article className="card audit-card">
      <div className="card-title"><div><h3>Trilho de auditoria</h3><p>Registo cronológico das principais acções no sistema.</p></div><button>Ver registo completo</button></div>
      <div className="audit-timeline">{audit.map((item, index) => <div className="audit-event" key={item.time}>
        <span>{index + 1}</span><div><b>{item.action}</b><small>{item.user} · {item.entity}</small></div><time>{item.time}</time>
      </div>)}</div>
    </article>
  </main>
}
