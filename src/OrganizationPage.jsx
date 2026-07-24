import { useEffect, useState } from 'react'
import { inviteMember, loadOrganizationWorkspace, saveOrganization, updateMember } from './lib/organizations.js'

const roleLabels = {
  owner: 'Proprietário',
  admin: 'Administrador',
  procurement_manager: 'Gestor de procurement',
  procurement_officer: 'Oficial de procurement',
  evaluator: 'Avaliador',
  approver: 'Aprovador',
  finance: 'Finanças',
  auditor: 'Auditor',
  contract_manager: 'Gestor de contrato',
  viewer: 'Consulta',
}

const roleCapabilities = {
  admin: 'Organização, utilizadores, regras e todos os módulos',
  procurement_manager: 'Concursos, fornecedores, contratos e conformidade',
  procurement_officer: 'Preparação e gestão operacional dos processos',
  evaluator: 'Avaliação de propostas e consulta documental',
  approver: 'Decisões de procurement e financeiras',
  finance: 'Orçamentos, lançamentos, pagamentos e documentos',
  auditor: 'Consulta, conformidade, relatórios e trilho de auditoria',
  contract_manager: 'Contratos, entregas, documentos e acompanhamento',
  viewer: 'Consulta sem alterações',
}

export default function OrganizationPage() {
  const [workspace, setWorkspace] = useState(null)
  const [form, setForm] = useState(null)
  const [invite, setInvite] = useState({ email: '', role: 'viewer' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    const data = await loadOrganizationWorkspace()
    setWorkspace(data)
    setForm(data.organization ? {
      name: data.organization.name || '',
      legal_name: data.organization.legal_name || '',
      nuit: data.organization.nuit || '',
      organization_type: data.organization.organization_type || 'company',
      can_buy: data.organization.can_buy,
      can_supply: data.organization.can_supply,
    } : null)
  }

  useEffect(() => {
    refresh().catch(err => setError(err.message))
  }, [])

  const submitOrganization = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      await saveOrganization(workspace.organization.id, form)
      setMessage('Dados da organização actualizados.')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const submitInvite = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    try {
      const result = await inviteMember(workspace.organization.id, invite.email, invite.role)
      setMessage(result.status === 'added' ? 'O utilizador foi adicionado à organização.' : 'Convite registado. O acesso será activado quando o utilizador criar a conta.')
      setInvite({ email: '', role: 'viewer' })
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleMember = async (member) => {
    setSaving(true); setError(''); setMessage('')
    try {
      await updateMember(workspace.organization.id, member.user_id, { active: !member.active })
      setMessage(member.active ? 'Acesso do membro suspenso.' : 'Acesso do membro reactivado.')
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const changeRole = async (member, role) => {
    setSaving(true); setError(''); setMessage('')
    try {
      await updateMember(workspace.organization.id, member.user_id, { role })
      setMessage('Função do membro actualizada.')
      await refresh()
    } catch (err) { setError(err.message) } finally { setSaving(false) }
  }

  if (!workspace) return <main className="dashboard"><div className="empty">A carregar a organização…</div></main>
  if (!workspace.organization) return <main className="dashboard"><div className="empty"><h2>Sem organização associada</h2><p>Contacte o administrador da plataforma.</p></div></main>

  return <main className="dashboard">
    <div className="headline"><div><h1>Organização e utilizadores</h1><p>Configure a entidade, as funções e os acessos da equipa.</p></div><span className="plan-badge">{workspace.organization.subscription_plan}</span></div>
    {message && <p className="alert success">{message}</p>}
    {error && <p className="alert error">{error}</p>}
    <section className="settings-grid">
      <form className="card settings-form" onSubmit={submitOrganization}>
        <div className="card-title"><div><h3>Dados da organização</h3><p>Informação institucional usada nos processos.</p></div></div>
        <label>Nome comercial<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></label>
        <label>Nome legal<input value={form.legal_name} onChange={e => setForm({ ...form, legal_name: e.target.value })} /></label>
        <div className="form-pair">
          <label>NUIT<input value={form.nuit} onChange={e => setForm({ ...form, nuit: e.target.value })} /></label>
          <label>Tipo<select value={form.organization_type} onChange={e => setForm({ ...form, organization_type: e.target.value })}><option value="company">Empresa</option><option value="ngo">ONG</option><option value="government">Governo</option></select></label>
        </div>
        <div className="check-row"><label><input type="checkbox" checked={form.can_buy} onChange={e => setForm({ ...form, can_buy: e.target.checked })} /> Entidade compradora</label><label><input type="checkbox" checked={form.can_supply} onChange={e => setForm({ ...form, can_supply: e.target.checked })} /> Entidade fornecedora</label></div>
        <button className="primary compact" disabled={saving}>{saving ? 'A guardar…' : 'Guardar alterações'}</button>
      </form>
      <form className="card settings-form" onSubmit={submitInvite}>
        <div className="card-title"><div><h3>Adicionar utilizador</h3><p>Atribua a função adequada ao novo membro.</p></div></div>
        <label>E-mail<input type="email" value={invite.email} onChange={e => setInvite({ ...invite, email: e.target.value })} placeholder="nome@organizacao.org" required /></label>
        <label>Função<select value={invite.role} onChange={e => setInvite({ ...invite, role: e.target.value })}>{Object.entries(roleLabels).filter(([key]) => key !== 'owner').map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <button className="primary compact" disabled={saving}>{saving ? 'A processar…' : 'Adicionar membro'}</button>
      </form>
    </section>
    <section className="card members-card">
      <div className="card-title"><div><h3>Membros</h3><p>{workspace.members.length} utilizador(es) associado(s)</p></div></div>
      <div className="member-list">
        {workspace.members.map(member => <div className="member-row" key={member.user_id}>
          <div className="avatar">{(member.profiles?.full_name || member.profiles?.email || '?').split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase()}</div>
          <div><b>{member.profiles?.full_name || 'Utilizador'}</b><small>{member.profiles?.email || 'E-mail não disponível'}</small></div>
          {member.role === 'owner' ? <span className="role-pill">{roleLabels.owner}</span> : <select value={member.role} onChange={e => changeRole(member, e.target.value)} disabled={saving}>{Object.entries(roleLabels).filter(([key]) => key !== 'owner').map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select>}
          <span className={member.active ? 'status-active' : 'status-inactive'}>{member.active ? 'Activo' : 'Suspenso'}</span>
          {member.role !== 'owner' && <button className="text-button inline" onClick={() => toggleMember(member)} disabled={saving}>{member.active ? 'Suspender' : 'Reactivar'}</button>}
        </div>)}
      </div>
    </section>
    <section className="card members-card">
      <div className="card-title"><div><h3>Matriz de funções</h3><p>Separação de responsabilidades aplicada pela base de dados.</p></div></div>
      <div className="member-list">{Object.entries(roleCapabilities).map(([role, capability]) => <div className="member-row" key={role}><span className="role-pill">{roleLabels[role]}</span><div><b>{roleLabels[role]}</b><small>{capability}</small></div></div>)}</div>
    </section>
    {workspace.invitations.length > 0 && <section className="card members-card">
      <div className="card-title"><div><h3>Convites pendentes</h3><p>Aguardam criação da conta.</p></div></div>
      {workspace.invitations.map(item => <div className="member-row pending" key={item.id}><div><b>{item.email}</b><small>{new Date(item.created_at).toLocaleDateString('pt-PT')}</small></div><span className="role-pill">{roleLabels[item.role]}</span><span className="status-inactive">Pendente</span></div>)}
    </section>}
  </main>
}
