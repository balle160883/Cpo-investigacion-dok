import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, User, AlertCircle, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { getApiBaseUrl, recuperarPasswordApi, cambiarPasswordPrimerIngresoApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Recuperación de Contraseña Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [sendingResetReq, setSendingResetReq] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  // Cambio Obligatorio de Contraseña (Primer Ingreso) Modal State
  const [showForceChangeModal, setShowForceChangeModal] = useState(false);
  const [pendingSession, setPendingSession] = useState(null);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [forceChangeLoading, setForceChangeLoading] = useState(false);
  const [forceChangeError, setForceChangeError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSolicitarRecuperacion = async () => {
    if (!resetEmailInput.trim()) {
      setResetMsg('Ingresa un correo electrónico válido.');
      return;
    }
    setSendingResetReq(true);
    setResetMsg('');
    try {
      const res = await recuperarPasswordApi(resetEmailInput.trim());
      setResetMsg(res.mensaje || 'Si el correo está registrado, se enviaron las instrucciones.');
    } catch (err) {
      setResetMsg('Error: ' + err.message);
    } finally {
      setSendingResetReq(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      // Si requiere cambio obligatorio en primer ingreso
      if (data.debe_cambiar_password) {
        setPendingSession(data);
        setShowForceChangeModal(true);
        return;
      }

      login(data.user, data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForcePasswordChange = async (e) => {
    e.preventDefault();
    setForceChangeError('');

    if (!nuevaPassword || !confirmarPassword) {
      setForceChangeError('Ambos campos son obligatorios.');
      return;
    }

    if (nuevaPassword.length < 6) {
      setForceChangeError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (nuevaPassword === 'Seguridad2026@') {
      setForceChangeError('Debes elegir una contraseña distinta a la contraseña temporal.');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setForceChangeError('Las contraseñas no coinciden.');
      return;
    }

    setForceChangeLoading(true);
    try {
      const result = await cambiarPasswordPrimerIngresoApi({
        nuevaPassword,
        confirmarPassword,
        email: email.trim(),
        passwordActual: password,
        token: pendingSession?.token,
      });

      setShowForceChangeModal(false);
      login(result.user, result.token);
      navigate('/');
    } catch (err) {
      setForceChangeError(err.message || 'Error al actualizar contraseña.');
    } finally {
      setForceChangeLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">

        {/* Header Logo */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center mx-auto shadow-lg shadow-sky-500/20">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Caja Oblatos</h1>
          <p className="text-xs text-sky-400 font-semibold tracking-wider uppercase">
            Sistema de Investigaciones Domiciliarias
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Usuario o Correo Electrónico:
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nombre de Usuario o Correo"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Contraseña:
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 p-1 text-slate-400 hover:text-slate-200 transition focus:outline-none"
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="w-4 h-4 text-sky-400" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end text-xs">
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="text-sky-400 hover:text-sky-300 transition font-medium"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition shadow-lg shadow-sky-600/30 disabled:opacity-50 mt-2"
          >
            {loading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="text-center text-[11px] text-slate-500 pt-2 border-t border-slate-800/60">
          Acceso Autorizado • Caja Oblatos Ahorro y Crédito
        </div>
      </div>

      {/* Modal Cambio Obligatorio de Contraseña (Primer Ingreso) */}
      {showForceChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Actualización de Contraseña</h3>
                <p className="text-xs text-amber-400/90 font-medium">Primer inicio de sesión requerido</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              Hola <strong className="text-white">{pendingSession?.user?.nombre}</strong>. Has ingresado con la clave institucional temporal. Por seguridad, define una contraseña personal para acceder al sistema.
            </p>

            {forceChangeError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forceChangeError}</span>
              </div>
            )}

            <form onSubmit={handleForcePasswordChange} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nueva Contraseña:
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={nuevaPassword}
                    onChange={(e) => setNuevaPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Confirmar Nueva Contraseña:
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmarPassword}
                  onChange={(e) => setConfirmarPassword(e.target.value)}
                  placeholder="Repite tu nueva contraseña"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowForceChangeModal(false);
                    setPassword('');
                    setNuevaPassword('');
                    setConfirmarPassword('');
                  }}
                  className="w-1/3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={forceChangeLoading}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {forceChangeLoading ? 'Guardando...' : 'Guardar y Entrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Solicitar Recuperación por Correo */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-100 text-base">🔑 Recuperación de Contraseña</h3>
            <p className="text-xs text-slate-400">Ingresa tu correo electrónico registrado para enviarte las instrucciones y enlace de restablecimiento.</p>

            <input
              type="email"
              value={resetEmailInput}
              onChange={(e) => setResetEmailInput(e.target.value)}
              placeholder="ejemplo@cajaoblatos.com.mx"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-slate-100 font-mono"
            />

            {resetMsg && (
              <div className="p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl text-sky-300 text-xs">
                {resetMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowResetModal(false); setResetMsg(''); }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={sendingResetReq}
                onClick={handleSolicitarRecuperacion}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition"
              >
                {sendingResetReq ? 'Enviando...' : 'Enviar Correo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
