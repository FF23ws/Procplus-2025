import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { canAccess, loadCurrentAccess } from './lib/access.js'

const items = [
  { module: 'procurement', label: 'Concursos', path: '/app/concursos' },
  { module: 'suppliers', label: 'Fornecedores', path: '/app/fornecedores' },
  { module: 'contracts', label: 'Contratos', path: '/app/contratos' },
  { module: 'approvals', label: 'Aprovações', path: '/app/aprovações' },
  { module: 'finance', label: 'Finanças', path: '/app/finanças' },
  { module: 'compliance', label: 'Conformidade', path: '/app/conformidade' },
  { module: 'reports', label: 'Relatórios', path: '/app/relatórios' },
  { module: 'documents', label: 'Documentos', path: '/app/documentos' },
  { module: 'administration', label: 'Administração', path: '/app/administração' },
  { module: 'integrations', label: 'Integrações', path: '/app/integrações' },
  { module: 'assistant', label: 'Assistente IA', path: '/app/ia' },
]

export default function RoleNavigation() {
  const [access, setAccess] = useState(null)
  useEffect(() => { loadCurrentAccess().then(setAccess).catch(() => setAccess({ role: 'viewer' })) }, [])
  const role = access?.role
  return <>
    <nav>
      <NavLink end to="/app">◫ <span>Visão geral</span></NavLink>
      {canAccess(role, 'organization') && <NavLink to="/app/organizacao">◫ <span>Organização</span></NavLink>}
      {items.filter(item => canAccess(role, item.module)).map(item => <NavLink key={item.module} to={item.path}>◫ <span>{item.label}</span></NavLink>)}
    </nav>
    <div className="org"><b>{access?.organizations?.name || 'Organização'}</b><small>{access?.organizations?.subscription_plan || 'Procplus'}</small></div>
  </>
}
