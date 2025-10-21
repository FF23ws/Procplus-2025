
import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound(){
  return (
    <section className="notfound">
      <h2>404</h2>
      <p>Página não encontrada.</p>
      <Link className="btn" to="/">Voltar à Home</Link>
    </section>
  );
}
