
import React from 'react';
import { Link } from 'react-router-dom';

export default function Home(){
  const authed = !!localStorage.getItem('token');
  return (
    <section>
      <h1 style={{marginBottom:8}}>Bem-vindo ao Procplus</h1>
      <p>Plataforma de procurement (MVP) para ONGs, empresas e governo.</p>
      <div style={{marginTop:16, display:'flex', gap:12}}>
        {!authed ? <Link to='/login'>Iniciar sessão</Link> : <Link to='/dashboard'>Ir ao Dashboard</Link>}
        <Link to='/tenders'>Ver Concursos</Link>
      </div>
    </section>
  );
}
