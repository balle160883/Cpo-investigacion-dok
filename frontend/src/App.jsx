import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import InvestigacionesPage from './pages/InvestigacionesPage';
import DetalleFormatoPage from './pages/DetalleFormatoPage';
import MapaPage from './pages/MapaPage';
import InvestigadoresPage from './pages/InvestigadoresPage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Header />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-6 overflow-y-auto">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/investigaciones" element={<InvestigacionesPage />} />
              <Route path="/investigaciones/:id" element={<DetalleFormatoPage />} />
              <Route path="/mapa" element={<MapaPage />} />
              <Route path="/investigadores" element={<InvestigadoresPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
