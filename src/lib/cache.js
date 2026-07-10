import { supabase, fetchAllLeads, getFromDate } from './supabase';

class CacheManager {
  constructor() {
    this.stages = new Map();
    this.profiles = new Map();
    this.leads = [];
    this.isLoaded = false;
    this.listeners = new Set();
    // Default: last 30 days. 0 = all time.
    this.dateWindowDays = parseInt(localStorage.getItem('cache_date_window') || '30');
  }

  async loadAll() {
    try {
      const from_date = getFromDate(this.dateWindowDays);
      const [stagesRes, profilesRes, leadsData] = await Promise.all([
        supabase
          .from('pipeline_stages')
          .select('*')
          .order('position', { ascending: true }),
        supabase
          .from('profiles')
          .select('*')
          .eq('is_active', true),
        fetchAllLeads(
          'id, created_at, first_name, last_name, email, phone, company, position, linkedin_url, country, source, source_detail, pipeline_stage_id, industry, investment, branches, assigned_to, valoracion, medio_contacto, fecha_ultimo_contacto, fecha_carga, motivo_descarte, notes, updated_at',
          { from_date }
        )
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

      this.leads = leadsData || [];
      this.isLoaded = true;
      console.log(`Cache initialized: ${this.leads.length} leads (ventana: ${this.dateWindowDays === 0 ? 'todo' : this.dateWindowDays + 'd'})`);
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
    this.leads = [];
    this.isLoaded = false;
    this.listeners.clear();
  }
}

export const cache = new CacheManager();
