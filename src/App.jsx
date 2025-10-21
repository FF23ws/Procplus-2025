import React, { createContext, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotFound from './pages/NotFound.jsx';
import './style.css';

export const LangContext = createContext({ lang: 'pt', setLang: () => {} });
export const AuthContext = createContext({ authed: false, setAuthed: () => {} });

function ProtectedRoute({ children }) {
  return (
    <AuthContext.Consumer>
      {({ authed }) => (authed ? children : <Navigate to="/login" replace />)}
    </AuthContext.Consumer>
  );
}

export default function App() {
  const [lang, setLang] = useState('pt');
  const [authed, setAuthed] = useState(false);

  const langValue = useMemo(() => ({ lang, setLang }), [lang]);
  const authValue = useMemo(() => ({ authed, setAuthed }), [authed]);

  return (
    <LangContext.Provider value={langValue}>
      <AuthContext.Provider value={authValue}>
        <BrowserRouter>
          <header className="topbar">
            <Link to="/" className="brand">Procplus</Link>
            <nav className="nav">
              <Link to="/">Home</Link>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/login">Login</Link>
              <select aria-label="Idioma" value={lang} onChange={(e)=>setLang(e.target.value)}>
                <option value="pt">PT</option>
                <option value="en">EN</option>
                <option value="fr">FR</option>
                <option value="es">ES</option>
              </select>
            </nav>
          </header>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <footer className="footer">© {new Date().getFullYear()} Procplus</footer>
        </BrowserRouter>
      </AuthContext.Provider>
    </LangContext.Provider>
  );
}
