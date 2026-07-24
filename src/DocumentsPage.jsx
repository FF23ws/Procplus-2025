import { useEffect, useMemo, useState } from 'react'
import { addDocument, loadDocumentWorkspace, openDocument, removeDocument } from './lib/documents.js'

const typeLabels = { tender: 'Concurso', supplier: 'Fornecedor', contract: 'Contrato', approval: 'Aprovação', organization: 'Organização', finance: 'Finanças', compliance: 'Conformidade', payment: 'Pagamento', other: 'Outro' }
const statusLabels = { valid: 'Válido', expiring: 'A expirar', expired: 'Expirado' }
const formatDate = value => value ? new Intl.DateTimeFormat('pt-MZ').format(new Date(value)) : 'Sem validade'

export default function DocumentsPage() {
  const [workspace, setWorkspace] = useState(null)
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const refresh = async () => {
    try { setWorkspace(await loadDocumentWorkspace()) }
    catch (err) { setError(err.message || 'Não foi possível carregar o arquivo.') }
  }
  useEffect(() => { refresh() }, [])
  const documents = useMemo(() => (workspace?.documents || []).filter(item => {
    const text = `${item.name} ${item.reference || ''} ${item.entity_name || ''}`.toLowerCase()
    return (type === 'all' || item.entity_type === type) && text.includes(query.toLowerCase())
  }), [workspace, query, type])
  const metrics = useMemo(() => {
    const all = workspace?.documents || []
    return { total: all.length, valid: all.filter(x => x.status === 'valid').length, warning: all.filter(x => x.status === 'expiring').length, action: all.filter(x => x.status === 'expired').length }
  }, [workspace])
  const submit = async event => {
    event.preventDefault(); setError(''); setMessage(''); setSaving(true)
    const form = new FormData(event.currentTarget)
    try {
      await addDocument({ name: form.get('name'), entity_type: form.get('entity_type'), entity_name: form.get('entity_name'), reference: form.get('reference'), expires_at: form.get('expires_at') || null, file: form.get('file') })
      event.currentTarget.reset(); setShowForm(false); setMessage('Documento guardado com segurança no arquivo.'); await refresh()
    } catch (err) { setError(err.message || 'Não foi possível guardar o documento.') }
    finally { setSaving(false) }
  }
  const view = async item => {
    setError('')
    try { await openDocument(item.storage_path) } catch (err) { setError(err.message || 'Não foi possível abrir o documento.') }
  }
  const remove = async item => {
    if (!window.confirm(`Eliminar permanentemente “${item.name}”?`)) return
    setError(''); setMessage('')
    try { await removeDocument(item); setMessage('Documento eliminado.'); await refresh() }
    catch (err) { setError(err.message || 'Não foi possível eliminar o documento.') }
  }
  if (!workspace) return <main className="dashboard"><div className="empty">{error || 'A preparar o arquivo documental…'}</div></main>
  return <main className="dashboard">
    <div className="headline document-headline"><div><h1>Documentos e anexos</h1><p>Arquivo privado, validade e evidências de procurement.</p></div><button className="primary compact" onClick={() => setShowForm(value => !value)}>+ Adicionar documento</button></div>
    {error && <p className="alert error">{error}</p>}{message && <p className="alert success">{message}</p>}
    <section className="document-metrics">
      <article><small>TOTAL ARQUIVADO</small><strong>{metrics.total}</strong><span>documentos registados</span></article>
      <article><small>VÁLIDOS</small><strong>{metrics.valid}</strong><span className="up">Dentro da validade</span></article>
      <article><small>A EXPIRAR</small><strong>{metrics.warning}</strong><span className="warn">Próximos 30 dias</span></article>
      <article><small>ACÇÃO NECESSÁRIA</small><strong>{metrics.action}</strong><span className="danger">Documentos expirados</span></article>
    </section>
    {showForm && <form className="card document-form" onSubmit={submit}>
      <div className="card-title"><div><h3>Novo documento</h3><p>Formatos PDF, Word, Excel e imagem; máximo 20 MB.</p></div></div>
      <div className="document-form-grid">
        <label>Nome do documento<input name="name" required /></label>
        <label>Área<select name="entity_type" required>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Entidade ou processo<input name="entity_name" required /></label>
        <label>Referência<input name="reference" /></label>
        <label>Validade<input name="expires_at" type="date" /></label>
        <label>Ficheiro<input name="file" type="file" required accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" /></label>
      </div>
      <div className="document-form-actions"><button type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="primary compact" disabled={saving}>{saving ? 'A guardar…' : 'Guardar documento'}</button></div>
    </form>}
    <section className="card document-card">
      <div className="document-toolbar"><div><h3>Arquivo documental</h3><small>{documents.length} resultado(s)</small></div><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar documento ou referência…" /><select value={type} onChange={e => setType(e.target.value)}><option value="all">Todas as áreas</option>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      <div className="document-table">
        <div className="document-row document-header"><span>Documento</span><span>Ligação</span><span>Validade</span><span>Estado / Acções</span></div>
        {!documents.length && <div className="list-empty">Nenhum documento corresponde aos filtros.</div>}
        {documents.map(item => <div className="document-row" key={item.id}><div><b>{item.name}</b><small>{item.file_name}</small></div><div><b>{item.entity_name || typeLabels[item.entity_type]}</b><small>{item.reference || typeLabels[item.entity_type]}</small></div><span>{formatDate(item.expires_at)}</span><div><span className={`process-status document-${item.status}`}>{statusLabels[item.status]}</span><button type="button" onClick={() => view(item)}>Abrir</button><button type="button" onClick={() => remove(item)}>Eliminar</button></div></div>)}
      </div>
    </section>
  </main>
}
