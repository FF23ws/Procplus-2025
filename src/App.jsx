
import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TendersList from './pages/TendersList';
import TenderCreate from './pages/TenderCreate';
import Suppliers from './pages/Suppliers';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Suspense fallback={<p style={{padding:20}}>A carregar…</p>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="tenders" element={<TendersList />} />
            <Route path="tenders/novo" element={<TenderCreate />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="home" element={<Navigate to='/' replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
