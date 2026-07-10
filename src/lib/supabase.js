import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan las credenciales de Supabase en el archivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchAllLeads(selectColumns = '*', options = {}) {
  let allLeads = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;
    let query = supabase
      .from('leads')
      .select(selectColumns)
      .order('id', { ascending: true })
      .range(from, to);

    if (options.from_date) {
      query = query.gte('created_at', options.from_date);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      allLeads = allLeads.concat(data);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    } else {
      hasMore = false;
    }
  }

  return allLeads;
}

/** Returns an ISO date string N days ago, or null if days = 0 (= all time). */
export function getFromDate(days) {
  if (!days || days === 0) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
