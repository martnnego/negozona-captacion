import { supabase } from './supabase';

let cachedUserWithProfile = null;
let pendingUserPromise = null;

export const auth = {
  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    
    // Fetch profile
    const profile = await this.getProfile(data.user.id);
    cachedUserWithProfile = { ...data.user, profile };
    return { user: data.user, profile };
  },

  async logout() {
    cachedUserWithProfile = null;
    pendingUserPromise = null;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) return null;
      return data?.session || null;
    } catch (e) {
      console.error('Error in getSession:', e);
      return null;
    }
  },

  async getCurrentUser(forceRefresh = false) {
    if (!forceRefresh && cachedUserWithProfile) {
      return cachedUserWithProfile;
    }

    if (pendingUserPromise) {
      return pendingUserPromise;
    }

    pendingUserPromise = (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        const session = data?.session || null;
        const user = session?.user || null;
        if (error || !user) {
          cachedUserWithProfile = null;
          return null;
        }

        const profile = await this.getProfile(user.id);
        cachedUserWithProfile = { ...user, user, profile };
        return cachedUserWithProfile;
      } catch (err) {
        console.error('Error in auth.getCurrentUser:', err);
        cachedUserWithProfile = null;
        return null;
      } finally {
        pendingUserPromise = null;
      }
    })();

    return pendingUserPromise;
  },

  async getProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Exception fetching profile:', e);
      return null;
    }
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange((event, session) => {
      // Defer execution outside the GoTrue lock to avoid deadlock on child queries
      setTimeout(async () => {
        try {
          if (session?.user) {
            if (cachedUserWithProfile && cachedUserWithProfile.id === session.user.id) {
              callback(event, cachedUserWithProfile);
            } else {
              const profile = await this.getProfile(session.user.id);
              cachedUserWithProfile = { ...session.user, user: session.user, profile };
              callback(event, cachedUserWithProfile);
            }
          } else {
            cachedUserWithProfile = null;
            callback(event, null);
          }
        } catch (err) {
          console.error('Error handling auth state change:', err);
          callback(event, null);
        }
      }, 0);
    });
  }
};


