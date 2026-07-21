import { supabase } from '../lib/supabase';
import { cache } from '../lib/cache';
import { toast } from '../components/toast';
import { modal } from '../components/modal';
import { auth } from '../lib/auth';

export function renderSettings(currentUser) {
  const container = document.createElement('div');
  container.className = 'flex flex-col gap-6 animate-fade-in pb-12 select-none';

  const isAdmin = currentUser?.profile?.role === 'super_admin';

  // Read tab from hash or fallback to localStorage / default
  const currentHash = window.location.hash;
  let activeTab = 'profile';
  if (currentHash === '#settings-users' && isAdmin) {
    activeTab = 'users';
  } else if (currentHash === '#settings-pipeline' && isAdmin) {
    activeTab = 'pipeline';
  } else if (currentHash === '#settings-franquiday' && isAdmin) {
    activeTab = 'franquiday';
  } else if (currentHash === '#settings-integrations') {
    activeTab = 'integrations';
  } else if (currentHash === '#settings-profile') {
    activeTab = 'profile';
  } else {
    activeTab = localStorage.getItem('settings_active_tab') || 'profile';
    if (activeTab === 'users' && !isAdmin) activeTab = 'profile';
    if (activeTab === 'pipeline' && !isAdmin) activeTab = 'profile';
    if (activeTab === 'franquiday' && !isAdmin) activeTab = 'profile';
  }

  localStorage.setItem('settings_active_tab', activeTab);

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
        <button data-tab="profile" class="py-2.5 font-bold tracking-wider relative focus:outline-none transition-colors duration-150 cursor-pointer ${
          activeTab === 'profile' 
            ? 'text-primary border-b-2 border-primary -mb-[1px]' 
            : 'text-[#616161] hover:text-primary border-b-2 border-transparent'
        }">
          MI PERFIL
        </button>
        ${isAdmin ? `
          <button data-tab="users" class="py-2.5 font-bold tracking-wider relative focus:outline-none transition-colors duration-150 cursor-pointer ${
            activeTab === 'users' 
              ? 'text-primary border-b-2 border-primary -mb-[1px]' 
              : 'text-[#616161] hover:text-primary border-b-2 border-transparent'
          }">
            GESTIÓN DE USUARIOS
          </button>
          <button data-tab="pipeline" class="py-2.5 font-bold tracking-wider relative focus:outline-none transition-colors duration-150 cursor-pointer ${
            activeTab === 'pipeline' 
              ? 'text-primary border-b-2 border-primary -mb-[1px]' 
              : 'text-[#616161] hover:text-primary border-b-2 border-transparent'
          }">
            ETAPAS DEL PIPELINE
          </button>
          <button data-tab="franquiday" class="py-2.5 font-bold tracking-wider relative focus:outline-none transition-colors duration-150 cursor-pointer ${
            activeTab === 'franquiday' 
              ? 'text-primary border-b-2 border-primary -mb-[1px]' 
              : 'text-[#616161] hover:text-primary border-b-2 border-transparent'
          }">
            EVENTOS FRANQUIDAY
          </button>
        ` : ''}
        <button data-tab="integrations" class="py-2.5 font-bold tracking-wider relative focus:outline-none transition-colors duration-150 cursor-pointer ${
          activeTab === 'integrations' 
            ? 'text-primary border-b-2 border-primary -mb-[1px]' 
            : 'text-[#616161] hover:text-primary border-b-2 border-transparent'
        }">
          INTEGRACIONES
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="settings-tab-content" class="w-full min-h-[300px]"></div>
    `;

    // Tab click handlers (updates URL hash to trigger router)
    container.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        localStorage.setItem('settings_active_tab', tab);
        window.location.hash = `#settings-${tab}`;
      });
    });

    const contentArea = container.querySelector('#settings-tab-content');
    
    if (activeTab === 'profile') {
      renderProfileTab(contentArea);
    } else if (activeTab === 'users') {
      renderUsersTab(contentArea);
    } else if (activeTab === 'pipeline') {
      renderPipelineTab(contentArea);
    } else if (activeTab === 'franquiday') {
      renderFranquidayTab(contentArea);
    } else if (activeTab === 'integrations') {
      renderIntegrationsTab(contentArea);
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
          <td class="px-6 py-3.5 text-right select-none space-x-2">
            <button class="save-stage-btn px-4 py-1.5 bg-primary hover:bg-cohere-black text-white text-[9px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none">
              Guardar
            </button>
            <button class="delete-stage-btn px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-[9px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none cursor-pointer">
              Eliminar
            </button>
          </td>
        `;

        const colorInput = row.querySelector('.color-picker-input');
        const nameInput = row.querySelector('.stage-name-input');
        const saveBtn = row.querySelector('.save-stage-btn');
        const deleteBtn = row.querySelector('.delete-stage-btn');

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

        // Delete stage details
        deleteBtn.addEventListener('click', async () => {
          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Verificando...';

          try {
            // Check if stage is used in leads (pipeline_stage_id, franquiday_stage_id) or participaciones_franquiday
            // Using HEAD query with count exact to minimize database overhead
            const [
              { count: countLeads, error: err1 },
              { count: countFranquiday, error: err2 },
              { count: countParticipations, error: err3 }
            ] = await Promise.all([
              supabase.from('leads').select('id', { count: 'exact', head: true }).eq('pipeline_stage_id', stage.id),
              supabase.from('leads').select('id', { count: 'exact', head: true }).eq('franquiday_stage_id', stage.id),
              supabase.from('participaciones_franquiday').select('id', { count: 'exact', head: true }).eq('pipeline_stage_id', stage.id)
            ]);

            if (err1) throw err1;
            if (err2) throw err2;
            if (err3) throw err3;

            const totalInUse = (countLeads || 0) + (countFranquiday || 0) + (countParticipations || 0);

            if (totalInUse > 0) {
              toast.show(
                `No es posible eliminar la etapa "${stage.name}" porque está en uso por ${totalInUse} lead(s). Debes cambiar la etapa de los leads que la utilizan antes de eliminarla.`,
                'error'
              );
              deleteBtn.disabled = false;
              deleteBtn.textContent = 'Eliminar';
              return;
            }

            const confirmed = confirm(`¿Estás seguro de que deseas eliminar la etapa "${stage.name}"?`);
            if (!confirmed) {
              deleteBtn.disabled = false;
              deleteBtn.textContent = 'Eliminar';
              return;
            }

            deleteBtn.textContent = 'Eliminando...';

            const { error: deleteErr } = await supabase
              .from('pipeline_stages')
              .delete()
              .eq('id', stage.id);

            if (deleteErr) throw deleteErr;

            toast.show(`Etapa "${stage.name}" eliminada con éxito`, 'success');
            await cache.loadAll(); // reload stages in cache
            loadStages();
          } catch (err) {
            toast.show('Error al eliminar etapa: ' + err.message, 'error');
            deleteBtn.disabled = false;
            deleteBtn.textContent = 'Eliminar';
          }
        });

        tbody.appendChild(row);
      });
    }
  }

  // TAB 4: FRANQUIDAY EVENTS MANAGEMENT
  function renderFranquidayTab(parent) {
    const events = cache.getEvents() || [];
    
    parent.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans text-xs">
        <!-- New Event Form -->
        <div class="bg-white border border-[#d9d9dd] rounded-sm p-5 flex flex-col gap-4 max-w-sm h-fit">
          <h3 class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase border-b border-neutral-100 pb-2">Crear Nueva Edición</h3>
          
          <form id="create-event-form" class="flex flex-col gap-3">
            <div class="flex flex-col gap-1">
              <label for="event-name" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre del Evento *</label>
              <input type="text" id="event-name" name="nombre" required class="cohere-input text-xs" placeholder="Ej: Franquiday Buenos Aires 2026" />
            </div>
            
            <div class="flex flex-col gap-1">
              <label for="event-date" class="font-mono text-[9px] font-bold text-primary uppercase">Fecha *</label>
              <input type="date" id="event-date" name="fecha" required class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-1.5 px-3" />
            </div>

            <div class="flex flex-col gap-1">
              <label for="event-country" class="font-mono text-[9px] font-bold text-primary uppercase">País *</label>
              <select id="event-country" name="pais" required class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-1.5 px-3">
                <option value="Argentina">Argentina</option>
                <option value="España">España</option>
                <option value="México">México</option>
                <option value="Uruguay">Uruguay</option>
                <option value="Chile">Chile</option>
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <label for="event-state" class="font-mono text-[9px] font-bold text-primary uppercase">Provincia / Región *</label>
              <input type="text" id="event-state" name="provincia" required class="cohere-input text-xs" placeholder="Ej: Buenos Aires / Madrid" />
            </div>

            <div class="flex flex-col gap-1">
              <label for="event-city" class="font-mono text-[9px] font-bold text-primary uppercase">Ciudad *</label>
              <input type="text" id="event-city" name="ciudad" required class="cohere-input text-xs" placeholder="Ej: CABA / Madrid" />
            </div>

            <div class="flex flex-col gap-1">
              <label for="event-venue" class="font-mono text-[9px] font-bold text-primary uppercase">Lugar / Sede *</label>
              <input type="text" id="event-venue" name="lugar" required class="cohere-input text-xs" placeholder="Ej: Hotel Hilton / La Rural" />
            </div>

            <button type="submit" id="submit-event-btn" class="mt-2 w-full py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none">
              Crear Evento
            </button>
          </form>
        </div>

        <!-- Event List -->
        <div class="lg:col-span-2 bg-white border border-[#d9d9dd] rounded-sm p-5 flex flex-col gap-4">
          <h3 class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase border-b border-neutral-100 pb-2">Historial de Ediciones</h3>
          
          <div class="overflow-x-auto">
            <table class="w-full text-left font-sans text-xs">
              <thead>
                <tr class="border-b border-[#d9d9dd] font-mono text-[9px] font-bold text-muted-slate uppercase">
                  <th class="py-2.5">Edición / Nombre</th>
                  <th class="py-2.5">Fecha</th>
                  <th class="py-2.5">Ubicación / Sede</th>
                  <th class="py-2.5">Estado</th>
                  <th class="py-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-neutral-100">
                ${events.length === 0 ? `
                  <tr>
                    <td colspan="5" class="py-8 text-center text-neutral-400 italic">No hay eventos Franquiday registrados.</td>
                  </tr>
                ` : events.map(e => `
                  <tr class="hover:bg-neutral-50/50">
                    <td class="py-3 font-semibold text-primary">${e.nombre}</td>
                    <td class="py-3 font-mono">${e.fecha}</td>
                    <td class="py-3 text-neutral-500">${e.lugar} (${e.ciudad}, ${e.pais})</td>
                    <td class="py-3">
                      ${e.is_active 
                        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">Activo</span>`
                        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider bg-neutral-50 text-neutral-500 border border-neutral-200">Pasado</span>`
                      }
                    </td>
                    <td class="py-3 text-right select-none">
                      <div class="flex items-center justify-end gap-2">
                        ${!e.is_active ? `
                          <button data-activate-event-id="${e.id}" class="px-2.5 py-1 border border-[#d9d9dd] hover:border-emerald-600 hover:text-emerald-600 font-mono text-[9px] font-bold uppercase rounded-sm bg-white transition-all tracking-wider focus:outline-none cursor-pointer">
                            Activar
                          </button>
                        ` : `
                          <span class="text-neutral-400 font-mono text-[9px] italic mr-1">Evento Activo</span>
                        `}
                        
                        <!-- Edit Button -->
                        <button data-edit-event-id="${e.id}" class="p-1 rounded-sm text-neutral-400 hover:text-primary hover:bg-neutral-50 transition-colors focus:outline-none text-[12px] cursor-pointer" title="Editar Evento">
                          ✏️
                        </button>
                        
                        <!-- Delete Button -->
                        <button data-delete-event-id="${e.id}" class="p-1 rounded-sm text-neutral-400 hover:text-rose-600 hover:bg-neutral-50 transition-colors focus:outline-none text-[12px] cursor-pointer" title="Eliminar Evento">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Form submission
    const form = parent.querySelector('#create-event-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('#submit-event-btn');
      btn.disabled = true;
      btn.textContent = 'Creando...';

      const formData = new FormData(form);
      const newEvent = {
        nombre: formData.get('nombre').trim(),
        fecha: formData.get('fecha'),
        pais: formData.get('pais'),
        provincia: formData.get('provincia').trim(),
        ciudad: formData.get('ciudad').trim(),
        lugar: formData.get('lugar').trim(),
        is_active: false
      };

      try {
        const { data, error } = await supabase
          .from('eventos_franquiday')
          .insert([newEvent])
          .select()
          .single();

        if (error) throw error;

        toast.show('¡Edición de Franquiday registrada con éxito!', 'success');
        
        // If there is no active event, activate this one automatically
        const active = cache.getActiveEvent();
        if (!active) {
          await supabase.rpc('activate_franquiday_event', { event_id: data.id });
        }

        await cache.loadAll();
        renderFranquidayTab(parent);
      } catch (err) {
        toast.show('Error al registrar evento: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Crear Evento';
      }
    });

    // Activation button clicks
    parent.querySelectorAll('[data-activate-event-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const eventId = btn.dataset.activateEventId;
        btn.disabled = true;
        btn.textContent = 'Activando...';

        try {
          const { error } = await supabase.rpc('activate_franquiday_event', { event_id: eventId });
          if (error) throw error;

          toast.show('Evento Franquiday activado correctamente. Sincronización realizada.', 'success');
          await cache.loadAll();
          renderFranquidayTab(parent);
        } catch (err) {
          toast.show('Error al activar evento: ' + err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Activar';
        }
      });
    });

    // Edit event click handler
    parent.querySelectorAll('[data-edit-event-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const eventId = btn.dataset.editEventId;
        const ev = events.find(x => x.id === eventId);
        if (!ev) return;

        const editFormWrapper = document.createElement('div');
        editFormWrapper.className = 'font-sans text-xs select-none';
        editFormWrapper.innerHTML = `
          <form id="edit-event-form" class="flex flex-col gap-4 pb-2">
            <div class="flex flex-col gap-1">
              <label for="edit-event-name" class="font-mono text-[9px] font-bold text-primary uppercase">Nombre de la edición *</label>
              <input type="text" id="edit-event-name" name="nombre" required value="${ev.nombre || ''}" class="cohere-input text-xs" />
            </div>
            <div class="flex flex-col gap-1">
              <label for="edit-event-date" class="font-mono text-[9px] font-bold text-primary uppercase">Fecha *</label>
              <input type="date" id="edit-event-date" name="fecha" required value="${ev.fecha || ''}" class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-1.5 px-3" />
            </div>
            <div class="flex flex-col gap-1">
              <label for="edit-event-country" class="font-mono text-[9px] font-bold text-primary uppercase">País *</label>
              <select id="edit-event-country" name="pais" required class="cohere-input text-xs bg-white border border-[#d9d9dd] rounded-sm py-1.5 px-3">
                ${['Argentina', 'España', 'México', 'Uruguay', 'Chile'].map(c => `
                  <option value="${c}" ${ev.pais === c ? 'selected' : ''}>${c}</option>
                `).join('')}
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label for="edit-event-state" class="font-mono text-[9px] font-bold text-primary uppercase">Provincia / Región *</label>
              <input type="text" id="edit-event-state" name="provincia" required value="${ev.provincia || ''}" class="cohere-input text-xs" />
            </div>
            <div class="flex flex-col gap-1">
              <label for="edit-event-city" class="font-mono text-[9px] font-bold text-primary uppercase">Ciudad *</label>
              <input type="text" id="edit-event-city" name="ciudad" required value="${ev.ciudad || ''}" class="cohere-input text-xs" />
            </div>
            <div class="flex flex-col gap-1">
              <label for="edit-event-venue" class="font-mono text-[9px] font-bold text-primary uppercase">Lugar / Sede *</label>
              <input type="text" id="edit-event-venue" name="lugar" required value="${ev.lugar || ''}" class="cohere-input text-xs" />
            </div>
            
            <div class="flex items-center justify-end gap-3 mt-5 border-t border-neutral-100 pt-4">
              <button type="button" id="btn-cancel-edit-event" class="px-5 py-2 text-neutral-600 hover:text-primary font-mono text-[10px] font-bold uppercase cursor-pointer">
                Cancelar
              </button>
              <button type="submit" id="btn-save-event" class="px-6 py-2.5 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer">
                Guardar cambios
              </button>
            </div>
          </form>
        `;

        const editModal = modal.create({
          title: `Editar Evento: ${ev.nombre}`,
          content: editFormWrapper
        });

        editFormWrapper.querySelector('#btn-cancel-edit-event').addEventListener('click', () => editModal.close());

        editFormWrapper.querySelector('#edit-event-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const btnSave = editFormWrapper.querySelector('#btn-save-event');
          btnSave.disabled = true;
          btnSave.textContent = 'Guardando...';

          const fd = new FormData(e.target);
          const updatedEvent = {
            nombre: fd.get('nombre').trim(),
            fecha: fd.get('fecha'),
            pais: fd.get('pais'),
            provincia: fd.get('provincia').trim(),
            ciudad: fd.get('ciudad').trim(),
            lugar: fd.get('lugar').trim()
          };

          try {
            const { error } = await supabase
              .from('eventos_franquiday')
              .update(updatedEvent)
              .eq('id', ev.id);

            if (error) throw error;

            toast.show('Evento Franquiday actualizado correctamente', 'success');
            editModal.close();
            await cache.loadAll();
            renderFranquidayTab(parent);
          } catch (err) {
            toast.show('Error al actualizar evento: ' + err.message, 'error');
            btnSave.disabled = false;
            btnSave.textContent = 'Guardar cambios';
          }
        });
      });
    });

    // Delete event click handler
    parent.querySelectorAll('[data-delete-event-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const eventId = btn.dataset.deleteEventId;
        const ev = events.find(x => x.id === eventId);
        if (!ev) return;

        const confirmMsg = `¿Seguro que deseas eliminar permanentemente la edición "${ev.nombre}"?\n` +
                           `¡ATENCIÓN! Esto eliminará de forma irreversible todas las participaciones y notas comerciales de las marcas en este evento específico.`;
        if (!confirm(confirmMsg)) return;

        btn.disabled = true;
        
        try {
          const { error } = await supabase
            .from('eventos_franquiday')
            .delete()
            .eq('id', eventId);

          if (error) throw error;

          toast.show('Evento Franquiday y sus participaciones eliminados', 'success');

          // If the deleted event was the active one, clear activeEventId in local state
          const activeEv = cache.getActiveEvent();
          if (activeEv && activeEv.id === eventId) {
            localStorage.removeItem('crm_active_franquiday_event_id');
          }

          await cache.loadAll();
          renderFranquidayTab(parent);
        } catch (err) {
          toast.show('Error al eliminar evento: ' + err.message, 'error');
          btn.disabled = false;
        }
      });
    });
  }

  async function renderIntegrationsTab(parent) {
    parent.innerHTML = `
      <div class="flex items-center justify-center p-12 text-neutral-400 font-sans text-xs">
        <span class="animate-pulse mr-2">🔄</span> Cargando integraciones...
      </div>
    `;

    // 1. Fetch credentials status
    let whatsappConnected = false;
    let zapierSecret = '';
    
    try {
      const { data: settingsData } = await supabase
        .from('crm_settings')
        .select('key, value');
        
      const settings = Object.fromEntries((settingsData || []).map(item => [item.key, item.value]));
      whatsappConnected = !!(settings.whatsapp_waba_id && settings.whatsapp_access_token);
      zapierSecret = settings.zapier_webhook_secret || 'No configurado';
    } catch (e) {
      console.error('Error fetching integration settings status:', e);
    }

    parent.innerHTML = `
      <div class="flex flex-col gap-8 animate-fade-in font-sans text-xs">
        <div>
          <h3 class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase border-b border-neutral-100 pb-2">Hub de Integraciones</h3>
          <p class="text-neutral-500 text-[11px] mt-1 leading-relaxed">
            Conecta tu CRM con herramientas y canales externos para automatizar y optimizar la captación de leads.
          </p>
        </div>

        <!-- Grid of Integration Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <!-- Card 1: WhatsApp WABA -->
          <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between gap-6 transition-shadow duration-150 hover:shadow-xs">
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">
                  💬
                </div>
                <span class="font-mono text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  whatsappConnected 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                }">
                  ${whatsappConnected ? 'Conectado' : 'Sin Configurar'}
                </span>
              </div>
              <div class="flex flex-col gap-1">
                <h4 class="font-bold text-primary font-display text-sm">WhatsApp Cloud API</h4>
                <p class="text-neutral-500 text-[11px] leading-relaxed">
                  Conecta tus números de WhatsApp Business Account (WABA). Gestiona altas, registros y bajas de números de API de nube.
                </p>
              </div>
            </div>
            <button id="btn-configure-whatsapp" class="w-full py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none cursor-pointer text-center">
              Configurar
            </button>
          </div>

          <!-- Card 2: Mailing (Próximamente) -->
          <div class="bg-white border border-[#d9d9dd] opacity-60 rounded-sm p-6 flex flex-col justify-between gap-6">
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-xl">
                  ✉️
                </div>
                <span class="font-mono text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-neutral-100 text-neutral-500 border border-neutral-200">
                  Próximamente
                </span>
              </div>
              <div class="flex flex-col gap-1">
                <h4 class="font-bold text-primary font-display text-sm">Mailing Automático</h4>
                <p class="text-neutral-500 text-[11px] leading-relaxed">
                  Automatiza el envío de correos electrónicos y campañas personalizadas para nutrir y calificar tus leads.
                </p>
              </div>
            </div>
            <button disabled class="w-full py-2 bg-neutral-100 text-neutral-400 text-[10px] font-mono font-bold uppercase rounded-full tracking-wider focus:outline-none cursor-not-allowed text-center">
              Próximamente
            </button>
          </div>

          <!-- Card 3: Zapier & API Webhook -->
          <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col justify-between gap-6 transition-shadow duration-150 hover:shadow-xs">
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <div class="w-10 h-10 rounded-full bg-coral/10 text-coral flex items-center justify-center text-xl">
                  🔌
                </div>
                <span class="font-mono text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Activo
                </span>
              </div>
              <div class="flex flex-col gap-1">
                <h4 class="font-bold text-primary font-display text-sm">Webhook / Zapier</h4>
                <p class="text-neutral-500 text-[11px] leading-relaxed">
                  Recibe prospectos automáticamente desde SalesQL, Zapier u otras fuentes externas directamente a tu pipeline.
                </p>
              </div>
            </div>
            <button id="btn-view-zapier-secret" class="w-full py-2 border border-neutral-200 bg-white hover:bg-neutral-50 text-[#616161] hover:text-primary text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none cursor-pointer text-center">
              Ver Clave API
            </button>
          </div>

        </div>
      </div>
    `;

    // Configure WhatsApp click handler
    parent.querySelector('#btn-configure-whatsapp').addEventListener('click', () => {
      renderWhatsAppConfig(parent);
    });

    // View Zapier Webhook secret handler
    parent.querySelector('#btn-view-zapier-secret').addEventListener('click', () => {
      modal.create({
        title: 'Clave de Integración (Zapier / Webhook)',
        content: `
          <div class="flex flex-col gap-4 font-sans text-xs">
            <p class="text-neutral-500 leading-relaxed">
              Usa este token secreto como cabecera <code>Authorization: Bearer [TU_TOKEN]</code> o <code>X-API-Key: [TU_TOKEN]</code> en las llamadas POST a tu webhook de importación de leads.
            </p>
            <div class="flex items-center gap-2 border border-neutral-200 bg-neutral-50 p-3 rounded-xs font-mono text-[11px] select-all break-all text-primary">
              ${zapierSecret}
            </div>
            <p class="text-[10px] text-muted-slate italic">
              * Nota: Si envías leads desde SalesQL o Zapier, este es el token que autentica la transacción segura.
            </p>
          </div>
        `,
        actions: [{ text: 'Cerrar', primary: true }]
      });
    });
  }

  async function renderWhatsAppConfig(parent) {
    parent.innerHTML = `
      <div class="flex items-center justify-center p-12 text-neutral-400 font-sans text-xs">
        <span class="animate-pulse mr-2">🔄</span> Cargando configuración de WhatsApp...
      </div>
    `;

    try {
      // 1. Fetch credentials from crm_settings
      const { data: settingsData } = await supabase
        .from('crm_settings')
        .select('key, value');
      
      const settings = Object.fromEntries((settingsData || []).map(item => [item.key, item.value]));
      const wabaId = settings.whatsapp_waba_id || '';
      const appId = settings.whatsapp_app_id || '';
      const accessToken = settings.whatsapp_access_token || '';

      // 2. Fetch numbers from proxy if credentials exist
      let numbers = [];
      let fetchError = null;

      if (wabaId && accessToken) {
        try {
          const session = await auth.getSession();
          const jwt = session?.access_token;
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/numbers`, {
            headers: {
              'Authorization': `Bearer ${jwt}`
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            numbers = result.data || [];
          } else {
            const err = await response.json();
            fetchError = err.error?.message || err.error || 'Error al conectar con la API de Meta';
          }
        } catch (e) {
          fetchError = e.message;
        }
      }

      // Draw the configuration view
      parent.innerHTML = `
        <div class="flex flex-col gap-6 animate-fade-in font-sans text-xs">
          <!-- Breadcrumbs and back button -->
          <div class="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div class="flex items-center gap-2">
              <button id="btn-back-to-hub" class="text-neutral-400 hover:text-primary transition-colors cursor-pointer text-sm font-semibold p-1">
                ←
              </button>
              <div class="flex flex-col">
                <span class="font-mono text-[9px] text-muted-slate uppercase tracking-widest">Integraciones</span>
                <h3 class="font-bold text-primary font-display text-sm">WhatsApp Cloud API</h3>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <span class="font-mono text-[8px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                (wabaId && accessToken) 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-neutral-50 text-neutral-400 border border-neutral-200'
              }">
                ${(wabaId && accessToken) ? '● Conectado' : '● Desconectado'}
              </span>
            </div>
          </div>

          <!-- Credentials Card -->
          <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col gap-4">
            <h4 class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase border-b border-neutral-100 pb-1.5">Credenciales de Integración</h4>
            
            <form id="whatsapp-credentials-form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-1">
                <label for="wa-waba-id" class="font-mono text-[9px] font-bold text-primary uppercase">WABA ID (ID de WhatsApp Business)</label>
                <input type="text" id="wa-waba-id" name="waba_id" required value="${wabaId}" class="cohere-input text-xs" placeholder="Ej. 2294113451408638" />
              </div>
              
              <div class="flex flex-col gap-1">
                <label for="wa-app-id" class="font-mono text-[9px] font-bold text-primary uppercase">Meta App ID</label>
                <input type="text" id="wa-app-id" name="app_id" required value="${appId}" class="cohere-input text-xs" placeholder="Ej. 724131236762813" />
              </div>
              
              <div class="flex flex-col gap-1 md:col-span-2">
                <label for="wa-token" class="font-mono text-[9px] font-bold text-primary uppercase">System User Access Token (Token Permanente)</label>
                <div class="relative flex items-center">
                  <input type="password" id="wa-token" name="access_token" required value="${accessToken}" class="cohere-input text-xs w-full pr-10" placeholder="EAAK..." />
                  <button type="button" id="btn-toggle-token-visibility" class="absolute right-3 text-neutral-400 hover:text-primary focus:outline-none text-[11px] font-mono font-bold cursor-pointer">MOSTRAR</button>
                </div>
              </div>

              <div class="md:col-span-2 flex justify-between items-center mt-2 border-t border-neutral-100 pt-3">
                <span class="text-[10px] text-muted-slate max-w-md leading-normal">
                  Estas credenciales permiten al CRM sincronizarse de forma segura con los activos de Meta para gestionar la mensajería y números.
                </span>
                <button type="submit" id="btn-save-wa-credentials" class="px-5 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none shrink-0 cursor-pointer">
                  Guardar Credenciales
                </button>
              </div>
            </form>
          </div>

          <!-- Webhook Callback Info -->
          ${(wabaId && accessToken) ? `
            <div class="bg-neutral-50 border border-neutral-200 rounded-sm p-4 flex flex-col gap-2">
              <h5 class="font-mono text-[9px] font-bold text-primary uppercase tracking-wider">Webhook de Meta (Callback URL)</h5>
              <p class="text-neutral-500 text-[10px] leading-relaxed">
                Para recibir respuestas de clientes, copia esta URL y configúrala en tu aplicación en el panel de desarrolladores de Meta (WhatsApp > Configuración > Webhooks):
              </p>
              <div class="flex items-center justify-between border border-neutral-200 bg-white p-2.5 rounded-xs font-mono text-[10px] select-all break-all text-primary">
                <span>${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook</span>
                <button id="btn-copy-webhook-url" class="text-primary hover:text-coral font-bold font-mono tracking-widest text-[9px] uppercase px-2 cursor-pointer">Copiar</button>
              </div>
              <p class="text-[9px] text-muted-slate">
                * Usa como token de verificación: <code class="bg-neutral-200 px-1 py-0.5 rounded-xs text-[#333] font-bold">negozona_wa_secret_2026</code> y suscríbete al campo <code class="bg-neutral-200 px-1 py-0.5 rounded-xs text-[#333] font-bold">messages</code>.
              </p>
            </div>
          ` : ''}

          <!-- Numbers Management Section -->
          <div class="bg-white border border-[#d9d9dd] rounded-sm p-6 flex flex-col gap-4">
            <div class="flex items-center justify-between border-b border-neutral-100 pb-2">
              <div>
                <h4 class="font-mono text-[10px] font-bold text-primary tracking-wider uppercase">Números Activos en la WABA</h4>
                <p class="text-neutral-500 text-[10px] mt-0.5">Gestión de números de teléfono verificados y activos para Cloud API.</p>
              </div>
              ${(wabaId && accessToken) ? `
                <button id="btn-vincular-numero" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors duration-150 focus:outline-none cursor-pointer">
                  + Vincular Nuevo Número
                </button>
              ` : ''}
            </div>

            ${!wabaId || !accessToken ? `
              <div class="py-8 flex flex-col items-center text-center gap-2 border border-dashed border-neutral-200 bg-neutral-50 rounded-xs">
                <span class="text-xl">⚠️</span>
                <p class="text-neutral-500 text-[11px]">Por favor, configura y guarda las credenciales globales primero para poder listar y gestionar números.</p>
              </div>
            ` : fetchError ? `
              <div class="p-4 flex flex-col gap-2 border border-rose-200 bg-rose-50 text-rose-800 rounded-xs">
                <span class="font-bold text-[11px]">Error al conectar con la cuenta de Meta:</span>
                <p class="text-[10px] leading-relaxed select-all">${fetchError}</p>
                <p class="text-[9px] text-rose-600 mt-1">Por favor verifica que tu WABA ID sea correcto y que el Token del Sistema no esté expirado y tenga los permisos adecuados.</p>
              </div>
            ` : numbers.length === 0 ? `
              <div class="py-8 flex flex-col items-center text-center gap-2 border border-dashed border-neutral-200 bg-neutral-50 rounded-xs">
                <span class="text-xl text-neutral-400">💬</span>
                <p class="text-neutral-500 text-[11px] font-bold">No se encontraron números asociados.</p>
                <p class="text-neutral-400 text-[10px] max-w-xs leading-normal">Asegúrate de agregar al menos un número en tu panel de WhatsApp Manager en Meta.</p>
              </div>
            ` : `
              <div class="overflow-x-auto border border-[#d9d9dd] rounded-sm">
                <table class="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr class="bg-neutral-50 border-b border-[#d9d9dd] font-mono text-[9px] text-muted-slate uppercase tracking-wider select-none">
                      <th class="py-3 px-4 font-bold">Número</th>
                      <th class="py-3 px-4 font-bold">ID Teléfono</th>
                      <th class="py-3 px-4 font-bold">Nombre de Mostrar</th>
                      <th class="py-3 px-4 font-bold text-center">Calidad</th>
                      <th class="py-3 px-4 font-bold text-center">Estado</th>
                      <th class="py-3 px-4 font-bold text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100">
                    ${numbers.map(num => {
                      const isConnected = num.status === 'CONNECTED';
                      let qualityClass = 'bg-neutral-100 text-neutral-600 border border-neutral-200';
                      if (num.quality_rating === 'GREEN') qualityClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                      if (num.quality_rating === 'YELLOW') qualityClass = 'bg-amber-50 text-amber-700 border border-amber-200';
                      if (num.quality_rating === 'RED') qualityClass = 'bg-rose-50 text-rose-700 border border-rose-200';

                      return `
                        <tr class="hover:bg-neutral-50/50 transition-colors">
                          <td class="py-3 px-4 font-bold text-primary">${num.display_phone_number}</td>
                          <td class="py-3 px-4 font-mono text-[10px] select-all">${num.id}</td>
                          <td class="py-3 px-4 font-semibold text-neutral-600">${num.verified_name || '<Sin nombre>'}</td>
                          <td class="py-3 px-4 text-center">
                            <span class="font-mono text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm uppercase ${qualityClass}">
                              ${num.quality_rating}
                            </span>
                          </td>
                          <td class="py-3 px-4 text-center">
                            <span class="font-mono text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm uppercase ${
                              isConnected 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                            }">
                              ${num.status || 'VERIFICADO'}
                            </span>
                          </td>
                          <td class="py-3 px-4 text-right">
                            <div class="flex items-center justify-end gap-2">
                              ${isConnected ? `
                                <button data-deregister-id="${num.id}" class="px-2.5 py-1 text-rose-600 hover:bg-rose-50 border border-rose-200 hover:border-rose-300 rounded-sm text-[10px] font-semibold transition-colors cursor-pointer focus:outline-none">
                                  Desactivar
                                </button>
                                <button data-pin-id="${num.id}" class="px-2.5 py-1 text-primary hover:bg-neutral-100 border border-neutral-200 rounded-sm text-[10px] font-semibold transition-colors cursor-pointer focus:outline-none">
                                  PIN
                                </button>
                              ` : `
                                <button data-register-id="${num.id}" class="px-2.5 py-1 bg-primary hover:bg-cohere-black text-white rounded-sm text-[10px] font-semibold transition-colors cursor-pointer focus:outline-none">
                                  Activar
                                </button>
                              `}
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;

      // Back to Hub Handler
      parent.querySelector('#btn-back-to-hub').addEventListener('click', () => {
        renderIntegrationsTab(parent);
      });

      // Show/Hide Token Toggle
      const tokenInput = parent.querySelector('#wa-token');
      const toggleBtn = parent.querySelector('#btn-toggle-token-visibility');
      if (toggleBtn && tokenInput) {
        toggleBtn.addEventListener('click', () => {
          if (tokenInput.type === 'password') {
            tokenInput.type = 'text';
            toggleBtn.textContent = 'OCULTAR';
          } else {
            tokenInput.type = 'password';
            toggleBtn.textContent = 'MOSTRAR';
          }
        });
      }

      // Copy Webhook Url
      const copyBtn = parent.querySelector('#btn-copy-webhook-url');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`);
          toast.show('Webhook URL copiada al portapapeles', 'success');
        });
      }

      // Save credentials form submission
      const credentialsForm = parent.querySelector('#whatsapp-credentials-form');
      if (credentialsForm) {
        credentialsForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const saveBtn = credentialsForm.querySelector('#btn-save-wa-credentials');
          saveBtn.disabled = true;
          saveBtn.textContent = 'Guardando...';

          const fd = new FormData(credentialsForm);
          const newWaba = fd.get('waba_id').trim();
          const newAppId = fd.get('app_id').trim();
          const newAccessToken = fd.get('access_token').trim();

          try {
            // Upsert in public.crm_settings
            const upsertRows = [
              { key: 'whatsapp_waba_id', value: newWaba, description: 'ID de WhatsApp Business Account (WABA)' },
              { key: 'whatsapp_app_id', value: newAppId, description: 'ID de la Aplicación de Meta Developers' },
              { key: 'whatsapp_access_token', value: newAccessToken, description: 'Token permanente de System User de Meta' }
            ];

            const { error: saveError } = await supabase
              .from('crm_settings')
              .upsert(upsertRows, { onConflict: 'key' });

            if (saveError) throw saveError;

            toast.show('Credenciales guardadas correctamente', 'success');
            // Re-render
            await renderWhatsAppConfig(parent);
          } catch (err) {
            toast.show('Error al guardar: ' + err.message, 'error');
          } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Guardar Credenciales';
          }
        });
      }

      // Action Handlers: DEREGISTER, REGISTER, PIN UPDATE
      if (numbers.length > 0) {
        // DEREGISTER
        parent.querySelectorAll('[data-deregister-id]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const phoneId = btn.dataset.deregisterId;
            const num = numbers.find(n => n.id === phoneId);
            if (!confirm(`¿Seguro que deseas desactivar de Cloud API el número ${num ? num.display_phone_number : phoneId}?\nEl número dejará de enviar y recibir mensajes a través del CRM.`)) {
              return;
            }

            btn.disabled = true;
            btn.textContent = 'Desactivando...';

            try {
              const session = await auth.getSession();
              const jwt = session?.access_token;
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/deregister`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${jwt}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ phone_number_id: phoneId })
              });

              const result = await res.json();
              if (!res.ok) {
                throw new Error(result.error?.message || result.error || 'Error al desactivar el número en Meta');
              }

              toast.show('Número desactivado correctamente de la API de nube', 'success');
              await renderWhatsAppConfig(parent);
            } catch (err) {
              toast.show(err.message, 'error');
              btn.disabled = false;
              btn.textContent = 'Desactivar';
            }
          });
        });

        // REGISTER (existing verified number)
        parent.querySelectorAll('[data-register-id]').forEach(btn => {
          btn.addEventListener('click', () => {
            const phoneId = btn.dataset.registerId;
            const num = numbers.find(n => n.id === phoneId);
            
            const registerModal = modal.create({
              title: 'Activar Número de WhatsApp',
              content: `
                <div class="flex flex-col gap-4 font-sans text-xs">
                  <p class="text-neutral-500 leading-relaxed">
                    El número <strong>${num ? num.display_phone_number : phoneId}</strong> ya está verificado en tu cuenta. Para poder usarlo en Cloud API debes registrarlo estableciendo o ingresando su PIN de 6 dígitos de verificación en dos pasos.
                  </p>
                  <div class="flex flex-col gap-1">
                    <label for="reg-pin" class="font-mono text-[9px] font-bold text-primary uppercase">PIN de Verificación (6 dígitos)</label>
                    <input type="text" id="reg-pin" required maxlength="6" minlength="6" class="cohere-input text-xs font-mono tracking-widest text-center" placeholder="******" pattern="\\d{6}" />
                  </div>
                </div>
              `,
              actions: [
                { text: 'Cancelar', onClick: (close) => close() },
                {
                  text: 'Registrar y Activar',
                  primary: true,
                  onClick: async (close) => {
                    const pinInput = registerModal.bodyEl.querySelector('#reg-pin');
                    const pin = pinInput.value.trim();
                    if (!/^\d{6}$/.test(pin)) {
                      toast.show('El PIN debe tener exactamente 6 dígitos numéricos', 'warning');
                      return;
                    }

                    pinInput.disabled = true;
                    
                    try {
                      const session = await auth.getSession();
                      const jwt = session?.access_token;
                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/register`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${jwt}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ phone_number_id: phoneId, pin })
                      });

                      const result = await res.json();
                      if (!res.ok) {
                        throw new Error(result.error?.message || result.error || 'Error al registrar el número en Meta');
                      }

                      toast.show('¡Número registrado y activado correctamente!', 'success');
                      close();
                      await renderWhatsAppConfig(parent);
                    } catch (err) {
                      toast.show(err.message, 'error');
                      pinInput.disabled = false;
                    }
                  }
                }
              ]
            });
          });
        });

        // PIN CHANGE
        parent.querySelectorAll('[data-pin-id]').forEach(btn => {
          btn.addEventListener('click', () => {
            const phoneId = btn.dataset.pinId;
            const num = numbers.find(n => n.id === phoneId);
            
            const pinModal = modal.create({
              title: 'Modificar PIN de 2 pasos',
              content: `
                <div class="flex flex-col gap-4 font-sans text-xs">
                  <p class="text-neutral-500 leading-relaxed">
                    Ingresa el nuevo PIN de 6 dígitos que deseas asignar al número <strong>${num ? num.display_phone_number : phoneId}</strong> para su verificación en dos pasos en Cloud API.
                  </p>
                  <div class="flex flex-col gap-1">
                    <label for="update-pin-val" class="font-mono text-[9px] font-bold text-primary uppercase">Nuevo PIN (6 dígitos)</label>
                    <input type="text" id="update-pin-val" required maxlength="6" minlength="6" class="cohere-input text-xs font-mono tracking-widest text-center" placeholder="******" pattern="\\d{6}" />
                  </div>
                </div>
              `,
              actions: [
                { text: 'Cancelar', onClick: (close) => close() },
                {
                  text: 'Actualizar PIN',
                  primary: true,
                  onClick: async (close) => {
                    const pinInput = pinModal.bodyEl.querySelector('#update-pin-val');
                    const pin = pinInput.value.trim();
                    if (!/^\d{6}$/.test(pin)) {
                      toast.show('El PIN debe tener exactamente 6 dígitos numéricos', 'warning');
                      return;
                    }

                    pinInput.disabled = true;
                    
                    try {
                      const session = await auth.getSession();
                      const jwt = session?.access_token;
                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/update-pin`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${jwt}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ phone_number_id: phoneId, pin })
                      });

                      const result = await res.json();
                      if (!res.ok) {
                        throw new Error(result.error?.message || result.error || 'Error al actualizar el PIN en Meta');
                      }

                      toast.show('PIN de dos pasos actualizado correctamente', 'success');
                      close();
                    } catch (err) {
                      toast.show(err.message, 'error');
                      pinInput.disabled = false;
                    }
                  }
                }
              ]
            });
          });
        });
      }

      // VINCULAR NUEVO NUMERO (Step Wizard Modal)
      const btnVincular = parent.querySelector('#btn-vincular-numero');
      if (btnVincular) {
        btnVincular.addEventListener('click', () => {
          let step = 1;
          let phoneId = '';
          let method = 'SMS';
          let lang = 'es_US';

          const wizardModal = modal.create({
            title: 'Vincular y Verificar Número',
            content: `
              <div id="wizard-container" class="font-sans text-xs">
                <!-- Content will be drawn dynamically based on current step -->
              </div>
            `,
            actions: [
              { text: 'Cancelar', onClick: (close) => close() },
              { text: 'Siguiente', primary: true, onClick: async (close) => {
                  await handleWizardNext(close);
                }
              }
            ]
          });

          const wizardContainer = wizardModal.bodyEl.querySelector('#wizard-container');
          
          function drawStep() {
            const footerButtons = wizardModal.bodyEl.parentElement.querySelectorAll('button');
            const nextBtn = footerButtons[footerButtons.length - 1];
            
            if (step === 1) {
              nextBtn.textContent = 'Enviar Código';
              wizardContainer.innerHTML = `
                <div class="flex flex-col gap-4">
                  <div class="flex gap-2 font-mono text-[9px] text-[#616161] font-bold uppercase select-none border-b border-neutral-100 pb-2">
                    <span class="text-primary border-b border-primary pb-0.5">1. Solicitud</span>
                    <span>2. Verificación</span>
                    <span>3. Registro</span>
                  </div>
                  <p class="text-neutral-500 leading-normal">
                    Ingresa el <strong>Phone Number ID</strong> (ID de teléfono) de tu número registrado en Meta Business Suite, selecciona el método por el cual deseas recibir el código de verificación y el idioma del mensaje/llamada.
                  </p>
                  
                  <div class="flex flex-col gap-1">
                    <label for="wiz-phone-id" class="font-mono text-[9px] font-bold text-primary uppercase">Phone Number ID (ID del Teléfono)</label>
                    <input type="text" id="wiz-phone-id" required class="cohere-input text-xs" placeholder="Ej. 106540352242922" value="${phoneId}" />
                  </div>

                  <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1">
                      <label for="wiz-method" class="font-mono text-[9px] font-bold text-primary uppercase">Método de Envío</label>
                      <select id="wiz-method" class="cohere-input text-xs">
                        <option value="SMS" ${method === 'SMS' ? 'selected' : ''}>SMS</option>
                        <option value="VOICE" ${method === 'VOICE' ? 'selected' : ''}>Llamada de Voz</option>
                      </select>
                    </div>
                    <div class="flex flex-col gap-1">
                      <label for="wiz-lang" class="font-mono text-[9px] font-bold text-primary uppercase">Idioma</label>
                      <select id="wiz-lang" class="cohere-input text-xs">
                        <option value="es_US" ${lang === 'es_US' ? 'selected' : ''}>Español (Latam)</option>
                        <option value="es_ES" ${lang === 'es_ES' ? 'selected' : ''}>Español (España)</option>
                        <option value="pt_BR" ${lang === 'pt_BR' ? 'selected' : ''}>Portugués (Brasil)</option>
                        <option value="en_US" ${lang === 'en_US' ? 'selected' : ''}>Inglés</option>
                      </select>
                    </div>
                  </div>
                </div>
              `;
            } else if (step === 2) {
              nextBtn.textContent = 'Verificar Código';
              wizardContainer.innerHTML = `
                <div class="flex flex-col gap-4">
                  <div class="flex gap-2 font-mono text-[9px] text-[#616161] font-bold uppercase select-none border-b border-neutral-100 pb-2">
                    <span class="text-neutral-400">1. Solicitud</span>
                    <span class="text-primary border-b border-primary pb-0.5">2. Verificación</span>
                    <span>3. Registro</span>
                  </div>
                  <p class="text-neutral-500 leading-normal">
                    Se ha enviado un código de verificación mediante <strong>${method === 'SMS' ? 'SMS' : 'Llamada de Voz'}</strong> al número de teléfono seleccionado. Ingresa el código numérico de 6 dígitos que recibiste para validar su propiedad.
                  </p>
                  
                  <div class="flex flex-col gap-1">
                    <label for="wiz-code" class="font-mono text-[9px] font-bold text-primary uppercase">Código de Verificación (6 dígitos)</label>
                    <input type="text" id="wiz-code" required maxlength="6" minlength="6" class="cohere-input text-xs font-mono tracking-widest text-center" placeholder="******" pattern="\\d{6}" />
                  </div>
                </div>
              `;
            } else if (step === 3) {
              nextBtn.textContent = 'Finalizar y Registrar';
              wizardContainer.innerHTML = `
                <div class="flex flex-col gap-4">
                  <div class="flex gap-2 font-mono text-[9px] text-[#616161] font-bold uppercase select-none border-b border-neutral-100 pb-2">
                    <span class="text-neutral-400">1. Solicitud</span>
                    <span class="text-neutral-400">2. Verificación</span>
                    <span class="text-primary border-b border-primary pb-0.5">3. Registro</span>
                  </div>
                  <p class="text-neutral-500 leading-normal">
                    El número ha sido verificado con éxito. Para activar la mensajería a través del Cloud API, debes definir un PIN de 6 dígitos numéricos que actuará como verificación en dos pasos del número.
                  </p>
                  
                  <div class="flex flex-col gap-1">
                    <label for="wiz-pin" class="font-mono text-[9px] font-bold text-primary uppercase">Definir PIN de 2 Pasos (6 dígitos)</label>
                    <input type="text" id="wiz-pin" required maxlength="6" minlength="6" class="cohere-input text-xs font-mono tracking-widest text-center" placeholder="******" pattern="\\d{6}" />
                  </div>
                </div>
              `;
            }
          }

          async function handleWizardNext(closeModalFn) {
            const footerButtons = wizardModal.bodyEl.parentElement.querySelectorAll('button');
            const nextBtn = footerButtons[footerButtons.length - 1];

            if (step === 1) {
              const inputPhoneId = wizardContainer.querySelector('#wiz-phone-id').value.trim();
              const selectMethod = wizardContainer.querySelector('#wiz-method').value;
              const selectLang = wizardContainer.querySelector('#wiz-lang').value;

              if (!inputPhoneId) {
                toast.show('El ID del teléfono es requerido', 'warning');
                return;
              }

              phoneId = inputPhoneId;
              method = selectMethod;
              lang = selectLang;

              nextBtn.disabled = true;
              nextBtn.textContent = 'Solicitando...';

              try {
                const session = await auth.getSession();
                const jwt = session?.access_token;
                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/request-code`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ phone_number_id: phoneId, code_method: method, language: lang })
                });

                const result = await res.json();
                if (!res.ok) {
                  throw new Error(result.error?.message || result.error || 'Error al solicitar el código de verificación');
                }

                toast.show('Código enviado con éxito', 'success');
                step = 2;
                drawStep();
              } catch (err) {
                toast.show(err.message, 'error');
              } finally {
                nextBtn.disabled = false;
                nextBtn.textContent = 'Enviar Código';
              }

            } else if (step === 2) {
              const inputCode = wizardContainer.querySelector('#wiz-code').value.trim();
              if (!/^\d{6}$/.test(inputCode)) {
                toast.show('Por favor ingresa un código de 6 dígitos válido', 'warning');
                return;
              }

              nextBtn.disabled = true;
              nextBtn.textContent = 'Verificando...';

              try {
                const session = await auth.getSession();
                const jwt = session?.access_token;
                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/verify-code`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ phone_number_id: phoneId, code: inputCode })
                });

                const result = await res.json();
                if (!res.ok) {
                  throw new Error(result.error?.message || result.error || 'Código incorrecto o vencido');
                }

                toast.show('Número verificado correctamente', 'success');
                step = 3;
                drawStep();
              } catch (err) {
                toast.show(err.message, 'error');
              } finally {
                nextBtn.disabled = false;
                nextBtn.textContent = 'Verificar Código';
              }

            } else if (step === 3) {
              const inputPin = wizardContainer.querySelector('#wiz-pin').value.trim();
              if (!/^\d{6}$/.test(inputPin)) {
                toast.show('Por favor ingresa un PIN de 6 dígitos', 'warning');
                return;
              }

              nextBtn.disabled = true;
              nextBtn.textContent = 'Registrando...';

              try {
                const session = await auth.getSession();
                const jwt = session?.access_token;
                const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/register`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${jwt}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ phone_number_id: phoneId, pin: inputPin })
                });

                const result = await res.json();
                if (!res.ok) {
                  throw new Error(result.error?.message || result.error || 'Error al completar el registro del número');
                }

                toast.show('¡El número ha sido registrado y activado con éxito!', 'success');
                closeModalFn();
                await renderWhatsAppConfig(parent);
              } catch (err) {
                toast.show(err.message, 'error');
              } finally {
                nextBtn.disabled = false;
                nextBtn.textContent = 'Finalizar y Registrar';
              }
            }
          }

          // Initial render of first wizard step
          drawStep();
        });
      }

    } catch (e) {
      toast.show('Error al renderizar el panel: ' + e.message, 'error');
    }
  }

  return container;
}
