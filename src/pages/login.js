import { auth } from '../lib/auth';
import { router } from '../lib/router';
import { toast } from '../components/toast';

export function renderLogin() {
  const view = document.createElement('div');
  view.className = 'flex flex-col items-center justify-center min-h-full px-4 bg-neutral-50/50 animate-fade-in select-none text-neutral-700';

  view.innerHTML = `
    <div class="w-full max-w-sm flex flex-col gap-8 bg-white border border-[#d9d9dd] rounded-sm p-8 shadow-xs">
      <!-- Title header -->
      <div class="flex flex-col gap-4 text-center items-center">
        <div class="h-16 flex items-center justify-center">
          <img src="/logo-negozona-white.png" alt="NegoZona Logo" class="h-30 w-auto object-contain select-none" />
        </div>
        <div class="flex flex-col gap-1 mt-1">
          <h2 class="text-xl font-normal font-display text-primary tracking-tight leading-tight">Expansión Franquicias</h2>
          <p class="text-xs text-muted-slate font-sans">Ingresá tus credenciales para acceder al CRM</p>
        </div>
      </div>

      <!-- Login Form Card -->
      <form id="login-form" class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <label for="email" class="font-mono text-[9px] tracking-wider text-primary font-bold uppercase">Email</label>
          <input 
            type="email" 
            id="email" 
            name="email" 
            required 
            placeholder="nombre@negozona.com"
            class="cohere-input text-xs"
            autocomplete="email"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="password" class="font-mono text-[9px] tracking-wider text-primary font-bold uppercase">Contraseña</label>
          <input 
            type="password" 
            id="password" 
            name="password" 
            required 
            placeholder="••••••••"
            class="cohere-input text-xs"
            autocomplete="current-password"
          />
        </div>

        <button 
          type="submit" 
          id="submit-btn"
          class="w-full mt-3 py-2.5 bg-primary hover:bg-cohere-black text-white text-xs font-semibold rounded-full tracking-wider transition-colors duration-150 uppercase shadow-xs flex items-center justify-center gap-2 cursor-pointer focus:outline-none"
        >
          <span>Ingresar</span>
        </button>
      </form>
      
      <!-- Footer Note -->
      <div class="text-center pt-2 border-t border-[#e5e7eb]">
        <span class="text-[9px] text-muted-slate font-mono uppercase tracking-wider">Sólo acceso autorizado</span>
      </div>
    </div>
  `;

  const form = view.querySelector('#login-form');
  const submitBtn = view.querySelector('#submit-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;

    // Loading State
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Ingresando...</span>
    `;

    try {
      await auth.login(email, password);
      toast.show('¡Sesión iniciada correctamente!', 'success');
      router.navigate('#dashboard');
    } catch (err) {
      toast.show(err.message || 'Error de inicio de sesión', 'error');
      // Reset button
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Ingresar</span>`;
    }
  });

  return view;
}
