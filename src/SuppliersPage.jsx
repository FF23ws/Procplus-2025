import { useEffect, useMemo, useState } from 'react'
import { createSupplier, loadSuppliers, updateSupplierAssessment } from './lib/suppliers.js'

const emptyForm = {
  legal_name: '',
  trading_name: '',
  nuit: '',
  email: '',
  phone: '',
  address: '',
  supplier_type: 'company',
  categories: '',
}

const statusLabels = {
  pending: 'Pendente',
  under_review: 'Em análise',
  prequalified: 'Pré-qualificado',
  rejected: 'Rejeitado',
  suspended: 'Suspenso',
  expired: 'Expirado',
}

const riskLabels = { low: 'Baixo', medium: 'Médio', high: 'Alto' }
const typeLabels = { company: 'Empresa', individual: 'Empresário individual', ngo: 'ONG / Associação' }

export default function SuppliersPage() {
  const [workspace, setWorkspace] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [assessment, setAssessment] = useState({ status: 'under_review', score: 0, risk_level: 'medium', prequalified_until: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const refresh = async (selectedId = selected?.id) => {
    const data = await loadSuppliers()
    setWorkspace(data)
    if (selectedId) {
      const current = data.suppliers.find(item => item.id === selectedId) || null
      setSelected(current)
      if (current) syncAssessment(current)
    }
  }

  const syncAssessment = (supplier) => setAssessment({
    status: supplier.status,
    score: supplier.score,
    risk_level: supplier.risk_level,
    prequalified_until: supplier.prequalified_until || '',
    notes: supplier.notes || '',
  })

  useEffect(() => { refresh().catch(err => setError(err.message)) }, [])

  const visibleSuppliers = useMemo(() => {
    if (!workspace) return []
    const term = query.trim().toLowerCase()
    return workspace.suppliers.filter(item => {
      const matchesStatus = filter === 'all' || item.status === filter
      const matchesSearch = !term || [item.legal_name, item.trading_name, item.nuit, item.supplier_code, ...(item.categories || [])]
        .filter(Boolean).some(value => value.toLowerCase().includes(term))
      return matchesStatus && matchesSearch
    })
  }, [workspace, filter, query])

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await createSupplier(workspace.organization.id, {
        ...form,
        trading_name: form.trading_name || null,
        nuit: form.nuit || null,
        address: form.address || null,
        categories: form.categories.split(',').map(item => item.trim()).filter(Boolean),
      })
      setForm(emptyForm)
      setShowForm(false)
      setMessage('Fornecedor registado com sucesso.')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const saveAssessment = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      const updated = await updateSupplierAssessment(selected.id, {
        ...assessment,
        score: Number(assessment.score),
        prequalified_until: assessment.prequalified_until || null,
      })
      setSelected(updated)
      setMessage(`Avaliação de ${updated.legal_name} guardada com sucesso.`)
      await refresh(updated.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const chooseSupplier = (supplier) => {
    setSelected(supplier)
    syncAssessment(supplier)
  }

  if (!workspace) return <main className="dashboard"><div className="empty">A carregar os fornecedores…</div></main>
  if (!workspace.organization) return <main className="dashboard"><div className="empty"><h2>Sem organização associada</h2></div></main>

  return <main className="dashboard">
    <div className="headline">
      <div><h1>Fornecedores</h1><p>Centralize o cadastro e as decisões de pré‑qualificação.</p></div>
      <button className="primary compact" onClick={() => { setShowForm(!showForm); setSelected(null) }}>{showForm ? 'Fechar' : '+ Novo fornecedor'}</button>
    </div>
    {message && <p className="alert success">{message}</p>}
    {error && <p className="alert error">{error}</p>}

    {showForm && <form className="card procurement-form" onSubmit={submit}>
      <div className="card-title"><div><h3>Novo fornecedor</h3><p>Registe a identidade, contactos e áreas de fornecimento.</p></div></div>
      <div className="form-pair">
        <label>Razão social<input value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })} required /></label>
        <label>Nome comercial<input value={form.trading_name} onChange={e => setForm({ ...form, trading_name: e.target.value })} /></label>
        <label>NUIT<input value={form.nuit} onChange={e => setForm({ ...form, nuit: e.target.value })} /></label>
        <label>Tipo<select value={form.supplier_type} onChange={e => setForm({ ...form, supplier_type: e.target.value })}>{Object.entries(typeLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
        <label>E-mail<input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></label>
        <label>Telefone<input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required /></label>
        <label className="span-two">Categorias de fornecimento<input value={form.categories} onChange={e => setForm({ ...form, categories: e.target.value })} placeholder="Ex.: Informática, Logística, Material de escritório" /></label>
        <label className="span-two">Endereço<textarea rows="3" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
      </div>
      <button className="primary compact" disabled={saving}>{saving ? 'A registar…' : 'Registar fornecedor'}</button>
    </form>}

    {!showForm && <section className="procurement-layout">
      <div className="card process-list">
        <div className="supplier-toolbar">
          <div><h3>Base de fornecedores</h3><small>{workspace.suppliers.length} fornecedor(es)</small></div>
          <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar fornecedor…" />
          <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os estados</option>{Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select>
        </div>
        {visibleSuppliers.length === 0 && <div className="list-empty">Nenhum fornecedor corresponde aos filtros.</div>}
        {visibleSuppliers.map(item => <button className={`process-row supplier-row ${selected?.id === item.id ? 'selected' : ''}`} key={item.id} onClick={() => chooseSupplier(item)}>
          <div><b>{item.trading_name || item.legal_name}</b><small>{item.supplier_code} · {item.nuit ? `NUIT ${item.nuit}` : typeLabels[item.supplier_type]}</small></div>
          <strong>{Number(item.score).toFixed(0)}/100</strong>
          <span className={`process-status supplier-${item.status}`}>{statusLabels[item.status]}</span>
        </button>)}
      </div>

      <aside className="card process-detail">
        {!selected ? <div className="detail-placeholder"><h3>Ficha do fornecedor</h3><p>Seleccione um fornecedor para consultar e avaliar.</p></div> : <>
          <div className="detail-heading">
            <span className={`process-status supplier-${selected.status}`}>{statusLabels[selected.status]}</span>
            <small>{selected.supplier_code}</small>
            <h2>{selected.trading_name || selected.legal_name}</h2>
          </div>
          <dl>
            <div><dt>Razão social</dt><dd>{selected.legal_name}</dd></div>
            <div><dt>NUIT</dt><dd>{selected.nuit || 'Não indicado'}</dd></div>
            <div><dt>Contacto</dt><dd>{selected.phone}<br />{selected.email}</dd></div>
            <div><dt>Risco</dt><dd>{riskLabels[selected.risk_level]}</dd></div>
          </dl>
          <div className="category-list">{(selected.categories || []).map(category => <span key={category}>{category}</span>)}</div>
          <form className="assessment-form" onSubmit={saveAssessment}>
            <h3>Pré‑qualificação</h3>
            <div className="form-pair">
              <label>Estado<select value={assessment.status} onChange={e => setAssessment({ ...assessment, status: e.target.value })}>{Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
              <label>Pontuação<input type="number" min="0" max="100" value={assessment.score} onChange={e => setAssessment({ ...assessment, score: e.target.value })} /></label>
              <label>Risco<select value={assessment.risk_level} onChange={e => setAssessment({ ...assessment, risk_level: e.target.value })}>{Object.entries(riskLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
              <label>Válido até<input type="date" value={assessment.prequalified_until} onChange={e => setAssessment({ ...assessment, prequalified_until: e.target.value })} /></label>
              <label className="span-two">Notas<textarea rows="3" value={assessment.notes} onChange={e => setAssessment({ ...assessment, notes: e.target.value })} /></label>
            </div>
            <button className="primary compact" disabled={saving}>{saving ? 'A guardar…' : 'Guardar avaliação'}</button>
          </form>
        </>}
      </aside>
    </section>}
  </main>
}
