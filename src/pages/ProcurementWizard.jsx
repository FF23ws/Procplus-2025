import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const steps = [
  ['Informações Gerais','Identificação e prioridade'],
  ['Projecto e Financiamento','Fonte de fundos e orçamento'],
  ['Objecto da Aquisição','Descrição, quantidades e entrega'],
  ['Compliance','Validação automática das regras'],
  ['Critérios','Matriz de avaliação'],
  ['Aprovações','Fluxo e responsáveis'],
  ['Documentos','Anexos obrigatórios'],
  ['Revisão','Confirmação final'],
  ['Publicação','Geração do processo']
]

const initialForm = {
  title:'Aquisição de equipamento informático',
  department:'Tecnologias de Informação',
  requester:'Fernando Francisco',
  priority:'Normal',
  justification:'Substituição de equipamento obsoleto e reforço da capacidade operacional.',
  project:'Teachers Resilience & Well-Being',
  donor:'União Europeia',
  costCenter:'TRWB-ICT-2026',
  budgetLine:'Equipamento e materiais',
  currency:'EUR',
  availableBudget:'60000',
  category:'Equipamento informático',
  quantity:'20',
  unit:'Unidade',
  estimatedValue:'45000',
  deliveryLocation:'Maputo',
  deliveryDays:'30',
  description:'Fornecimento de computadores portáteis, acessórios e serviços de configuração.'
}

function Field({label, children, full=false}){
  return <div className={`field${full?' full':''}`}><label>{label}</label>{children}</div>
}

