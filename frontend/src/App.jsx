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
import AuditLogPage from './pages/AuditLogPage';

function AppRoutes() {
  const { user, isAuthenticated, loading, logout, theme } = useAuth();

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
  const canViewMap = ['superadmin', 'asignador', 'validador', 'admin'].includes(userRole);
  const canViewAudit = ['superadmin', 'admin', 'auditor'].includes(userRole);

  return (
    <div className={`min-h-screen ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'} flex flex-col transition-colors duration-200`}>
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
            <Route
              path="/auditoria"
              element={canViewAudit ? <AuditLogPage /> : <Navigate to="/" replace />}
            />
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
