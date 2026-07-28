import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getSession, onAuthStateChange, signIn, signOut } from './lib/supabase.js'
import { loadSupplierPortal, submitPortalBid, updatePortalSupplier, uploadPortalDocument } from './lib/supplierPortal.js'
import './supplier-portal.css'

const documentTypes = {
  registration: 'Certidão de registo/BR',
  license: 'Alvará ou licença',
  nuit: 'NUIT',
  inss: 'Declaração de conformidade INSS',
  bank: 'Comprovativo bancário',
  statutes: 'Estatutos',
  experience: 'Experiência operacional',
  references: 'Referências comerciais',
  price_list: 'Tabela de preços',
  integrity: 'Declaração de integridade',
  other: 'Outro documento',
}
const statusLabels = { pending:'Pendente', under_review:'Em análise', prequalified:'Pré-qualificado', rejected:'Rejeitado', suspended:'Suspenso', expired:'Expirado' }

export function SupplierPortalLogin() {
  const navigate = useNavigate()
  const [email,setEmail] = useState('')
  const [password,setPassword] = useState('')
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  const submit = async event => {
    event.preventDefault(); setLoading(true); setError('')
    try { await signIn(email,password); navigate('/portal-fornecedor') }
    catch (err) { setError(err.message || 'Não foi possível iniciar a sessão.') }
    finally { setLoading(false) }
  }
  return <main className="supplier-login">
    <section className="supplier-login-brand"><div className="logo light">P<span>+</span></div><div><p className="eyebrow">PORTAL DO FORNECEDOR</p><h1>Oportunidades transparentes. Propostas seguras.</h1><p>Actualize a sua empresa, mantenha a pré‑qualificação válida e acompanhe cada participação.</p></div><small>Procplus · Área externa protegida</small></section>
    <section className="supplier-login-form"><form onSubmit={submit}><p className="eyebrow green">FORNECEDORES</p><h2>Entrar no portal</h2><p className="muted">Use o e-mail registado pela organização compradora.</p>
      <label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
      <label>Palavra-passe<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
      {error && <p className="alert error">{error}</p>}<button className="primary" disabled={loading}>{loading?'A entrar…':'Entrar'}</button>
      <small className="portal-help">Ainda não tem acesso? Contacte a organização compradora para registar o seu e-mail e enviar o convite.</small>
    </form></section>
  </main>
}

export function SupplierPortalProtected() {
  const [session,setSession] = useState(undefined)
  useEffect(()=>{ getSession().then(setSession).catch(()=>setSession(null)); return onAuthStateChange(setSession) },[])
  if(session===undefined) return <main className="loading-page">A validar o acesso do fornecedor…</main>
  return session ? <SupplierPortal /> : <Navigate to="/fornecedor" replace />
}

