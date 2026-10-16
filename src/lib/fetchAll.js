// Supabase/PostgREST caps rows per request (default 1000, and the project may set it lower).
// Page through the table using the real page length and the exact total count.
import { supabase } from './supabaseClient';

export async function fetchAll(table, columns = '*', build = (q) => q) {
  const out = [];
  let total = null;
  for (let guard = 0; guard < 500; guard++) {
    const from = out.length;
    const { data, error, count } = await build(
      supabase.from(table).select(columns, { count: 'exact' })
    )
      .order('id')
      .range(from, from + 999);
    if (error || !data || data.length === 0) break;
    if (total === null && typeof count === 'number') total = count;
    out.push(...data);
    if (total !== null ? out.length >= total : data.length < 1000) break;
  }
  return out;
}
