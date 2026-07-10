import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { toast } from '../components/toast';

export function renderSettings(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in pb-12 select-none';

  let activeTab = 'profile'; // 'profile', 'users', 'pipeline'
  const isAdmin = currentUser?.profile?.role === 'super_admin';

  // Render main structure
  renderMain();

  function renderMain() {
    container.innerHTML = `
      <!-- Header Title -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#d9d9dd] pb-6 shrink-0">
        <div>
          <h2 class="text-2xl font-normal font-display text-primary leading-tight tracking-tight">Configuración</h2>
          <p class="text-xs text-muted-slate mt-1 font-sans">${isAdmin ? 'Administración de perfiles, permisos y etapas del pipeline' : 'Editá tu perfil y contraseña de acceso'}</p>
        </div>
      </div>

      <!-- Tab Navigation Bar -->
      <div class="flex items-center gap-6 border-b border-[#d9d9dd] font-sans text-xs select-none">
        <button data-tab="profile" class="py-2.5 font-bold tracking-wider relative focus:outline-none transition-colors duration-150 ${
          activeTab === 'profile' 
            ? 'text-primary border-b-2 border-primary -mb-[1px]' 
            : 'text-[#616161] hover:text-primary border-b-2 border-transparent'
        }">
          MI PERFIL
        </button>
        ${isAdmin ? `
          <button data-tab="users" class="py-2.5 font-bold tracking-wider relative focus:outline-none transition-colors duration-150 ${
            activeTab === 'users' 
              ? 'text-primary border-b-2 border-primary -mb-[1px]' 
              : 'text-[#616161] hover:text-primary border-b-2 border-transparent'
          }">
            GESTIÓN DE USUARIOS
          </button>
          <button data-tab="pipeline" class="py-2.5 font-bold tracking-wider relative focus:outline-none transition-colors duration-150 ${
            activeTab === 'pipeline' 
              ? 'text-primary border-b-2 border-primary -mb-[1px]' 
              : 'text-[#616161] hover:text-primary border-b-2 border-transparent'
          }">
            ETAPAS DEL PIPELINE
          </button>
        ` : ''}
      </div>

      <!-- Tab Content Area -->
      <div id="settings-tab-content" class="w-full min-h-[300px]"></div>
    `;

    // Tab click handlers
    container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        renderMain();
      });
    });

    const contentArea = container.querySelector('#settings-tab-content');
    
    if (activeTab === 'profile') {
      renderProfileTab(contentArea);
    } else if (activeTab === 'users') {
      renderUsersTab(contentArea);
    } else if (activeTab === 'pipeline') {
      renderPipelineTab(contentArea);
    }
  }

  // TAB 1: PROFILE MANAGEMENT
  function renderProfileTab(parent) {
    parent.innerHTML = `
      <div class="max-w-md bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col gap-6 font-sans text-xs">
        <h3 class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase border-b border-neutral-100 pb-2">Información del Perfil</h3>
        
        <form id="profile-edit-form" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label for="profile-name" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre completo</label>
            <input type="text" id="profile-name" name="full_name" required value="${currentUser?.profile?.full_name || ''}" class="cohere-input text-xs" />
          </div>
          
          <div class="flex flex-col gap-1">
            <label for="profile-email" class="font-mono text-[9px] font-bold text-primary uppercase">Email (No editable)</label>
            <input type="email" id="profile-email" disabled value="${currentUser?.email || ''}" class="cohere-input text-xs bg-neutral-50 border-neutral-200 text-neutral-400 cursor-not-allowed" />
          </div>

          <div class="flex justify-end mt-2">
            <button type="submit" id="save-profile-btn" class="px-5 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none">
              Guardar Perfil
            </button>
          </div>
        </form>

        <h3 class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase border-b border-neutral-100 pb-2 mt-4">Cambiar Contraseña</h3>
        
        <form id="password-edit-form" class="flex flex-col gap-4">
          <div class="flex flex-col gap-1">
            <label for="new-password" class="font-mono text-[9px] font-bold text-primary uppercase">Nueva Contraseña</label>
            <input type="password" id="new-password" name="password" required minlength="6" class="cohere-input text-xs" placeholder="Mínimo 6 caracteres" />
          </div>
          
          <div class="flex flex-col gap-1">
            <label for="confirm-password" class="font-mono text-[9px] font-bold text-primary uppercase">Confirmar Nueva Contraseña</label>
            <input type="password" id="confirm-password" name="confirm_password" required minlength="6" class="cohere-input text-xs" placeholder="Repetir contraseña" />
          </div>

          <div class="flex justify-end mt-2">
            <button type="submit" id="save-password-btn" class="px-5 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none">
              Actualizar Contraseña
            </button>
          </div>
        </form>
      </div>
    `;

    const profileForm = parent.querySelector('#profile-edit-form');
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = profileForm.querySelector('#save-profile-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';

      const fullName = profileForm.querySelector('#profile-name').value.trim();

      try {
        const { error } = await supabase
          .from('profiles')
          .update({ full_name: fullName })
          .eq('id', currentUser.id);

        if (error) throw error;

        // Update local session cache
        currentUser.profile.full_name = fullName;
        await cache.loadAll(); // Reload cache in memory

        toast.show('¡Perfil actualizado con éxito!', 'success');
        
        // Reload page header name
        const sideNameSpan = document.querySelector('aside .truncate');
        if (sideNameSpan) sideNameSpan.textContent = fullName;
      } catch (err) {
        toast.show('Error al actualizar perfil: ' + err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Perfil';
      }
    });

    const passwordForm = parent.querySelector('#password-edit-form');
    passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = passwordForm.querySelector('#save-password-btn');
      
      const newPassword = passwordForm.querySelector('#new-password').value;
      const confirmPassword = passwordForm.querySelector('#confirm-password').value;

      if (newPassword !== confirmPassword) {
        toast.show('Las contraseñas ingresadas no coinciden', 'info');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';

      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        toast.show('¡Contraseña actualizada con éxito!', 'success');
        passwordForm.reset();
      } catch (err) {
        toast.show('Error al actualizar contraseña: ' + err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Actualizar Contraseña';
      }
    });
  }

  // TAB 2: USER MANAGEMENT (Admin Only)
  async function renderUsersTab(parent) {
    parent.innerHTML = `
      <div class="flex flex-col gap-6 font-sans text-xs">
        
        <!-- Supabase Auth Guidance Info Box -->
        <div class="bg-neutral-50 border border-[#d9d9dd] rounded-sm p-5 flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <h4 class="font-bold text-primary font-mono text-[9px] tracking-wider uppercase border-b border-neutral-200 pb-2">¿Cómo invitar a un nuevo comercial?</h4>
            <ol class="flex flex-col gap-1.5 text-[11px] text-neutral-600 list-decimal list-inside pl-1">
              <li>Ingresá al panel de <b>Supabase</b> → <b>Authentication</b> → <b>Users</b>.</li>
              <li>Hacé clic en <b>Add User</b> → <b>Invite User</b>.</li>
              <li>Ingresá el email del comercial y confirmá. Se enviará un email con el enlace de acceso automáticamente.</li>
              <li>El comercial aparecerá en esta tabla en cuanto active su cuenta y configure su perfil.</li>
            </ol>
          </div>

          <div class="flex flex-col gap-2 border-t border-neutral-200 pt-4">
            <h4 class="font-bold text-coral font-mono text-[9px] tracking-wider uppercase">¿Cómo reiniciar un tester/usuario de prueba?</h4>
            <p class="text-[11px] text-neutral-500 mb-1">Si necesitás eliminar y volver a invitar a un usuario de prueba (para limpiar datos de sesión anteriores), seguí estos pasos:</p>
            <ol class="flex flex-col gap-1.5 text-[11px] text-neutral-600 list-decimal list-inside pl-1">
              <li>Ingresá al panel de <b>Supabase</b> → <b>Authentication</b> → <b>Users</b>.</li>
              <li>Buscá al usuario por email y hacé clic en los tres puntos (⋯) a la derecha de su fila.</li>
              <li>Seleccioná <b>Delete User</b> y confirmá. <span class="text-rose-600 font-semibold">Esto eliminará también su perfil del CRM en cascada.</span></li>
              <li>Para re-invitar, repetí el proceso de invitación descripto arriba con el mismo email.</li>
            </ol>
          </div>
        </div>

        <!-- Users Table -->
        <div class="bg-white border border-[#d9d9dd] rounded-sm overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-[#d9d9dd] bg-white flex items-center justify-between select-none">
            <span class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase">Listado de Usuarios</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-neutral-50 border-b border-[#d9d9dd] font-mono text-[9px] font-bold text-muted-slate tracking-wider uppercase">
                  <th class="px-6 py-3">Nombre</th>
                  <th class="px-6 py-3">Email</th>
                  <th class="px-6 py-3">Rol</th>
                  <th class="px-6 py-3">Estado</th>
                  <th class="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody id="users-tbody" class="divide-y divide-[#e5e7eb] text-neutral-700">
                <tr>
                  <td colspan="5" class="py-8 text-center text-neutral-400">Cargando comerciales...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const tbody = parent.querySelector('#users-tbody');
    loadUsers();

    async function loadUsers() {
      tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-neutral-400">Cargando comerciales...</td></tr>`;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name');

        if (error) throw error;

        tbody.innerHTML = '';
        
        data.forEach(profile => {
          // Cannot modify own active status
          const isSelf = profile.id === currentUser.id;

          const row = document.createElement('tr');
          row.className = 'hover:bg-neutral-50/50 transition-colors';
          row.innerHTML = `
            <td class="px-6 py-3.5 font-semibold text-primary font-display">${profile.full_name || 'Sin Nombre'}</td>
            <td class="px-6 py-3.5 font-mono text-[10px]">${profile.email}</td>
            <td class="px-6 py-3.5">
              <select class="role-select bg-white border border-[#d9d9dd] rounded-sm py-1 px-2 font-mono text-[10px] font-bold text-[#616161] focus:outline-none uppercase tracking-wider ${
                isSelf ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }" ${isSelf ? 'disabled' : ''}>
                <option value="comercial" ${profile.role === 'comercial' ? 'selected' : ''}>COMERCIAL</option>
                <option value="super_admin" ${profile.role === 'super_admin' ? 'selected' : ''}>ADMIN</option>
              </select>
            </td>
            <td class="px-6 py-3.5 select-none">
              <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                profile.is_active 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }">
                ${profile.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </td>
            <td class="px-6 py-3.5 text-right select-none">
              ${!isSelf ? `
                <button class="status-toggle-btn px-3 py-1 border border-[#d9d9dd] hover:border-primary hover:text-primary rounded-full font-mono text-[9px] font-bold uppercase bg-white transition-all focus:outline-none">
                  ${profile.is_active ? 'Desactivar' : 'Activar'}
                </button>
              ` : '—'}
            </td>
          `;

          // Handle Role Change
          if (!isSelf) {
            const roleSelect = row.querySelector('.role-select');
            roleSelect.addEventListener('change', async () => {
              const newRole = roleSelect.value;
              try {
                const { error: err } = await supabase
                  .from('profiles')
                  .update({ role: newRole })
                  .eq('id', profile.id);

                if (err) throw err;
                toast.show(`¡Rol actualizado correctamente!`, 'success');
                await cache.loadAll();
              } catch (err) {
                toast.show('Error al cambiar rol: ' + err.message, 'error');
                roleSelect.value = profile.role;
              }
            });

            // Handle Active Toggle
            const statusBtn = row.querySelector('.status-toggle-btn');
            statusBtn.addEventListener('click', async () => {
              const nextStatus = !profile.is_active;
              statusBtn.disabled = true;
              
              try {
                const { error: err } = await supabase
                  .from('profiles')
                  .update({ is_active: nextStatus })
                  .eq('id', profile.id);

                if (err) throw err;
                
                toast.show(`Usuario ${nextStatus ? 'activado' : 'desactivado'} con éxito`, 'success');
                await cache.loadAll();
                loadUsers();
              } catch (err) {
                toast.show('Error al cambiar estado: ' + err.message, 'error');
                statusBtn.disabled = false;
              }
            });
          }

          tbody.appendChild(row);
        });

      } catch (err) {
        toast.show('Error al cargar perfiles: ' + err.message, 'error');
      }
    }
  }

  // TAB 3: PIPELINE STAGES MANAGEMENT (Admin Only)
  function renderPipelineTab(parent) {
    parent.innerHTML = `
      <div class="flex flex-col gap-6 font-sans text-xs">
        
        <!-- Stages Editor Table -->
        <div class="bg-white border border-[#d9d9dd] rounded-sm overflow-hidden flex flex-col">
          <div class="px-5 py-4 border-b border-[#d9d9dd] bg-white flex items-center justify-between select-none">
            <span class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase">Etapas del Pipeline</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-neutral-50 border-b border-[#d9d9dd] font-mono text-[9px] font-bold text-muted-slate tracking-wider uppercase">
                  <th class="px-6 py-3 w-16">Posición</th>
                  <th class="px-6 py-3 w-28">Color</th>
                  <th class="px-6 py-3">Nombre de la Etapa</th>
                  <th class="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody id="stages-tbody" class="divide-y divide-[#e5e7eb] text-neutral-700">
                <!-- Dynamic stages list -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const tbody = parent.querySelector('#stages-tbody');
    loadStages();

    function loadStages() {
      tbody.innerHTML = '';
      const stages = cache.getStages();

      stages.forEach((stage, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-neutral-50/50 transition-colors';
        
        row.innerHTML = `
          <!-- Position label -->
          <td class="px-6 py-3.5 font-mono text-[10px] text-neutral-500 font-bold">${stage.position}</td>
          
          <!-- Color picker field -->
          <td class="px-6 py-3.5 flex items-center gap-2">
            <input type="color" class="color-picker-input w-7 h-7 rounded-sm border border-neutral-300 cursor-pointer" value="${stage.color}" />
            <span class="font-mono text-[9px] text-neutral-500 tracking-wider">${stage.color.toUpperCase()}</span>
          </td>

          <!-- Stage Name Input -->
          <td class="px-6 py-3.5">
            <input type="text" class="stage-name-input bg-transparent border-b border-transparent hover:border-neutral-200 focus:border-primary py-1 px-1 text-xs text-primary font-semibold font-display tracking-tight w-full max-w-xs focus:outline-none transition-colors" value="${stage.name}" />
          </td>

          <!-- Actions -->
          <td class="px-6 py-3.5 text-right select-none">
            <button class="save-stage-btn px-4 py-1.5 bg-primary hover:bg-cohere-black text-white text-[9px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none">
              Guardar
            </button>
          </td>
        `;

        const colorInput = row.querySelector('.color-picker-input');
        const nameInput = row.querySelector('.stage-name-input');
        const saveBtn = row.querySelector('.save-stage-btn');

        // Color input changes text label dynamically
        colorInput.addEventListener('input', () => {
          row.querySelector('span').textContent = colorInput.value.toUpperCase();
        });

        // Save stage details
        saveBtn.addEventListener('click', async () => {
          const nextName = nameInput.value.trim();
          const nextColor = colorInput.value.trim();

          if (!nextName) {
            toast.show('El nombre de la etapa no puede estar vacío', 'info');
            return;
          }

          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';

          try {
            const { error: err } = await supabase
              .from('pipeline_stages')
              .update({ name: nextName, color: nextColor })
              .eq('id', stage.id);

            if (err) throw err;

            toast.show(`¡Etapa ${nextName} actualizada con éxito!`, 'success');
            await cache.loadAll(); // reload stages in cache
          } catch (err) {
            toast.show('Error al actualizar etapa: ' + err.message, 'error');
          } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Guardar';
          }
        });

        tbody.appendChild(row);
      });
    }
  }

  return container;
}
