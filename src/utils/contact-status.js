import { supabase } from '../lib/supabase';
import { modal } from '../components/modal';

export const CONTACT_DEACTIVATION_HELPER = '⚠️ Si desactivas este contacto, quedará excluido de campañas masivas y automatizaciones, y se inhabilitará el envío de WhatsApps y correos directos para evitar reportes de spam.';

/**
 * Prompts user with a confirmation modal before deactivating a contact.
 */
export function confirmContactDeactivation({ contactName, onConfirm, onCancel }) {
  const content = document.createElement('div');
  content.className = 'font-sans text-xs text-neutral-700 flex flex-col gap-3 leading-relaxed';
  content.innerHTML = `
    <div class="bg-rose-50 border border-rose-200 rounded-sm p-3 text-rose-900 flex items-start gap-2.5">
      <span class="text-base shrink-0">⚠️</span>
      <div class="flex flex-col gap-1">
        <span class="font-bold text-xs">¿Estás seguro de que deseas desactivar a ${contactName ? `<b>${contactName}</b>` : 'este contacto'}?</span>
        <span class="text-[11px] text-rose-800">
          Esta acción aplica la política de <strong>exclusión total (opt-out)</strong> para evitar que los usuarios nos reporten como spam.
        </span>
      </div>
    </div>

    <div class="space-y-2 text-[11px] text-neutral-600">
      <p class="font-bold uppercase font-mono text-[9.5px] text-primary">Consecuencias de la desactivación:</p>
      <ul class="list-disc pl-4 space-y-1">
        <li><strong>Campañas y Automatizaciones:</strong> Quedará excluido inmediatamente de cualquier envío masivo o flujo automatizado.</li>
        <li><strong>Ficha del Lead:</strong> Se inhabilitarán los envíos de WhatsApp y Email hacia este destinatario.</li>
        <li><strong>Comunicaciones pendientes:</strong> Se cancelarán automáticamente todos los WhatsApps programados y automatizaciones activas para este contacto.</li>
        <li><strong>Agente IA de WhatsApp:</strong> Si el número estaba en la Lista Blanca de Meta, se removerá para liberar cupo y evitar respuestas automáticas.</li>
      </ul>
    </div>
  `;

  let confirmed = false;

  const confirmModal = modal.create({
    title: 'Confirmar Desactivación de Contacto',
    content,
    actions: [
      {
        text: 'Cancelar',
        primary: false,
        onClick: () => {
          if (!confirmed && onCancel) onCancel();
        }
      },
      {
        text: 'Sí, Desactivar Contacto',
        primary: true,
        onClick: () => {
          confirmed = true;
          if (onConfirm) onConfirm();
        }
      }
    ],
    onClose: () => {
      if (!confirmed && onCancel) onCancel();
    }
  });

  return confirmModal;
}

/**
 * Executes cascading cancellations and Meta allowlist cleanup when a contact is deactivated.
 */
export async function cascadeDeactivateContact(contactId, contactPhone) {
  const results = {
    cancelledScheduledMessages: 0,
    cancelledAutomations: 0,
    removedFromAllowlist: false
  };

  try {
    // 1. Cancel pending scheduled WhatsApp messages
    const { data: cancelledMsgs, error: waErr } = await supabase
      .from('whatsapp_messages')
      .update({ 
        status: 'cancelled',
        error_message: 'Cancelado automáticamente por desactivación del contacto (opt-out anti-spam)'
      })
      .eq('contact_id', contactId)
      .eq('status', 'scheduled')
      .select('id');

    if (!waErr && cancelledMsgs) {
      results.cancelledScheduledMessages = cancelledMsgs.length;
    }

    // 2. Cancel active/waiting automation executions
    const { data: cancelledAutos, error: autoErr } = await supabase
      .from('automation_executions')
      .update({ status: 'cancelled' })
      .eq('contact_id', contactId)
      .in('status', ['waiting', 'running'])
      .select('id');

    if (!autoErr && cancelledAutos) {
      results.cancelledAutomations = cancelledAutos.length;
    }

    // 3. Remove from Meta Agent Allowlist if phone is present
    if (contactPhone) {
      const cleanContactPhone = String(contactPhone).replace(/[^\d]/g, '');
      if (cleanContactPhone.length >= 8) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const jwt = session?.access_token;
          if (jwt) {
            const headers = { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'application/json' };
            const numRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/numbers`, { headers });
            if (numRes.ok) {
              const numData = await numRes.json();
              const numbers = (numData.data || []).filter(n => n.is_eligible_agent || n.agent_status === 'ACTIVE' || n.agent_status === 'ELIGIBLE');
              
              for (const num of numbers) {
                try {
                  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-allowlist`, {
                    method: 'DELETE',
                    headers,
                    body: JSON.stringify({ phone_number_id: num.id, consumer_phone_number: contactPhone })
                  });
                  results.removedFromAllowlist = true;
                } catch (e) {
                  console.warn(`Could not remove contact from allowlist on line ${num.id}:`, e);
                }
              }
            }
          }
        } catch (allowErr) {
          console.warn('Error syncing allowlist deletion:', allowErr);
        }
      }
    }
  } catch (err) {
    console.error('Error during cascading deactivation:', err);
  }

  return results;
}
