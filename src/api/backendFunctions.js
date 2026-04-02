// @ts-nocheck
import { supabase } from './supabaseClient';
import { MAKES, MODELS_BY_MAKE } from '../utils/carConstants';
import { CustomCarBrand, CustomCarModel } from './entities';

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

/**
 * Fetch all brands: predefined MAKES + custom brands from database
 * Returns a deduplicated, sorted array of brand names
 */
export async function fetchAllBrands() {
  try {
    const customBrands = await CustomCarBrand.list();
    const customBrandNames = (customBrands || []).map(b => b.brand_name).filter(Boolean);
    const allBrands = [...new Set([...MAKES, ...customBrandNames])].sort();
    return allBrands;
  } catch (error) {
    console.warn('Failed to fetch custom brands, using predefined makes:', error.message);
    return MAKES;
  }
}

/**
 * Fetch models for a given brand: predefined models + custom models from database
 * Returns a deduplicated, sorted array of model names
 */
export async function fetchModelsByBrand(brand) {
  try {
    const predefinedModels = MODELS_BY_MAKE[brand] || [];
    const customModels = await CustomCarModel.filter({ brand });
    const customModelNames = (customModels || []).map(m => m.model_name).filter(Boolean);
    const allModels = [...new Set([...predefinedModels, ...customModelNames])].sort();
    return allModels;
  } catch (error) {
    console.warn(`Failed to fetch custom models for brand ${brand}, using predefined models:`, error.message);
    return MODELS_BY_MAKE[brand] || [];
  }
}

/**
 * Add a custom brand. Will deduplicate based on brand_name.
 * Requires user to be authenticated.
 */
export async function addCustomBrand(brandName) {
  try {
    // Normalize brand name
    const normalized = brandName.trim();
    if (!normalized || normalized.length < 2 || normalized.length > 50) {
      throw new Error('Brand name must be 2-50 characters');
    }

    // Check if brand already exists (predefined or custom)
    const allBrands = await fetchAllBrands();
    if (allBrands.some(b => b.toLowerCase() === normalized.toLowerCase())) {
      console.log(`Brand "${normalized}" already exists`);
      return normalized;
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    // Insert custom brand
    const result = await CustomCarBrand.create({
      brand_name: normalized,
      created_by: user.id,
    });

    return result?.brand_name || normalized;
  } catch (error) {
    console.error('Failed to add custom brand:', error.message);
    throw error;
  }
}

/**
 * Add a custom model for a given brand. Will deduplicate based on (brand, model_name).
 * Requires user to be authenticated.
 */
export async function addCustomModel(brand, modelName) {
  try {
    // Normalize model name
    const normalized = modelName.trim();
    if (!normalized || normalized.length < 2 || normalized.length > 50) {
      throw new Error('Model name must be 2-50 characters');
    }

    // Check if model already exists for this brand
    const allModels = await fetchModelsByBrand(brand);
    if (allModels.some(m => m.toLowerCase() === normalized.toLowerCase())) {
      console.log(`Model "${normalized}" already exists for brand "${brand}"`);
      return normalized;
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    // Insert custom model
    const result = await CustomCarModel.create({
      brand,
      model_name: normalized,
      created_by: user.id,
    });

    return result?.model_name || normalized;
  } catch (error) {
    console.error('Failed to add custom model:', error.message);
    throw error;
  }
}
