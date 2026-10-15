// Supabase/PostgREST returns at most 1000 rows per request. Page through the table.
import { supabase } from './supabaseClient';

export async function fetchAll(table, columns = '*', build = (q) => q) {
  const size = 1000;
  let from = 0;
  const out = [];
  for (;;) {
    const { data, error } = await build(supabase.from(table).select(columns))
      .order('id')
      .range(from, from + size - 1);
    if (error || !data) break;
    out.push(...data);
    if (data.length < size) break;
    from += size;
  }
  return out;
}
