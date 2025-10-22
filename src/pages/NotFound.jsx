
import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound(){
  return (
    <section>
      <h2>404 — Página não encontrada</h2>
      <Link to='/'>Voltar ao início</Link>
    </section>
  );
}