function SupplierPortal() {
  const navigate=useNavigate()
  const [workspace,setWorkspace]=useState(null)
  const [tab,setTab]=useState('overview')
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [saving,setSaving]=useState(false)
  const [docForm,setDocForm]=useState({documentType:'registration',expiresAt:'',file:null})
  const [bidProcess,setBidProcess]=useState(null)
  const [bidForm,setBidForm]=useState({amount:'',currency:'MZN',validityDate:''})
  const refresh=async()=>setWorkspace(await loadSupplierPortal())
  useEffect(()=>{refresh().catch(err=>setError(err.message))},[])
  const [profile,setProfile]=useState(null)
  useEffect(()=>{if(workspace?.supplier)setProfile({...workspace.supplier,categories:(workspace.supplier.categories||[]).join(', ')})},[workspace?.supplier])
  const proposalMap=useMemo(()=>new Map((workspace?.bids||[]).map(item=>[item.process_id,item])),[workspace?.bids])

  const saveProfile=async event=>{event.preventDefault();setSaving(true);setError('');try{await updatePortalSupplier(workspace.supplier.id,profile);setMessage('Perfil actualizado e submetido para validação.');await refresh()}catch(err){setError(err.message)}finally{setSaving(false)}}
  const upload=async event=>{event.preventDefault();setSaving(true);setError('');try{await uploadPortalDocument(workspace,docForm);setDocForm({documentType:'registration',expiresAt:'',file:null});setMessage('Documento enviado para análise.');await refresh()}catch(err){setError(err.message)}finally{setSaving(false)}}
  const submitBid=async event=>{event.preventDefault();setSaving(true);setError('');try{await submitPortalBid(workspace,bidProcess,bidForm);setBidProcess(null);setBidForm({amount:'',currency:'MZN',validityDate:''});setMessage('Proposta submetida electronicamente e registada com sucesso.');await refresh()}catch(err){setError(err.message)}finally{setSaving(false)}}
  const logout=async()=>{await signOut();navigate('/fornecedor')}
  if(!workspace)return <main className="loading-page">A preparar o Portal do Fornecedor…</main>
  if(!workspace.account)return <main className="portal-unlinked"><div className="logo">P<span>+</span></div><h1>Acesso ainda não associado</h1><p>Não encontramos um fornecedor registado com o e-mail desta conta. Peça à organização compradora para confirmar o seu e-mail no cadastro.</p><button onClick={logout}>Terminar sessão</button></main>
  const completeness=[profile?.legal_name,profile?.nuit,profile?.email,profile?.phone,profile?.address,profile?.categories].filter(Boolean).length
  const completion=Math.round(completeness/6*100)

  return <div className="supplier-portal-shell">
    <aside><div className="logo light small">P<span>+</span><b>fornecedores</b></div><nav>{[['overview','Visão geral'],['profile','Perfil'],['documents','Documentos'],['tenders','Concursos'],['proposals','Propostas'],['contracts','Contratos e pagamentos']].map(([key,label])=><button className={tab===key?'active':''} onClick={()=>setTab(key)} key={key}>◫ <span>{label}</span></button>)}</nav><div className="portal-org"><b>{workspace.organization?.name}</b><small>{workspace.supplier.supplier_code}</small></div><button className="portal-logout" onClick={logout}>Terminar sessão</button></aside>
    <section className="supplier-workspace"><header><div><small>PORTAL DO FORNECEDOR</small><h2>{workspace.supplier.trading_name||workspace.supplier.legal_name}</h2></div><span className={`portal-status ${workspace.supplier.status}`}>{statusLabels[workspace.supplier.status]}</span></header>
      <main>{message&&<p className="alert success">{message}</p>}{error&&<p className="alert error">{error}</p>}
        {tab==='overview'&&<><div className="portal-headline"><div><h1>Visão geral</h1><p>Acompanhe a sua qualificação e as oportunidades disponíveis.</p></div></div><section className="portal-metrics"><article><small>PERFIL COMPLETO</small><strong>{completion}%</strong><span>Dados essenciais</span></article><article><small>DOCUMENTOS</small><strong>{workspace.documents.length}</strong><span>Submetidos</span></article><article><small>CONCURSOS ABERTOS</small><strong>{workspace.tenders.filter(x=>x.status==='published').length}</strong><span>Disponíveis</span></article><article><small>PROPOSTAS</small><strong>{workspace.bids.length}</strong><span>Submetidas</span></article></section><section className="portal-grid"><article className="portal-card"><h3>Próximas acções</h3>{completion<100&&<p>Complete os dados do perfil da empresa.</p>}{workspace.documents.length<5&&<p>Envie os documentos de pré‑qualificação.</p>}{completion===100&&workspace.documents.length>=5&&<p>O seu cadastro está preparado para análise.</p>}</article><article className="portal-card"><h3>Estado da pré‑qualificação</h3><strong className="qualification">{statusLabels[workspace.supplier.status]}</strong><p>Pontuação comunicada pela organização: {Number(workspace.supplier.score||0).toFixed(0)}/100</p>{workspace.supplier.prequalified_until&&<small>Válida até {new Date(workspace.supplier.prequalified_until).toLocaleDateString('pt-PT')}</small>}</article></section></>}
        {tab==='profile'&&profile&&<form className="portal-card portal-form" onSubmit={saveProfile}><h1>Perfil da empresa</h1><p>Os campos de avaliação só podem ser alterados pela organização compradora.</p><div className="form-pair"><label>Razão social<input value={profile.legal_name||''} onChange={e=>setProfile({...profile,legal_name:e.target.value})} required/></label><label>Nome comercial<input value={profile.trading_name||''} onChange={e=>setProfile({...profile,trading_name:e.target.value})}/></label><label>NUIT<input value={profile.nuit||''} onChange={e=>setProfile({...profile,nuit:e.target.value})}/></label><label>Tipo<select value={profile.supplier_type} onChange={e=>setProfile({...profile,supplier_type:e.target.value})}><option value="company">Empresa</option><option value="individual">Empresário individual</option><option value="ngo">ONG / Associação</option></select></label><label>E-mail<input type="email" value={profile.email||''} onChange={e=>setProfile({...profile,email:e.target.value})} required/></label><label>Telefone<input value={profile.phone||''} onChange={e=>setProfile({...profile,phone:e.target.value})} required/></label><label>País<input value={profile.country_code||'MZ'} maxLength="2" onChange={e=>setProfile({...profile,country_code:e.target.value.toUpperCase()})}/></label><label>Categorias<input value={profile.categories||''} onChange={e=>setProfile({...profile,categories:e.target.value})} placeholder="Informática, logística…"/></label><label className="span-two">Endereço<textarea rows="3" value={profile.address||''} onChange={e=>setProfile({...profile,address:e.target.value})}/></label></div><button className="primary compact" disabled={saving}>{saving?'A guardar…':'Guardar perfil'}</button></form>}
        {tab==='documents'&&<section className="portal-grid documents"><form className="portal-card portal-form" onSubmit={upload}><h2>Enviar documento</h2><label>Tipo<select value={docForm.documentType} onChange={e=>setDocForm({...docForm,documentType:e.target.value})}>{Object.entries(documentTypes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Validade<input type="date" value={docForm.expiresAt} onChange={e=>setDocForm({...docForm,expiresAt:e.target.value})}/></label><label>Ficheiro PDF/JPG/PNG<input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e=>setDocForm({...docForm,file:e.target.files?.[0]||null})} required/></label><small>Máximo: 10 MB.</small><button className="primary compact" disabled={saving}>{saving?'A enviar…':'Enviar documento'}</button></form><article className="portal-card"><h2>Documentos submetidos</h2>{workspace.documents.length?workspace.documents.map(doc=><div className="portal-list-row" key={doc.id}><div><b>{documentTypes[doc.document_type]||doc.document_type}</b><small>{doc.name} · {new Date(doc.uploaded_at).toLocaleDateString('pt-PT')}</small></div><span className={`doc-${doc.review_status}`}>{doc.review_status}</span></div>):<p>Ainda não existem documentos.</p>}</article></section>}
        {tab==='tenders'&&<section><div className="portal-headline"><div><h1>Concursos</h1><p>Oportunidades publicadas pela organização.</p></div></div><div className="portal-card">{workspace.tenders.length?workspace.tenders.map(tender=><div className="tender-row" key={tender.id}><div><span className={`portal-status ${tender.status}`}>{tender.status}</span><h3>{tender.title}</h3><small>{tender.reference} · {tender.procurement_method}</small><p>{tender.description}</p></div><div><strong>{Number(tender.estimated_value).toLocaleString('pt-PT')} {tender.currency}</strong><small>Prazo: {tender.deadline?new Date(tender.deadline).toLocaleString('pt-PT'):'Não definido'}</small>{tender.status==='published'&&!proposalMap.has(tender.id)&&<button className="primary compact" onClick={()=>{setBidProcess(tender);setBidForm({...bidForm,currency:tender.currency})}}>Submeter proposta</button>}{proposalMap.has(tender.id)&&<span className="submitted-badge">✓ Proposta submetida</span>}</div></div>):<p>Não existem concursos disponíveis.</p>}</div></section>}
        {tab==='proposals'&&<section><div className="portal-headline"><div><h1>Minhas propostas</h1><p>Histórico e estado das submissões.</p></div></div><div className="portal-card">{workspace.bids.length?workspace.bids.map(bid=><div className="portal-list-row" key={bid.id}><div><b>{bid.bid_reference}</b><small>{new Date(bid.submitted_at).toLocaleString('pt-PT')} · {Number(bid.amount).toLocaleString('pt-PT')} {bid.currency}</small></div><span className={`bid-${bid.status}`}>{bid.status}</span></div>):<p>Ainda não submeteu propostas.</p>}</div></section>}
        {tab==='contracts'&&<section><div className="portal-headline"><div><h1>Contratos e pagamentos</h1><p>Contratos atribuídos à sua empresa. Facturas e pagamentos serão ligados nesta mesma área.</p></div></div><div className="portal-card">{workspace.contracts.length?workspace.contracts.map(contract=><div className="portal-list-row" key={contract.id}><div><b>{contract.title}</b><small>{contract.contract_number} · {Number(contract.total_value).toLocaleString('pt-PT')} {contract.currency}</small></div><span className={`contract-${contract.status}`}>{contract.status}</span></div>):<p>Ainda não existem contratos associados.</p>}</div></section>}
      </main>
    </section>
    {bidProcess&&<div className="portal-modal"><form className="portal-card portal-form" onSubmit={submitBid}><button type="button" className="modal-close" onClick={()=>setBidProcess(null)}>×</button><p className="eyebrow green">SUBMISSÃO ELECTRÓNICA</p><h2>{bidProcess.title}</h2><p>{bidProcess.reference}</p><label>Valor da proposta<input type="number" min="0" step="0.01" value={bidForm.amount} onChange={e=>setBidForm({...bidForm,amount:e.target.value})} required/></label><label>Moeda<select value={bidForm.currency} onChange={e=>setBidForm({...bidForm,currency:e.target.value})}>{['MZN','USD','EUR','ZAR'].map(x=><option key={x}>{x}</option>)}</select></label><label>Validade da proposta<input type="date" value={bidForm.validityDate} onChange={e=>setBidForm({...bidForm,validityDate:e.target.value})}/></label><p className="form-warning">Ao submeter, a proposta fica registada com data e hora. Os critérios publicados não podem ser alterados durante a avaliação.</p><button className="primary" disabled={saving}>{saving?'A submeter…':'Confirmar submissão'}</button></form></div>}
  </div>
}
