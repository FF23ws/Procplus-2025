
import React, { useContext } from 'react';
import { LangContext } from '../App.jsx';
import pt from '../i18n/pt.json';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import es from '../i18n/es.json';

const dict = { pt, en, fr, es };

export default function Dashboard(){
  const { lang } = useContext(LangContext);
  const t = dict[lang];

  return (
    <section className="dash">
      <h2>{t.dash_title}</h2>
      <p className="muted">{t.dash_welcome}</p>
      <div className="grid">
        <div className="tile"><strong>Concursos</strong><span>0 ativos</span></div>
        <div className="tile"><strong>Fornecedores</strong><span>0 registados</span></div>
        <div className="tile"><strong>Pedidos</strong><span>0 em aprovação</span></div>
      </div>
    </section>
  );
}
