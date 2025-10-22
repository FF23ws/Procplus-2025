
import React from 'react';
import { Link } from 'react-router-dom';

export default function Dashboard(){
  return (
    <section>
      <h2>Dashboard</h2>
      <div style={{display:'grid', gap:12, marginTop:12}}>
        <Link to='/tenders'>Concursos</Link>
        <Link to='/tenders/novo'>Criar Concurso</Link>
        <Link to='/suppliers'>Fornecedores</Link>
        <Link to='/settings'>Definições</Link>
      </div>
    </section>
  );
}
