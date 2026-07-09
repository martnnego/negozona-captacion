import { supabase } from './supabase';

class CacheManager {
  constructor() {
    this.stages = new Map();
    this.profiles = new Map();
    this.isLoaded = false;
  }

  async loadAll() {
    try {
      const [stagesRes, profilesRes] = await Promise.all([
        supabase
          .from('pipeline_stages')
          .select('*')
          .order('position', { ascending: true }),
        supabase
          .from('profiles')
          .select('*')
          .eq('is_active', true)
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

      this.isLoaded = true;
      console.log('Cache initialized successfully');
    } catch (err) {
      console.error('Error loading metadata cache:', err);
    }
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

  clear() {
    this.stages.clear();
    this.profiles.clear();
    this.isLoaded = false;
  }
}

export const cache = new CacheManager();
