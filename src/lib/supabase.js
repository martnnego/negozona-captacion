import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Faltan las credenciales de Supabase en el archivo .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchAllLeads(selectColumns = '*') {
  let allLeads = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('leads')
      .select(selectColumns)
      .order('id', { ascending: true })
      .range(from, to);

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
