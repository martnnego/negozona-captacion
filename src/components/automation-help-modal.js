/**
 * Modal explicativo para que los usuarios comprendan el funcionamiento integral
 * del módulo de Automatizaciones sin necesidad de hacer pruebas a ciegas.
 */

export function openAutomationHelpModal() {
  // Remove existing modal if open
  const existing = document.getElementById('automation-help-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'automation-help-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in font-sans';

  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
      <!-- Modal Header -->
      <div class="flex items-center justify-between px-6 py-5 border-b border-neutral-200 bg-neutral-50">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center text-lg font-bold shadow-xs">
            🤖
          </div>
          <div>
            <h3 class="text-base font-bold text-neutral-900 font-display">¿Cómo funcionan las Automatizaciones?</h3>
            <p class="text-xs text-neutral-500">Guía completa sobre disparadores, segmentación, recurrencias y control de solapamiento</p>
          </div>
        </div>
        <button id="btn-close-help-modal" class="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors cursor-pointer text-lg font-mono">
          ✕
        </button>
      </div>

      <!-- Modal Body (Scrollable) -->
      <div class="overflow-y-auto px-6 py-6 space-y-8 text-xs text-neutral-700 leading-relaxed">
        
        <!-- Section 1: Concepto Central y Ciclo de Vida -->
        <section class="space-y-3">
          <div class="flex items-center gap-2 text-primary font-bold text-sm">
            <span>🔄</span>
            <h4>1. El Ciclo de Vida de una Automatización</h4>
          </div>
          <p>
            Una automatización es una secuencia de <strong>acciones y esperas</strong> que se ejecutan automáticamente cada vez que un lead o contacto cumple una condición de inicio (disparador) y califica dentro del segmento configurado.
          </p>

          <!-- Visual Flowchart Cards -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
            <div class="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-blue-700 font-bold font-mono text-[11px]">
                <span>1. Disparo & Filtro</span>
                <span>⚡</span>
              </div>
              <p class="text-[11px] text-blue-900">
                Se detecta el evento o la hora programada. Se valida la <strong>segmentación de audiencia</strong> y se crea la ejecución.
              </p>
            </div>

            <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-amber-700 font-bold font-mono text-[11px]">
                <span>2. Acción / Espera</span>
                <span>⏳</span>
              </div>
              <p class="text-[11px] text-amber-900">
                Se ejecutan pasos inmediatos (WhatsApp/Email). Si hay una <strong>espera</strong>, se suspende hasta que venza el plazo exacto.
              </p>
            </div>

            <div class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-emerald-700 font-bold font-mono text-[11px]">
                <span>3. Avance</span>
                <span>⏭️</span>
              </div>
              <p class="text-[11px] text-emerald-900">
                El motor en segundo plano retoma el flujo paso a paso y registra logs legibles en el historial.
              </p>
            </div>

            <div class="p-3.5 bg-purple-50 border border-purple-200 rounded-xl flex flex-col gap-1.5">
              <div class="flex items-center justify-between text-purple-700 font-bold font-mono text-[11px]">
                <span>4. Finalización</span>
                <span>🏁</span>
              </div>
              <p class="text-[11px] text-purple-900">
                Al ejecutar el último paso, la ejecución individual pasa a estado <strong>Finalizada</strong>.
              </p>
            </div>
          </div>
        </section>

        <!-- Section 2: Disparadores (Triggers) Disponibles -->
        <section class="space-y-3">
          <div class="flex items-center gap-2 text-primary font-bold text-sm">
            <span>🎯</span>
            <h4>2. Disparadores de Inicio Disponibles</h4>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
              <div class="font-bold text-neutral-900 flex items-center gap-1.5">
                <span class="text-sm">📥</span> Lead Creado
              </div>
              <p class="text-[11px] text-neutral-600">
                Entra automáticamente cada nuevo lead registrado por formulario web, importación CSV o de forma manual.
              </p>
            </div>

            <div class="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
              <div class="font-bold text-neutral-900 flex items-center gap-1.5">
                <span class="text-sm">👤</span> Contacto Creado
              </div>
              <p class="text-[11px] text-neutral-600">
                Se activa cuando se agrega una nueva persona con teléfono o correo a un lead o al directorio general.
              </p>
            </div>

            <div class="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
              <div class="font-bold text-neutral-900 flex items-center gap-1.5">
                <span class="text-sm">🗂️</span> Cambio de Etapa
              </div>
              <p class="text-[11px] text-neutral-600">
                Se activa cuando un lead es movido en el embudo comercial (ej: de "Nuevo" a "Primer Contacto").
              </p>
            </div>

            <div class="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1">
              <div class="font-bold text-blue-950 flex items-center gap-1.5">
                <span class="text-sm">📅</span> Ejecución Puntual
              </div>
              <p class="text-[11px] text-blue-800">
                Se programa para una fecha y hora específica (Hora Argentina UTC-3). Se ejecuta una única vez para toda la audiencia seleccionada y luego concluye.
              </p>
            </div>

            <div class="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl space-y-1 md:col-span-2">
              <div class="font-bold text-purple-950 flex items-center gap-1.5">
                <span class="text-sm">🔄</span> Ejecución Recurrente (Periódica)
              </div>
              <p class="text-[11px] text-purple-800">
                Se repite automáticamente con una frecuencia fija (minutos, horas, días, semanas, meses) con opciones de límite: indefinido, tras <em>N</em> repeticiones o hasta una fecha límite.
              </p>
            </div>
          </div>
        </section>

        <!-- Section 3: Segmentación de Audiencia -->
        <section class="space-y-3">
          <div class="flex items-center gap-2 text-primary font-bold text-sm">
            <span>🎯</span>
            <h4>3. Segmentación de Audiencia</h4>
          </div>
          <p>
            Cada automatización te permite filtrar de forma precisa sobre qué contactos o leads se aplicará el flujo:
          </p>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div class="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1">
              <strong class="text-neutral-900 block text-xs">⚡ Segmento Dinámico</strong>
              <p class="text-[11px] text-neutral-500">
                Evalúa los filtros en vivo al momento de cada ejecución (por Etapa del Pipeline, País y Días de inactividad). Ideal para flujos recurrentes.
              </p>
            </div>

            <div class="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1">
              <strong class="text-neutral-900 block text-xs">📌 Segmento Estático</strong>
              <p class="text-[11px] text-neutral-500">
                Permite congelar y elegir con casillas de verificación una lista fija de prospectos con buscador por nombre, empresa o teléfono.
              </p>
            </div>

            <div class="p-3.5 bg-white border border-neutral-200 rounded-xl space-y-1">
              <strong class="text-neutral-900 block text-xs">👥 Todos los Contactos</strong>
              <p class="text-[11px] text-neutral-500">
                Aplica sin restricciones a todos los contactos y prospectos activos registrados en el CRM.
              </p>
            </div>
          </div>
        </section>

        <!-- Section 4: Regla de Control de Solapamiento -->
        <section class="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-2 text-rose-950">
          <div class="flex items-center gap-2 font-bold text-sm text-rose-900">
            <span>⚠️</span>
            <h4>4. Control de Solapamiento (Tope de Plazos vs Repetición)</h4>
          </div>
          <p class="text-xs text-rose-900 leading-relaxed">
            <strong>Regla Fundamental de Seguridad:</strong> La suma de todas las esperas (delays) de una automatización debe ser <strong>estrictamente menor</strong> que el intervalo de repetición programado.
          </p>
          <div class="p-3 bg-white/80 rounded-xl border border-rose-200 text-[11px] space-y-1 text-rose-950">
            <div>
              <strong>Ejemplo:</strong> Si una automatización se repite <em>cada 1 día</em>, la suma de sus pasos de espera no puede superar las 24 horas.
            </div>
            <div class="text-rose-800">
              👉 <em>¿Por qué?</em> Si las esperas durasen más que el intervalo, se generarían ejecuciones superpuestas simultáneas sobre los mismos contactos antes de que termine el ciclo anterior. El sistema detecta esto en vivo y <strong>bloquea el guardado</strong> hasta que ajustes los delays o amplíes la frecuencia.
            </div>
          </div>
        </section>

        <!-- Section 5: Acciones y Esperas -->
        <section class="space-y-3">
          <div class="flex items-center gap-2 text-primary font-bold text-sm">
            <span>⚡</span>
            <h4>5. Tipos de Pasos Configurables</h4>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm shrink-0">
                💬
              </div>
              <div>
                <strong class="text-neutral-900 block">Enviar WhatsApp (Plantilla Meta)</strong>
                <p class="text-[11px] text-neutral-500 mt-0.5">
                  Envía plantillas oficiales de Meta con soporte de cabeceras multimedia (imágenes, PDFs), botones de flujo y mapeo automático de variables.
                </p>
              </div>
            </div>

            <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-sm shrink-0">
                ✉️
              </div>
              <div>
                <strong class="text-neutral-900 block">Enviar Email (Plantilla CRM & Adjuntos)</strong>
                <p class="text-[11px] text-neutral-500 mt-0.5">
                  Despacha correos seleccionando el remitente comercial, preheader para bandeja de entrada, adjuntos de archivos y tracking de apertura/clics.
                </p>
              </div>
            </div>

            <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-sm shrink-0">
                ⏳
              </div>
              <div>
                <strong class="text-neutral-900 block">Esperar Tiempo (Delay)</strong>
                <p class="text-[11px] text-neutral-500 mt-0.5">
                  Pausa la ejecución durante X minutos, horas o días antes de avanzar al próximo nodo del flujo.
                </p>
              </div>
            </div>

            <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-start gap-3">
              <div class="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-sm shrink-0">
                🏷️
              </div>
              <div>
                <strong class="text-neutral-900 block">Cambiar Etapa / Comentario Interno</strong>
                <p class="text-[11px] text-neutral-500 mt-0.5">
                  Mueve el lead en el tablero Kanban comercial o agrega una nota interna visible para el equipo.
                </p>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 6: Variables Dinámicas -->
        <section class="space-y-3">
          <div class="flex items-center gap-2 text-primary font-bold text-sm">
            <span>🔤</span>
            <h4>6. Variables Dinámicas Disponibles</h4>
          </div>
          <p>
            Puedes insertar etiquetas dinámicas en los emails, WhatsApp y comentarios. El sistema las reemplazará automáticamente con los datos reales del lead o contacto:
          </p>
          <div class="flex flex-wrap gap-2 pt-1 font-mono text-[11px]">
            <span class="px-2.5 py-1 bg-neutral-100 text-neutral-800 rounded-md border border-neutral-300 font-bold">{{nombre}}</span>
            <span class="px-2.5 py-1 bg-neutral-100 text-neutral-800 rounded-md border border-neutral-300 font-bold">{{empresa}}</span>
            <span class="px-2.5 py-1 bg-neutral-100 text-neutral-800 rounded-md border border-neutral-300 font-bold">{{telefono}}</span>
            <span class="px-2.5 py-1 bg-neutral-100 text-neutral-800 rounded-md border border-neutral-300 font-bold">{{email}}</span>
            <span class="px-2.5 py-1 bg-neutral-100 text-neutral-800 rounded-md border border-neutral-300 font-bold">{{origen}}</span>
          </div>
        </section>

        <!-- Section 7: Estados y Reglas de Reingreso -->
        <section class="space-y-3">
          <div class="flex items-center gap-2 text-primary font-bold text-sm">
            <span>🛡️</span>
            <h4>7. Estados de Ejecución y Regla de Reingreso</h4>
          </div>
          <div class="space-y-2 text-[11px]">
            <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-xl space-y-1">
              <strong class="text-neutral-900 block text-xs">🔁 Casilla "Permitir reingreso"</strong>
              <p class="text-neutral-600">
                • <strong>Activado:</strong> Si ocurre nuevamente el evento o en cada repetición de un flujo recurrente, el contacto podrá volver a entrar e iniciar el flujo desde el Paso 1.<br/>
                • <strong>Desactivado:</strong> Cada contacto solo ejecutará este flujo una única vez en toda su historia.
              </p>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div class="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                <span class="font-mono font-bold text-[10px] text-blue-800 block">EN PROCESO</span>
                <span class="text-[10px] text-blue-900">Ejecutando o en pausa de espera.</span>
              </div>
              <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <span class="font-mono font-bold text-[10px] text-emerald-800 block">FINALIZADA</span>
                <span class="text-[10px] text-emerald-900">Todos los pasos completados.</span>
              </div>
              <div class="p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                <span class="font-mono font-bold text-[10px] text-rose-800 block">ERROR</span>
                <span class="text-[10px] text-rose-900">Falló un paso. Reanudable desde el error.</span>
              </div>
              <div class="p-2.5 bg-neutral-100 border border-neutral-300 rounded-lg">
                <span class="font-mono font-bold text-[10px] text-neutral-700 block">CANCELADA</span>
                <span class="text-[10px] text-neutral-600">Detenida por un operador.</span>
              </div>
            </div>
          </div>
        </section>

      </div>

      <!-- Modal Footer -->
      <div class="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
        <span class="text-[11px] text-neutral-400 font-mono">CRM Captación de Franquicias • Automatizaciones</span>
        <button id="btn-understood" class="px-5 py-2 bg-primary hover:bg-neutral-900 text-white font-mono text-xs font-bold uppercase rounded-lg shadow-sm transition-all cursor-pointer">
          Entendido, volver
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeFn = () => modal.remove();
  modal.querySelector('#btn-close-help-modal').addEventListener('click', closeFn);
  modal.querySelector('#btn-understood').addEventListener('click', closeFn);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeFn();
  });
}
