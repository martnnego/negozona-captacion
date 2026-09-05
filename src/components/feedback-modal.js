import { supabase } from '../lib/supabase';
import { auth } from '../lib/auth';
import { toast } from './toast';
import { captureFeedbackContext } from '../utils/feedback-context';
import { notifyNewFeedback } from '../utils/feedback-notifications';

/**
 * Opens the ultra-fast User Feedback Modal.
 */
export async function openFeedbackModal() {
  // Prevent opening multiple modals
  if (document.getElementById('feedback-modal-backdrop')) return;

  const currentUser = await auth.getCurrentUser();
  const context = await captureFeedbackContext();

  const backdrop = document.createElement('div');
  backdrop.id = 'feedback-modal-backdrop';
  backdrop.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in select-none';

  const container = document.createElement('div');
  container.className = 'bg-white w-full max-w-lg rounded-sm border border-neutral-200 shadow-xl flex flex-col overflow-hidden animate-fade-in';

  let selectedType = 'bug'; // 'bug', 'improvement', 'idea'
  let isSubmitting = false;

  // Build entity info snippet for the subtle context badge
  let entityLabel = '';
  if (context.entity_context?.name) {
    entityLabel = ` • Registro: ${context.entity_context.name}`;
  } else if (context.entity_context?.title) {
    entityLabel = ` • ${context.entity_context.title}`;
  } else if (context.entity_context?.id) {
    entityLabel = ` • ID #${context.entity_context.id.slice(0, 8)}`;
  }

  container.innerHTML = `
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-[#d9d9dd] bg-white">
      <div class="flex items-center gap-2.5">
        <span class="text-xl">💬</span>
        <div>
          <h3 class="text-base font-semibold font-display text-primary leading-none">Danos tu Feedback</h3>
          <p class="text-[11px] text-muted-slate mt-1 font-sans">Tu opinión nos ayuda a mejorar el CRM día a día</p>
        </div>
      </div>
      <button id="feedback-close-btn" class="text-neutral-400 hover:text-primary transition-colors font-mono text-base p-1 cursor-pointer" title="Cerrar">✕</button>
    </div>

    <!-- Body Form -->
    <form id="feedback-form" class="p-6 flex flex-col gap-4">
      <!-- Type selector cards -->
      <div class="flex flex-col gap-1.5">
        <label class="font-sans text-[11px] font-bold uppercase tracking-wider text-muted-slate">Tipo de feedback</label>
        <div class="grid grid-cols-3 gap-2" id="feedback-type-selector">
          <button type="button" data-type="bug" class="type-pill flex flex-col items-center justify-center p-2.5 rounded-sm border-2 transition-all cursor-pointer border-rose-500 bg-rose-50/50 text-rose-900 font-medium">
            <span class="text-lg">🐛</span>
            <span class="text-xs mt-1 font-sans font-semibold">Problema</span>
          </button>
          <button type="button" data-type="improvement" class="type-pill flex flex-col items-center justify-center p-2.5 rounded-sm border-2 transition-all cursor-pointer border-neutral-200 hover:border-amber-400 bg-white text-neutral-600">
            <span class="text-lg">💡</span>
            <span class="text-xs mt-1 font-sans font-medium">Mejora</span>
          </button>
          <button type="button" data-type="idea" class="type-pill flex flex-col items-center justify-center p-2.5 rounded-sm border-2 transition-all cursor-pointer border-neutral-200 hover:border-purple-400 bg-white text-neutral-600">
            <span class="text-lg">✨</span>
            <span class="text-xs mt-1 font-sans font-medium">Idea</span>
          </button>
        </div>
      </div>

      <!-- Description textarea -->
      <div class="flex flex-col gap-1.5">
        <label for="feedback-desc" class="font-sans text-[11px] font-bold uppercase tracking-wider text-muted-slate flex justify-between">
          <span>Descripción</span>
          <span class="font-normal lowercase text-[10px] text-neutral-400">requerido</span>
        </label>
        <textarea 
          id="feedback-desc" 
          rows="4" 
          autofocus
          required
          placeholder="Contanos qué pasó o qué te gustaría mejorar..."
          class="w-full text-sm font-sans px-3 py-2.5 border border-[#d9d9dd] rounded-sm focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none transition-all placeholder:text-neutral-400 resize-none"
        ></textarea>
      </div>

      <!-- Automatic context indicator badge -->
      <div class="flex items-center gap-2 p-2.5 bg-neutral-50 rounded-sm border border-neutral-100 text-[11px] text-neutral-500 font-sans">
        <span class="text-xs">📍</span>
        <div class="truncate">
          <span class="font-semibold text-neutral-700">Contexto automático:</span>
          <span class="text-neutral-600">${context.module}${entityLabel}</span>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
        <button 
          type="button" 
          id="feedback-cancel-btn" 
          class="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-primary hover:bg-neutral-100 rounded-sm transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button 
          type="submit" 
          id="feedback-submit-btn" 
          class="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-neutral-800 rounded-sm transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span id="feedback-submit-spinner" class="hidden animate-spin">◌</span>
          <span id="feedback-submit-text">Enviar feedback</span>
        </button>
      </div>
    </form>
  `;

  backdrop.appendChild(container);
  document.body.appendChild(backdrop);
  document.body.classList.add('overflow-hidden');

  // Elements
  const closeBtn = container.querySelector('#feedback-close-btn');
  const cancelBtn = container.querySelector('#feedback-cancel-btn');
  const typeSelector = container.querySelector('#feedback-type-selector');
  const textarea = container.querySelector('#feedback-desc');
  const form = container.querySelector('#feedback-form');
  const submitBtn = container.querySelector('#feedback-submit-btn');
  const submitSpinner = container.querySelector('#feedback-submit-spinner');
  const submitText = container.querySelector('#feedback-submit-text');

  // Focus textarea after render
  setTimeout(() => textarea.focus(), 80);

  function closeModal() {
    backdrop.classList.add('opacity-0');
    container.classList.add('translate-y-2');
    setTimeout(() => {
      backdrop.remove();
      document.body.classList.remove('overflow-hidden');
    }, 180);
  }

  // Type selection styles
  const typeStyles = {
    bug: {
      activeBorder: 'border-rose-500',
      activeBg: 'bg-rose-50/50',
      activeText: 'text-rose-900',
      activeHover: 'hover:border-rose-400'
    },
    improvement: {
      activeBorder: 'border-amber-500',
      activeBg: 'bg-amber-50/50',
      activeText: 'text-amber-900',
      activeHover: 'hover:border-amber-400'
    },
    idea: {
      activeBorder: 'border-purple-500',
      activeBg: 'bg-purple-50/50',
      activeText: 'text-purple-900',
      activeHover: 'hover:border-purple-400'
    }
  };

  typeSelector.querySelectorAll('.type-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      selectedType = type;

      typeSelector.querySelectorAll('.type-pill').forEach(b => {
        const bType = b.dataset.type;
        const bStyle = typeStyles[bType];
        
        if (bType === type) {
          b.className = `type-pill flex flex-col items-center justify-center p-2.5 rounded-sm border-2 transition-all cursor-pointer ${bStyle.activeBorder} ${bStyle.activeBg} ${bStyle.activeText} font-semibold shadow-2xs`;
        } else {
          b.className = `type-pill flex flex-col items-center justify-center p-2.5 rounded-sm border-2 border-neutral-200 ${bStyle.activeHover} bg-white text-neutral-600 font-medium transition-all cursor-pointer`;
        }
      });
    });
  });

  // Close handlers
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  // Escape key handler
  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && !isSubmitting) {
      window.removeEventListener('keydown', handleKeyDown);
      closeModal();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  // Form Submit Handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = textarea.value.trim();
    if (!description) {
      textarea.focus();
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    submitSpinner.classList.remove('hidden');
    submitText.textContent = 'Enviando...';

    try {
      // 1. Insert into public.user_feedbacks
      const feedbackPayload = {
        type: selectedType,
        description,
        user_id: currentUser?.id || null,
        status: 'nuevo',
        module: context.module,
        page_url: context.page_url,
        entity_context: context.entity_context,
        metadata: context.metadata
      };

      const { data, error } = await supabase
        .from('user_feedbacks')
        .insert([feedbackPayload])
        .select()
        .single();

      if (error) throw error;

      // 2. Trigger internal CRM notification for super_admins
      await notifyNewFeedback({
        feedback: data || feedbackPayload,
        currentUser
      });

      // 3. Success feedback & close
      closeModal();
      toast.show('¡Gracias por tu feedback! Ha sido registrado correctamente.', 'success');
    } catch (err) {
      console.error('Error enviando feedback:', err);
      toast.show('Error al enviar el feedback: ' + (err.message || 'Intente nuevamente'), 'error');
      submitBtn.disabled = false;
      submitSpinner.classList.add('hidden');
      submitText.textContent = 'Enviar feedback';
      isSubmitting = false;
    }
  });
}
