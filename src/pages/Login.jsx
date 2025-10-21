
import React, { useContext, useState } from 'react';
import { LangContext, AuthContext } from '../App.jsx';
import pt from '../i18n/pt.json';
import en from '../i18n/en.json';
import fr from '../i18n/fr.json';
import es from '../i18n/es.json';
import { useNavigate } from 'react-router-dom';

const dict = { pt, en, fr, es };

export default function Login(){
  const { lang } = useContext(LangContext);
  const { setAuthed } = useContext(AuthContext);
  const t = dict[lang];
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');

  function onSubmit(e){
    e.preventDefault();
    if(email && pwd){
      setAuthed(true);
      nav('/dashboard');
    }
  }

  return (
    <section className="auth">
      <h2>{t.login_title}</h2>
      <form onSubmit={onSubmit} className="form">
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input placeholder="Palavra-passe" type="password" value={pwd} onChange={e=>setPwd(e.target.value)} />
        <button className="btn" type="submit">{t.login_btn}</button>
      </form>
    </section>
  );
}
