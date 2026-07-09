import { supabase } from '../lib/supabase';
import { realtime } from '../lib/realtime';

export function renderNotificationBell(currentUser, onNotificationClick) {
  const container = document.createElement('div');
  container.className = 'relative select-none';

  let notifications = [];
  let unreadCount = 0;

  container.innerHTML = `
    <button id="bell-btn" class="relative p-2 text-neutral-600 hover:text-primary transition-colors focus:outline-none">
      <span class="text-lg">🔔</span>
      <span id="bell-badge" class="absolute top-1.5 right-1.5 w-4 h-4 bg-coral text-white text-[9px] font-bold rounded-full flex items-center justify-center hidden">0</span>
    </button>
    
    <div id="bell-dropdown" class="absolute right-0 mt-2 w-80 bg-white border border-[#d9d9dd] rounded-sm shadow-lg overflow-hidden hidden z-50 flex flex-col max-h-96">
      <div class="px-4 py-3 border-b border-[#d9d9dd] bg-neutral-50 flex items-center justify-between">
        <span class="font-sans text-xs font-semibold text-primary uppercase tracking-wider">Notificaciones</span>
        <button id="mark-all-read-btn" class="font-sans text-[10px] text-action-blue hover:underline uppercase font-medium">Marcar leídas</button>
      </div>
      <div id="notifications-list" class="flex-1 overflow-y-auto divide-y divide-[#d9d9dd] max-h-72">
        <div class="p-4 text-center text-xs text-neutral-400 font-sans">Cargando...</div>
      </div>
    </div>
  `;

  const btn = container.querySelector('#bell-btn');
  const badge = container.querySelector('#bell-badge');
  const dropdown = container.querySelector('#bell-dropdown');
  const list = container.querySelector('#notifications-list');
  const markAllBtn = container.querySelector('#mark-all-read-btn');

  // Toggle Dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  // Fetch initial notifications
  async function loadNotifications() {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) throw error;
      notifications = data || [];
      updateUI();
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }

  function updateUI() {
    unreadCount = notifications.filter(n => !n.is_read).length;
    if (unreadCount > 0) {
      badge.textContent = unreadCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    if (notifications.length === 0) {
      list.innerHTML = `<div class="p-6 text-center text-xs text-neutral-400 font-sans">No tienes notificaciones</div>`;
      return;
    }

    list.innerHTML = notifications
      .map(n => {
        return `
          <div data-id="${n.id}" data-lead-id="${n.lead_id || ''}" class="p-3 hover:bg-neutral-50 cursor-pointer transition-colors font-sans flex flex-col gap-0.5 ${!n.is_read ? 'bg-[#f1f5ff]' : ''}">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-primary truncate">${n.title}</span>
              <span class="text-[9px] text-muted">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p class="text-[11px] text-[#616161] leading-relaxed">${n.message || ''}</p>
          </div>
        `;
      })
      .join('');

    // Attach click events
    list.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.dataset.id;
        const leadId = el.dataset.leadId;
        
        // Mark as read
        try {
          await supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', id);
          
          notifications = notifications.map(n => n.id === id ? { ...n, is_read: true } : n);
          updateUI();
        } catch (err) {
          console.error(err);
        }

        dropdown.classList.add('hidden');
        if (leadId && onNotificationClick) {
          onNotificationClick(leadId);
        }
      });
    });
  }

  // Mark all read
  markAllBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', currentUser.id)
        .eq('is_read', false);

      if (error) throw error;
      notifications = notifications.map(n => ({ ...n, is_read: true }));
      updateUI();
    } catch (err) {
      console.error(err);
    }
  });

  // Load initially
  loadNotifications();

  // Subscribe to realtime notification updates
  if (currentUser) {
    const unsubscribe = realtime.subscribeToNotifications(currentUser.id, (newNotification) => {
      notifications.unshift(newNotification);
      if (notifications.length > 15) notifications.pop();
      updateUI();
    });
    
    // Clean up function ref
    container.unsubscribe = unsubscribe;
  }

  return container;
}
