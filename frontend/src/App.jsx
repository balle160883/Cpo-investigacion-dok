import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InvestigacionesPage from './pages/InvestigacionesPage';
import DetalleFormatoPage from './pages/DetalleFormatoPage';
import MapaPage from './pages/MapaPage';
import InvestigadoresPage from './pages/InvestigadoresPage';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('cpo_user');
    const token = localStorage.getItem('cpo_token');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('cpo_user');
        localStorage.removeItem('cpo_token');
      }
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('cpo_user');
    localStorage.removeItem('cpo_token');
    setUser(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Cargando sistema...</div>;
  }

  if (!user) {
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage onLoginSuccess={(u) => setUser(u)} />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    );
  }

  const userRole = (user?.rol || '').toLowerCase();
  const allowedRolesForMap = ['superadmin', 'asignador', 'validador'];
  const canViewMap = allowedRolesForMap.includes(userRole);

  return (
    <Router>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <Header user={user} onLogout={handleLogout} />
        <div className="flex flex-1">
          <Sidebar user={user} />
          <main className="flex-1 p-6 overflow-y-auto">
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/investigaciones" element={<InvestigacionesPage />} />
              <Route path="/investigaciones/:id" element={<DetalleFormatoPage />} />
              <Route
                path="/mapa"
                element={canViewMap ? <MapaPage /> : <Navigate to="/" replace />}
              />
              <Route path="/investigadores" element={<InvestigadoresPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}
