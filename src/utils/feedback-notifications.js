import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';

/**
 * Creates internal notification records in Supabase for all active super_admins
 * whenever a user submits new feedback.
 *
 * @param {Object} params
 * @param {Object} params.feedback - The created feedback object (type, description, module, id)
 * @param {Object} [params.currentUser] - The currently logged-in user object
 */
export async function notifyNewFeedback({ feedback, currentUser }) {
  if (!feedback) return;

  try {
    // 1. Resolve active super_admin profiles
    let admins = (cache.getProfiles ? cache.getProfiles() : [])
      .filter(p => p.role === 'super_admin' && p.is_active !== false);

    if (!admins || admins.length === 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('role', 'super_admin')
        .eq('is_active', true);
      admins = data || [];
    }

    if (!admins || admins.length === 0) return;

    // 2. Resolve title and icon by feedback type
    let title = '💬 Nuevo feedback recibido';
    if (feedback.type === 'bug') {
      title = '🐛 Reporte de problema';
    } else if (feedback.type === 'improvement') {
      title = '💡 Sugerencia de mejora';
    } else if (feedback.type === 'idea') {
      title = '✨ Nueva idea compartida';
    }

    const userName = currentUser?.profile?.full_name || currentUser?.email || 'Usuario';
    const moduleName = feedback.module || 'CRM';
    const cleanDesc = (feedback.description || '').replace(/\s+/g, ' ').trim();
    const snippet = cleanDesc.length > 70 ? cleanDesc.slice(0, 67) + '...' : cleanDesc;
    const message = `"${snippet}" — Por: ${userName} (${moduleName})`;

    // 3. Build notification records for all admins
    const notifications = admins.map(admin => ({
      user_id: admin.id,
      title,
      message,
      type: 'user_feedback',
      is_read: false,
      created_by: currentUser?.id || null,
      created_at: new Date().toISOString()
    }));

    await supabase.from('notifications').insert(notifications);
  } catch (err) {
    console.error('Error creating feedback notifications for admins:', err);
  }
}
