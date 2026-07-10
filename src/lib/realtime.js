import { supabase } from './supabase';

export const realtime = {
  subscribeToLeads(callback) {
    const uniqueChannelId = `leads-changes-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(uniqueChannelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToNotifications(userId, callback) {
    const uniqueChannelId = `notifications-${userId}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(uniqueChannelId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToContacts(callback) {
    const uniqueChannelId = `contacts-changes-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(uniqueChannelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts'
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  subscribeToLinks(callback) {
    const uniqueChannelId = `links-changes-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(uniqueChannelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_contacts_link'
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};
