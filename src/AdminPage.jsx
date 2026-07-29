import { useEffect, useMemo, useState } from 'react'
import { createExchangeRate, createFundingRule, loadAdministration, toggleFundingRule } from './lib/admin.js'

const sourceLabels = {
  internal: 'Fundos próprios',
  eu: 'União Europeia',
  american_government: 'Fundos do Governo dos Estados Unidos da América',
  mozambique_government: 'Governo de Moçambique',
  international: 'Organizações multilaterais, internacionais e cooperação bilateral',
  other: 'Outro financiador ou regra personalizada',
}

const methodLabels = {
  request_for_quotation: 'Pedido de cotações',
  open_tender: 'Concurso público',
  restricted_tender: 'Concurso restrito',
  direct_award: 'Ajuste directo',
}

const exchangeRateSources = [
  'InfoEuro — Comissão Europeia',
  'Banco de Moçambique',
  'Millennium bim',
  'Standard Bank Moçambique',
  'BCI — Banco Comercial e de Investimentos',
  'Absa Bank Moçambique',
  'Moza Banco',
  'Ecobank Moçambique',
  'Access Bank Mozambique',
  'Taxa contratual ou indicada pelo doador',
]

const emptyRule = {
  name: '', funding_source: 'internal', min_value: 0, threshold: '', currency: 'MZN',
  procurement_method: 'request_for_quotation', quotations_required: 3, approval_levels: 1,
  required_documents_text: '', min_deadline_days: 3, publication_required: false,
  committee_required: false, contract_required: false,
}

const ruleTemplates = [
  {
    id: 'eu-direct', group: 'União Europeia', title: 'Compra directa — menos de 5.000 EUR',
    note: 'Modelo de referência; confirme sempre o contrato e as regras do doador.',
    values: {
      name: 'UE · Compra directa < 5.000 EUR', funding_source: 'eu', min_value: 0, threshold: 4999.99,
      currency: 'EUR', procurement_method: 'direct_award', quotations_required: 1, approval_levels: 1,
      required_documents_text: 'Requisição de compra, Aprovação, Cotação, Ordem de compra',
      min_deadline_days: 0, publication_required: false, committee_required: false, contract_required: false,
    },
  },
  {
    id: 'eu-rfq', group: 'União Europeia', title: 'RFQ — 5.000 a 60.000 EUR',
    note: 'Modelo de referência; confirme sempre o contrato e as regras do doador.',
    values: {
      name: 'UE · RFQ 5.000–60.000 EUR', funding_source: 'eu', min_value: 5000, threshold: 60000,
      currency: 'EUR', procurement_method: 'request_for_quotation', quotations_required: 3, approval_levels: 3,
      required_documents_text: 'Requisição de compra, RFQ, Cotações, Matriz comparativa, Declarações de imparcialidade, Relatório de avaliação, Aprovação, Contrato',
      min_deadline_days: 5, publication_required: false, committee_required: true, contract_required: true,
    },
  },
  {
    id: 'eu-open', group: 'União Europeia', title: 'Concurso público — acima de 60.000 EUR',
    note: 'Modelo de referência; confirme sempre o contrato e as regras do doador.',
    values: {
      name: 'UE · Concurso público > 60.000 EUR', funding_source: 'eu', min_value: 60000.01, threshold: '',
      currency: 'EUR', procurement_method: 'open_tender', quotations_required: 3, approval_levels: 4,
      required_documents_text: 'Requisição de compra, Aprovação do procedimento, Anúncio público, Caderno de encargos, Acta de abertura, Lista de presença, Declarações de imparcialidade, Avaliação técnica, Avaliação financeira, Due diligence, Decisão de adjudicação, Contrato',
      min_deadline_days: 15, publication_required: true, committee_required: true, contract_required: true,
    },
  },
  {
    id: 'adpp-small', group: 'Fundos próprios · ADPP 2022', title: 'Compra até 499 USD',
    note: 'Faixa baseada no Manual ADPP 2022; use a taxa trimestral aprovada para equivalência em MZN.',
    values: {
      name: 'ADPP · Compra 0–499 USD', funding_source: 'internal', min_value: 0, threshold: 499,
      currency: 'USD', procurement_method: 'direct_award', quotations_required: 1, approval_levels: 1,
      required_documents_text: 'Requisição de compra, Aprovação, Cotação ou RFQ, Ordem de compra, Factura, Guia de remessa, Comprovativo de pagamento, Recibo',
      min_deadline_days: 0, publication_required: false, committee_required: false, contract_required: false,
    },
  },
  {
    id: 'adpp-three-quotes', group: 'Fundos próprios · ADPP 2022', title: 'Compra de 500 a 999,99 USD',
    note: 'Faixa baseada no Manual ADPP 2022; use a taxa trimestral aprovada para equivalência em MZN.',
    values: {
      name: 'ADPP · RFQ 500–999,99 USD', funding_source: 'internal', min_value: 500, threshold: 999.99,
      currency: 'USD', procurement_method: 'request_for_quotation', quotations_required: 3, approval_levels: 2,
      required_documents_text: 'Requisição de compra, Pedido formal de cotações, Três cotações, Tabela comparativa, QEC-A, Aprovação, NPT ou Ordem de compra, Factura, Guia de remessa, Comprovativo de pagamento, Recibo',
      min_deadline_days: 3, publication_required: false, committee_required: false, contract_required: false,
    },
  },
  {
    id: 'adpp-rfq', group: 'Fundos próprios · ADPP 2022', title: 'Compra de 1.000 a 9.999,99 USD',
    note: 'Faixa baseada no Manual ADPP 2022; confirme RFQ/RFP conforme a complexidade.',
    values: {
      name: 'ADPP · RFQ/RFP 1.000–9.999,99 USD', funding_source: 'internal', min_value: 1000, threshold: 9999.99,
      currency: 'USD', procurement_method: 'request_for_quotation', quotations_required: 3, approval_levels: 2,
      required_documents_text: 'Requisição de compra, RFQ ou RFP, Três propostas, Declarações de imparcialidade, Tabela comparativa, Relatório da comissão de avaliação, Aprovação, NPT, Ordem de compra ou contrato, Factura, Guia de remessa, Comprovativo de pagamento, Recibo',
      min_deadline_days: 5, publication_required: false, committee_required: true, contract_required: false,
    },
  },
]

