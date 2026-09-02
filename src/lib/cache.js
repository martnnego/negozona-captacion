import { supabase, fetchAllLeads, getFromDate, fetchAllRows } from './supabase';

class CacheManager {
  constructor() {
    this.stages = new Map();
    this.profiles = new Map();
    this.leads = [];
    this.contacts = new Map();
    this.links = [];
    this.events = [];
    this.participations = [];
    this.latestInteractions = new Map(); // lead_id -> latest lead_interaction object
    this.leadAutomations = new Map(); // lead_id -> Array<automation_executions>
    this.isLoaded = false;
    this.listeners = new Set();
    // Default: 0 = all time (fetch all leads from Supabase).
    this.dateWindowDays = parseInt(localStorage.getItem('cache_date_window') || '0');
  }

  async loadAll() {
    try {
      const from_date = getFromDate(this.dateWindowDays);
      const [stagesRes, profilesRes, leadsData, contactsData, linksData, eventsData, participationsData, interactionsData, executionsData] = await Promise.all([
        supabase
          .from('pipeline_stages')
          .select('*')
          .order('position', { ascending: true }),
        supabase
          .from('profiles')
          .select('*')
          .eq('is_active', true),
        fetchAllLeads('*', { from_date }),
        fetchAllRows('contacts', '*'),
        fetchAllRows('lead_contacts_link', '*', { orderCol: 'lead_id' }),
        fetchAllRows('eventos_franquiday', '*', { orderCol: 'fecha' }),
        fetchAllRows('participaciones_franquiday', '*', { orderCol: 'lead_id' }),
        fetchAllRows('lead_interactions', '*', { orderCol: 'contacted_at', ascending: false }),
        fetchAllRows('automation_executions', 'id, lead_id, contact_id, automation_id, status, current_step_order, error_message, scheduled_for, updated_at, created_at, automations(id, name, trigger_type), contacts(id, first_name, last_name, phone, email)', { orderCol: 'updated_at', ascending: false })
      ]);

      if (stagesRes.error) throw stagesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      this.stages.clear();
      stagesRes.data.forEach(stage => {
        this.stages.set(stage.id, stage);
      });

      this.profiles.clear();
      profilesRes.data.forEach(profile => {
        this.profiles.set(profile.id, profile);
      });

      this.contacts.clear();
      if (contactsData) {
        contactsData.forEach(c => {
          this.contacts.set(c.id, c);
        });
      }

      this.links = linksData || [];
      this.events = eventsData || [];
      this.participations = participationsData || [];
      this.leads = leadsData || [];

      this.latestInteractions.clear();
      if (interactionsData) {
        // Because interactionsData is ordered by contacted_at DESC, the first one encountered per lead_id is the newest
        interactionsData.forEach(item => {
          if (item.lead_id && !this.latestInteractions.has(item.lead_id)) {
            this.latestInteractions.set(item.lead_id, item);
          }
        });
      }

      this.leadAutomations.clear();
      if (executionsData) {
        executionsData.forEach(item => {
          if (item.lead_id) {
            if (!this.leadAutomations.has(item.lead_id)) {
              this.leadAutomations.set(item.lead_id, []);
            }
            this.leadAutomations.get(item.lead_id).push(item);
          }
        });
      }

      this.isLoaded = true;
      console.log(`Cache initialized: ${this.leads.length} leads, ${this.contacts.size} contacts, ${this.links.length} links, ${this.events.length} events, ${this.participations.length} participations, ${this.latestInteractions.size} latest interactions, ${this.leadAutomations.size} leads con automatizaciones (ventana: ${this.dateWindowDays === 0 ? 'todo' : this.dateWindowDays + 'd'})`);
      this.triggerChange();
    } catch (err) {
      console.error('Error loading metadata cache:', err);
    }
  }

  /** Change the date window and reload the leads from Supabase. */
  async setDateWindow(days) {
    this.dateWindowDays = days;
    localStorage.setItem('cache_date_window', String(days));
    this.isLoaded = false;
    await this.loadAll();
  }


  getStage(id) {
    return this.stages.get(id);
  }

  getStages() {
    return Array.from(this.stages.values());
  }

  getProfile(id) {
    return this.profiles.get(id);
  }

  getProfiles() {
    return Array.from(this.profiles.values());
  }

  getLeads() {
    return this.leads;
  }

