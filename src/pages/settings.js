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
                  <input type="password" id="wa-token" name="access_token" required value="${accessToken}" class="cohere-input text-xs w-full !pr-24" placeholder="EAAK..." />
                  <button type="button" id="btn-toggle-token-visibility" class="absolute right-2 px-2.5 py-1 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded text-neutral-700 hover:text-primary text-[10px] font-mono font-bold cursor-pointer transition-colors shadow-xs z-10">MOSTRAR</button>
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
                      <th class="py-3 px-4 font-bold text-center">Estado WABA</th>
                      <th class="py-3 px-4 font-bold text-center">Estado Agente</th>
                      <th class="py-3 px-4 font-bold text-center">Acción Agente</th>
                      <th class="py-3 px-4 font-bold text-right">Acciones WABA</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-neutral-100">
                    ${numbers.map(num => {
                      const isConnected = num.status === 'CONNECTED';
                      let qualityClass = 'bg-neutral-100 text-neutral-600 border border-neutral-200';
                      if (num.quality_rating === 'GREEN') qualityClass = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
                      if (num.quality_rating === 'YELLOW') qualityClass = 'bg-amber-50 text-amber-700 border border-amber-200';
                      if (num.quality_rating === 'RED') qualityClass = 'bg-rose-50 text-rose-700 border border-rose-200';

                      const agentStatus = num.agent_status || (num.is_eligible_agent ? 'ACTIVE' : 'NO_ELIGIBLE');

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
                          <td class="py-3 px-4 text-center">
                            <span class="font-mono text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm uppercase ${
                              agentStatus === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : agentStatus === 'ELIGIBLE'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                            }">
                              ${agentStatus === 'ACTIVE' ? 'Activo' : agentStatus === 'ELIGIBLE' ? 'Elegible' : 'No elegible'}
                            </span>
                          </td>
                          <td class="py-3 px-4 text-center">
                            ${agentStatus === 'ACTIVE' ? `
                              <button data-configure-agent-id="${num.id}" class="px-2.5 py-1 bg-primary hover:bg-cohere-black text-white rounded-sm text-[10px] font-semibold transition-colors cursor-pointer focus:outline-none">
                                Configuración
                              </button>
                            ` : agentStatus === 'ELIGIBLE' ? `
                              <button data-onboard-id="${num.id}" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-sm text-[10px] font-semibold transition-colors cursor-pointer focus:outline-none">
                                Incorporar
                              </button>
                            ` : `
                              <span class="text-neutral-400 text-[10px] font-mono">-</span>
                            `}
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

      // Action Handlers: DEREGISTER, REGISTER, PIN UPDATE, AGENT ONBOARD & CONFIG
      if (numbers.length > 0) {
        // AGENT ONBOARDING
        parent.querySelectorAll('[data-onboard-id]').forEach(btn => {
          btn.addEventListener('click', () => {
            const phoneId = btn.dataset.onboardId;
            const num = numbers.find(n => n.id === phoneId);

            const onboardModal = modal.create({
              title: 'Incorporar Agente de WhatsApp',
              content: `
                <div class="flex flex-col gap-4 font-sans text-xs">
                  <p class="text-neutral-600 leading-relaxed">
                    Estás a punto de iniciar la incorporación (onboarding) del Agente de Meta Business para el número <strong>${num ? num.display_phone_number : phoneId}</strong>.
                  </p>
                  <div class="p-3 bg-amber-50 border border-amber-200 rounded-sm flex items-start gap-2 text-amber-900">
                    <span class="text-base">⚠️</span>
                    <p class="text-[11px] font-semibold leading-normal">
                      Esta acción no puede deshacerse en el futuro.
                    </p>
                  </div>
                  <p class="text-neutral-500 text-[10px]">
                    Al confirmar, Meta creará las entidades necesarias y programará los trabajos asíncronos para la preparación del agente.
                  </p>
                </div>
              `,
              actions: [
                { text: 'Cancelar', onClick: (close) => close() },
                {
                  text: 'Confirmar Incorporación',
                  primary: true,
                  onClick: async (close) => {
                    try {
                      const session = await auth.getSession();
                      const jwt = session?.access_token;
                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-onboard`, {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${jwt}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ phone_number_id: phoneId })
                      });
                      const result = await res.json();
                      if (!res.ok) {
                        throw new Error(result.error?.message || result.error || 'Error al procesar incorporación');
                      }
                      toast.show('Incorporación del agente iniciada correctamente', 'success');
                      close();
                      await renderWhatsAppConfig(parent);
                    } catch (err) {
                      toast.show(err.message, 'error');
                    }
                  }
                }
              ]
            });
          });
        });

        // AGENT CONFIGURATION
        parent.querySelectorAll('[data-configure-agent-id]').forEach(btn => {
          btn.addEventListener('click', () => {
            const phoneId = btn.dataset.configureAgentId;
            const num = numbers.find(n => n.id === phoneId);
            openAgentConfigModal(phoneId, num ? num.display_phone_number : phoneId);
          });
        });

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
      toast.show('Error al renderizar el panel de WhatsApp: ' + e.message, 'error');
    }
  }

  // Helper: Modal de Configuración del Agente de WhatsApp (Solapas Operacionales)
  function openAgentConfigModal(phoneId, displayNumber) {
    const configModal = modal.create({
      title: `Configuración del Agente (${displayNumber})`,
      sizeClass: 'max-w-5xl',
      content: `
        <div class="flex flex-col gap-4 font-sans text-xs w-full min-h-[500px]">
          <!-- Pestañas Superiores -->
          <div class="flex border-b border-neutral-200 gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider overflow-x-auto whitespace-nowrap pb-0.5">
            <button class="agent-tab-btn px-3 py-2 border-b-2 border-primary text-primary active-tab cursor-pointer shrink-0" data-tab="tab-principal">Principal</button>
            <button class="agent-tab-btn px-3 py-2 border-b-2 border-transparent text-neutral-400 hover:text-primary cursor-pointer shrink-0" data-tab="tab-conocimiento">Conocimiento del Agente</button>
            <button class="agent-tab-btn px-3 py-2 border-b-2 border-transparent text-neutral-400 hover:text-primary cursor-pointer shrink-0" data-tab="tab-habilidades">Habilidades del Agente</button>
            <button class="agent-tab-btn px-3 py-2 border-b-2 border-transparent text-neutral-400 hover:text-primary cursor-pointer shrink-0" data-tab="tab-conectores">Conectores</button>
            <button class="agent-tab-btn px-3 py-2 border-b-2 border-transparent text-neutral-400 hover:text-primary cursor-pointer shrink-0" data-tab="tab-simulador">🧪 Probador (Simulador)</button>
            <button class="agent-tab-btn px-3 py-2 border-b-2 border-transparent text-neutral-400 hover:text-primary cursor-pointer shrink-0" data-tab="tab-eventos">⚡ Eventos CRM</button>
            <button class="agent-tab-btn px-3 py-2 border-b-2 border-transparent text-neutral-400 hover:text-primary cursor-pointer shrink-0" data-tab="tab-evaluacion">📊 Evaluaciones</button>
          </div>

          <!-- Contenido dinámico de las solapas -->
          <div id="agent-tab-container" class="py-2 flex-1 overflow-y-auto max-h-[600px]">
            <div class="flex items-center justify-center py-12 text-neutral-400">
              <span class="animate-pulse mr-2">🔄</span> Cargando configuración del agente...
            </div>
          </div>
        </div>
      `,
      actions: [
        { text: 'Cerrar', onClick: (close) => close() }
      ]
    });

    const bodyEl = configModal.bodyEl;
    const tabContainer = bodyEl.querySelector('#agent-tab-container');

    // Cambios de solapas
    bodyEl.querySelectorAll('.agent-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        bodyEl.querySelectorAll('.agent-tab-btn').forEach(b => {
          b.classList.remove('border-primary', 'text-primary');
          b.classList.add('border-transparent', 'text-neutral-400');
        });
        btn.classList.remove('border-transparent', 'text-neutral-400');
        btn.classList.add('border-primary', 'text-primary');
        loadTab(btn.dataset.tab);
      });
    });

    let activeSimConvId = null;

    async function getAuthHeader() {
      const session = await auth.getSession();
      return { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' };
    }

    async function loadTab(tabKey) {
      tabContainer.innerHTML = `
        <div class="flex items-center justify-center py-12 text-neutral-400">
          <span class="animate-pulse mr-2">🔄</span> Cargando información...
        </div>
      `;

      try {
        const headers = await getAuthHeader();

        // 1. SOLAPA PRINCIPAL (SETTINGS)
        if (tabKey === 'tab-principal') {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-settings?phone_number_id=${phoneId}`, { headers });
          const rawSettings = await res.json().catch(() => ({}));
          const s = rawSettings.settings || (Array.isArray(rawSettings) ? (rawSettings[0] || {}) : (rawSettings.data?.[0] || rawSettings || {}));

          const rolloutEnabled = s.rollout?.enabled !== false;
          const handoffEnabled = s.handoff?.enabled !== false;
          const handoffMessage = s.handoff?.message || '';
          const followupEnabled = s.followup?.enabled !== false;
          const followupInterval = s.followup?.followup_interval_in_seconds || 3600;
          const followupMessage = s.followup?.message || '';
          const aiAudience = s.ai_audience || 'EVERYONE';
          const neverSayPhrases = Array.isArray(s.never_say_phrases) ? s.never_say_phrases : [];

          tabContainer.innerHTML = `
            <div class="flex flex-col gap-4 font-sans">
              <div class="p-4 bg-neutral-50 border border-neutral-200 rounded-sm">
                <h4 class="font-mono text-[10px] font-bold text-primary uppercase mb-2">Ajustes Operacionales del Agente</h4>
                <p class="text-neutral-500 text-[10px] mb-4">Configura el estado de actividad (Rollout), escalación a operadores (Handoff), seguimiento automático (Followup) y frases restringidas (never_say_phrases).</p>
                
                <form id="form-agent-settings" class="flex flex-col gap-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-1">
                      <label class="font-mono text-[9px] font-bold text-primary uppercase">Estado de Actividad (Rollout en Meta)</label>
                      <select name="rollout_enabled" class="cohere-input text-xs">
                        <option value="true" ${rolloutEnabled ? 'selected' : ''}>🟢 Activado (El agente responde consultas)</option>
                        <option value="false" ${!rolloutEnabled ? 'selected' : ''}>🔴 Desactivado (Pausado temporalmente)</option>
                      </select>
                    </div>

                    <div class="flex flex-col gap-1">
                      <label class="font-mono text-[9px] font-bold text-primary uppercase">Audiencia de IA (AI Audience)</label>
                      <select name="ai_audience" class="cohere-input text-xs">
                        <option value="EVERYONE" ${aiAudience === 'EVERYONE' ? 'selected' : ''}>Todos los prospectos (EVERYONE)</option>
                        <option value="ALLOWLISTED_ONLY" ${aiAudience === 'ALLOWLISTED_ONLY' ? 'selected' : ''}>Solo Lista Blanca (ALLOWLISTED_ONLY)</option>
                      </select>
                    </div>
                  </div>

                  <div class="border-t border-neutral-200 pt-3 flex flex-col gap-3">
                    <h5 class="font-mono text-[9px] font-bold text-neutral-600 uppercase">Reglas de Escalación a Humanos (Handoff)</h5>
                    <div class="flex items-center gap-2">
                      <select name="handoff_enabled" class="cohere-input text-xs w-48">
                        <option value="true" ${handoffEnabled ? 'selected' : ''}>Habilitado</option>
                        <option value="false" ${!handoffEnabled ? 'selected' : ''}>Deshabilitado</option>
                      </select>
                      <span class="text-[10px] text-neutral-500">Envía un mensaje personalizado antes de transferir a un agente humano.</span>
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">Mensaje de Transferencia / Escalación</label>
                      <textarea name="handoff_message" rows="2" class="cohere-input text-xs" placeholder="Ej. Un representante de nuestro equipo comercial se comunicará contigo a la brevedad.">${handoffMessage}</textarea>
                    </div>
                  </div>

                  <div class="border-t border-neutral-200 pt-3 flex flex-col gap-3">
                    <h5 class="font-mono text-[9px] font-bold text-neutral-600 uppercase">Seguimiento Automático (Followup)</h5>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="flex flex-col gap-1">
                        <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">Estado de Seguimiento</label>
                        <select name="followup_enabled" class="cohere-input text-xs">
                          <option value="true" ${followupEnabled ? 'selected' : ''}>Habilitado</option>
                          <option value="false" ${!followupEnabled ? 'selected' : ''}>Deshabilitado</option>
                        </select>
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">Intervalo de Inactividad</label>
                        <select name="followup_interval" class="cohere-input text-xs">
                          <option value="300" ${followupInterval === 300 ? 'selected' : ''}>5 minutos (300 s)</option>
                          <option value="900" ${followupInterval === 900 ? 'selected' : ''}>15 minutos (900 s)</option>
                          <option value="1800" ${followupInterval === 1800 ? 'selected' : ''}>30 minutos (1800 s)</option>
                          <option value="3600" ${followupInterval === 3600 ? 'selected' : ''}>1 hora (3600 s)</option>
                          <option value="7200" ${followupInterval === 7200 ? 'selected' : ''}>2 horas (7200 s)</option>
                          <option value="28800" ${followupInterval === 28800 ? 'selected' : ''}>8 horas (28800 s)</option>
                          <option value="86400" ${followupInterval === 86400 ? 'selected' : ''}>24 horas (86400 s)</option>
                        </select>
                      </div>
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">Mensaje de Seguimiento</label>
                      <textarea name="followup_message" rows="2" class="cohere-input text-xs" placeholder="Ej. ¿Sigues interesado en recibir más información sobre nuestras franquicias?">${followupMessage}</textarea>
                    </div>
                  </div>

                  <div class="border-t border-neutral-200 pt-3 flex flex-col gap-3">
                    <h5 class="font-mono text-[9px] font-bold text-neutral-600 uppercase">Frases Prohibidas / Excluidas (never_say_phrases)</h5>
                    <div class="flex flex-col gap-1">
                      <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">Lista de Restricciones de Lenguaje (Separadas por comas)</label>
                      <textarea name="never_say_phrases" rows="2" class="cohere-input text-xs" placeholder="Ej. retornos garantizados, 100% sin riesgo, inversión libre de impuestos">${neverSayPhrases.join(', ')}</textarea>
                      <span class="text-[10px] text-neutral-500">Frases que el agente de IA tiene prohibido mencionar bajo cualquier circunstancia.</span>
                    </div>
                  </div>

                  <div class="flex justify-end pt-3 border-t border-neutral-200">
                    <button type="submit" class="px-5 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer">
                      Guardar Ajustes Principales
                    </button>
                  </div>
                </form>
              </div>
            </div>
          `;

          const settingsForm = tabContainer.querySelector('#form-agent-settings');
          settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = settingsForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando...';

            try {
              const rolloutVal = settingsForm.querySelector('[name="rollout_enabled"]').value === 'true';
              const handoffVal = settingsForm.querySelector('[name="handoff_enabled"]').value === 'true';
              const handoffMsg = settingsForm.querySelector('[name="handoff_message"]').value.trim();
              const followupVal = settingsForm.querySelector('[name="followup_enabled"]').value === 'true';
              const followupInt = parseInt(settingsForm.querySelector('[name="followup_interval"]').value, 10) || 3600;
              const followupMsg = settingsForm.querySelector('[name="followup_message"]').value.trim();
              const audienceVal = settingsForm.querySelector('[name="ai_audience"]').value;
              const neverSayRaw = settingsForm.querySelector('[name="never_say_phrases"]')?.value || '';
              const neverSayPhrases = neverSayRaw
                .split(/[\n,]+/)
                .map(p => p.trim())
                .filter(Boolean);

              const payload = {
                phone_number_id: phoneId,
                settings: {
                  rollout: { enabled: rolloutVal },
                  handoff: {
                    enabled: handoffVal,
                    ...(handoffMsg ? { message: handoffMsg } : {})
                  },
                  followup: {
                    enabled: followupVal,
                    followup_interval_in_seconds: followupInt,
                    ...(followupMsg ? { message: followupMsg } : {})
                  },
                  ai_audience: audienceVal,
                  never_say_phrases: neverSayPhrases
                }
              };

              const saveRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-settings`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload)
              });

              const resData = await saveRes.json().catch(() => ({}));

              if (saveRes.ok) {
                toast.show('Ajustes principales guardados con éxito en Meta', 'success');
                const subtabParent = document.getElementById('subtab-content');
                if (subtabParent) {
                  renderWhatsAppConfig(subtabParent).catch(() => {});
                }
              } else {
                const errDetail = resData.raw_meta_response || resData.detail || resData.error?.message || resData.title || JSON.stringify(resData);
                toast.show('Error al guardar ajustes: ' + errDetail, 'error');
              }
            } catch (err) {
              toast.show('Error: ' + err.message, 'error');
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Guardar Ajustes Principales';
            }
          });
        }

        // 2. SOLAPA CONOCIMIENTO DEL AGENTE
        else if (tabKey === 'tab-conocimiento') {
          tabContainer.innerHTML = `
            <div class="flex flex-col gap-4">
              <!-- Sub-Pestañas de Conocimiento -->
              <div class="flex bg-neutral-100 p-1 rounded-sm gap-1 font-mono text-[9px] font-bold uppercase">
                <button class="know-subtab-btn px-3 py-1.5 rounded-xs bg-white text-primary shadow-xs cursor-pointer" data-subtab="business-info">Información del Negocio</button>
                <button class="know-subtab-btn px-3 py-1.5 rounded-xs text-neutral-500 hover:text-primary cursor-pointer" data-subtab="faqs">Preguntas Frecuentes (FAQs)</button>
                <button class="know-subtab-btn px-3 py-1.5 rounded-xs text-neutral-500 hover:text-primary cursor-pointer" data-subtab="files">Archivos / Documentos</button>
                <button class="know-subtab-btn px-3 py-1.5 rounded-xs text-neutral-500 hover:text-primary cursor-pointer" data-subtab="websites">Sitios Web</button>
              </div>

              <div id="know-subtab-content" class="pt-2"></div>
            </div>
          `;

          const subtabBtns = tabContainer.querySelectorAll('.know-subtab-btn');
          const subtabContent = tabContainer.querySelector('#know-subtab-content');

          subtabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
              subtabBtns.forEach(b => {
                b.classList.remove('bg-white', 'text-primary', 'shadow-xs');
                b.classList.add('text-neutral-500');
              });
              btn.classList.remove('text-neutral-500');
              btn.classList.add('bg-white', 'text-primary', 'shadow-xs');
              loadKnowSubtab(btn.dataset.subtab);
            });
          });

          async function loadKnowSubtab(subtabKey) {
            subtabContent.innerHTML = `<div class="py-8 text-center text-neutral-400"><span class="animate-pulse">🔄</span> Cargando...</div>`;

            if (subtabKey === 'business-info') {
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-knowledge/business-info?phone_number_id=${phoneId}`, { headers });
              const rawInfo = await res.json().catch(() => ({}));
              const bInfo = rawInfo.business_info || (Array.isArray(rawInfo) ? (rawInfo[0] || {}) : (rawInfo.data?.[0] || rawInfo || {}));
              const cInfo = bInfo.contact_info || {};

              subtabContent.innerHTML = `
                <form id="form-business-info" class="p-4 bg-white border border-neutral-200 rounded-sm flex flex-col gap-4 font-sans">
                  <div class="flex items-center justify-between border-b border-neutral-200 pb-2">
                    <h5 class="font-mono text-[10px] font-bold text-primary uppercase">Información del Negocio y Empresa</h5>
                    <span class="text-[10px] text-neutral-400 font-mono">Meta Agent Knowledge</span>
                  </div>

                  <div class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1">
                      <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Información General del Negocio (business_description)</label>
                      <textarea name="description" rows="3" class="cohere-input text-xs" placeholder="Describa el negocio, misión, rubro principal y modelo de franquicias...">${bInfo.business_description || bInfo.description || ''}</textarea>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="flex flex-col gap-1">
                        <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Métodos de Pago Aceptados (payment_method)</label>
                        <input type="text" name="payment_methods" class="cohere-input text-xs" value="${bInfo.payment_method || bInfo.payment_methods || ''}" placeholder="Ej. Transferencia bancaria, Tarjetas de crédito, Financiación propia..." />
                      </div>

                      <div class="flex flex-col gap-1">
                        <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Información de Compra / Proceso de Venta (purchase_info)</label>
                        <input type="text" name="purchase_info" class="cohere-input text-xs" value="${bInfo.purchase_info || ''}" placeholder="Ej. Compra online en nuestro sitio web o contáctanos para agendar una reunión..." />
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div class="flex flex-col gap-1">
                        <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Políticas de Devolución / Garantías (return_policy)</label>
                        <textarea name="return_policy" rows="2" class="cohere-input text-xs" placeholder="Detalle sobre garantías de inversión o devolución de canon si aplica...">${bInfo.return_policy || ''}</textarea>
                      </div>

                      <div class="flex flex-col gap-1">
                        <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Información de Envíos y Entregas (delivery_and_shipping)</label>
                        <textarea name="delivery_and_shipping" rows="2" class="cohere-input text-xs" placeholder="Detalle sobre entregas de insumos, mobiliario y kits iniciales...">${bInfo.delivery_and_shipping || ''}</textarea>
                      </div>
                    </div>
                  </div>

                  <!-- Datos de Contacto -->
                  <div class="border-t border-neutral-200 pt-3 flex flex-col gap-3">
                    <h5 class="font-mono text-[9px] font-bold text-neutral-600 uppercase">Información de Contacto y Ubicación (contact_info)</h5>
                    
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div class="flex flex-col gap-1">
                        <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">Correo Electrónico (email)</label>
                        <input type="email" name="contact_email" class="cohere-input text-xs" value="${cInfo.email || 'info@negozona.com'}" placeholder="info@negozona.com" />
                      </div>

                      <div class="flex flex-col gap-1">
                        <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">Horarios de Atención (hours_of_operation)</label>
                        <input type="text" name="hours_of_operation" class="cohere-input text-xs" value="${cInfo.hours_of_operation || ''}" placeholder="Ej. Lunes a Viernes de 9:00 a 18:00 hs (GMT-3)" />
                      </div>

                      <div class="flex flex-col gap-1">
                        <label class="font-mono text-[8px] font-bold text-neutral-500 uppercase">Dirección Física / Ubicación (address)</label>
                        <input type="text" name="address" class="cohere-input text-xs" value="${cInfo.address || ''}" placeholder="Ej. Av. Libertador 1234, Piso 5, Buenos Aires" />
                      </div>
                    </div>
                  </div>

                  <div class="flex justify-end pt-2 border-t border-neutral-200">
                    <button type="submit" class="px-5 py-2 bg-primary hover:bg-cohere-black text-white text-[10px] font-mono font-bold uppercase rounded-full tracking-wider transition-colors cursor-pointer">
                      Guardar Info de Negocio
                    </button>
                  </div>
                </form>
              `;

              const form = subtabContent.querySelector('#form-business-info');
              form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = form.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Guardando...';

                try {
                  const formData = new FormData(form);
                  const payload = {
                    phone_number_id: phoneId,
                    business_info: {
                      business_description: formData.get('description'),
                      payment_method: formData.get('payment_methods'),
                      return_policy: formData.get('return_policy'),
                      purchase_info: formData.get('purchase_info'),
                      delivery_and_shipping: formData.get('delivery_and_shipping'),
                      contact_info: {
                        email: formData.get('contact_email'),
                        hours_of_operation: formData.get('hours_of_operation'),
                        address: formData.get('address')
                      }
                    }
                  };

                  const saveRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-knowledge/business-info`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(payload)
                  });
                  const resData = await saveRes.json().catch(() => ({}));

                  if (saveRes.ok) {
                    toast.show('Información del negocio guardada con éxito en Meta', 'success');
                  } else {
                    const errDetail = resData.raw_meta_response || resData.detail || resData.error?.message || resData.title || JSON.stringify(resData);
                    toast.show('Error al guardar info del negocio: ' + errDetail, 'error');
                  }
                } catch (err) {
                  toast.show('Error: ' + err.message, 'error');
                } finally {
                  submitBtn.disabled = false;
                  submitBtn.textContent = 'Guardar Info de Negocio';
                }
              });
            } else if (subtabKey === 'faqs') {
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-knowledge/faqs?phone_number_id=${phoneId}`, { headers });
              const faqs = await res.json();
              const faqList = Array.isArray(faqs) ? faqs : (faqs.data || []);

              subtabContent.innerHTML = `
                <div class="flex flex-col gap-4">
                  <form id="form-add-faq" class="p-3 bg-neutral-50 border border-neutral-200 rounded-sm flex flex-col gap-2">
                    <span class="font-mono text-[9px] font-bold text-primary uppercase">+ Nueva Pregunta Frecuente</span>
                    <input type="text" name="question" required class="cohere-input text-xs" placeholder="Pregunta (ej. ¿Cuál es la inversión inicial requerida?)" />
                    <textarea name="answer" required rows="2" class="cohere-input text-xs" placeholder="Respuesta directa de la empresa..."></textarea>
                    <div class="flex justify-end">
                      <button type="submit" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-mono font-bold uppercase rounded-full">+ Agregar FAQ</button>
                    </div>
                  </form>

                  <div class="flex flex-col gap-2">
                    <span class="font-mono text-[9px] font-bold text-neutral-500 uppercase">FAQs Registradas (${faqList.length})</span>
                    ${faqList.length === 0 ? `<p class="text-neutral-400 text-[10px] italic py-2">No hay FAQs cargadas aún.</p>` : `
                      <div class="divide-y divide-neutral-200 border border-neutral-200 rounded-sm bg-white">
                        ${faqList.map(f => `
                          <div class="p-3 flex justify-between items-start gap-2">
                            <div class="flex flex-col gap-1">
                              <strong class="text-primary text-xs">❓ ${f.question || f.q}</strong>
                              <p class="text-neutral-600 text-[11px]">💬 ${f.answer || f.a}</p>
                            </div>
                            <button data-delete-faq-id="${f.id}" class="text-rose-600 hover:text-rose-800 text-[10px] font-mono font-bold uppercase">Eliminar</button>
                          </div>
                        `).join('')}
                      </div>
                    `}
                  </div>
                </div>
              `;

              const addForm = subtabContent.querySelector('#form-add-faq');
              addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = addForm.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Guardando...';

                try {
                  const formData = new FormData(addForm);
                  const payload = {
                    phone_number_id: phoneId,
                    faq: { question: formData.get('question'), answer: formData.get('answer') }
                  };
                  const saveRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-knowledge/faqs`, { method: 'POST', headers, body: JSON.stringify(payload) });
                  const resData = await saveRes.json().catch(() => ({}));
                  if (saveRes.ok) {
                    toast.show('FAQ agregada', 'success');
                    loadKnowSubtab('faqs');
                  } else {
                    const errorMsg = resData.raw_meta_response || resData.error?.message || resData.detail || resData.error || resData.title || JSON.stringify(resData);
                    toast.show('Error al agregar FAQ: ' + errorMsg, 'error');
                  }
                } catch (err) {
                  toast.show('Error al agregar FAQ: ' + err.message, 'error');
                } finally {
                  submitBtn.disabled = false;
                  submitBtn.textContent = '+ Agregar FAQ';
                }
              });

              // Delete FAQ handlers
              subtabContent.querySelectorAll('[data-delete-faq-id]').forEach(btn => {
                btn.addEventListener('click', async () => {
                  const faqId = btn.dataset.deleteFaqId;
                  if (!confirm('¿Seguro que deseas eliminar esta FAQ?')) return;
                  btn.disabled = true;
                  btn.textContent = 'Eliminando...';
                  try {
                    const delRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-knowledge/faqs`, {
                      method: 'DELETE',
                      headers,
                      body: JSON.stringify({ phone_number_id: phoneId, faq_id: faqId })
                    });
                    if (delRes.ok) {
                      toast.show('FAQ eliminada', 'success');
                      loadKnowSubtab('faqs');
                    } else {
                      const resData = await delRes.json().catch(() => ({}));
                      toast.show('Error al eliminar FAQ: ' + (resData.error?.message || resData.detail || 'Error en la API'), 'error');
                    }
                  } catch (err) {
                    toast.show(err.message, 'error');
                  }
                });
              });
            } else if (subtabKey === 'files') {
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-knowledge/files?phone_number_id=${phoneId}`, { headers });
              const filesData = await res.json();
              const filesList = Array.isArray(filesData) ? filesData : (filesData.data || []);

              subtabContent.innerHTML = `
                <div class="flex flex-col gap-4 font-sans">
                  <form id="form-add-file" class="p-3 bg-neutral-50 border border-neutral-200 rounded-sm flex flex-col gap-2.5">
                    <span class="font-mono text-[9px] font-bold text-primary uppercase">+ Subir Archivo a Base de Conocimiento (Meta Knowledge API)</span>
                    
                    <div class="flex flex-col gap-1">
                      <label class="text-[10px] font-bold text-neutral-700">Nombre del Documento (*):</label>
                      <input type="text" id="input-file-name" name="file_name" required class="cohere-input text-xs" placeholder="Ej. Manual_Franquicias_2026.pdf" />
                    </div>

                    <div class="flex flex-col gap-1">
                      <label class="text-[10px] font-bold text-neutral-700">Seleccionar Archivo (*):</label>
                      <input type="file" id="input-file-binary" name="file" required accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.csv,.xlsx" class="cohere-input text-xs cursor-pointer bg-white file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-mono file:font-bold file:bg-primary file:text-white hover:file:bg-cohere-black" />
                      <p class="text-neutral-500 text-[10px] mt-0.5">
                        Formatos soportados: <strong>.pdf, .doc, .docx, .png, .jpg, .jpeg, .csv, .xlsx</strong> (Máximo: <strong>100 MB</strong>)
                      </p>
                    </div>

                    <div class="flex justify-end pt-1">
                      <button type="submit" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-mono font-bold uppercase rounded-full cursor-pointer transition-colors">
                        ⬆️ Subir Archivo a Meta
                      </button>
                    </div>
                  </form>

                  <div class="flex flex-col gap-2">
                    <span class="font-mono text-[9px] font-bold text-neutral-500 uppercase">Documentos Cargados (${filesList.length})</span>
                    ${filesList.length === 0 ? `<p class="text-neutral-400 text-[10px] italic py-2">No hay archivos subidos aún.</p>` : `
                      <div class="divide-y divide-neutral-200 border border-neutral-200 rounded-sm bg-white">
                        ${filesList.map(doc => `
                          <div class="p-3 flex justify-between items-center gap-2">
                            <div class="flex items-center gap-2 font-semibold text-primary text-xs">
                              📄 <span>${doc.file_name || doc.name || doc.id}</span>
                              ${doc.id ? `<span class="text-neutral-400 font-mono text-[9px] font-normal">(ID: ${doc.id})</span>` : ''}
                            </div>
                            <button data-delete-file-id="${doc.id}" class="text-rose-600 hover:text-rose-800 text-[10px] font-mono font-bold uppercase cursor-pointer">Eliminar</button>
                          </div>
                        `).join('')}
                      </div>
                    `}
                  </div>
                </div>
              `;

              const addForm = subtabContent.querySelector('#form-add-file');
              const fileNameInput = subtabContent.querySelector('#input-file-name');
              const fileBinaryInput = subtabContent.querySelector('#input-file-binary');

              // Auto-fill file_name if empty when user selects a file
              fileBinaryInput.addEventListener('change', () => {
                if (fileBinaryInput.files && fileBinaryInput.files[0] && !fileNameInput.value.trim()) {
                  fileNameInput.value = fileBinaryInput.files[0].name;
                }
              });

              addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const submitBtn = addForm.querySelector('button[type="submit"]');
                const fileObj = fileBinaryInput.files[0];
                const fileName = fileNameInput.value.trim();

                if (!fileObj) {
                  toast.show('Por favor selecciona un archivo', 'warning');
                  return;
                }

                // Client-side validations (Meta spec: max 100MB and supported extensions)
                const allowedExtensions = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.csv', '.xlsx'];
                const fileExt = '.' + fileObj.name.split('.').pop().toLowerCase();
                if (!allowedExtensions.includes(fileExt)) {
                  toast.show(`Formato no soportado por Meta (${fileExt}). Formatos válidos: ${allowedExtensions.join(', ')}`, 'error');
                  return;
                }

                const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
                if (fileObj.size > MAX_BYTES) {
                  toast.show('El archivo excede el tamaño máximo permitido por Meta de 100 MB', 'error');
                  return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = 'Subiendo a Meta...';

                try {
                  const fd = new FormData();
                  fd.append('file_name', fileName || fileObj.name);
                  fd.append('file', fileObj, fileObj.name);

                  // Do NOT include Content-Type header so browser sets multipart/form-data with boundary
                  const uploadHeaders = {
                    'Authorization': headers.Authorization
                  };

                  const saveRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-knowledge/files?phone_number_id=${phoneId}`, {
                    method: 'POST',
                    headers: uploadHeaders,
                    body: fd
                  });

                  const resData = await saveRes.json().catch(() => ({}));

                  if (saveRes.ok) {
                    toast.show('Archivo subido exitosamente a la base de conocimiento de Meta', 'success');
                    loadKnowSubtab('files');
                  } else {
                    const errDetail = resData.raw_meta_response || resData.error?.message || resData.detail || resData.title || JSON.stringify(resData);
                    toast.show('Error al subir archivo: ' + errDetail, 'error');
                  }
                } catch (err) {
                  toast.show('Error al subir archivo: ' + err.message, 'error');
                } finally {
                  submitBtn.disabled = false;
                  submitBtn.textContent = '⬆️ Subir Archivo a Meta';
                }
              });

              // Delete File handlers
              subtabContent.querySelectorAll('[data-delete-file-id]').forEach(btn => {
                btn.addEventListener('click', async () => {
                  const fileId = btn.dataset.deleteFileId;
                  if (!confirm('¿Seguro que deseas eliminar este archivo de la base de conocimiento?')) return;
                  btn.disabled = true;
                  btn.textContent = 'Eliminando...';
                  try {
                    const delRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-knowledge/files`, {
                      method: 'DELETE',
                      headers,
                      body: JSON.stringify({ phone_number_id: phoneId, file_id: fileId })
                    });
                    if (delRes.ok) {
                      toast.show('Archivo eliminado', 'success');
                      loadKnowSubtab('files');
                    } else {
                      const resData = await delRes.json().catch(() => ({}));
                      toast.show('Error al eliminar archivo: ' + (resData.error?.message || resData.detail || 'Error en la API'), 'error');
                    }
                  } catch (err) {
                    toast.show(err.message, 'error');
                  }
                });
              });
            } else if (subtabKey === 'websites') {
              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-knowledge/websites?phone_number_id=${phoneId}`, { headers });
              const sitesData = await res.json();
              const sitesList = Array.isArray(sitesData) ? sitesData : (sitesData.data || []);

              subtabContent.innerHTML = `
                <div class="flex flex-col gap-4">
                  <form id="form-add-website" class="p-3 bg-neutral-50 border border-neutral-200 rounded-sm flex flex-col gap-2">
                    <span class="font-mono text-[9px] font-bold text-primary uppercase">+ Agregar Sitio Web para Rastreo</span>
                    <input type="url" name="url" required class="cohere-input text-xs" placeholder="https://negozona.com/franquicias" />
                    <div class="flex justify-end">
                      <button type="submit" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-mono font-bold uppercase rounded-full">+ Registrar URL</button>
                    </div>
                  </form>

                  <div class="flex flex-col gap-2">
                    <span class="font-mono text-[9px] font-bold text-neutral-500 uppercase">Sitios Web Rastreados (${sitesList.length})</span>
                    ${sitesList.length === 0 ? `<p class="text-neutral-400 text-[10px] italic py-2">No hay sitios web registrados.</p>` : `
                      <div class="divide-y divide-neutral-200 border border-neutral-200 rounded-sm bg-white">
                        ${sitesList.map(s => `
                          <div class="p-3 flex justify-between items-center">
                            <span class="text-primary font-mono text-[11px] select-all">🌐 ${s.url}</span>
                            <button data-delete-site-id="${s.id}" class="text-rose-600 hover:text-rose-800 text-[10px] font-mono font-bold uppercase">Eliminar</button>
                          </div>
                        `).join('')}
                      </div>
                    `}
                  </div>
                </div>
              `;

              const addForm = subtabContent.querySelector('#form-add-website');
              addForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(addForm);
                const payload = { phone_number_id: phoneId, url: formData.get('url') };
                const saveRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-knowledge/websites`, { method: 'POST', headers, body: JSON.stringify(payload) });
                if (saveRes.ok) { toast.show('Sitio Web registrado', 'success'); loadKnowSubtab('websites'); }
                else toast.show('Error al registrar URL', 'error');
              });
            }
          }

          loadKnowSubtab('business-info');
        }

        // 3. SOLAPA HABILIDADES DEL AGENTE (SKILLS)
        else if (tabKey === 'tab-habilidades') {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-skills?phone_number_id=${phoneId}`, { headers });
          const skillsData = await res.json();
          const skillsList = Array.isArray(skillsData) ? skillsData : (skillsData.data || []);

          tabContainer.innerHTML = `
            <div class="flex flex-col gap-4">
              <form id="form-add-skill" class="p-4 bg-neutral-50 border border-neutral-200 rounded-sm flex flex-col gap-3">
                <span class="font-mono text-[9px] font-bold text-primary uppercase">+ Crear Nueva Habilidad del Agente</span>
                
                <div class="flex flex-col gap-1">
                  <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Identificador / Título de la Habilidad</label>
                  <input type="text" name="title" required class="cohere-input text-xs" placeholder="ej. cualificacion-prospectos" pattern="[a-z0-9-]+" />
                  <span class="text-[9px] text-neutral-400 font-mono">Usar solo letras minúsculas, números y guiones (ej. saludo-inicial, cualificacion-leads).</span>
                </div>

                <div class="flex flex-col gap-1">
                  <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Cuándo Aplicar (Contexto / Disparador)</label>
                  <input type="text" name="description" required class="cohere-input text-xs" placeholder="ej. Aplicar cuando el cliente salude o consulte por primera vez" />
                </div>

                <div class="flex flex-col gap-1">
                  <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Directivas e Instrucciones de la Habilidad</label>
                  <textarea name="skill" required rows="3" class="cohere-input text-xs" placeholder="ej. 1) Saludar cordialmente por su nombre. 2) Consultar la ciudad de interés. 3) Derivar a un operador comercial."></textarea>
                </div>

                <div class="flex justify-end pt-1">
                  <button type="submit" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-mono font-bold uppercase rounded-full">+ Crear Habilidad</button>
                </div>
              </form>

              <div class="flex flex-col gap-2">
                <span class="font-mono text-[9px] font-bold text-neutral-500 uppercase">Habilidades Configuradas (${skillsList.length})</span>
                ${skillsList.length === 0 ? `<p class="text-neutral-400 text-[10px] italic py-2">No hay habilidades personalizadas definidas.</p>` : `
                  <div class="divide-y divide-neutral-200 border border-neutral-200 rounded-sm bg-white">
                    ${skillsList.map(sk => `
                      <div class="p-3 flex justify-between items-start gap-2">
                        <div class="flex flex-col gap-1">
                          <div class="flex items-center gap-2">
                            <strong class="text-primary text-xs">⚡ ${sk.title || sk.name || sk.id}</strong>
                            ${sk.channel ? `<span class="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 font-mono text-[8px] rounded uppercase">${sk.channel}</span>` : ''}
                          </div>
                          ${sk.description ? `<p class="text-neutral-600 text-[11px]"><strong>Disparador:</strong> ${sk.description}</p>` : ''}
                          ${sk.skill ? `<p class="text-neutral-500 text-[10px] font-mono whitespace-pre-wrap"><strong>Instrucciones:</strong> ${sk.skill}</p>` : ''}
                        </div>
                        <button data-delete-skill-id="${sk.id}" class="text-rose-600 hover:text-rose-800 text-[10px] font-mono font-bold uppercase shrink-0">Eliminar</button>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
          `;

          const addSkillForm = tabContainer.querySelector('#form-add-skill');
          addSkillForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = addSkillForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando...';

            try {
              const formData = new FormData(addSkillForm);
              const payload = {
                phone_number_id: phoneId,
                skill: {
                  title: formData.get('title'),
                  description: formData.get('description'),
                  skill: formData.get('skill')
                }
              };
              const saveRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-skills`, { method: 'POST', headers, body: JSON.stringify(payload) });
              const resData = await saveRes.json().catch(() => ({}));
              if (saveRes.ok) {
                toast.show('Habilidad guardada con éxito', 'success');
                loadTab('tab-habilidades');
              } else {
                const errorMsg = resData.raw_meta_response || resData.error?.message || resData.detail || resData.title || JSON.stringify(resData);
                toast.show('Error al guardar habilidad: ' + errorMsg, 'error');
              }
            } catch (err) {
              toast.show('Error al guardar habilidad: ' + err.message, 'error');
            } finally {
              submitBtn.disabled = false;
              submitBtn.textContent = '+ Crear Habilidad';
            }
          });

          // Delete Skill handlers
          tabContainer.querySelectorAll('[data-delete-skill-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const skillId = btn.dataset.deleteSkillId;
              if (!confirm('¿Seguro que deseas eliminar esta habilidad?')) return;
              btn.disabled = true;
              btn.textContent = 'Eliminando...';
              try {
                const delRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-skills`, {
                  method: 'DELETE',
                  headers,
                  body: JSON.stringify({ phone_number_id: phoneId, skill_id: skillId })
                });
                if (delRes.ok) {
                  toast.show('Habilidad eliminada', 'success');
                  loadTab('tab-habilidades');
                } else {
                  const resData = await delRes.json().catch(() => ({}));
                  const errDetail = resData.raw_meta_response || resData.detail || resData.error?.message || resData.title || JSON.stringify(resData);
                  toast.show('Error al eliminar habilidad: ' + errDetail, 'error');
                }
              } catch (err) {
                toast.show(err.message, 'error');
              }
            });
          });
        }

        // 4. SOLAPA CONECTORES
        else if (tabKey === 'tab-conectores') {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-connectors?phone_number_id=${phoneId}`, { headers });
          const connData = await res.json();
          const connList = Array.isArray(connData) ? connData : (connData.data || []);

          tabContainer.innerHTML = `
            <div class="flex flex-col gap-4">
              <form id="form-add-connector" class="p-4 bg-neutral-50 border border-neutral-200 rounded-sm flex flex-col gap-3">
                <span class="font-mono text-[9px] font-bold text-primary uppercase">+ Registrar Nuevo Conector API</span>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Nombre del Conector</label>
                    <input type="text" name="name" required class="cohere-input text-xs" placeholder="Ej. API de Inventario / CRM" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">Tipo de Autenticación</label>
                    <select name="auth_type" class="cohere-input text-xs">
                      <option value="API_KEY">API Key</option>
                      <option value="OAUTH2_CLIENT_CREDENTIALS">OAuth2 Client Credentials</option>
                      <option value="NONE">Sin Autenticación</option>
                    </select>
                  </div>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="font-mono text-[8px] font-bold text-neutral-600 uppercase">URL Base del Servicio</label>
                  <input type="url" name="base_url" required class="cohere-input text-xs" placeholder="https://api.empresa.com/v1" />
                </div>
                <div class="flex justify-end pt-1">
                  <button type="submit" class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-mono font-bold uppercase rounded-full">+ Agregar Conector</button>
                </div>
              </form>

              <div class="flex flex-col gap-2">
                <span class="font-mono text-[9px] font-bold text-neutral-500 uppercase">Conectores Registrados (${connList.length})</span>
                ${connList.length === 0 ? `<p class="text-neutral-400 text-[10px] italic py-2">No hay conectores externos registrados.</p>` : `
                  <div class="divide-y divide-neutral-200 border border-neutral-200 rounded-sm bg-white">
                    ${connList.map(cn => `
                      <div class="p-3 flex justify-between items-center">
                        <div class="flex flex-col gap-1">
                          <strong class="text-primary text-xs">🔌 ${cn.name}</strong>
                          <span class="text-neutral-500 font-mono text-[10px]">${cn.base_url} [Auth: ${cn.auth_type}]</span>
                        </div>
                        <button data-delete-connector-id="${cn.id}" class="text-rose-600 hover:text-rose-800 text-[10px] font-mono font-bold uppercase">Eliminar</button>
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
          `;

          const addConnForm = tabContainer.querySelector('#form-add-connector');
          addConnForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(addConnForm);
            const payload = {
              phone_number_id: phoneId,
              connector: {
                name: formData.get('name'),
                auth_type: formData.get('auth_type'),
                base_url: formData.get('base_url')
              }
            };
            const saveRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-connectors`, { method: 'POST', headers, body: JSON.stringify(payload) });
            if (saveRes.ok) { toast.show('Conector registrado', 'success'); loadTab('tab-conectores'); }
            else toast.show('Error al registrar conector', 'error');
          });
        }

        // 5. SOLAPA PROBADOR (SIMULADOR DE IA SIN COSTO)
        else if (tabKey === 'tab-simulador') {
          tabContainer.innerHTML = `
            <div class="flex flex-col gap-4">
              <div class="p-3 bg-blue-50 border border-blue-200 rounded-sm text-blue-900 text-[10px]">
                ℹ️ <strong>Probador del Agente de IA en Vivo:</strong> Envía mensajes de prueba para validar las respuestas del agente sin consumir tokens ni generar costos en tu cuenta de Meta WhatsApp.
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div class="md:col-span-2 flex flex-col border border-neutral-200 rounded-sm bg-white h-[380px]">
                  <div class="p-2.5 bg-neutral-50 border-b border-neutral-200 flex justify-between items-center">
                    <span class="font-mono text-[9px] font-bold text-primary uppercase">💬 Consola de Chat de Prueba</span>
                    <button id="btn-reset-sim-conv" class="text-[9px] font-mono text-neutral-500 hover:text-primary underline cursor-pointer">🔄 Reiniciar Conversación</button>
                  </div>

                  <div id="sim-chat-history" class="flex-1 p-3 overflow-y-auto flex flex-col gap-2 bg-neutral-50/50">
                    <div class="p-2 bg-white border border-neutral-200 rounded text-[11px] text-neutral-600 self-start max-w-[85%]">
                      👋 ¡Hola! Soy el simulador del Agente de IA. Escribe cualquier consulta para probar mis respuestas.
                    </div>
                  </div>

                  <form id="sim-chat-form" class="p-2 border-t border-neutral-200 bg-white flex gap-2">
                    <input type="text" id="sim-user-input" placeholder="Escribe un mensaje de prueba..." class="cohere-input text-xs flex-1" required />
                    <button type="submit" id="sim-btn-send" class="px-4 py-2 bg-primary hover:bg-cohere-black text-white font-mono text-[10px] font-bold uppercase rounded-sm cursor-pointer">Enviar</button>
                  </form>
                </div>

                <div class="flex flex-col gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-sm h-[380px] overflow-y-auto">
                  <span class="font-mono text-[9px] font-bold text-primary uppercase border-b border-neutral-200 pb-1">⚡ Diagnóstico del Turno</span>
                  
                  <div class="flex flex-col gap-1">
                    <span class="text-[8px] font-mono text-neutral-500 uppercase font-bold">Consumo Estimado de Tokens</span>
                    <div id="sim-stat-tokens" class="text-xs font-mono font-bold text-neutral-700 bg-white p-1.5 border border-neutral-200 rounded">-</div>
                  </div>

                  <div class="flex flex-col gap-1">
                    <span class="text-[8px] font-mono text-neutral-500 uppercase font-bold">Motivo de Escalación (Handoff)</span>
                    <div id="sim-stat-handoff" class="text-xs font-mono text-neutral-700 bg-white p-1.5 border border-neutral-200 rounded">-</div>
                  </div>

                  <div class="flex flex-col gap-1">
                    <span class="text-[8px] font-mono text-neutral-500 uppercase font-bold">Motivo de No Respuesta</span>
                    <div id="sim-stat-no-resp" class="text-xs font-mono text-neutral-700 bg-white p-1.5 border border-neutral-200 rounded">-</div>
                  </div>

                  <div class="flex flex-col gap-1">
                    <span class="text-[8px] font-mono text-neutral-500 uppercase font-bold">Botones Sugeridos (Quick Replies)</span>
                    <div id="sim-stat-quick" class="text-xs font-mono text-neutral-700 bg-white p-1.5 border border-neutral-200 rounded">-</div>
                  </div>
                </div>
              </div>
            </div>
          `;

          const simForm = tabContainer.querySelector('#sim-chat-form');
          const simInput = tabContainer.querySelector('#sim-user-input');
          const simHistory = tabContainer.querySelector('#sim-chat-history');
          const simBtnSend = tabContainer.querySelector('#sim-btn-send');
          const btnReset = tabContainer.querySelector('#btn-reset-sim-conv');

          const statTokens = tabContainer.querySelector('#sim-stat-tokens');
          const statHandoff = tabContainer.querySelector('#sim-stat-handoff');
          const statNoResp = tabContainer.querySelector('#sim-stat-no-resp');
          const statQuick = tabContainer.querySelector('#sim-stat-quick');

          btnReset.addEventListener('click', () => {
            activeSimConvId = null;
            simHistory.innerHTML = `
              <div class="p-2 bg-white border border-neutral-200 rounded text-[11px] text-neutral-600 self-start max-w-[85%]">
                🔄 Conversación reiniciada. Envía un nuevo mensaje para iniciar una prueba limpia.
              </div>
            `;
            statTokens.textContent = '-';
            statHandoff.textContent = '-';
            statNoResp.textContent = '-';
            statQuick.textContent = '-';
          });

          simForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = simInput.value.trim();
            if (!text) return;

            simInput.value = '';
            simBtnSend.disabled = true;

            simHistory.insertAdjacentHTML('beforeend', `
              <div class="p-2 bg-primary text-white rounded text-[11px] self-end max-w-[85%]">
                ${text}
              </div>
            `);
            simHistory.scrollTop = simHistory.scrollHeight;

            const loadingId = 'sim-loading-' + Date.now();
            simHistory.insertAdjacentHTML('beforeend', `
              <div id="${loadingId}" class="p-2 bg-white border border-neutral-200 rounded text-[11px] text-neutral-400 self-start animate-pulse">
                🤖 Procesando consulta en pipeline de Meta...
              </div>
            `);
            simHistory.scrollTop = simHistory.scrollHeight;

            try {
              const testPayload = { phone_number_id: phoneId, user_msg: text };
              if (activeSimConvId) testPayload.conversation_id = activeSimConvId;

              const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-test`, {
                method: 'POST',
                headers,
                body: JSON.stringify(testPayload)
              });

              const loadingEl = simHistory.querySelector('#' + loadingId);
              if (loadingEl) loadingEl.remove();

              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                simHistory.insertAdjacentHTML('beforeend', `
                  <div class="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded text-[11px] self-start max-w-[85%]">
                    ❌ Error: ${errData.detail || errData.error || 'Error al comunicarse con Meta Agent Test API'}
                  </div>
                `);
                return;
              }

              const data = await res.json();
              activeSimConvId = data.conversation_id || activeSimConvId;

              if (data.no_response_reason === 'ELIGIBILITY_CHECK_FAILED') {
                simHistory.insertAdjacentHTML('beforeend', `
                  <div class="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-[10px] self-start max-w-[90%] flex flex-col gap-1 my-1">
                    <span>⚠️ <strong>Sin respuesta de Meta (ELIGIBILITY_CHECK_FAILED):</strong></span>
                    <span>Esto ocurre porque la Audiencia del Agente está configurada en <strong>Solo Lista Blanca (ALLOWLISTED_ONLY)</strong> en Meta. Cambia la audiencia a <strong>Todos (EVERYONE)</strong> en la pestaña <em>Principal</em> para probar respuestas en el simulador.</span>
                  </div>
                `);
              } else {
                const agentResp = data.agent_response || '(Sin respuesta de texto)';
                simHistory.insertAdjacentHTML('beforeend', `
                  <div class="p-2 bg-white border border-neutral-200 rounded text-[11px] text-neutral-800 self-start max-w-[85%] shadow-sm">
                    🤖 ${agentResp}
                  </div>
                `);
              }
              simHistory.scrollTop = simHistory.scrollHeight;

              statTokens.textContent = data.estimated_token_usage != null ? `${data.estimated_token_usage} tokens` : '0 / No aplicable';
              statHandoff.textContent = data.handoff_reason || 'Ninguno';
              statNoResp.textContent = data.no_response_reason || 'Ninguno';
              statQuick.textContent = (data.quick_replies && data.quick_replies.length > 0) ? data.quick_replies.join(', ') : 'Sin botones';

            } catch (err) {
              const loadingEl = simHistory.querySelector('#' + loadingId);
              if (loadingEl) loadingEl.remove();
              simHistory.insertAdjacentHTML('beforeend', `
                <div class="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded text-[11px] self-start">
                  ❌ Error de red: ${err.message}
                </div>
              `);
            } finally {
              simBtnSend.disabled = false;
            }
          });
        }

        // 6. SOLAPA EVENTOS CRM
        else if (tabKey === 'tab-eventos') {
          tabContainer.innerHTML = `
            <div class="flex flex-col gap-4">
              <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-sm">
                <h4 class="font-mono text-[10px] font-bold text-primary uppercase mb-2">Transmisión de Eventos del CRM al Agente (agent_event)</h4>
                <p class="text-neutral-500 text-[10px] mb-4">Configura las notificaciones que el CRM le envía automáticamente al Agente de Meta para actualizar el diálogo con prospectos.</p>
                
                <div class="flex flex-col gap-3">
                  <div class="flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-sm">
                    <div class="flex flex-col gap-0.5">
                      <strong class="text-primary text-xs">🔔 Notificar Cambio de Etapa del Lead (stage_changed)</strong>
                      <span class="text-[10px] text-neutral-500 font-mono">Envía una actualización a Meta cada vez que un lead avanza o cambia de columna en el embudo comercial.</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked class="sr-only peer" id="event-toggle-stage" />
                      <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div class="flex items-center justify-between p-3 bg-white border border-neutral-200 rounded-sm">
                    <div class="flex flex-col gap-0.5">
                      <strong class="text-primary text-xs">⭐ Notificar Lead Calificado (lead_qualified)</strong>
                      <span class="text-[10px] text-neutral-500 font-mono">Informa al agente cuando los datos de contacto o validación telefónica son aprobados.</span>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked class="sr-only peer" id="event-toggle-qualified" />
                      <div class="w-7 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          `;
        }

        // 7. SOLAPA EVALUACIONES
        else if (tabKey === 'tab-evaluacion') {
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-eval/cases?phone_number_id=${phoneId}`, { headers });
          const evalData = await res.json().catch(() => ({}));
          const cases = evalData.eval_cases || (Array.isArray(evalData) ? evalData : (evalData.data || []));

          tabContainer.innerHTML = `
            <div class="flex flex-col gap-4 font-sans">
              <div class="p-3 bg-neutral-50 border border-neutral-200 rounded-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div>
                  <div class="flex items-center gap-2">
                    <h4 class="font-mono text-[10px] font-bold text-primary uppercase mb-0.5">Auditoría y Evaluaciones Automatizadas (agent-eval)</h4>
                    <button id="btn-toggle-eval-help" type="button" class="text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer text-xs font-mono font-bold flex items-center gap-1">
                      ℹ️ <span class="underline text-[9px]">¿Cómo funciona?</span>
                    </button>
                  </div>
                  <p class="text-neutral-500 text-[10px]">Ejecuta simulaciones automáticas con el Judge LLM de Meta para auditar la precisión de las respuestas del agente.</p>
                </div>
                <button id="btn-run-eval" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-[9px] font-bold uppercase rounded-full shadow-xs cursor-pointer transition-colors shrink-0">
                  ⚡ Ejecutar Evaluación Automatizada
                </button>
              </div>

              <!-- Interactive Help Banner -->
              <div id="eval-help-box" class="hidden p-4 bg-indigo-50/80 border border-indigo-200 rounded-sm text-indigo-950 text-xs flex flex-col gap-2">
                <div class="flex justify-between items-center border-b border-indigo-200 pb-1.5">
                  <strong class="font-mono text-[10px] uppercase font-bold text-indigo-900 flex items-center gap-1">📖 Guía de Evaluaciones Automatizadas Meta AI</strong>
                  <button id="btn-close-eval-help" type="button" class="text-indigo-600 hover:text-indigo-900 font-bold text-xs cursor-pointer px-1">✕ Cerrar</button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div class="flex flex-col gap-1 bg-white p-3 rounded border border-indigo-100 shadow-2xs">
                    <strong class="text-indigo-900 text-[10px] font-mono uppercase font-bold">1. Simulador de Cliente</strong>
                    <p class="text-[11px] text-neutral-600 leading-relaxed">Meta genera un bot cliente que simula prospectos reales haciendo consultas sobre tu negocio, inversión o condiciones.</p>
                  </div>
                  <div class="flex flex-col gap-1 bg-white p-3 rounded border border-indigo-100 shadow-2xs">
                    <strong class="text-indigo-900 text-[10px] font-mono uppercase font-bold">2. Límite de Turnos (Max Turns)</strong>
                    <p class="text-[11px] text-neutral-600 leading-relaxed">Un <em>turno</em> es 1 intercambio [Pregunta Cliente + Respuesta Agente]. Define la duración máxima del diálogo antes de calificar (ej. 10 turnos).</p>
                  </div>
                  <div class="flex flex-col gap-1 bg-white p-3 rounded border border-indigo-100 shadow-2xs">
                    <strong class="text-indigo-900 text-[10px] font-mono uppercase font-bold">3. Judge LLM (Juez IA)</strong>
                    <p class="text-[11px] text-neutral-600 leading-relaxed">Un modelo de inteligencia artificial actúa como auditor neutral, califica del 1 al 5 y emite un informe con sugerencias de mejora.</p>
                  </div>
                </div>
              </div>

              <!-- Status / Progress Banner -->
              <div id="eval-status-banner" class="hidden p-3 bg-blue-50 border border-blue-200 rounded-sm text-blue-900 text-xs flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="animate-spin text-base">🔄</span>
                  <span id="eval-status-text" class="font-mono text-[10px] font-bold uppercase">Ejecutando simulación de diálogo y evaluación con Judge LLM...</span>
                </div>
                <span id="eval-job-id" class="font-mono text-[9px] text-blue-700"></span>
              </div>

              <!-- Results Summary Container -->
              <div id="eval-results-container" class="hidden flex flex-col gap-3">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-sm flex flex-col">
                    <span class="font-mono text-[8px] font-bold text-emerald-800 uppercase">Score Promedio Conversación</span>
                    <span id="eval-score-conv" class="text-2xl font-bold font-mono text-emerald-700 mt-1">-</span>
                  </div>
                  <div class="p-3 bg-blue-50 border border-blue-200 rounded-sm flex flex-col">
                    <span class="font-mono text-[8px] font-bold text-blue-800 uppercase">Score Promedio por Turno</span>
                    <span id="eval-score-turn" class="text-2xl font-bold font-mono text-blue-700 mt-1">-</span>
                  </div>
                </div>

                <div class="p-3 bg-white border border-neutral-200 rounded-sm flex flex-col gap-1">
                  <span class="font-mono text-[9px] font-bold text-primary uppercase">📝 Dictamen del Judge LLM Meta</span>
                  <p id="eval-summary-text" class="text-neutral-600 text-xs italic py-1"></p>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <span class="font-mono text-[9px] font-bold text-neutral-500 uppercase">Escenarios de Evaluación Disponibles en Meta (${cases.length})</span>
                ${cases.length === 0 ? `
                  <div class="p-4 bg-neutral-50 border border-neutral-200 rounded-sm text-neutral-500 text-[10px] italic">
                    Meta no registra casos de evaluación personalizados para esta línea aún. Al presionar <strong>⚡ Ejecutar Evaluación Automatizada</strong>, Meta utilizará la suite de pruebas estándar asignada a tu Agente.
                  </div>
                ` : `
                  <div class="divide-y divide-neutral-200 border border-neutral-200 rounded-sm bg-white">
                    ${cases.map(c => `
                      <div class="p-3 flex justify-between items-start gap-2">
                        <div class="flex flex-col gap-1">
                          <strong class="text-primary text-xs">${c.scenario || c.name || 'Caso de Evaluación'}</strong>
                          <span class="text-neutral-500 font-mono text-[10px]">ID: ${c.id} | Max turnos: ${c.max_turns || 10}</span>
                          ${c.success_criteria ? `<span class="text-emerald-700 text-[10px]">✅ Criterios: ${Array.isArray(c.success_criteria) ? c.success_criteria.join(', ') : c.success_criteria}</span>` : ''}
                        </div>
                        <input type="checkbox" data-eval-case-id="${c.id}" checked class="mt-1 cursor-pointer" />
                      </div>
                    `).join('')}
                  </div>
                `}
              </div>
            </div>
          `;

          const toggleHelpBtn = tabContainer.querySelector('#btn-toggle-eval-help');
          const closeHelpBtn = tabContainer.querySelector('#btn-close-eval-help');
          const helpBox = tabContainer.querySelector('#eval-help-box');

          if (toggleHelpBtn && helpBox) {
            toggleHelpBtn.addEventListener('click', () => helpBox.classList.toggle('hidden'));
          }
          if (closeHelpBtn && helpBox) {
            closeHelpBtn.addEventListener('click', () => helpBox.classList.add('hidden'));
          }

          const runBtn = tabContainer.querySelector('#btn-run-eval');
          const statusBanner = tabContainer.querySelector('#eval-status-banner');
          const statusText = tabContainer.querySelector('#eval-status-text');
          const jobIdEl = tabContainer.querySelector('#eval-job-id');
          const resultsContainer = tabContainer.querySelector('#eval-results-container');
          const scoreConvEl = tabContainer.querySelector('#eval-score-conv');
          const scoreTurnEl = tabContainer.querySelector('#eval-score-turn');
          const summaryTextEl = tabContainer.querySelector('#eval-summary-text');

          runBtn.addEventListener('click', async () => {
            const checkedBoxes = Array.from(tabContainer.querySelectorAll('[data-eval-case-id]:checked'));
            const selectedCaseIds = checkedBoxes.map(cb => cb.dataset.evalCaseId).join(',');

            runBtn.disabled = true;
            runBtn.textContent = 'Lanzando...';
            statusBanner.classList.remove('hidden');
            statusText.textContent = 'Enviando petición de evaluación a Meta...';
            resultsContainer.classList.add('hidden');

            try {
              const runUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-eval/run?phone_number_id=${phoneId}${selectedCaseIds ? `&eval_case_ids=${encodeURIComponent(selectedCaseIds)}` : ''}`;
              const runRes = await fetch(runUrl, { method: 'POST', headers, body: JSON.stringify({}) });
              const runData = await runRes.json().catch(() => ({}));

              if (!runRes.ok) {
                const errDetail = runData.raw_meta_response || runData.error?.message || runData.detail || runData.title || JSON.stringify(runData);
                toast.show('Error al lanzar evaluación: ' + errDetail, 'error');
                statusBanner.classList.add('hidden');
                return;
              }

              const jobId = runData.job_id;
              jobIdEl.textContent = `Job ID: ${jobId || 'RUNNING'}`;
              statusText.textContent = 'Simulando diálogos y auditando con Judge LLM Meta...';

              if (!jobId) {
                toast.show('Evaluación iniciada', 'success');
                statusBanner.classList.add('hidden');
                return;
              }

              // Poll for completion
              let attempts = 0;
              const maxAttempts = 30;
              const pollInterval = setInterval(async () => {
                attempts++;
                try {
                  const statusUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-eval/run?phone_number_id=${phoneId}&job_id=${encodeURIComponent(jobId)}`;
                  const pollRes = await fetch(statusUrl, { headers });
                  const pollData = await pollRes.json().catch(() => ({}));

                  const currentStatus = pollData.status || 'RUNNING';
                  statusText.textContent = `Estado de Evaluación: ${currentStatus} (Consulta ${attempts}/${maxAttempts})...`;

                  if (currentStatus === 'COMPLETED' || currentStatus === 'SUCCESS') {
                    clearInterval(pollInterval);
                    statusBanner.classList.add('hidden');
                    toast.show('¡Evaluación completada con éxito!', 'success');

                    const result = pollData.result || pollData;
                    if (result) {
                      resultsContainer.classList.remove('hidden');
                      scoreConvEl.textContent = result.avg_conversation_score ? `${result.avg_conversation_score} / 5.0` : 'N/A';
                      scoreTurnEl.textContent = result.avg_turn_score ? `${result.avg_turn_score} / 5.0` : 'N/A';
                      summaryTextEl.textContent = result.summary || 'Evaluación procesada correctamente sin observaciones.';

                      if (result.summary_id) {
                        const sumRes = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-proxy/agent-eval/summary?phone_number_id=${phoneId}&summary_ids=${encodeURIComponent(result.summary_id)}`, { headers });
                        const sumData = await sumRes.json().catch(() => null);
                        if (sumData && sumData.insights && sumData.insights[0]) {
                          const insight = sumData.insights[0];
                          summaryTextEl.textContent = insight.summary || summaryTextEl.textContent;
                        }
                      }
                    }
                  } else if (currentStatus === 'FAILED' || currentStatus === 'ERROR' || attempts >= maxAttempts) {
                    clearInterval(pollInterval);
                    statusBanner.classList.add('hidden');
                    toast.show('El trabajo de evaluación finalizó o excedió el tiempo límite', 'warning');
                  }
                } catch (pollErr) {
                  console.error('Error polling evaluation status:', pollErr);
                }
              }, 4000);

            } catch (err) {
              toast.show('Error: ' + err.message, 'error');
              statusBanner.classList.add('hidden');
            } finally {
              runBtn.disabled = false;
              runBtn.textContent = '⚡ Ejecutar Evaluación Automatizada';
            }
          });
        }

      } catch (err) {
        tabContainer.innerHTML = `<div class="p-4 bg-rose-50 text-rose-700 text-xs rounded-sm">Error al cargar datos de la pestaña: ${err.message}</div>`;
      }
    }

    loadTab('tab-principal');
  }

  return container;
}
