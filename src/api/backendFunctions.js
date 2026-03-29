import { supabase } from './supabaseClient';

export async function scrapeListings({ action, params }) {
  const { data, error } = await supabase.functions.invoke('used-car-scrape', {
    body: { action, params },
  });
  if (error) throw new Error(error.message);
  return data;
}
