
import React, { useContext } from 'react';
import { LangContext } from '../App.jsx';
import pt from '../i18n/pt.json';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import es from '../i18n/es.json';

const dict = { pt, en, fr, es };

export default function Home(){
  const { lang } = useContext(LangContext);
  const t = dict[lang];

  return (
    <section className="hero">
      <h1>{t.home_title}</h1>
      <p className="muted">{t.home_sub}</p>
      <div className="cards">
        <div className="card"><h3>Concursos</h3><p>Criar e gerir RFPs/RFQs de forma segura.</p></div>
        <div className="card"><h3>Fornecedores</h3><p>Catálogo, due diligence e avaliação.</p></div>
        <div className="card"><h3>Compliance</h3><p>Regras EUA, UE, Moçambique e financiadores.</p></div>
      </div>
    </section>
  );
}
