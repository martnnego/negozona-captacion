import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';

/**
 * Creates notification records in Supabase for all active team members
 * whenever a new interaction (gestión) is registered.
 *
 * @param {Object} params
 * @param {Object} params.lead - The lead object (must have id and company)
 * @param {Object} params.interaction - The interaction object (contact_type, direction, subject, body, created_by, contacted_at)
 * @param {Object} [params.currentUser] - The currently logged-in user object
 */
export async function notifyNewInteraction({ lead, interaction, currentUser }) {
  if (!lead || !interaction) return;

  try {
    // 1. Resolve active profiles to notify
    let profiles = cache.getProfiles();
    if (!profiles || profiles.length === 0) {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true);
      profiles = data || [];
    }

    if (!profiles || profiles.length === 0) return;

    // 2. Resolve medium icon and label
    const type = interaction.contact_type || 'otro';
    let typeLabel = 'Otro';
    let typeIcon = 'ℹ️';

    if (type === 'whatsapp') {
      typeIcon = '🟢';
      typeLabel = 'WhatsApp';
    } else if (type === 'email') {
      typeIcon = '✉️';
      typeLabel = 'Email';
    } else if (type === 'telefono') {
      typeIcon = '📞';
      typeLabel = 'Llamada';
    } else if (type === 'meet') {
      typeIcon = '💻';
      typeLabel = 'Meet';
    } else if (type === 'linkedin') {
      typeIcon = '🔗';
      typeLabel = 'LinkedIn';
    }

    const directionLabel = interaction.direction === 'inbound' ? 'Entrante' : 'Saliente';
    const companyName = lead.company || 'Empresa';

    // 3. Resolve author name
    let authorName = 'Comercial';
    if (interaction.direction === 'inbound') {
      authorName = 'Cliente';
    } else {
      const authorId = currentUser?.id || interaction.created_by;
      const authorProfile = profiles.find(p => p.id === authorId);
      authorName = authorProfile?.full_name || currentUser?.profile?.full_name || 'Comercial';
    }

    const subject = interaction.subject || 'Nueva gestión';
    const title = `${typeIcon} ${typeLabel} ${directionLabel} · ${companyName}`;
    const message = `"${subject}" — Por: ${authorName}`;

    // 4. Build notifications array for all team members
    const notifications = profiles.map(p => ({
      user_id: p.id,
      lead_id: lead.id,
      title,
      message,
      type: 'lead_interaction',
      is_read: false,
      created_by: currentUser?.id || interaction.created_by || null,
      created_at: new Date().toISOString()
    }));

    await supabase.from('notifications').insert(notifications);
  } catch (err) {
    console.error('Error creating interaction notifications:', err);
  }
}
