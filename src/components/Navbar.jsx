
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const linkStyle = ({isActive})=>({ 
  textDecoration: isActive ? 'underline' : 'none',
  color: '#222'
});

export default function Navbar(){
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login', { replace:true });
  };

  return (
    <header style={{borderBottom:'1px solid #eee', background:'#fafafa'}}>
      <nav style={{display:'flex', gap:16, alignItems:'center', padding:'12px 24px'}}>
        <strong>Procplus</strong>
        <NavLink to='/' style={linkStyle}>Home</NavLink>
        <NavLink to='/dashboard' style={linkStyle}>Dashboard</NavLink>
        <NavLink to='/tenders' style={linkStyle}>Concursos</NavLink>
        <NavLink to='/suppliers' style={linkStyle}>Fornecedores</NavLink>
        <NavLink to='/settings' style={linkStyle}>Definições</NavLink>
        <div style={{marginLeft:'auto'}}>
          {token ? (
            <button onClick={logout}>Sair</button>
          ) : (
            <NavLink to='/login' style={linkStyle}>Login</NavLink>
          )}
        </div>
      </nav>
    </header>
  );
}
