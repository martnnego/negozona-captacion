import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { formatDateTime } from '../utils/date-format';
import { toast } from './toast';
import { renderLeadDetail } from '../pages/lead-detail';
import { formatDate } from '../utils/date-format';

/**
 * Drawer lateral para inspeccionar el historial y timeline detallado de una ejecución.
 * @param {string} executionId - UUID de la ejecución en automation_executions
 * @param {Function} [onUpdated] - Callback si se cancela o reintenta la ejecución
 */
export async function openAutomationExecutionDrawer(executionId, onUpdated) {
  const existing = document.getElementById('automation-execution-drawer-container');
  if (existing) existing.remove();

  const container = document.createElement('div');
  container.id = 'automation-execution-drawer-container';
  container.className = 'fixed inset-0 z-50 overflow-hidden font-sans';

  container.innerHTML = `
    <!-- Backdrop -->
    <div id="exec-drawer-backdrop" class="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-fade-in"></div>

    <!-- Slide Panel -->
    <div class="fixed inset-y-0 right-0 max-w-full flex pl-10">
      <div class="w-screen max-w-xl bg-white shadow-2xl border-l border-neutral-200 flex flex-col transform transition-transform duration-300 animate-slide-left">
        
        <!-- Header -->
        <div class="px-6 py-5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div id="exec-status-icon" class="w-9 h-9 rounded-xl bg-neutral-200 text-neutral-700 flex items-center justify-center text-base font-bold">
              ⏳
            </div>
            <div>
              <h3 class="text-sm font-bold font-display text-neutral-900" id="exec-title">
                Detalle de Ejecución
              </h3>
              <p class="text-[10px] text-neutral-400 font-mono" id="exec-subtitle">ID: ${executionId.slice(0, 8)}...</p>
            </div>
          </div>
          <button id="btn-close-exec-drawer" class="w-8 h-8 rounded-lg flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200 transition-colors cursor-pointer text-base font-mono">
            ✕
          </button>
        </div>

        <!-- Content Area -->
        <div class="flex-1 overflow-y-auto px-6 py-6 space-y-6 text-xs text-neutral-800" id="exec-drawer-body">
          <div class="py-12 text-center text-neutral-400 animate-pulse font-mono">
            🔄 Cargando historial de ejecución...
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="px-6 py-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between" id="exec-drawer-footer">
          <span class="text-[11px] text-neutral-400 font-mono">Historial en tiempo real</span>
          <div class="flex items-center gap-2" id="exec-footer-actions">
            <!-- Rendered dynamically based on status -->
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.appendChild(container);

  const closeDrawer = () => container.remove();
  container.querySelector('#btn-close-exec-drawer').addEventListener('click', closeDrawer);
  container.querySelector('#exec-drawer-backdrop').addEventListener('click', closeDrawer);

  await loadExecutionDetail();

  async function loadExecutionDetail() {
    try {
      // 1. Fetch execution with lead & contact info
      const { data: exec, error: execErr } = await supabase
        .from('automation_executions')
        .select(`
          *,
          automations(name, trigger_type),
          leads(id, company, source, pipeline_stage_id),
          contacts(id, first_name, last_name, phone, email)
        `)
        .eq('id', executionId)
        .single();

      if (execErr || !exec) {
        throw new Error(execErr?.message || 'No se encontró la ejecución');
      }

      // 2. Fetch logs for this execution in chronological order
      const { data: logs } = await supabase
        .from('automation_execution_logs')
        .select('*')
        .eq('execution_id', executionId)
        .order('executed_at', { ascending: true });

      // 3. Fetch all automation steps to show complete flow
      const { data: allSteps } = await supabase
        .from('automation_steps')
        .select('*')
        .eq('automation_id', exec.automation_id)
        .order('step_order', { ascending: true });

      renderExecutionContent(exec, logs || [], allSteps || []);

    } catch (err) {
      container.querySelector('#exec-drawer-body').innerHTML = `
        <div class="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
          ⚠️ Error al cargar ejecución: ${err.message}
        </div>
      `;
    }
  }

  function renderExecutionContent(exec, logs, steps) {
    const body = container.querySelector('#exec-drawer-body');
    const footerActions = container.querySelector('#exec-footer-actions');
    const statusIcon = container.querySelector('#exec-status-icon');
    const stages = cache.getStages() || [];

    const statusBadges = {
      running: { label: 'En Proceso', bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: '⚡' },
      waiting: { label: 'En Espera (Delay)', bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: '⏳' },
      completed: { label: 'Finalizada con Éxito', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '✅' },
      failed: { label: 'Error en Ejecución', bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: '❌' },
      cancelled: { label: 'Cancelada', bg: 'bg-neutral-100 text-neutral-600 border-neutral-200', icon: '🛑' }
    };

    const currentBadge = statusBadges[exec.status] || statusBadges.running;
    statusIcon.textContent = currentBadge.icon;
    statusIcon.className = `w-9 h-9 rounded-xl flex items-center justify-center text-base font-bold ${currentBadge.bg}`;

    const contactName = exec.contacts ? `${exec.contacts.first_name || ''} ${exec.contacts.last_name || ''}`.trim() : null;
    const displayName = contactName || exec.leads?.company || 'Contacto / Lead';
    const displaySubtitle = [
      exec.leads?.company && exec.leads.company !== displayName ? `Empresa: ${exec.leads.company}` : null,
      exec.contacts?.phone ? `📱 ${exec.contacts.phone}` : null,
      exec.contacts?.email ? `✉️ ${exec.contacts.email}` : null
    ].filter(Boolean).join(' • ');

    const resumeStep = steps.find(s => s.step_order === exec.current_step_order) || steps[0];

    body.innerHTML = `
      <!-- Contact Summary Card -->
      <div class="p-4 bg-neutral-50 rounded-xl border border-neutral-200 flex flex-col gap-3">
        <div class="flex items-start justify-between">
          <div>
            <h4 class="text-sm font-bold text-neutral-900 font-display">${displayName}</h4>
            <p class="text-[11px] text-neutral-500 mt-0.5">${displaySubtitle || 'Sin datos adicionales'}</p>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${currentBadge.bg}">
            ${currentBadge.label}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-200/80 font-mono text-[10px]">
          <div>
            <span class="text-neutral-400 block uppercase">Iniciado</span>
            <strong class="text-neutral-700">${formatDateTime(exec.started_at || exec.created_at)}</strong>
          </div>
          <div>
            <span class="text-neutral-400 block uppercase">${exec.completed_at ? 'Completado' : 'Próxima Acción'}</span>
            <strong class="text-neutral-700">${exec.completed_at ? formatDateTime(exec.completed_at) : formatDateTime(exec.scheduled_for || exec.updated_at)}</strong>
          </div>
        </div>

        ${exec.lead_id ? `
          <div class="pt-1">
            <button id="btn-view-lead-profile" class="text-xs font-mono font-bold text-primary hover:underline cursor-pointer flex items-center gap-1">
              <span>📋 Ver Ficha del Lead →</span>
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Execution Status / Resume Info Banner -->
      ${exec.status === 'failed' ? `
        <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-3 shadow-2xs">
          <span class="text-xl shrink-0">📍</span>
          <div>
            <strong class="font-bold block text-amber-950">Punto de reanudación: Paso #${exec.current_step_order} (${resumeStep?.name || 'Paso actual'})</strong>
            <p class="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
              Al hacer clic en <strong>"Reintentar"</strong>, el flujo continuará exactamente a partir del <strong>Paso #${exec.current_step_order}</strong>. Los pasos anteriores ya ejecutados con éxito no se volverán a repetir.
            </p>
          </div>
        </div>
      ` : ''}

      ${exec.error_message && exec.status === 'failed' ? `
        <div class="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
          <span class="text-base shrink-0">⚠️</span>
          <div>
            <strong class="font-bold block">Motivo del error:</strong>
            <span class="font-mono text-[11px] break-words">${exec.error_message}</span>
          </div>
        </div>
      ` : ''}

      <!-- Timeline of Steps -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-bold text-neutral-800 font-mono uppercase text-[10px] tracking-wider flex items-center gap-2">
            <span>📋</span> Línea de Tiempo del Flujo (${steps.length} Pasos)
          </h4>
          <span class="text-[10px] text-neutral-400 font-mono">
            ${exec.status === 'completed' ? '✓ 100% Completado' : `Progreso: Paso #${exec.current_step_order || 1} de ${steps.length}`}
          </span>
        </div>

        <div class="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200">
          
          <!-- Trigger Start Node -->
          <div class="relative flex items-start gap-3">
            <div class="absolute -left-6 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-2xs">
              ✓
            </div>
            <div class="flex-1 bg-white p-3.5 rounded-xl border border-neutral-200 shadow-2xs">
              <div class="flex items-center justify-between">
                <span class="font-bold text-neutral-800 text-[11px] flex items-center gap-1.5">
                  <span>⚡ Disparador Inicial Activado</span>
                </span>
                <span class="text-[9px] font-mono text-neutral-400">${formatDate(exec.started_at || exec.created_at)}</span>
              </div>
              <p class="text-[10px] text-neutral-500 mt-1">Automatización iniciada para "${exec.automations?.name || 'Flujo'}"</p>
            </div>
          </div>

          <!-- Flow Steps -->
          ${steps.map((step, idx) => {
            // Find all logs for this step to check if it was retried
            const stepLogs = logs.filter(l => l.step_id === step.id || l.step_order === step.step_order);
            // Latest log defines current state
            const latestLog = stepLogs[stepLogs.length - 1];
            const previousAttempts = stepLogs.length > 1 ? stepLogs.length : 1;

            const isStepCompleted = (latestLog && latestLog.status === 'completed') || (exec.status === 'completed' && exec.current_step_order >= step.step_order);
            const isStepFailed = latestLog && latestLog.status === 'failed' && exec.status === 'failed';
            const isStepWaiting = exec.status === 'waiting' && exec.current_step_order === step.step_order;
            const isResumePoint = exec.status === 'failed' && exec.current_step_order === step.step_order;
            const isPending = !latestLog && (exec.current_step_order < step.step_order);

            let dotBg = 'bg-neutral-200 text-neutral-500';
            let statusBadgeHtml = '<span class="text-neutral-400 font-mono text-[9px]">Pendiente</span>';
            let dotIcon = '⏳';
            let cardBorder = 'border-neutral-200 bg-white';

            if (isStepCompleted) {
              dotBg = 'bg-emerald-500 text-white';
              dotIcon = '✓';
              statusBadgeHtml = `<span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">✓ Completado</span>`;
              cardBorder = 'border-emerald-200/80 bg-emerald-50/10';
            } else if (isStepFailed) {
              dotBg = 'bg-rose-500 text-white';
              dotIcon = '✕';
              statusBadgeHtml = `<span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-rose-50 text-rose-700 border border-rose-200">✕ Falló</span>`;
              cardBorder = 'border-rose-300 bg-rose-50/20';
            } else if (isStepWaiting) {
              dotBg = 'bg-amber-500 text-white animate-pulse';
              dotIcon = '⏳';
              statusBadgeHtml = `<span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">⏳ En Espera</span>`;
              cardBorder = 'border-amber-300 bg-amber-50/20';
            }

            const stepTypeTitles = {
              send_whatsapp: 'WhatsApp',
              send_email: 'Email',
              delay: 'Espera Temporal',
              change_stage: 'Cambio de Etapa',
              add_comment: 'Comentario Interno'
            };

            const detailsHtml = renderHumanReadableStepDetails(step, latestLog, stages);

            return `
              <div class="relative flex items-start gap-3">
                <div class="absolute -left-6 w-5 h-5 rounded-full ${dotBg} flex items-center justify-center text-[10px] font-bold ring-4 ring-white shadow-2xs">
                  ${dotIcon}
                </div>
                
                <div class="flex-1 p-3.5 rounded-xl border ${cardBorder} shadow-2xs space-y-2">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[9px] font-mono font-bold uppercase text-neutral-400">Paso #${step.step_order}</span>
                        <span class="font-bold text-neutral-900 text-xs">${step.name || stepTypeTitles[step.step_type] || 'Acción'}</span>
                        ${previousAttempts > 1 && isStepCompleted ? `
                          <span class="px-1.5 py-0.2 rounded text-[8px] font-mono bg-blue-50 text-blue-700 border border-blue-200" title="Reintentado exitosamente">
                            🔄 Intento #${previousAttempts}
                          </span>
                        ` : ''}
                      </div>
                      <div class="text-[10px] text-neutral-500 font-mono mt-0.5">
                        Tipo: ${stepTypeTitles[step.step_type] || step.step_type}
                      </div>
                    </div>
                    
                    <div class="flex flex-col items-end gap-1">
                      ${statusBadgeHtml}
                      ${isResumePoint ? `
                        <span class="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                          📍 Reanuda aquí
                        </span>
                      ` : ''}
                    </div>
                  </div>

                  <!-- Human-Readable Clean Details -->
                  ${detailsHtml}

                  <!-- Timestamp / Duration Footer -->
                  ${latestLog?.executed_at ? `
                    <div class="pt-1.5 border-t border-neutral-100 flex items-center justify-between text-[9px] font-mono text-neutral-400">
                      <span>Ejecutado: ${formatDateTime(latestLog.executed_at)}</span>
                      ${latestLog.duration_ms ? `<span>Duración: ${latestLog.duration_ms} ms</span>` : ''}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}

        </div>
      </div>
    `;

    // View lead profile click
    const leadBtn = body.querySelector('#btn-view-lead-profile');
    if (leadBtn && exec.lead_id) {
      leadBtn.addEventListener('click', () => {
        container.remove();
        renderLeadDetail(exec.lead_id);
      });
    }

    // Dynamic Footer Buttons
    footerActions.innerHTML = '';

    if (['running', 'waiting'].includes(exec.status)) {
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-mono font-bold uppercase rounded-lg transition-colors cursor-pointer flex items-center gap-1.5';
      cancelBtn.innerHTML = `<span>🛑 Cancelar Ejecución</span>`;
      cancelBtn.addEventListener('click', async () => {
        if (!confirm('¿Estás seguro de cancelar esta ejecución activa? Ya no se ejecutarán los pasos pendientes.')) return;
        try {
          const nowIso = new Date().toISOString();
          await supabase
            .from('automation_executions')
            .update({ status: 'cancelled', updated_at: nowIso })
            .eq('id', exec.id);

          await supabase.from('automation_execution_logs').insert({
            execution_id: exec.id,
            step_order: exec.current_step_order || 1,
            step_type: 'cancelled',
            status: 'completed',
            output_data: { message: 'Flujo cancelado manualmente por el usuario desde el visor de pasos' },
            executed_at: nowIso
          });

          toast.show('Ejecución cancelada', 'info');
          await cache.loadAll();
          if (onUpdated) onUpdated();
          await loadExecutionDetail();
        } catch (e) {
          toast.show('Error al cancelar: ' + e.message, 'error');
        }
      });
      footerActions.appendChild(cancelBtn);
    }

    if (['failed', 'cancelled'].includes(exec.status)) {
      const retryBtn = document.createElement('button');
      retryBtn.className = 'px-4 py-2.5 bg-primary hover:bg-neutral-900 text-white text-xs font-mono font-bold uppercase rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-2';
      retryBtn.innerHTML = `<span>🔄 Reintentar desde Paso #${exec.current_step_order || 1}</span>`;
      
      retryBtn.addEventListener('click', async () => {
        try {
          retryBtn.disabled = true;
          retryBtn.innerHTML = `<span>🔄 Reanudando ejecución...</span>`;

          // Reset status to running and schedule now
          await supabase
            .from('automation_executions')
            .update({
              status: 'running',
              scheduled_for: new Date().toISOString(),
              error_message: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', exec.id);

          // Invoke runner directly
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automation-runner`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ execution_id: exec.id })
          }).catch(() => {});

          toast.show(`Ejecución reanudada a partir del Paso #${exec.current_step_order || 1}`, 'success');
          if (onUpdated) onUpdated();
          await loadExecutionDetail();
        } catch (e) {
          toast.show('Error al reintentar: ' + e.message, 'error');
          retryBtn.disabled = false;
          retryBtn.innerHTML = `<span>🔄 Reintentar desde Paso #${exec.current_step_order || 1}</span>`;
        }
      });
      footerActions.appendChild(retryBtn);
    }
  }

  function renderHumanReadableStepDetails(step, log, stages) {
    const config = step.config || {};
    const output = log?.output_data || {};
    const isError = log?.status === 'failed' || !!log?.error_message;

    if (isError && log?.error_message) {
      return `
        <div class="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] font-sans">
          <strong class="font-bold block text-rose-900">⚠️ Error detectado en este paso:</strong>
          <span class="mt-0.5 block leading-relaxed">${log.error_message}</span>
        </div>
      `;
    }

    const targetModeLabels = {
      execution_contact: 'Contacto de esta ejecución',
      primary_only: 'Solo contacto principal',
      all_contacts: 'Todos los contactos vinculados'
    };

    if (step.step_type === 'send_whatsapp') {
      const templateName = config.template_name || 'Plantilla oficial';
      const targetMode = targetModeLabels[config.recipient_mode] || (config.recipient_mode === 'all_contacts' ? 'Todos los contactos del lead' : 'Contacto de esta ejecución');
      const sentCount = output.sent_count || (output.results ? output.results.length : 1);
      const isDone = log?.status === 'completed';
      const isSkipped = output.skipped === true;

      return `
        <div class="space-y-1.5 text-[11px] text-neutral-700 bg-neutral-50/80 p-2.5 rounded-lg border border-neutral-200">
          <div class="flex items-center justify-between">
            <span>Plantilla: <strong>${templateName}</strong></span>
            <span class="text-[10px] text-neutral-500 font-mono bg-neutral-100 px-1.5 py-0.5 rounded">Destinatario: ${targetMode}</span>
          </div>
          ${config.header_media_url ? `
            <div class="text-[10px] text-emerald-700 flex items-center gap-1 font-mono">
              <span>🖼️ Encabezado multimedia adjunto</span>
            </div>
          ` : ''}
          ${isSkipped ? `
            <div class="text-[10px] text-neutral-600 bg-amber-50/80 border border-amber-200/80 p-1.5 rounded flex items-center gap-1.5">
              <span>⏭️</span> <span>${output.message || 'Paso omitido para este contacto secundario'}</span>
            </div>
          ` : isDone ? `
            <div class="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
              <span>✓ Enviado con éxito por WhatsApp a ${sentCount} destinatario(s)</span>
            </div>
          ` : ''}
        </div>
      `;

    } else if (step.step_type === 'send_email') {
      const subject = config.subject || 'Sin asunto';
      const sender = config.sender_email || 'Predeterminado';
      const targetMode = targetModeLabels[config.recipient_mode] || (config.recipient_mode === 'all_contacts' ? 'Todos los contactos del lead' : 'Contacto de esta ejecución');
      const isDone = log?.status === 'completed';
      const isSkipped = output.skipped === true;

      return `
        <div class="space-y-1.5 text-[11px] text-neutral-700 bg-neutral-50/80 p-2.5 rounded-lg border border-neutral-200">
          <div>Asunto: <strong>"${subject}"</strong></div>
          <div class="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
            <span>De: ${sender}</span>
            <span class="bg-neutral-100 px-1.5 py-0.5 rounded">Para: ${targetMode}</span>
          </div>
          ${config.preview_text ? `
            <div class="text-[10px] text-neutral-500 italic">Preheader: "${config.preview_text}"</div>
          ` : ''}
          ${config.attachments && config.attachments.length > 0 ? `
            <div class="text-[10px] text-blue-700 font-mono">📎 ${config.attachments.length} archivo(s) adjunto(s)</div>
          ` : ''}
          ${isSkipped ? `
            <div class="text-[10px] text-neutral-600 bg-amber-50/80 border border-amber-200/80 p-1.5 rounded flex items-center gap-1.5">
              <span>⏭️</span> <span>${output.message || 'Paso omitido para este contacto secundario'}</span>
            </div>
          ` : isDone ? `
            <div class="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
              <span>✓ Correo electrónico enviado exitosamente</span>
            </div>
          ` : ''}
        </div>
      `;

    } else if (step.step_type === 'delay') {
      const unitMap = { minutes: 'minuto(s)', hours: 'hora(s)', days: 'día(s)' };
      const durationText = `${config.duration || 1} ${unitMap[config.unit] || 'minutos'}`;
      const isDone = log?.status === 'completed';

      return `
        <div class="space-y-1 text-[11px] text-neutral-700 bg-neutral-50/80 p-2.5 rounded-lg border border-neutral-200">
          <div>Duración configurada: <strong>${durationText}</strong></div>
          ${isDone ? `
            <div class="text-[10px] text-emerald-700 font-medium">✓ Espera cumplida correctamente</div>
          ` : ''}
        </div>
      `;

    } else if (step.step_type === 'change_stage') {
      const targetStage = stages.find(s => s.id === config.to_stage_id);
      const stageName = targetStage ? targetStage.name : 'Etapa de pipeline';
      const isDone = log?.status === 'completed';

      return `
        <div class="space-y-1 text-[11px] text-neutral-700 bg-neutral-50/80 p-2.5 rounded-lg border border-neutral-200">
          <div>Etapa destino: <strong>${stageName}</strong></div>
          ${isDone ? `
            <div class="text-[10px] text-emerald-700 font-medium">✓ Lead movido exitosamente a "${stageName}"</div>
          ` : ''}
        </div>
      `;

    } else if (step.step_type === 'add_comment') {
      const commentText = config.comment || output.content || 'Nota registrada';
      const isDone = log?.status === 'completed';

      return `
        <div class="space-y-1 text-[11px] text-neutral-700 bg-neutral-50/80 p-2.5 rounded-lg border border-neutral-200">
          <div class="italic">"${commentText}"</div>
          ${isDone ? `
            <div class="text-[10px] text-emerald-700 font-medium">✓ Comentario guardado en la ficha del lead</div>
          ` : ''}
        </div>
      `;
    }

    return '';
  }
}
