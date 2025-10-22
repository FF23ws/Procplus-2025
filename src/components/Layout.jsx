
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout(){
  return (
    <div style={{fontFamily:'Inter, system-ui, Arial'}}>
      <Navbar/>
      <main style={{padding:'24px', maxWidth: '1100px', margin:'0 auto'}}>
        <Outlet/>
      </main>
      <footer style={{textAlign:'center', padding:'12px', color:'#777'}}>
        © 2025 Procplus
      </footer>
    </div>
  );
}
