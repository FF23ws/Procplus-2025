
import React from 'react';
import { suppliers } from '../sample-data';

export default function Suppliers(){
  return (
    <section>
      <h2>Fornecedores</h2>
      <ul>
        {suppliers.map(s => (
          <li key={s.id}>
            {s.name} — {s.category} — {s.country}
          </li>
        ))}
      </ul>
    </section>
  );
}
