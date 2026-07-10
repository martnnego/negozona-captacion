import { supabase } from '../lib/supabase';

export async function checkDuplicateEmails(emails) {
  if (!emails || emails.length === 0) return {};

  // Remove empty or null emails
  const cleanEmails = Array.from(new Set(emails.filter(e => e && e.trim() !== '')));
  if (cleanEmails.length === 0) return {};

  const duplicateMap = {};

  // Process in chunks of 500 to avoid query size limits in Postgres
  const chunkSize = 500;
  for (let i = 0; i < cleanEmails.length; i += chunkSize) {
    const chunk = cleanEmails.slice(i, i + chunkSize);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, email')
        .in('email', chunk);

      if (error) throw error;

      if (data) {
        data.forEach(lead => {
          if (lead.email) {
            duplicateMap[lead.email.toLowerCase()] = lead.id;
          }
        });
      }
    } catch (err) {
      console.error('Error checking duplicates chunk:', err);
    }
  }

  return duplicateMap;
}
