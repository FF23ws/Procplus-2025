
import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export default function ProtectedRoute(){
  const isAuthed = !!localStorage.getItem('token');
  const location = useLocation();
  return isAuthed ? <Outlet/> : <Navigate to='/login' replace state={{from: location}}/>;
}
