import React, { useState, useEffect } from 'react';
import { 
  fetchContactoDetalle, 
  prevalidarDomicilioApi, 
  validarContactoApi 
} from '../services/api';

export default function PrevalidacionContactoModal({ personaIdSif, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Form Prevalidación Domicilio
  const [metodoDomicilio, setMetodoDomicilio] = useState('LLAMADA');
  const [obsDomicilio, setObsDomicilio] = useState('');

  // Form Validación Contactos y Semáforo
  const [tel1, setTel1] = useState('');
  const [tel2, setTel2] = useState('');
  const [email, setEmail] = useState('');
  const [fuenteDatos, setFuenteDatos] = useState('SUCURSAL');
  const [estadoSemaforo, setEstadoSemaforo] = useState('VERDE');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadContacto();
  }, [personaIdSif]);

  async function loadContacto() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchContactoDetalle(personaIdSif);
      setData(res);
      if (res.contacto) {
        setTel1(res.contacto.telefono_principal || '');
        setTel2(res.contacto.telefono_secundario || '');
        setEmail(res.contacto.email_validado || '');
        setFuenteDatos(res.contacto.fuente_datos_contacto || 'SUCURSAL');
        setEstadoSemaforo(res.contacto.estado_contacto_semaforo || 'VERDE');
      }
    } catch (err) {
      setError(err.message || 'Error al cargar detalles de contacto');
    } finally {
      setLoading(false);
    }
  }

  async function handlePrevalidarDomicilioSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await prevalidarDomicilioApi({
        personaIdSif: data.persona_id_sif,
        metodoValidacion: metodoDomicilio,
        observaciones: obsDomicilio.trim(),
      });
      loadContacto();
      alert('¡Domicilio prevalidado por la sucursal con éxito!');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleValidarContactoSubmit(e) {
    e.preventDefault();
    if (!tel1.trim() || !tel2.trim()) {
      alert('Debe capturar tanto el Teléfono Principal como el Teléfono Secundario de referencia.');
      return;
    }
    setSubmitting(true);
    try {
      await validarContactoApi({
        personaIdSif: data.persona_id_sif,
        telefonoPrincipal: tel1.trim(),
        telefonoSecundario: tel2.trim(),
        emailValidado: email.trim(),
        fuenteDatos,
        estadoSemaforo,
      });
      loadContacto();
      alert('¡Datos de contacto y semáforo convalidados correctamente!');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const getSemaforoContactoBadge = (color) => {
    switch (color) {
      case 'VERDE':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 VERDE — CONTACTO CONFIRMADO</span>;
      case 'AMARILLO':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 AMARILLO — NO VERIFICADO</span>;
      case 'ROJO':
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">🔴 ROJO — INVÁLIDO / INCOMPLETO</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-100">Prevalidación de Domicilio & Semáforo de Contacto</h2>
              <span className="text-xs px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Persona #{personaIdSif}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Verificación previa por sucursal y semáforo de contacto alternativo (Folios 002 y 003)</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {loading ? (
            <div className="py-16 text-center text-slate-400 animate-pulse">
              Cargando prevalidación de domicilio y teléfonos de contacto...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
              {error}
            </div>
          ) : data ? (
            <>
              {/* SECCIÓN 1: Prevalidación de Domicilio por Sucursal (Folio 002) */}
              <div className="p-5 border border-slate-800 bg-slate-950/40 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                      🏡 Domicilio del Solicitante / Aval
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {data.domicilio.calle} #{data.domicilio.numero_exterior} {data.domicilio.numero_interior ? `Int ${data.domicilio.numero_interior}` : ''}, Col. {data.domicilio.colonia}, C.P. {data.domicilio.codigo_postal}, {data.domicilio.municipio}
                    </p>
                  </div>
                  <div>
                    {data.domicilio.domicilio_validado_sucursal ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        🟢 VALIDADO POR SUCURSAL
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                        🔴 PENDIENTE PREVALIDACIÓN
                      </span>
                    )}
                  </div>
                </div>

                {data.domicilio.domicilio_validado_sucursal ? (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                    ✓ Validado vía <strong>{data.domicilio.metodo_validacion_domicilio}</strong> por <strong>{data.domicilio.usuario_validacion_domicilio}</strong> el {new Date(data.domicilio.fecha_validacion_domicilio).toLocaleString()}.
                    {data.domicilio.observaciones_domicilio && (
                      <div className="italic text-slate-400 mt-1">Obs: "{data.domicilio.observaciones_domicilio}"</div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handlePrevalidarDomicilioSubmit} className="p-4 border border-slate-700 bg-slate-900 rounded-lg space-y-3">
                    <div className="font-semibold text-xs text-amber-300">⚠ Acción Requerida: Confirmar prevalidación del domicilio antes de enviar a campo</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Método de Prevalidación:</label>
                        <select
                          value={metodoDomicilio}
                          onChange={(e) => setMetodoDomicilio(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200"
                        >
                          <option value="LLAMADA">Llamada Telefónica con Confirmación Verbal</option>
                          <option value="MAPA_DIGITAL">Verificación Cruzada con Mapas Digitales</option>
                          <option value="WHATSAPP">WhatsApp / Confirmación Ubicación GPS</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Observaciones / Referencias adicionales:</label>
                        <input
                          type="text"
                          value={obsDomicilio}
                          onChange={(e) => setObsDomicilio(e.target.value)}
                          placeholder="Ej. Casa de fachada amarilla frente a tienda de abarrotes."
                          className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-md"
                      >
                        ✓ Confirmar Prevalidación por Sucursal
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* SECCIÓN 2: Semáforo y Validación de Contactos (Folio 003) */}
              <div className="p-5 border border-slate-800 bg-slate-950/40 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-slate-100 text-base flex items-center gap-2">
                      📞 Datos de Contacto & Semáforo de Validación
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Sujeto: <strong className="text-slate-200">{data.nombre_completo}</strong>
                    </p>
                  </div>
                  <div>
                    {getSemaforoContactoBadge(data.contacto.estado_contacto_semaforo)}
                  </div>
                </div>

                <form onSubmit={handleValidarContactoSubmit} className="p-4 border border-slate-700 bg-slate-900 rounded-lg space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Teléfono Principal (*):</label>
                      <input
                        type="text"
                        value={tel1}
                        onChange={(e) => setTel1(e.target.value)}
                        placeholder="Ej. 3312345678"
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Teléfono Secundario Alternativo (Familiar/Referencia) (*):</label>
                      <input
                        type="text"
                        value={tel2}
                        onChange={(e) => setTel2(e.target.value)}
                        placeholder="Ej. 3398765432"
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Correo Electrónico Validado:</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">Fuente del Dato de Contacto:</label>
                      <select
                        value={fuenteDatos}
                        onChange={(e) => setFuenteDatos(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200"
                      >
                        <option value="SUCURSAL">Capturado por Sucursal</option>
                        <option value="APP_MOVIL">Proporcionado por App Móvil</option>
                        <option value="LLAMADA">Confirmado por Llamada Automatizada / WhatsApp</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Estado de Semáforo Asignado:</label>
                      <select
                        value={estadoSemaforo}
                        onChange={(e) => setEstadoSemaforo(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-slate-200 font-bold"
                      >
                        <option value="VERDE" className="text-emerald-400 font-bold">🟢 VERDE — Válido y Confirmado</option>
                        <option value="AMARILLO" className="text-amber-400 font-bold">🟡 AMARILLO — No Confirmado</option>
                        <option value="ROJO" className="text-rose-400 font-bold">🔴 ROJO — Inválido / Incompleto</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-md"
                    >
                      Guardar y Convalidar Semáforo de Contacto
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Cerrar Ventana
          </button>
        </div>
      </div>
    </div>
  );
}
