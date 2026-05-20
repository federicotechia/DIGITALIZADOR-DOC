import React from 'react';
import { motion } from 'motion/react';
import { Info, ExternalLink, ShieldCheck, HelpCircle, X } from 'lucide-react';

interface VercelGuideProps {
  onClose: () => void;
  projectId: string;
}

export default function VercelGuide({ onClose, projectId }: VercelGuideProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xl max-w-2xl w-full"
    >
      <div className="flex items-start justify-between mb-4 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Dominio de Vercel en Firebase
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight">
              Instrucciones de Redirección y Seguridad
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-4 text-xs text-slate-600 leading-relaxed">
        <p>
          Cuando despliegues este desarrollo en **Vercel**, el inicio de sesión con Google (mediante popup o redirección) fallará con un error de origen no autorizado salvo que completes el siguiente procedimiento en la consola de Firebase.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900">
          <h4 className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-1">
            <Info size={14} /> ¿Por qué es necesario?
          </h4>
          <p className="text-[11px] leading-relaxed">
            Firebase Auth protege las credenciales de tus usuarios verificando que el dominio solicitante esté autorizado. Vercel asignará un subdominio autogenerado como <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">crucianelli-scan.vercel.app</code> que debés indicarle a Firebase para habilitar el canal de comunicación seguro por <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">postMessage</code>.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-bold text-slate-800 uppercase tracking-widest text-[10px]">
            Paso a Paso en la Consola de Firebase:
          </h4>
          <ol className="list-decimal list-inside space-y-2.5">
            <li>
              Dirigite a la consola oficial de Firebase en{' '}
              <a
                href={`https://console.firebase.google.com/project/${projectId}/authentication/providers`}
                target="_blank"
                referrerPolicy="no-referrer"
                className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-0.5"
              >
                console.firebase.google.com <ExternalLink size={10} />
              </a>.
            </li>
            <li>
              En el menú lateral izquierdo, ingresá a la sección de **Authentication** (Autenticación) y seleccioná la pestaña **Settings** (Configuración) arriba a la derecha.
            </li>
            <li>
              Buscá la tarjeta llamada **Authorized Domains** (Dominios autorizados) en la configuración.
            </li>
            <li>
              Hacé clic en **Add Domain** (Agregar dominio) e ingresá el dominio asignado por Vercel (por ejemplo:{' '}
              <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-amber-800 font-semibold">
                proyecto-generado.vercel.app
              </span>). No incluyas <code className="bg-slate-100 px-1 rounded">https://</code> ni rutas adicionales.
            </li>
            <li>
              *(Opcional - Google Console)* Si deseás máxima cobertura en redes restringidas, ingresá a la{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                referrerPolicy="no-referrer"
                className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-0.5"
              >
                Consola de Google Cloud <ExternalLink size={10} />
              </a>{' '}
              con tu mismo proyecto de Firebase, editá el ID de cliente de OAuth 2.0 Web y agregá tu dominio vercel en los campos **Orígenes de JavaScript autorizados** y **URI de redirección autorizados**.
            </li>
          </ol>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-semibold uppercase">
            Proyecto Activo: {projectId}
          </span>
          <button
            onClick={onClose}
            className="bg-indigo-600 text-white font-bold py-1.5 px-4 rounded-lg uppercase tracking-wider hover:bg-indigo-700 transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </motion.div>
  );
}
