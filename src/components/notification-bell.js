import { supabase } from '../lib/supabase';
import { realtime } from '../lib/realtime';

let chimeTimestamps = [];

function playNotificationChime() {
  const isMuted = localStorage.getItem('crm_bell_sound_muted') === 'true';
  if (isMuted) return;

  const now = Date.now();
  // Filter out timestamps older than 10 seconds
  chimeTimestamps = chimeTimestamps.filter(t => now - t < 10000);

  // If there are already 3 chimes in the last 10 seconds, suppress sound
  if (chimeTimestamps.length >= 3) {
    return;
  }

  chimeTimestamps.push(now);

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq, startTime, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Fast attack, smooth crystal decay
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const t = ctx.currentTime;
    // F5 (698.46 Hz) -> C6 (1046.50 Hz) delightful crystal chime
    playTone(698.46, t, 0.18);
    playTone(1046.50, t + 0.08, 0.35);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch (err) {
    // Silently handle audio context restrictions
  }
}

export function renderNotificationBell(currentUser, onNotificationClick) {
  const container = document.createElement('div');
  container.className = 'relative select-none';

  let notifications = [];
  let unreadCount = 0;
  let isMuted = localStorage.getItem('crm_bell_sound_muted') === 'true';

  container.innerHTML = `
    <button id="bell-btn" class="relative p-2 text-neutral-600 hover:text-primary transition-colors focus:outline-none cursor-pointer">
      <span id="bell-icon" class="text-lg inline-block transition-transform duration-300">🔔</span>
      <span id="bell-badge" class="absolute top-1.5 right-1.5 w-4 h-4 bg-coral text-white text-[9px] font-bold rounded-full flex items-center justify-center hidden">0</span>
    </button>
    
    <div id="bell-dropdown" class="absolute right-0 mt-2 w-80 bg-white border border-[#d9d9dd] rounded-sm shadow-lg overflow-hidden hidden z-50 flex flex-col max-h-96">
      <div class="px-4 py-3 border-b border-[#d9d9dd] bg-neutral-50 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-sans text-xs font-semibold text-primary uppercase tracking-wider">Notificaciones</span>
          <button id="sound-toggle-btn" title="${isMuted ? 'Activar sonido de notificación' : 'Silenciar sonido de notificación'}" class="text-neutral-500 hover:text-primary transition-colors text-xs cursor-pointer p-0.5">
            ${isMuted ? '🔇' : '🔔'}
          </button>
        </div>
        <button id="mark-all-read-btn" class="font-sans text-[10px] text-action-blue hover:underline uppercase font-medium">Marcar leídas</button>
      </div>
      <div id="notifications-list" class="flex-1 overflow-y-auto divide-y divide-[#d9d9dd] max-h-72">
        <div class="p-4 text-center text-xs text-neutral-400 font-sans">Cargando...</div>
      </div>
    </div>
  `;

  const btn = container.querySelector('#bell-btn');
  const bellIcon = container.querySelector('#bell-icon');
  const badge = container.querySelector('#bell-badge');
  const dropdown = container.querySelector('#bell-dropdown');
  const list = container.querySelector('#notifications-list');
  const markAllBtn = container.querySelector('#mark-all-read-btn');
  const soundToggleBtn = container.querySelector('#sound-toggle-btn');

  // Sound Toggle Handler
  soundToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isMuted = !isMuted;
    localStorage.setItem('crm_bell_sound_muted', String(isMuted));
    soundToggleBtn.textContent = isMuted ? '🔇' : '🔔';
    soundToggleBtn.title = isMuted ? 'Activar sonido de notificación' : 'Silenciar sonido de notificación';
    
    if (!isMuted) {
      playNotificationChime();
    }
  });

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

  function triggerBellAnimation() {
    if (!bellIcon) return;
    bellIcon.classList.add('animate-bounce');
    setTimeout(() => {
      bellIcon.classList.remove('animate-bounce');
    }, 1000);
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
          <div data-id="${n.id}" data-type="${n.type || ''}" data-lead-id="${n.lead_id || ''}" class="p-3 hover:bg-neutral-50 cursor-pointer transition-colors font-sans flex flex-col gap-0.5 ${!n.is_read ? 'bg-[#f1f5ff]' : ''}">
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
        const type = el.dataset.type;
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

        if ((type === 'campaign_created' || type === 'campaign_status') && window.location.hash !== '#campaigns') {
          window.location.hash = '#campaigns';
        } else if (leadId && onNotificationClick) {
          if (type === 'lead_interaction') {
            localStorage.setItem('lead_detail_active_tab', 'interactions');
          }
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
      
      // Do not play sound if this notification was originated by the current user
      if (!newNotification.created_by || newNotification.created_by !== currentUser.id) {
        playNotificationChime();
      }
      triggerBellAnimation();
    });
    
    // Clean up function ref
    container.unsubscribe = unsubscribe;
  }

  return container;
}
