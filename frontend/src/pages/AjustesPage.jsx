import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  fetchConfiguracionCorreo, 
  guardarConfiguracionCorreoApi, 
  probarConexionCorreoApi, 
  enviarResetAdminApi, 
  fetchSuscripcionRenta, 
  actualizarPlanSuscripcionApi, 
  registrarPagoRentaApi,
  fetchInvestigadores,
  fetchConfiguracionWhatsApp,
  guardarConfiguracionWhatsAppApi,
  probarConexionWhatsAppApi,
  crearUsuarioApi,
  actualizarUsuarioApi,
  eliminarUsuarioApi
} from '../services/api';
import Toast from '../components/Toast';
import { Navigate } from 'react-router-dom';
import { Mail, Key, CreditCard, ShieldCheck, CheckCircle2, AlertTriangle, Send, RefreshCw, Lock, Save, DollarSign, MessageSquare, Users, UserPlus, Edit3, Trash2, Search, UserCheck } from 'lucide-react';

export default function AjustesPage() {
  const auth = useAuth();
  const userRole = (() => {
    if (auth?.user?.rol) return auth.user.rol.toLowerCase();
    try { return (JSON.parse(localStorage.getItem('cpo_user') || '{}').rol || '').toLowerCase(); } catch { return ''; }
  })();
  const isSuperAdmin = userRole === 'superadmin' || userRole === 'admin';

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  const [activeTab, setActiveTab] = useState('correo'); // 'correo', 'usuarios', 'password', 'whatsapp', 'suscripcion'
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // 1. Estado Servidor SMTP & Triggers
  const [smtpConfig, setSmtpConfig] = useState({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from_email: '',
    from_name: 'CPO Investigaciones — Notificaciones',
    enabled: false,
  });
  const [emailTriggers, setEmailTriggers] = useState({
    notificar_validador_al_completar: true,
    notificar_analista_al_validar: true,
    notificar_sucursal_devolucion: true,
    notificar_alerta_renta_vencida: true,
  });
  const [testEmailInput, setTestEmailInput] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);

  // 2. Estado Gestión de Usuarios y Roles (Admin / Super Admin)
  const [userSearchFilter, setUserSearchFilter] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null = nuevo
  const [userFormData, setUserFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    rol: 'investigador',
    password: '',
    activo: true,
  });
  const [submittingUser, setSubmittingUser] = useState(false);

  // 2. Estado WhatsApp Business API (Super Admin)
  const [whatsappConfig, setWhatsappConfig] = useState({
    enabled: false,
    provider: 'META_CLOUD',
    phone_number_id: '',
    token: '',
    sender_phone: '+523312345678',
    template_name: 'cpo_notificacion_visita',
  });
  const [testPhoneInput, setTestPhoneInput] = useState('');
  const [testingWhatsApp, setTestingWhatsApp] = useState(false);

  // 3. Estado Restablecimiento de Contraseñas (Admin)
  const [usuariosList, setUsuariosList] = useState([]);
  const [selectedUsuarioId, setSelectedUsuarioId] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  // 4. Estado Suscripcion & Renta Mensual (Super Admin)
  const [suscripcionData, setSuscripcionData] = useState(null);
  const [historialPagos, setHistorialPagos] = useState([]);
  const [submittingPago, setSubmittingPago] = useState(false);
  const [montoPago, setMontoPago] = useState('4500.00');
  const [metodoPago, setMetodoPago] = useState('TRANSFERENCIA');
  const [folioFactura, setFolioFactura] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      // Cargar SMTP
      const corrRes = await fetchConfiguracionCorreo().catch(() => null);
      if (corrRes) {
        if (corrRes.smtp_config) setSmtpConfig(corrRes.smtp_config);
        if (corrRes.email_triggers) setEmailTriggers(corrRes.email_triggers);
      }

      // Cargar Usuarios para Reset
      const usrs = await fetchInvestigadores().catch(() => []);
      setUsuariosList(usrs || []);
      if (usrs && usrs.length > 0) setSelectedUsuarioId(usrs[0].id);

      // Cargar Suscripción y WhatsApp si es SuperAdmin
      if (isSuperAdmin) {
        const suscRes = await fetchSuscripcionRenta().catch(() => null);
        if (suscRes) {
          setSuscripcionData(suscRes.suscripcion);
          setHistorialPagos(suscRes.historial_pagos || []);
        }

        const waRes = await fetchConfiguracionWhatsApp().catch(() => null);
        if (waRes && waRes.whatsapp_config) {
          setWhatsappConfig(waRes.whatsapp_config);
        }
      }
    } catch (err) {
      console.error('Error cargando ajustes:', err);
    } finally {
      setLoading(false);
    }
  }

  // Guardar SMTP
  async function handleGuardarCorreo(e) {
    e.preventDefault();
    try {
      await guardarConfiguracionCorreoApi({ smtpConfig, emailTriggers });
      setToast({ message: 'Configuración de correo y notificaciones guardada con éxito', type: 'success' });
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
  }

  // Probar SMTP
  async function handleProbarCorreo() {
    setTestingEmail(true);
    try {
      const res = await probarConexionCorreoApi(testEmailInput.trim() || undefined);
      setToast({ message: res.mensaje, type: res.simulado ? 'warning' : 'success' });
    } catch (err) {
      setToast({ message: 'Error en prueba SMTP: ' + err.message, type: 'error' });
    } finally {
      setTestingEmail(false);
    }
  }

  // Guardar WhatsApp (Super Admin)
  async function handleGuardarWhatsApp(e) {
    e.preventDefault();
    try {
      await guardarConfiguracionWhatsAppApi({ whatsappConfig });
      setToast({ message: 'Configuración de WhatsApp Business API guardada con éxito', type: 'success' });
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
  }

  // Probar WhatsApp (Super Admin)
  async function handleProbarWhatsApp() {
    setTestingWhatsApp(true);
    try {
      const res = await probarConexionWhatsAppApi(testPhoneInput.trim() || undefined);
      setToast({ message: res.mensaje, type: res.simulado ? 'warning' : 'success' });
    } catch (err) {
      setToast({ message: 'Error en prueba WhatsApp: ' + err.message, type: 'error' });
    } finally {
      setTestingWhatsApp(false);
    }
  }

  // Manejadores CRUD Usuarios & Roles
  function handleOpenNewUserModal() {
    setEditingUser(null);
    setUserFormData({
      nombre: '',
      email: '',
      telefono: '',
      rol: 'investigador',
      password: '',
      activo: true,
    });
    setShowUserModal(true);
  }

  function handleOpenEditUserModal(u) {
    setEditingUser(u);
    setUserFormData({
      nombre: u.nombre || '',
      email: u.email || '',
      telefono: u.telefono || '',
      rol: u.rol || 'investigador',
      password: '', // Vacío para no sobreescribir salvo que cambie
      activo: u.activo !== false,
    });
    setShowUserModal(true);
  }

  async function handleGuardarUsuario(e) {
    e.preventDefault();
    if (!userFormData.nombre.trim() || !userFormData.email.trim()) {
      alert('Nombre y correo electrónico son requeridos.');
      return;
    }
    if (!editingUser && !userFormData.password) {
      alert('La contraseña inicial es requerida para un nuevo usuario.');
      return;
    }

    setSubmittingUser(true);
    try {
      if (editingUser) {
        await actualizarUsuarioApi(editingUser.id, userFormData);
        setToast({ message: `Usuario #${editingUser.id} (${userFormData.nombre}) actualizado con éxito.`, type: 'success' });
      } else {
        await crearUsuarioApi(userFormData);
        setToast({ message: `Nuevo usuario ${userFormData.nombre} registrado con éxito.`, type: 'success' });
      }
      setShowUserModal(false);
      loadAllData();
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    } finally {
      setSubmittingUser(false);
    }
  }

  async function handleDesactivarUsuario(u) {
    if (!window.confirm(`¿Estás seguro de desactivar al usuario "${u.nombre}" (${u.email})?`)) {
      return;
    }
    try {
      await eliminarUsuarioApi(u.id);
      setToast({ message: `Usuario ${u.nombre} desactivado del sistema.`, type: 'success' });
      loadAllData();
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    }
  }

  // Enviar Reset de Password desde Admin
  async function handleEnviarResetAdmin(e) {
    e.preventDefault();
    setSendingReset(true);
    try {
      const res = await enviarResetAdminApi({
        usuarioId: selectedUsuarioId || undefined,
        email: manualEmail.trim() || undefined,
      });
      setToast({ message: res.mensaje, type: res.simulado ? 'warning' : 'success' });
    } catch (err) {
      setToast({ message: 'Error enviando correo: ' + err.message, type: 'error' });
    } finally {
      setSendingReset(false);
    }
  }

  // Registrar Pago de Renta Mensual
  async function handleRegistrarPago(e) {
    e.preventDefault();
    if (!montoPago || Number(montoPago) <= 0) {
      alert('Ingresa un monto de pago válido.');
      return;
    }
    setSubmittingPago(true);
    try {
      await registrarPagoRentaApi({
        monto: Number(montoPago),
        metodoPago,
        folioFactura: folioFactura.trim() || `FAC-${Date.now()}`,
      });
      setToast({ message: 'Pago de renta registrado. Extensión de 30 días activada.', type: 'success' });
      setFolioFactura('');
      loadAllData();
    } catch (err) {
      setToast({ message: 'Error: ' + err.message, type: 'error' });
    } finally {
      setSubmittingPago(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 font-sans">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            ⚙️ Panel de Ajustes y Configuración del Sistema
          </h1>
          <p className="text-xs text-slate-400 mt-1">Parametrización de Servidor de Correo SMTP, Restablecimiento de Contraseñas y Renta Mensual SaaS</p>
        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('correo')}
          className={`px-4 py-2.5 font-bold text-xs rounded-t-xl transition flex items-center gap-2 border-t border-x ${
            activeTab === 'correo' 
              ? 'bg-slate-900 border-slate-800 text-sky-400 border-b-slate-900 -mb-px shadow-lg' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mail className="w-4 h-4" />
          Servidor de Correo SMTP & Alertas
        </button>

        <button
          onClick={() => setActiveTab('usuarios')}
          className={`px-4 py-2.5 font-bold text-xs rounded-t-xl transition flex items-center gap-2 border-t border-x ${
            activeTab === 'usuarios' 
              ? 'bg-slate-900 border-slate-800 text-sky-400 border-b-slate-900 -mb-px shadow-lg' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          Gestión de Usuarios & Roles
        </button>

        <button
          onClick={() => setActiveTab('password')}
          className={`px-4 py-2.5 font-bold text-xs rounded-t-xl transition flex items-center gap-2 border-t border-x ${
            activeTab === 'password' 
              ? 'bg-slate-900 border-slate-800 text-sky-400 border-b-slate-900 -mb-px shadow-lg' 
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          Restablecimiento de Contraseñas
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-4 py-2.5 font-bold text-xs rounded-t-xl transition flex items-center gap-2 border-t border-x ${
              activeTab === 'whatsapp' 
                ? 'bg-slate-900 border-slate-800 text-emerald-400 border-b-slate-900 -mb-px shadow-lg' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp Business API (Super Admin)
          </button>
        )}

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('suscripcion')}
            className={`px-4 py-2.5 font-bold text-xs rounded-t-xl transition flex items-center gap-2 border-t border-x ${
              activeTab === 'suscripcion' 
                ? 'bg-slate-900 border-slate-800 text-purple-400 border-b-slate-900 -mb-px shadow-lg' 
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Renta Mensual SaaS (Super Admin)
          </button>
        )}
      </div>

      {/* PESTAÑA 1: SERVIDOR SMTP Y ALERTAS */}
      {activeTab === 'correo' && (
        <div className="space-y-6">
          <form onSubmit={handleGuardarCorreo} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                  <Mail className="w-5 h-5 text-sky-400" /> Servidor de Salida SMTP (Nodemailer / SendGrid / Gmail)
                </h3>
                <p className="text-xs text-slate-400">Configura el servidor para enviar correos de notificación a validadores y analistas.</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={smtpConfig.enabled}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, enabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-sky-500"
                />
                <span>Habilitar Envío de Correo Real</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Servidor Host SMTP (*):</label>
                <input
                  type="text"
                  value={smtpConfig.host}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Puerto SMTP:</label>
                <input
                  type="number"
                  value={smtpConfig.port}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                  placeholder="587"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nombre Remitente:</label>
                <input
                  type="text"
                  value={smtpConfig.from_name}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, from_name: e.target.value })}
                  placeholder="CPO Investigaciones — Alertas"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Usuario / Email SMTP:</label>
                <input
                  type="email"
                  value={smtpConfig.user}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                  placeholder="notificaciones@cajaoblatos.com.mx"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Contraseña SMTP:</label>
                <input
                  type="password"
                  value={smtpConfig.pass}
                  onChange={(e) => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                />
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpConfig.secure}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                    className="w-4 h-4 rounded accent-sky-500"
                  />
                  <span>Conexión Segura SSL/TLS (Puerto 465)</span>
                </label>
              </div>
            </div>

            {/* Triggers de Alertas por Correo */}
            <div className="border-t border-slate-800 pt-5 space-y-3">
              <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">Disparadores Automáticos de Correo</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <label className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-700 transition">
                  <div className="pr-2">
                    <div className="font-bold text-slate-200">📩 Alertas a Validadores</div>
                    <div className="text-[11px] text-slate-400">Notificar al correo cuando un investigador complete una visita en campo.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailTriggers.notificar_validador_al_completar}
                    onChange={(e) => setEmailTriggers({ ...emailTriggers, notificar_validador_al_completar: e.target.checked })}
                    className="w-4 h-4 rounded accent-sky-500 shrink-0"
                  />
                </label>

                <label className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-700 transition">
                  <div className="pr-2">
                    <div className="font-bold text-slate-200">📩 Visto Bueno a Analistas</div>
                    <div className="text-[11px] text-slate-400">Notificar a los analistas cuando el validador apruebe y valide las visitas del préstamo.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailTriggers.notificar_analista_al_validar}
                    onChange={(e) => setEmailTriggers({ ...emailTriggers, notificar_analista_al_validar: e.target.checked })}
                    className="w-4 h-4 rounded accent-sky-500 shrink-0"
                  />
                </label>

                <label className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-700 transition">
                  <div className="pr-2">
                    <div className="font-bold text-slate-200">📩 Alertas de Devolución a Sucursal</div>
                    <div className="text-[11px] text-slate-400">Notificar a la sucursal cuando un analista o validador devuelva un expediente.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailTriggers.notificar_sucursal_devolucion}
                    onChange={(e) => setEmailTriggers({ ...emailTriggers, notificar_sucursal_devolucion: e.target.checked })}
                    className="w-4 h-4 rounded accent-sky-500 shrink-0"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow-lg shadow-sky-600/20 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Guardar Configuración de Correo
              </button>
            </div>
          </form>

          {/* Formulario Prueba SMTP */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              🧪 Probar Envío de Correo SMTP
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 text-xs">
              <input
                type="email"
                value={testEmailInput}
                onChange={(e) => setTestEmailInput(e.target.value)}
                placeholder="Ingresa correo para enviar prueba (ej. tu_correo@cajaoblatos.com)"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
              />
              <button
                type="button"
                disabled={testingEmail}
                onClick={handleProbarCorreo}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold transition flex items-center justify-center gap-2 border border-slate-700"
              >
                <Send className="w-4 h-4" /> {testingEmail ? 'Enviando...' : 'Enviar Correo de Prueba'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA: GESTIÓN DE USUARIOS Y ROLES (ADMIN / SUPER ADMIN) */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            {/* Header Tabla Usuarios */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-400" /> Administración de Usuarios y Asignación de Roles (RBAC)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Crea, edita datos, asigna roles de permisos y gestiona el estatus activo/inactivo de la plantilla.</p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearchFilter}
                    onChange={(e) => setUserSearchFilter(e.target.value)}
                    placeholder="Buscar por nombre, correo o rol..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleOpenNewUserModal}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow-lg shadow-sky-600/20 flex items-center gap-2 whitespace-nowrap"
                >
                  <UserPlus className="w-4 h-4" /> Crear Nuevo Usuario
                </button>
              </div>
            </div>

            {/* Tabla de Usuarios */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/40">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900 uppercase font-semibold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Nombre Completo</th>
                    <th className="p-3">Correo / Usuario</th>
                    <th className="p-3">Teléfono</th>
                    <th className="p-3">Rol Asignado</th>
                    <th className="p-3">Estatus</th>
                    <th className="p-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {usuariosList
                    .filter((u) => {
                      if (!userSearchFilter.trim()) return true;
                      const q = userSearchFilter.toLowerCase();
                      return (
                        u.nombre?.toLowerCase().includes(q) ||
                        u.email?.toLowerCase().includes(q) ||
                        u.rol?.toLowerCase().includes(q)
                      );
                    })
                    .map((u) => {
                      const r = (u.rol || '').toLowerCase();
                      let badgeStyle = 'bg-slate-800 text-slate-300';
                      let roleLabel = u.rol;
                      if (r === 'superadmin') { badgeStyle = 'bg-purple-500/20 text-purple-300 border border-purple-500/30'; roleLabel = '👑 Super Admin'; }
                      else if (r === 'admin') { badgeStyle = 'bg-sky-500/20 text-sky-300 border border-sky-500/30'; roleLabel = '🛡️ Admin'; }
                      else if (r === 'validador') { badgeStyle = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'; roleLabel = '✅ Validador'; }
                      else if (r === 'analista') { badgeStyle = 'bg-teal-500/20 text-teal-300 border border-teal-500/30'; roleLabel = '📊 Analista'; }
                      else if (r === 'asignador') { badgeStyle = 'bg-amber-500/20 text-amber-300 border border-amber-500/30'; roleLabel = '📍 Asignador'; }
                      else if (r === 'investigador') { badgeStyle = 'bg-blue-500/20 text-blue-300 border border-blue-500/30'; roleLabel = '🔍 Investigador'; }
                      else if (r === 'auditor') { badgeStyle = 'bg-rose-500/20 text-rose-300 border border-rose-500/30'; roleLabel = '📋 Auditor'; }

                      return (
                        <tr key={u.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-mono text-slate-400">#{u.id}</td>
                          <td className="p-3 font-bold text-slate-100">{u.nombre}</td>
                          <td className="p-3 font-mono text-slate-300">{u.email}</td>
                          <td className="p-3 font-mono text-slate-400">{u.telefono || '—'}</td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${badgeStyle}`}>
                              {roleLabel}
                            </span>
                          </td>
                          <td className="p-3">
                            {u.activo !== false ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                🟢 Activo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                🔴 Inactivo
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEditUserModal(u)}
                              className="px-2.5 py-1 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30 font-semibold transition"
                              title="Editar datos y rol"
                            >
                              <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Editar
                            </button>
                            {u.activo !== false && (
                              <button
                                onClick={() => handleDesactivarUsuario(u)}
                                className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-semibold transition"
                                title="Desactivar acceso del usuario"
                              >
                                <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Desactivar
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR / EDITAR USUARIOS Y ROLES */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                {editingUser ? <Edit3 className="w-5 h-5 text-sky-400" /> : <UserPlus className="w-5 h-5 text-sky-400" />}
                {editingUser ? `Editar Usuario #${editingUser.id}` : 'Crear Nuevo Usuario y Asignar Rol'}
              </h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarUsuario} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Nombre Completo (*):</label>
                <input
                  type="text"
                  required
                  value={userFormData.nombre}
                  onChange={(e) => setUserFormData({ ...userFormData, nombre: e.target.value })}
                  placeholder="Ej. Norma Bermejo Palos"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Correo / Usuario (*):</label>
                  <input
                    type="email"
                    required
                    value={userFormData.email}
                    onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                    placeholder="ejemplo@cajaoblatos.com.mx"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Teléfono:</label>
                  <input
                    type="text"
                    value={userFormData.telefono}
                    onChange={(e) => setUserFormData({ ...userFormData, telefono: e.target.value })}
                    placeholder="3312345678"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Rol RBAC Permisos (*):</label>
                <select
                  value={userFormData.rol}
                  onChange={(e) => setUserFormData({ ...userFormData, rol: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-bold"
                >
                  <option value="superadmin">👑 Super Admin — Acceso Total, Renta SaaS y WhatsApp API</option>
                  <option value="admin">🛡️ Administrador — Gestión General, Usuarios y Auditoría</option>
                  <option value="validador">✅ Validador de Crédito — Revisión de Expedientes y Dictamen</option>
                  <option value="analista">📊 Analista de Investigaciones — Revisión Documental y Devoluciones</option>
                  <option value="asignador">📍 Asignador de Zonas — Control Territorial y Mapa GPS</option>
                  <option value="investigador">🔍 Investigador en Campo — App Móvil, Visitas y Evidencias</option>
                  <option value="auditor">📋 Auditor — Bitácora de Eventos de Seguridad</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {editingUser ? 'Nueva Contraseña (dejar en blanco para mantener la actual):' : 'Contraseña Inicial (*):'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                />
              </div>

              {editingUser && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="userActiveCheck"
                    checked={userFormData.activo}
                    onChange={(e) => setUserFormData({ ...userFormData, activo: e.target.checked })}
                    className="w-4 h-4 rounded accent-sky-500 cursor-pointer"
                  />
                  <label htmlFor="userActiveCheck" className="text-slate-300 cursor-pointer font-semibold">
                    Usuario Habilitado / Activo
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingUser}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold transition shadow-md shadow-sky-600/20"
                >
                  {submittingUser ? 'Guardando...' : editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: RESTABLECIMIENTO DE CONTRASEÑAS POR ADMIN */}
      {activeTab === 'password' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <Key className="w-5 h-5 text-sky-400" /> Restablecimiento de Contraseñas por Correo
            </h3>
            <p className="text-xs text-slate-400 mt-1">Envía directamente un correo electrónico con el enlace de recuperación a cualquier usuario registrado.</p>
          </div>

          <form onSubmit={handleEnviarResetAdmin} className="space-y-4 text-xs max-w-2xl">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Seleccionar Usuario Registrado:</label>
              <select
                value={selectedUsuarioId}
                onChange={(e) => setSelectedUsuarioId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200"
              >
                {usuariosList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.email}) — Rol: {u.rol}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">O Ingresar Correo Manualmente:</label>
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="usuario@cajaoblatos.com.mx"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={sendingReset}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition shadow-lg shadow-sky-600/20 flex items-center gap-2"
              >
                <Send className="w-4 h-4" /> {sendingReset ? 'Enviando Correo...' : 'Enviar Correo de Restablecimiento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PESTAÑA 3: WHATSAPP BUSINESS API (EXCLUSIVO SUPER ADMIN) */}
      {activeTab === 'whatsapp' && isSuperAdmin && (
        <div className="space-y-6">
          <form onSubmit={handleGuardarWhatsApp} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-400" /> Integración WhatsApp Business API (Meta Cloud API)
                </h3>
                <p className="text-xs text-slate-400 mt-1">Configuración del canal oficial para notificar a los socios el día y rango de horario de la visita domiciliaria.</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!(whatsappConfig && whatsappConfig.enabled)}
                  onChange={(e) => setWhatsappConfig({ ...(whatsappConfig || {}), enabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-emerald-500"
                />
                <span className="text-emerald-400">Habilitar WhatsApp API</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Proveedor API:</label>
                <select
                  value={(whatsappConfig && whatsappConfig.provider) || 'META_CLOUD'}
                  onChange={(e) => setWhatsappConfig({ ...(whatsappConfig || {}), provider: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                >
                  <option value="META_CLOUD">Meta Cloud API (Oficial)</option>
                  <option value="TWILIO">Twilio WhatsApp API</option>
                  <option value="EVOLUTION">Evolution / UltraMsg Gateway</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Teléfono Emisor Empresa:</label>
                <input
                  type="text"
                  value={(whatsappConfig && whatsappConfig.sender_phone) || ''}
                  onChange={(e) => setWhatsappConfig({ ...(whatsappConfig || {}), sender_phone: e.target.value })}
                  placeholder="+523312345678"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">ID de Teléfono Meta (Phone Number ID):</label>
                <input
                  type="text"
                  value={(whatsappConfig && whatsappConfig.phone_number_id) || ''}
                  onChange={(e) => setWhatsappConfig({ ...(whatsappConfig || {}), phone_number_id: e.target.value })}
                  placeholder="109823749827349"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-medium mb-1">Token de Acceso Permanente (Bearer Token / API Key):</label>
                <input
                  type="password"
                  value={(whatsappConfig && whatsappConfig.token) || ''}
                  onChange={(e) => setWhatsappConfig({ ...(whatsappConfig || {}), token: e.target.value })}
                  placeholder="EAAXXXXXX..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nombre Plantilla Meta:</label>
                <input
                  type="text"
                  value={(whatsappConfig && whatsappConfig.template_name) || ''}
                  onChange={(e) => setWhatsappConfig({ ...(whatsappConfig || {}), template_name: e.target.value })}
                  placeholder="cpo_notificacion_visita"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-lg shadow-emerald-900 flex items-center gap-2"
              >
                <Save className="w-4 h-4" /> Guardar Credenciales de WhatsApp
              </button>
            </div>
          </form>

          {/* Formulario Probar WhatsApp */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              🧪 Probar Envío de WhatsApp en Vivo (Super Admin)
            </h3>
            <div className="flex flex-col sm:flex-row gap-3 text-xs">
              <input
                type="text"
                value={testPhoneInput}
                onChange={(e) => setTestPhoneInput(e.target.value)}
                placeholder="Ingresa celular destino con clave de país (ej. +523312345678)"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
              />
              <button
                type="button"
                disabled={testingWhatsApp}
                onClick={handleProbarWhatsApp}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold transition flex items-center justify-center gap-2 border border-slate-700"
              >
                <Send className="w-4 h-4" /> {testingWhatsApp ? 'Enviando...' : 'Enviar WhatsApp de Prueba'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: RENTA MENSUAL SAAS (EXCLUSIVO SUPER ADMIN) */}
      {activeTab === 'suscripcion' && isSuperAdmin && (
        <div className="space-y-6">
          {suscripcionData && (
            <>
              {/* Tarjeta de Vigencia y Estado de Cobro */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl border border-purple-500/30 bg-purple-950/20 space-y-1">
                  <div className="text-xs uppercase font-semibold text-purple-400">Plan Contratado</div>
                  <div className="text-xl font-bold text-slate-100">{suscripcionData.plan_nombre}</div>
                  <div className="text-xs text-slate-400">{suscripcionData.nombre_empresa}</div>
                </div>

                <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-1">
                  <div className="text-xs uppercase font-semibold text-emerald-400">Estado del Pago de Renta</div>
                  <div className="text-xl font-bold text-emerald-300">
                    ${Number(suscripcionData.precio_mensual).toLocaleString()} MXN / mes
                  </div>
                  <div className="text-xs text-emerald-400/90 font-medium">
                    Próximo corte: {new Date(suscripcionData.fecha_proximo_pago).toLocaleDateString()}
                  </div>
                </div>

                <div className={`p-5 rounded-2xl border ${
                  suscripcionData.dias_restantes > 5
                    ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                    : 'border-rose-500/40 bg-rose-950/20 text-rose-300 animate-pulse'
                }`}>
                  <div className="text-xs uppercase font-semibold">Vigencia Restante</div>
                  <div className="text-2xl font-bold">{suscripcionData.dias_restantes} días</div>
                  <div className="text-xs opacity-90">Estatus: <strong>{suscripcionData.estado_suscripcion}</strong></div>
                </div>
              </div>

              {/* Formulario Registrar Pago de Renta */}
              <form onSubmit={handleRegistrarPago} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="font-bold text-purple-300 text-sm flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-purple-400" /> Registrar Cobro / Pago de Renta Mensual (Super Admin)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Monto Pagado (MXN):</label>
                    <input
                      type="number"
                      value={montoPago}
                      onChange={(e) => setMontoPago(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Método de Pago:</label>
                    <select
                      value={metodoPago}
                      onChange={(e) => setMetodoPago(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200"
                    >
                      <option value="TRANSFERENCIA">Transferencia SPEI</option>
                      <option value="TARJETA">Tarjeta de Crédito / Débito</option>
                      <option value="EFECTIVO">Depósito Bancario</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Folio / Factura:</label>
                    <input
                      type="text"
                      value={folioFactura}
                      onChange={(e) => setFolioFactura(e.target.value)}
                      placeholder="FAC-2026-001"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-slate-200 font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={submittingPago}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-lg shadow-purple-900 flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Registrar Pago y Renovar 30 Días
                  </button>
                </div>
              </form>

              {/* Historial de Rentas Cobradas */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
                <h3 className="font-bold text-slate-100 text-sm">Historial de Cobros de Renta Mensual</h3>
                <div className="overflow-hidden border border-slate-800 rounded-xl bg-slate-950/40">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900 uppercase font-semibold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Fecha Pago</th>
                        <th className="p-3">Monto</th>
                        <th className="p-3">Método</th>
                        <th className="p-3">Folio Factura</th>
                        <th className="p-3">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {historialPagos.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-500 italic">No hay cobros registrados aún.</td>
                        </tr>
                      ) : (
                        historialPagos.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-800/30">
                            <td className="p-3 font-mono">{new Date(p.fecha_pago).toLocaleDateString()}</td>
                            <td className="p-3 font-bold text-emerald-400">${Number(p.monto).toLocaleString()} MXN</td>
                            <td className="p-3">{p.metodo_pago}</td>
                            <td className="p-3 font-mono">{p.folio_factura || '—'}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                {p.estatus}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'success' })}
      />
    </div>
  );
}
