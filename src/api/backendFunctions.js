import { supabase } from './supabaseClient';

/**
 * @param {{ action: string, params?: Record<string, unknown>, sourceIds?: string[] }} payload
 */
export async function scrapeListings({ action, params, sourceIds }) {
  const { data, error } = await supabase.functions.invoke('used-car-scrape', {
    body: { action, params, sourceIds },
  });
  if (error) throw new Error(error.message);
  return data;
}
