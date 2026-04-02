// @ts-nocheck
import { supabase } from './supabaseClient';

function makeEntity(table) {
  return {
    async list() {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw new Error(error.message);
      return data;
    },
    async filter(obj) {
      let q = supabase.from(table).select('*');
      for (const [key, value] of Object.entries(obj)) {
        q = q.eq(key, value);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return data;
    },
    async create(obj) {
      const { data, error } = await supabase.from(table).insert(obj).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    async update(id, obj) {
      const { data, error } = await supabase.from(table).update(obj).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}

export const CarEvaluation = makeEntity('used_car_evaluations');
export const CarListing = makeEntity('used_car_listings');
export const ScrapeLog = makeEntity('used_car_scrape_logs');
export const ConditionCheck = makeEntity('used_car_condition_checks');
export const ScrapeSource = makeEntity('used_car_scrape_sources');
export const ExShowroomPrice = makeEntity('used_car_ex_showroom_prices');
export const CustomDepreciation = makeEntity('used_car_custom_depreciation');
export const CustomCarBrand = makeEntity('custom_car_brands');
export const CustomCarModel = makeEntity('custom_car_models');