  setLeads(leads) {
    this.leads = leads;
    this.triggerChange();
  }

  addLead(lead) {
    if (!this.leads.find(l => l.id === lead.id)) {
      this.leads.push(lead);
      this.triggerChange();
    }
  }

  updateLead(lead) {
    let updated = false;
    this.leads = this.leads.map(l => {
      if (l.id === lead.id) {
        updated = true;
        return { ...l, ...lead };
      }
      return l;
    });
    if (updated) {
      this.triggerChange();
    }
  }

  deleteLead(id) {
    const lengthBefore = this.leads.length;
    this.leads = this.leads.filter(l => l.id !== id);
    if (this.leads.length !== lengthBefore) {
      // Also delete links involving this lead
      this.links = this.links.filter(k => k.lead_id !== id);
      this.triggerChange();
    }
  }

  // --- CONTACTS AND LINKS METHODS ---

  getContacts() {
    return Array.from(this.contacts.values());
  }

  getContact(id) {
    return this.contacts.get(id);
  }

  addContact(contact) {
    if (!this.contacts.has(contact.id)) {
      this.contacts.set(contact.id, contact);
      this.triggerChange();
    }
  }

  updateContact(contact) {
    if (this.contacts.has(contact.id)) {
      this.contacts.set(contact.id, { ...this.contacts.get(contact.id), ...contact });
      this.triggerChange();
    }
  }

  deleteContact(id) {
    if (this.contacts.delete(id)) {
      // Also clean up links and primary contact references
      this.links = this.links.filter(k => k.contact_id !== id);
      this.leads = this.leads.map(l => {
        if (l.primary_contact_id === id) {
          return { ...l, primary_contact_id: null };
        }
        return l;
      });
      this.triggerChange();
    }
  }

  getLinks() {
    return this.links;
  }

  addLink(link) {
    if (!this.links.find(k => k.lead_id === link.lead_id && k.contact_id === link.contact_id)) {
      this.links.push(link);
      this.triggerChange();
    }
  }

  deleteLink(leadId, contactId) {
    const lenBefore = this.links.length;
    this.links = this.links.filter(k => !(k.lead_id === leadId && k.contact_id === contactId));
    if (this.links.length !== lenBefore) {
      // If primary contact was this one, nullify it
      this.leads = this.leads.map(l => {
        if (l.id === leadId && l.primary_contact_id === contactId) {
          return { ...l, primary_contact_id: null };
        }
        return l;
      });
      this.triggerChange();
    }
  }

  /** Gets all contacts associated with a specific lead/company. */
  getLeadContacts(leadId) {
    const contactIds = this.links
      .filter(k => k.lead_id === leadId)
      .map(k => k.contact_id);
    return contactIds
      .map(id => this.contacts.get(id))
      .filter(Boolean);
  }

  /** Gets all leads/companies associated with a specific contact. */
  getContactLeads(contactId) {
    const leadIds = this.links
      .filter(k => k.contact_id === contactId)
      .map(k => k.lead_id);
    return this.leads.filter(l => leadIds.includes(l.id));
  }

  // --- FRANQUIDAY METHODS ---

  getEvents() {
    return this.events;
  }

  getEvent(id) {
    return this.events.find(e => e.id === id);
  }

  getActiveEvent() {
    return this.events.find(e => e.is_active === true);
  }

  addEvent(event) {
    if (!this.events.find(e => e.id === event.id)) {
      this.events.push(event);
      this.triggerChange();
    }
  }

  updateEvent(event) {
    let updated = false;
    this.events = this.events.map(e => {
      if (e.id === event.id) {
        updated = true;
        return { ...e, ...event };
      }
      return e;
    });
    if (updated) {
      this.triggerChange();
    }
  }

  deleteEvent(id) {
    const len = this.events.length;
    this.events = this.events.filter(e => e.id !== id);
    if (this.events.length !== len) {
      this.participations = this.participations.filter(p => p.evento_id !== id);
      this.triggerChange();
    }
  }

  getParticipations() {
    return this.participations;
  }

  getLeadParticipations(leadId) {
    return this.participations.filter(p => p.lead_id === leadId);
  }

