import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface UseSupabaseQueryOptions {
  enabled?: boolean;
}

export function useSupabaseQuery<T>(
  tableName: string,
  select = '*',
  filter?: { column: string; value: any },
  options: UseSupabaseQueryOptions = {}
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (options.enabled === false) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        let query = supabase.from(tableName).select(select);

        if (filter) {
          query = query.eq(filter.column, filter.value);
        }

        const { data, error } = await query;

        if (error) throw error;
        setData(data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error(`Error fetching from ${tableName}:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tableName, select, filter, options.enabled]);

  return { data, loading, error };
}
