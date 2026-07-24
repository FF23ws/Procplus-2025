import { useNavigate } from 'react-router-dom'
import './onboarding.css'

export default function OnboardingChecklist({ workspace }) {
  const navigate = useNavigate()
  const steps = [
    { label: 'Confirmar dados da organização', detail: 'Nome legal, NUIT e tipo de entidade.', done: Boolean(workspace.organization?.name), path: '/app/organizacao' },
    { label: 'Cadastrar o primeiro fornecedor', detail: 'Crie ou pré-qualifique um fornecedor.', done: workspace.suppliers.length > 0, path: '/app/fornecedores' },
    { label: 'Criar o primeiro processo', detail: 'Registe um concurso ou pedido de cotações.', done: workspace.processes.length > 0, path: '/app/concursos' },
    { label: 'Configurar um projecto financeiro', detail: 'Defina orçamento, moeda e financiador.', done: workspace.financeProjects.length > 0, path: '/app/finanças' },
    { label: 'Adicionar controlos de conformidade', detail: 'Configure evidências e riscos aplicáveis.', done: workspace.controls.length > 0, path: '/app/conformidade' },
  ]
  const completed = steps.filter(step => step.done).length
  if (completed === steps.length) return null
  const progress = Math.round((completed / steps.length) * 100)
  return <section className="onboarding-card">
    <div className="onboarding-heading">
      <div><p className="eyebrow green">CONFIGURAÇÃO INICIAL</p><h2>Prepare o espaço da sua organização</h2><small>{completed} de {steps.length} passos concluídos</small></div>
      <strong>{progress}%</strong>
    </div>
    <i><u style={{ width: `${progress}%` }} /></i>
    <div className="onboarding-steps">{steps.map((step, index) => <button type="button" className={step.done ? 'complete' : ''} key={step.label} onClick={() => navigate(step.path)}>
      <span>{step.done ? '✓' : index + 1}</span><div><b>{step.label}</b><small>{step.detail}</small></div><em>{step.done ? 'Concluído' : 'Configurar →'}</em>
    </button>)}</div>
  </section>
}