  getMostRecentFranquidayStageId(leadId) {
    const parts = this.getLeadParticipations(leadId) || [];
    if (parts.length === 0) return null;

    // 1. If there's an active event, prefer its stage
    const activeEvent = this.getActiveEvent();
    if (activeEvent) {
      const activePart = parts.find(p => p.evento_id === activeEvent.id);
      if (activePart) {
        return activePart.pipeline_stage_id;
      }
    }

    // 2. Fallback to sorting by event date descending
    const partsWithEvents = parts.map(p => {
      const ev = this.getEvent(p.evento_id);
      return { ...p, event: ev };
    }).filter(x => x.event !== undefined);

    if (partsWithEvents.length === 0) return null;

    partsWithEvents.sort((a, b) => new Date(b.event.fecha) - new Date(a.event.fecha));
    
    return partsWithEvents[0].pipeline_stage_id;
  }

  addParticipation(participation) {
    if (!this.participations.find(p => p.id === participation.id)) {
      this.participations.push(participation);
      this.triggerChange();
    }
  }

  updateParticipation(participation) {
    let updated = false;
    this.participations = this.participations.map(p => {
      if (p.id === participation.id) {
        updated = true;
        return { ...p, ...participation };
      }
      return p;
    });
    if (updated) {
      // If this was for the active event, also update the denormalized fields in lead in cache
      const activeEvent = this.getActiveEvent();
      if (activeEvent && participation.evento_id === activeEvent.id) {
        this.leads = this.leads.map(l => {
          if (l.id === participation.lead_id) {
            return { 
              ...l, 
              franquiday_stage_id: participation.pipeline_stage_id,
              franquiday_notes: participation.notes
            };
          }
          return l;
        });
      }
      this.triggerChange();
    }
  }

  deleteParticipation(id) {
    const len = this.participations.length;
    this.participations = this.participations.filter(p => p.id !== id);
    if (this.participations.length !== len) {
      this.triggerChange();
    }
  }

  // --- INTERACTIONS METHODS ---

  getLeadLatestInteraction(leadId) {
    return this.latestInteractions.get(leadId) || null;
  }

  addInteraction(interaction) {
    if (!interaction || !interaction.lead_id) return;
    const current = this.latestInteractions.get(interaction.lead_id);
    if (!current || new Date(interaction.contacted_at || interaction.created_at) >= new Date(current.contacted_at || current.created_at)) {
      this.latestInteractions.set(interaction.lead_id, interaction);
    }
    
    // Also update lead's fecha_ultimo_contacto in cache
    const contactDate = interaction.contacted_at || interaction.created_at || new Date().toISOString();
    this.leads = this.leads.map(l => {
      if (l.id === interaction.lead_id) {
        return {
          ...l,
          fecha_ultimo_contacto: contactDate
        };
      }
      return l;
    });

    this.triggerChange();
  }

  updateInteraction(interaction) {
    if (!interaction || !interaction.lead_id) return;
    const current = this.latestInteractions.get(interaction.lead_id);
    if (current && current.id === interaction.id) {
      this.latestInteractions.set(interaction.lead_id, { ...current, ...interaction });
      this.triggerChange();
    }
  }

  deleteInteraction(id, leadId) {
    if (!leadId) return;
    const current = this.latestInteractions.get(leadId);
    if (current && current.id === id) {
      this.latestInteractions.delete(leadId);
      this.triggerChange();
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  triggerChange() {
    this.listeners.forEach(cb => {
      try {
        cb();
      } catch (e) {
        console.error('Error in cache subscriber callback:', e);
      }
    });
  }

  getLeadAutomations(leadId) {
    if (!leadId) return [];
    return this.leadAutomations.get(leadId) || [];
  }

  getLeadActiveOrLatestAutomation(leadId) {
    const list = this.getLeadAutomations(leadId);
    if (list.length === 0) return null;
    // Prioridad 1: Activa en proceso o en espera
    const active = list.find(ex => ex.status === 'running' || ex.status === 'waiting');
    if (active) return active;
    // Prioridad 2: Fallida con error
    const failed = list.find(ex => ex.status === 'failed');
    if (failed) return failed;
    // Prioridad 3: Más reciente (ej. completada)
    return list[0];
  }

  clear() {
    this.stages.clear();
    this.profiles.clear();
    this.contacts.clear();
    this.links = [];
    this.events = [];
    this.participations = [];
    this.leads = [];
    this.latestInteractions.clear();
    this.leadAutomations.clear();
    this.isLoaded = false;
    this.listeners.clear();
  }
}

export const cache = new CacheManager();