export default function ProcurementWizard(){
  const [step,setStep]=useState(0)
  const [form,setForm]=useState(initialForm)
  const [published,setPublished]=useState(false)
  const navigate=useNavigate()
  const code='RFQ-2026-019'
  const update=(key,value)=>setForm(prev=>({...prev,[key]:value}))

  const compliance=useMemo(()=>{
    const amount=Number(form.estimatedValue||0)
    const budget=Number(form.availableBudget||0)
    const checks=[
      ['Orçamento disponível', amount>0 && amount<=budget],
      ['Procedimento adequado: RFQ', amount>0 && amount<=50000],
      ['Mínimo de 3 cotações', amount>500],
      ['Publicação pública', amount>=50000 ? false : true],
      ['Aprovação do Director', amount>=10000],
      ['Declaração de conflito de interesses', false]
    ]
    const passed=checks.filter(([,ok])=>ok).length
    return {checks,score:Math.round((passed/checks.length)*100)}
  },[form.estimatedValue,form.availableBudget])

  function content(){
    if(published){
      return <div className="success-box"><div className="success-icon">✓</div><h2>Processo criado com sucesso</h2><p>O processo <b>{code}</b> foi guardado e está pronto para seguir para aprovação.</p><button className="btn btn-primary" onClick={()=>navigate('/dashboard')}>Voltar ao Dashboard</button></div>
    }
    if(step===0) return <><h2>Informações Gerais</h2><p>Registe os dados principais do novo processo.</p><div className="form-grid"><Field label="Código do processo"><input value={code} disabled /></Field><Field label="Prioridade"><select value={form.priority} onChange={e=>update('priority',e.target.value)}><option>Normal</option><option>Urgente</option><option>Crítica</option></select></Field><Field label="Título do processo" full><input value={form.title} onChange={e=>update('title',e.target.value)} /></Field><Field label="Departamento"><input value={form.department} onChange={e=>update('department',e.target.value)} /></Field><Field label="Solicitante"><input value={form.requester} onChange={e=>update('requester',e.target.value)} /></Field><Field label="Justificação" full><textarea value={form.justification} onChange={e=>update('justification',e.target.value)} /></Field></div></>
    if(step===1) return <><h2>Projecto e Financiamento</h2><p>Associe a aquisição à fonte de financiamento correcta.</p><div className="form-grid"><Field label="Projecto"><input value={form.project} onChange={e=>update('project',e.target.value)} /></Field><Field label="Financiador"><select value={form.donor} onChange={e=>update('donor',e.target.value)}><option>União Europeia</option><option>Banco Mundial</option><option>Fundo Global</option><option>Fundos do Governo dos Estados Unidos da América</option><option>Fundos próprios</option></select></Field><Field label="Centro de custo"><input value={form.costCenter} onChange={e=>update('costCenter',e.target.value)} /></Field><Field label="Linha orçamental"><input value={form.budgetLine} onChange={e=>update('budgetLine',e.target.value)} /></Field><Field label="Moeda"><select value={form.currency} onChange={e=>update('currency',e.target.value)}><option>EUR</option><option>USD</option><option>MZN</option></select></Field><Field label="Saldo disponível"><input type="number" value={form.availableBudget} onChange={e=>update('availableBudget',e.target.value)} /></Field></div></>
    if(step===2) return <><h2>Objecto da Aquisição</h2><p>Descreva com precisão o bem, serviço ou obra a adquirir.</p><div className="form-grid"><Field label="Categoria"><input value={form.category} onChange={e=>update('category',e.target.value)} /></Field><Field label="Valor estimado"><input type="number" value={form.estimatedValue} onChange={e=>update('estimatedValue',e.target.value)} /></Field><Field label="Quantidade"><input type="number" value={form.quantity} onChange={e=>update('quantity',e.target.value)} /></Field><Field label="Unidade"><input value={form.unit} onChange={e=>update('unit',e.target.value)} /></Field><Field label="Local de entrega"><input value={form.deliveryLocation} onChange={e=>update('deliveryLocation',e.target.value)} /></Field><Field label="Prazo de entrega (dias)"><input type="number" value={form.deliveryDays} onChange={e=>update('deliveryDays',e.target.value)} /></Field><Field label="Descrição detalhada" full><textarea value={form.description} onChange={e=>update('description',e.target.value)} /></Field></div></>
    if(step===3) return <><h2>Compliance Engine</h2><p>A Procplus analisou o processo com base no valor, financiador e orçamento.</p><div className="compliance-card"><div className="score"><div className="score-ring">{compliance.score}%</div><div><h3>Compliance Score</h3><p>{compliance.score>=80?'O processo está em boas condições para avançar.':'Existem pontos críticos que devem ser corrigidos.'}</p></div></div><div className="checks">{compliance.checks.map(([name,ok])=><div className="check-row" key={name}><span>{name}</span><b className={ok?'ok':'warn'}>{ok?'✓ Conforme':'⚠ Rever'}</b></div>)}</div></div></>
    if(step===4) return <><h2>Critérios de Avaliação</h2><p>Defina a ponderação da avaliação. O total deve corresponder a 100%.</p><div className="form-grid"><Field label="Capacidade técnica"><input value="40%" readOnly /></Field><Field label="Proposta financeira"><input value="40%" readOnly /></Field><Field label="Experiência relevante"><input value="10%" readOnly /></Field><Field label="Prazo de entrega"><input value="10%" readOnly /></Field></div></>
    if(step===5) return <><h2>Fluxo de Aprovação</h2><p>Fluxo seleccionado automaticamente com base nas regras da organização.</p><div className="summary-box"><p><span>1. Supervisor</span><b>Validação da necessidade</b></p><p><span>2. Financeiro</span><b>Confirmação orçamental</b></p><p><span>3. Gestor do Projecto</span><b>Validação do financiador</b></p><p><span>4. Director</span><b>Aprovação final</b></p></div></>
    if(step===6) return <><h2>Documentos</h2><p>Adicione os documentos de suporte antes da submissão.</p><div className="form-grid"><Field label="Termos de Referência / Especificações" full><input type="file" /></Field><Field label="Estudo de mercado" full><input type="file" /></Field><Field label="Outros anexos" full><input type="file" multiple /></Field></div></>
    if(step===7) return <><h2>Revisão do Processo</h2><p>Confirme os dados antes de gerar o processo.</p><div className="summary-box"><p><span>Referência</span><b>{code}</b></p><p><span>Título</span><b>{form.title}</b></p><p><span>Projecto</span><b>{form.project}</b></p><p><span>Financiador</span><b>{form.donor}</b></p><p><span>Valor estimado</span><b>{form.currency} {Number(form.estimatedValue||0).toLocaleString()}</b></p><p><span>Procedimento recomendado</span><b>RFQ</b></p><p><span>Compliance Score</span><b>{compliance.score}%</b></p></div></>
    return <><h2>Publicação</h2><p>A Procplus está pronta para gerar o pacote completo do processo.</p><div className="summary-box"><p><span>Documento principal</span><b>Request for Quotation (RFQ)</b></p><p><span>Anexos gerados</span><b>Matriz, checklist e cronograma</b></p><p><span>Próximo estado</span><b>Em aprovação</b></p></div></>
  }

  return <main className="wizard-page"><div className="wizard-shell"><header className="wizard-header"><div><small>NOVO PROCESSO DE PROCUREMENT</small><h1>{code}</h1></div><button className="btn btn-secondary" onClick={()=>navigate('/dashboard')}>Guardar e sair</button></header><div className="wizard-body"><aside className="wizard-steps">{steps.map(([title,sub],i)=><div key={title} className={`wizard-step ${i===step?'active':''} ${i<step?'done':''}`}><div className="step-number">{i<step?'✓':i+1}</div><div><b>{title}</b><span>{sub}</span></div></div>)}</aside><section className="wizard-content">{content()}{!published&&<div className="wizard-footer"><button className="btn btn-secondary" disabled={step===0} onClick={()=>setStep(s=>Math.max(0,s-1))}>Anterior</button>{step<steps.length-1?<button className="btn btn-primary" onClick={()=>setStep(s=>s+1)}>Continuar</button>:<button className="btn btn-primary" onClick={()=>setPublished(true)}>Criar processo</button>}</div>}</section></div></div></main>
}
