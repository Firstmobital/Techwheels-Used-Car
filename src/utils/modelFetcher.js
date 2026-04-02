import { supabase } from '../api/supabaseClient';

// Fallback hardcoded models in case database is unavailable
const MODELS_BY_MAKE = {
  Maruti: ["Swift", "Alto", "Baleno", "Dzire", "Vitara Brezza", "Ertiga", "WagonR", "Celerio", "Ignis", "S-Cross", "XL6"],
  Hyundai: ["i20", "Creta", "Verna", "Grand i10", "Venue", "Tucson", "Santro", "Aura", "Alcazar", "i10"],
  Tata: ["Nexon", "Altroz", "Harrier", "Safari", "Tiago", "Tigor", "Punch", "Indica"],
  Honda: ["City", "Amaze", "Jazz", "WR-V", "BR-V", "Civic", "CR-V"],
  Kia: ["Seltos", "Sonet", "Carnival", "Carens"],
  Toyota: ["Innova", "Fortuner", "Glanza", "Urban Cruiser", "Camry", "Corolla"],
  Renault: ["Kwid", "Triber", "Duster", "Kiger"],
  Nissan: ["Magnite", "Kicks", "Micra", "Terrano"],
  MG: ["Hector", "Astor", "ZS EV", "Gloster"],
  Skoda: ["Rapid", "Kushaq", "Slavia", "Octavia", "Superb"],
  Volkswagen: ["Polo", "Vento", "Taigun", "Virtus", "Tiguan"],
  Ford: ["Figo", "Aspire", "EcoSport", "Endeavour", "Freestyle"],
  Chevrolet: ["Beat", "Cruze", "Spark", "Enjoy"],
  Mahindra: ["XUV300", "XUV500", "XUV700", "Scorpio", "Bolero", "Thar", "KUV100"],
  Other: [],
};

/**
 * Fetch distinct models for a given make from the database.
 * Falls back to hardcoded MODELS_BY_MAKE if database query fails.
 * @param {string} make - The car make/brand
 * @returns {Promise<string[]>} Array of model names
 */
export async function fetchModelsForMake(make) {
  try {
    const { data, error } = await supabase
      .from('used_car_ex_showroom_prices')
      .select('model')
      .eq('make', make);

    if (error) {
      console.warn('Failed to fetch models from database:', error.message);
      return MODELS_BY_MAKE[make] || [];
    }

    if (data && data.length > 0) {
      // Extract unique models and sort them
      const uniqueModels = [...new Set(data.map(row => row.model))].sort();
      return uniqueModels;
    }

    // Fallback to hardcoded if no data found
    return MODELS_BY_MAKE[make] || [];
  } catch (err) {
    console.warn('Error fetching models:', err.message);
    return MODELS_BY_MAKE[make] || [];
  }
}

export { MODELS_BY_MAKE };