export default function AdminPage() {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(emptyRule)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [rateForm, setRateForm] = useState({
    baseCurrency: 'USD', quoteCurrency: 'MZN', rate: '', rateType: 'quarterly',
    source: exchangeRateSources[0], customSource: '', reference: '', validFrom: '', validTo: '',
  })
  const refresh = async () => setData(await loadAdministration())
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [])
  const activeMembers = useMemo(() => data?.members.filter(x => x.active).length || 0, [data])

  const submit = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await createFundingRule(data.organization.id, {
        ...form,
        min_value: Number(form.min_value || 0),
        threshold: form.threshold === '' ? null : Number(form.threshold),
        quotations_required: Number(form.quotations_required),
        approval_levels: Number(form.approval_levels),
        min_deadline_days: Number(form.min_deadline_days || 0),
        required_documents: form.required_documents_text.split(',').map(item => item.trim()).filter(Boolean),
        required_documents_text: undefined,
        active: true,
      })
      setMessage('Regra de procurement criada e activada.')
      setForm(emptyRule)
      await refresh()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const toggle = async rule => {
    setSaving(true); setError('')
    try { await toggleFundingRule(rule.id, !rule.active); await refresh() }
    catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const applyTemplate = template => {
    setForm({ ...emptyRule, ...template.values })
    setMessage(`Modelo “${template.title}” carregado. Reveja os campos e clique em Activar regra.`)
    setError('')
  }

  const submitRate = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      if (rateForm.baseCurrency === rateForm.quoteCurrency) throw new Error('As moedas de origem e destino devem ser diferentes.')
      const source = rateForm.source === 'other' ? rateForm.customSource.trim() : rateForm.source
      if (!source) throw new Error('Indique a outra fonte da taxa cambial.')
      await createExchangeRate(data.organization.id, { ...rateForm, source })
      setRateForm({ baseCurrency: 'USD', quoteCurrency: 'MZN', rate: '', rateType: 'quarterly', source: exchangeRateSources[0], customSource: '', reference: '', validFrom: '', validTo: '' })
      setMessage('Taxa cambial registada. O motor já pode utilizá-la dentro do período indicado.')
      await refresh()
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  if (!data) return <main className="dashboard"><div className="empty">A carregar a administração…</div></main>
  return <main className="dashboard">
    <div className="headline admin-headline"><div><h1>Administração</h1><p>Gira permissões, regras de procurement e rastreabilidade da plataforma.</p></div><span className="plan-badge">{data.organization?.subscription_plan || 'Enterprise'}</span></div>
    {message && <p className="alert success">{message}</p>}
    {error && <p className="alert error">{error}</p>}
    <section className="admin-metrics">
      <article><small>UTILIZADORES ACTIVOS</small><strong>{activeMembers}</strong><span>{data.members.length} associados</span></article>
      <article><small>REGRAS ACTIVAS</small><strong>{data.rules.filter(x => x.active).length}</strong><span>Por financiador e faixa de valor</span></article>
      <article><small>EVENTOS DE AUDITORIA</small><strong>{data.logs.length}</strong><span>Últimos 50 eventos</span></article>
    </section>
    <section className="card">
      <div className="card-title"><div><h3>Biblioteca de modelos</h3><p>Pré-configurações editáveis. Nenhum modelo é activado sem revisão.</p></div></div>
      <div className="admin-rule-list">{ruleTemplates.map(template => <div className="admin-rule" key={template.id}>
        <div><b>{template.title}</b><small>{template.group}</small><small>{template.note}</small></div>
        <button className="primary compact" type="button" onClick={() => applyTemplate(template)}>Usar modelo</button>
      </div>)}</div>
    </section>
    <section className="admin-grid">
      <form className="card settings-form" onSubmit={submitRate}>
        <div className="card-title"><div><h3>Nova taxa cambial</h3><p>Registe a taxa aprovada, a fonte e o período de validade.</p></div></div>
        <div className="form-pair">
          <label>Moeda de origem<select value={rateForm.baseCurrency} onChange={e => setRateForm({...rateForm,baseCurrency:e.target.value})}>{['USD','EUR','MZN','ZAR','GBP'].map(x => <option key={x}>{x}</option>)}</select></label>
          <label>Moeda de destino<select value={rateForm.quoteCurrency} onChange={e => setRateForm({...rateForm,quoteCurrency:e.target.value})}>{['MZN','USD','EUR','ZAR','GBP'].map(x => <option key={x}>{x}</option>)}</select></label>
        </div>
        <label>Taxa<input type="number" min="0.00000001" step="0.00000001" value={rateForm.rate} onChange={e => setRateForm({...rateForm,rate:e.target.value})} placeholder="Ex.: MZN por 1 USD/EUR" required /></label>
        <label>Tipo<select value={rateForm.rateType} onChange={e => setRateForm({...rateForm,rateType:e.target.value})}><option value="quarterly">Taxa trimestral</option><option value="tranche">Taxa da tranche</option><option value="contract">Taxa contratual</option><option value="donor">Taxa do doador</option><option value="bank">Taxa bancária</option><option value="manual">Manual</option></select></label>
        <label>Fonte<select value={rateForm.source} onChange={e => setRateForm({...rateForm,source:e.target.value})}>
          {exchangeRateSources.map(source => <option key={source} value={source}>{source}</option>)}
          <option value="other">Outra fonte</option>
        </select></label>
        {rateForm.source === 'other' && <label>Nome da fonte<input value={rateForm.customSource} onChange={e => setRateForm({...rateForm,customSource:e.target.value})} placeholder="Indique a instituição ou documento" required /></label>}
        <label>Referência<input value={rateForm.reference} onChange={e => setRateForm({...rateForm,reference:e.target.value})} placeholder="Boletim, URL, contrato, tranche ou aprovação" required /></label>
        <div className="form-pair"><label>Válida desde<input type="date" value={rateForm.validFrom} onChange={e => setRateForm({...rateForm,validFrom:e.target.value})} required /></label><label>Válida até<input type="date" value={rateForm.validTo} onChange={e => setRateForm({...rateForm,validTo:e.target.value})} /></label></div>
        <button className="primary compact" disabled={saving}>{saving ? 'A guardar…' : 'Registar taxa'}</button>
      </form>
      <section className="card">
        <div className="card-title"><div><h3>Histórico cambial</h3><p>{data.rates?.length || 0} taxa(s) registada(s)</p></div></div>
        <div className="admin-rule-list">{data.rates?.length ? data.rates.map(rate => <div className="admin-rule" key={rate.id}><div><b>1 {rate.base_currency} = {Number(rate.rate).toLocaleString('pt-PT', { maximumFractionDigits: 8 })} {rate.quote_currency}</b><small>{rate.source} · {rate.rate_type} · {new Date(rate.valid_from).toLocaleDateString('pt-PT')}{rate.valid_to ? ` a ${new Date(rate.valid_to).toLocaleDateString('pt-PT')}` : ' em diante'}</small><small>{rate.reference || 'Sem referência adicional'}</small></div><span className={rate.active ? 'status-active' : 'status-inactive'}>{rate.active ? 'Activa' : 'Inactiva'}</span></div>) : <p className="list-empty">Ainda não existem taxas cambiais.</p>}</div>
      </section>
    </section>
    <section className="admin-grid">
      <form className="card settings-form" onSubmit={submit}>
        <div className="card-title"><div><h3>Nova regra automática</h3><p>Defina a faixa, o método e os requisitos obrigatórios.</p></div></div>
        <label>Nome da regra<input value={form.name} onChange={e => setForm({...form,name:e.target.value})} required /></label>
        <label>Origem dos fundos<select value={form.funding_source} onChange={e => setForm({...form,funding_source:e.target.value})}>{Object.entries(sourceLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Método obrigatório<select value={form.procurement_method} onChange={e => setForm({...form,procurement_method:e.target.value})}>{Object.entries(methodLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <div className="form-pair"><label>Valor mínimo<input type="number" min="0" value={form.min_value} onChange={e => setForm({...form,min_value:e.target.value})} required /></label><label>Valor máximo<input type="number" min="0" value={form.threshold} onChange={e => setForm({...form,threshold:e.target.value})} placeholder="Vazio = sem limite" /></label></div>
        <label>Moeda<select value={form.currency} onChange={e => setForm({...form,currency:e.target.value})}><option>MZN</option><option>USD</option><option>EUR</option><option>ZAR</option></select></label>
        <div className="form-pair"><label>Cotações exigidas<input type="number" min="0" max="10" value={form.quotations_required} onChange={e => setForm({...form,quotations_required:e.target.value})} /></label><label>Níveis de aprovação<input type="number" min="1" max="5" value={form.approval_levels} onChange={e => setForm({...form,approval_levels:e.target.value})} /></label></div>
        <label>Prazo mínimo para propostas (dias)<input type="number" min="0" value={form.min_deadline_days} onChange={e => setForm({...form,min_deadline_days:e.target.value})} /></label>
        <label>Documentos obrigatórios<input value={form.required_documents_text} onChange={e => setForm({...form,required_documents_text:e.target.value})} placeholder="Pedido de compra, especificações, orçamento aprovado" /><small>Separe os documentos por vírgulas.</small></label>
        <label><input type="checkbox" checked={form.publication_required} onChange={e => setForm({...form,publication_required:e.target.checked})} /> Publicação pública obrigatória</label>
        <label><input type="checkbox" checked={form.committee_required} onChange={e => setForm({...form,committee_required:e.target.checked})} /> Comissão de avaliação obrigatória</label>
        <label><input type="checkbox" checked={form.contract_required} onChange={e => setForm({...form,contract_required:e.target.checked})} /> Contrato obrigatório</label>
        <button className="primary compact" disabled={saving}>{saving ? 'A guardar…' : 'Activar regra'}</button>
      </form>
      <section className="card">
        <div className="card-title"><div><h3>Regras configuradas</h3><p>{data.rules.length} regra(s) da organização</p></div></div>
        <div className="admin-rule-list">{data.rules.length ? data.rules.map(rule => <div className="admin-rule" key={rule.id}><div><b>{rule.name}</b><small>{sourceLabels[rule.funding_source] || rule.funding_source} · {Number(rule.min_value || 0).toLocaleString('pt-PT')}–{rule.threshold == null ? 'sem limite' : Number(rule.threshold).toLocaleString('pt-PT')} {rule.currency} · {methodLabels[rule.procurement_method] || rule.procurement_method} · {rule.quotations_required} cotação(ões)</small></div><span className={rule.active ? 'status-active' : 'status-inactive'}>{rule.active ? 'Activa' : 'Inactiva'}</span><button className="text-button inline" onClick={() => toggle(rule)} disabled={saving}>{rule.active ? 'Desactivar' : 'Activar'}</button></div>) : <p className="list-empty">Ainda não existem regras personalizadas.</p>}</div>
      </section>
    </section>
    <section className="card admin-audit">
      <div className="card-title"><div><h3>Registo de auditoria</h3><p>Acções administrativas e alterações relevantes.</p></div></div>
      <div className="audit-list">{data.logs.length ? data.logs.map(log => <div className="audit-row" key={log.id}><span>●</span><div><b>{log.action}</b><small>{log.entity_type}{log.entity_id ? ' · '+log.entity_id : ''}</small></div><time>{new Date(log.created_at).toLocaleString('pt-PT')}</time></div>) : <p className="list-empty">O registo começará a ser preenchido com as próximas alterações.</p>}</div>
    </section>
  </main>
}
