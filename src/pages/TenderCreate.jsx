
import React, { useState } from 'react';

export default function TenderCreate(){
  const [form, setForm] = useState({ title:'', funder:'', budget:'', ruleset:'Geral' });

  const onSubmit = (e)=>{
    e.preventDefault();
    alert('Concurso criado (demo): ' + JSON.stringify(form, null, 2));
  };

  const update = (k)=>(e)=> setForm(prev=>({...prev, [k]: e.target.value}));

  return (
    <section style={{maxWidth:560}}>
      <h2>Novo Concurso</h2>
      <form onSubmit={onSubmit} style={{display:'grid', gap:12}}>
        <label>Título
          <input value={form.title} onChange={update('title')} required />
        </label>
        <label>Financiador / Origem dos Fundos
          <input value={form.funder} onChange={update('funder')} required />
        </label>
        <label>Orçamento
          <input value={form.budget} onChange={update('budget')} type='number' required />
        </label>
        <label>Regras / Framework
          <select value={form.ruleset} onChange={update('ruleset')}>
            <option>Geral</option>
            <option>Governo dos EUA (2 CFR)</option>
            <option>União Europeia</option>
            <option>Governo de Moçambique</option>
            <option>Regras internas (fundos próprios)</option>
          </select>
        </label>
        <button type='submit'>Criar</button>
      </form>
    </section>
  );
}
