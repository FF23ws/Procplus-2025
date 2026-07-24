import { useEffect, useMemo, useState } from 'react'
import { addDocument, loadDocumentWorkspace } from './lib/documents.js'

const typeLabels = {
  tender: 'Concurso',
  supplier: 'Fornecedor',
  contract: 'Contrato',
  approval: 'Aprovação',
  organization: 'Organização',
}

const statusLabels = { valid: 'Válido', expiring: 'A expirar', expired: 'Expirado', missing: 'Em falta' }

const formatDate = value => value ? new Intl.DateTimeFormat('pt-MZ').format(new Date(value)) : 'Sem validade'

export default function DocumentsPage() {
  const [workspace, setWorkspace] = useState(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')

  const refresh = () => loadDocumentWorkspace().then(setWorkspace).catch(err => setError(err.message))
  useEffect(refresh, [])

  const documents = useMemo(() => {
    if (!workspace) return []
    return workspace.documents.filter(item => {
      const text = `${item.name} ${item.reference || ''} ${item.entity_name || ''}`.toLowerCase()
      return (type === 'all' || item.entity_type === type) && text.includes(query.toLowerCase())
    })
  }, [workspace, query, type])

  const metrics = useMemo(() => {
    const all = workspace?.documents || []
    return {
      total: all.length,
      valid: all.filter(x => x.status === 'valid').length,
      warning: all.filter(x => x.status === 'expiring').length,
      action: all.filter(x => ['expired', 'missing'].includes(x.status)).length,
    }
  }, [workspace])

  const submit = async event => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    try {
      await addDocument({
        name: form.get('name'),
        entity_type: form.get('entity_type'),
        entity_name: form.get('entity_name'),
        reference: form.get('reference'),
        expires_at: form.get('expires_at') || null,
        file: form.get('file'),
      })
      event.currentTarget.reset()
      setShowForm(false)
      refresh()
    } catch (err) {
      setError(err.message || 'Não foi possível guardar o documento.')
    }
  }

  if (!workspace) return <main className="dashboard"><div className="empty">{error || 'A preparar o arquivo documental…'}</div></main>

  return <main className="dashboard">
    <div className="headline document-headline">
      <div><h1>Documentos e anexos</h1><p>Arquivo central, validade e evidências de todos os processos de procurement.</p></div>
      <button className="primary compact" onClick={() => setShowForm(value => !value)}>+ Adicionar documento</button>
    </div>

    {error && <p className="alert error">{error}</p>}

    <section className="document-metrics">
      <article><small>TOTAL ARQUIVADO</small><strong>{metrics.total}</strong><span>documentos registados</span></article>
      <article><small>VÁLIDOS</small><strong>{metrics.valid}</strong><span className="up">Dentro da validade</span></article>
      <article><small>A EXPIRAR</small><strong>{metrics.warning}</strong><span className="warn">Próximos 30 dias</span></article>
      <article><small>ACÇÃO NECESSÁRIA</small><strong>{metrics.action}</strong><span className="danger">Expirados ou em falta</span></article>
    </section>

    {showForm && <form className="card document-form" onSubmit={submit}>
      <div className="card-title"><div><h3>Novo documento</h3><p>Registe o ficheiro e a entidade a que pertence.</p></div></div>
      <div className="document-form-grid">
        <label>Nome do documento<input name="name" required placeholder="Ex.: Certidão de quitação fiscal" /></label>
        <label>Área<select name="entity_type" required>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Entidade ou processo<input name="entity_name" required placeholder="Nome do fornecedor, concurso ou contrato" /></label>
        <label>Referência<input name="reference" placeholder="Ex.: PP-2026-014" /></label>
        <label>Validade<input name="expires_at" type="date" /></label>
        <label>Ficheiro<input name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" /></label>
      </div>
      <div className="document-form-actions"><button type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary compact">Guardar documento</button></div>
    </form>}

    <section className="card document-card">
      <div className="document-toolbar">
        <div><h3>Arquivo documental</h3><small>{documents.length} resultado(s)</small></div>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar documento ou referência…" />
        <select value={type} onChange={e => setType(e.target.value)}><option value="all">Todas as áreas</option>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      </div>
      <div className="document-table">
        <div className="document-row document-header"><span>Documento</span><span>Ligação</span><span>Validade</span><span>Estado</span></div>
        {documents.length === 0 && <div className="list-empty">Nenhum documento corresponde aos filtros.</div>}
        {documents.map(item => <div className="document-row" key={item.id}>
          <div><b>{item.name}</b><small>{item.file_name || 'Documento obrigatório'}</small></div>
          <div><b>{item.entity_name || typeLabels[item.entity_type]}</b><small>{item.reference || typeLabels[item.entity_type]}</small></div>
          <span>{formatDate(item.expires_at)}</span>
          <span className={`process-status document-${item.status}`}>{statusLabels[item.status]}</span>
        </div>)}
      </div>
    </section>
  </main>
}
