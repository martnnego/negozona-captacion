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
    this.isLoaded = false;
    this.listeners = new Set();
    // Default: last 30 days. 0 = all time.
    this.dateWindowDays = parseInt(localStorage.getItem('cache_date_window') || '30');
  }

  async loadAll() {
    try {
      const from_date = getFromDate(this.dateWindowDays);
      const [stagesRes, profilesRes, leadsData, contactsData, linksData, eventsData, participationsData] = await Promise.all([
        supabase
          .from('pipeline_stages')
          .select('*')
          .order('position', { ascending: true }),
        supabase
          .from('profiles')
          .select('*')
          .eq('is_active', true),
        fetchAllLeads(
          'id, created_at, company, country, source, source_detail, pipeline_stage_id, industry, investment, branches, assigned_to, valoracion, motivo_descarte, notes, updated_at, primary_contact_id, nombre_validado, franquiday_stage_id, franquiday_notes, fecha_ultimo_contacto, ultimo_comentario',
          { from_date }
        ),
        fetchAllRows('contacts', '*'),
        fetchAllRows('lead_contacts_link', '*', { orderCol: 'lead_id' }),
        fetchAllRows('eventos_franquiday', '*', { orderCol: 'fecha' }),
        fetchAllRows('participaciones_franquiday', '*', { orderCol: 'lead_id' })
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
      this.isLoaded = true;
      console.log(`Cache initialized: ${this.leads.length} leads, ${this.contacts.size} contacts, ${this.links.length} links, ${this.events.length} events, ${this.participations.length} participations (ventana: ${this.dateWindowDays === 0 ? 'todo' : this.dateWindowDays + 'd'})`);
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

    const partsWithEvents = parts.map(p => {
      const ev = this.getEvent(p.evento_id);
      return { ...p, event: ev };
    }).filter(x => x.event !== undefined);

    if (partsWithEvents.length === 0) return null;

    // Sort by event date descending
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

  clear() {
    this.stages.clear();
    this.profiles.clear();
    this.contacts.clear();
    this.links = [];
    this.events = [];
    this.participations = [];
    this.leads = [];
    this.isLoaded = false;
    this.listeners.clear();
  }
}

export const cache = new CacheManager();
