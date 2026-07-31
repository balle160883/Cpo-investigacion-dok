import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import InvestigacionesPage from './pages/InvestigacionesPage';
import DetalleFormatoPage from './pages/DetalleFormatoPage';
import MapaPage from './pages/MapaPage';
import InvestigadoresPage from './pages/InvestigadoresPage';

function AppRoutes() {
  const { user, isAuthenticated, loading, logout } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Cargando sistema...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const userRole = (user?.rol || '').toLowerCase();
  const allowedRolesForMap = ['superadmin', 'asignador', 'validador', 'admin'];
  const canViewMap = allowedRolesForMap.includes(userRole);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header user={user} onLogout={logout} />
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
