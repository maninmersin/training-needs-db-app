const PAGE_SIZE = 1000; // the API returns at most 1000 rows per request

/**
 * Read every row of a query, a page at a time, in a stable order.
 *
 * A plain select silently stops at 1000 rows, so anything that needs "all the rows" (exports, counts
 * built from rows) must page. The query is rebuilt for each page.
 *
 * @param {() => Object} buildQuery - returns a fresh query, e.g. () => supabase.from('t').select('*').eq(...)
 * @returns {Promise<Array>} all rows
 */
export const fetchAllRows = async (buildQuery) => {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
};
