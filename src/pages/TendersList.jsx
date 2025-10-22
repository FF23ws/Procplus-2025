
import React from 'react';
import { Link } from 'react-router-dom';
import { tenders } from '../sample-data';

export default function TendersList(){
  return (
    <section>
      <h2>Concursos</h2>
      <p>Lista de concursos (dados de demonstração)</p>
      <ul>
        {tenders.map(t => (
          <li key={t.id}>
            <strong>{t.title}</strong> — {t.funder} — {t.status}
          </li>
        ))}
      </ul>
      <Link to='/tenders/novo'>+ Novo concurso</Link>
    </section>
  );
}
