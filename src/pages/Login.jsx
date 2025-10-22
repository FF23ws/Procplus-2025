
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Login(){
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const onSubmit = (e)=>{
    e.preventDefault();
    if(email && password){
      localStorage.setItem('token', 'demo');
      navigate(from, { replace:true });
    }
  };

  return (
    <section style={{maxWidth:420}}>
      <h2>Login</h2>
      <form onSubmit={onSubmit} style={{display:'grid', gap:12}}>
        <label>Email
          <input value={email} onChange={e=>setEmail(e.target.value)} type='email' required />
        </label>
        <label>Palavra-passe
          <input value={password} onChange={e=>setPassword(e.target.value)} type='password' required />
        </label>
        <button type='submit'>Entrar</button>
      </form>
    </section>
  );
}
