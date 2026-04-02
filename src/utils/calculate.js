// @ts-nocheck
import { supabase } from '../api/supabaseClient';

const DEPRECIATION_RATES = [0, 0.15, 0.12, 0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.02];

export async function getBasePrice(supabaseClient, make, model, variant) {
  const { data: entries } = await supabaseClient
    .from('used_car_ex_showroom_prices')
    .select('*')
    .eq('make', make)
    .eq('model', model);

  if (entries && entries.length > 0) {
    if (variant) {
      const variantMatch = entries.find(e => e.variant && e.variant.toLowerCase() === variant.toLowerCase());
      if (variantMatch) return variantMatch.ex_showroom_price;
    }
    return entries[0].ex_showroom_price;
  }

  // SPECIAL CASE: Tata — also check model_variant table
  if (make.toLowerCase() === 'tata') {
    let q = supabaseClient.from('model_variant').select('ex_showroom_price').eq('make', make).eq('model', model);
    if (variant) q = q.eq('variant', variant);
    const { data: tataPrices } = await q;
    if (tataPrices && tataPrices.length > 0) {
      return tataPrices[0].ex_showroom_price;
    }
  }

  return 700000; // fallback
}

export async function getCustomDepreciationRate(supabaseClient, make, model, fuel_type, transmission) {
  const { data: rules } = await supabaseClient
    .from('used_car_custom_depreciation')
    .select('*')
    .eq('is_active', true);

  if (!rules || rules.length === 0) return null;

  const scored = rules.map(r => {
    let score = 0;
    let matches = true;

    if (r.make && r.make.toLowerCase() === make.toLowerCase()) score += 4;
    else if (r.make) matches = false;

    if (matches && r.model && r.model.toLowerCase() === model.toLowerCase()) score += 3;
    if (matches && r.fuel_type && r.fuel_type === fuel_type) score += 2;
    if (matches && r.transmission && r.transmission === transmission) score += 1;

    return { rule: r, score, matches };
  }).filter(s => s.matches && s.score > 0).sort((a, b) => b.score - a.score);

  return scored.length > 0 ? scored[0].rule.depreciation_percent_per_year / 100 : null;
}

export async function calculateFairValue(supabaseClient, params) {
  const { make, model, variant, year, km_driven, fuel_type, transmission, num_owners, insurance_type } = params;

  const basePrice = await getBasePrice(supabaseClient, make, model, variant);
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  let depreciatedValue = basePrice;

  const customRate = await getCustomDepreciationRate(supabaseClient, make, model, fuel_type, transmission);

  if (customRate !== null) {
    for (let i = 1; i <= age; i++) {
      depreciatedValue *= (1 - customRate);
    }
  } else {
    for (let i = 1; i <= Math.min(age, DEPRECIATION_RATES.length - 1); i++) {
      depreciatedValue *= (1 - DEPRECIATION_RATES[i]);
    }
    if (age > DEPRECIATION_RATES.length - 1) {
      for (let i = DEPRECIATION_RATES.length; i <= age; i++) {
        depreciatedValue *= 0.98;
      }
    }
  }

  const expectedKM = age * 12000;
  const kmDiff = km_driven - expectedKM;
  if (kmDiff > 0) depreciatedValue *= Math.max(0.80, 1 - (kmDiff / expectedKM) * 0.10);
  else if (kmDiff < 0) depreciatedValue *= Math.min(1.08, 1 + (Math.abs(kmDiff) / expectedKM) * 0.05);

  if (fuel_type === "Diesel") depreciatedValue *= (age <= 5 ? 1.08 : 0.95);
  if (fuel_type === "CNG") depreciatedValue *= 0.95;
  if (fuel_type === "Electric") depreciatedValue *= 0.90;
  if (transmission === "Automatic") depreciatedValue *= 1.03;

  if (num_owners === 2) depreciatedValue *= 0.93;
  else if (num_owners === 3) depreciatedValue *= 0.87;
  else if (num_owners >= 4) depreciatedValue *= 0.80;

  if (insurance_type === "Third Party") depreciatedValue *= 0.98;
  else if (insurance_type === "Expired") depreciatedValue *= 0.95;

  const custom_conditions = params.custom_conditions || [];
  for (const cond of custom_conditions) {
    const isBad = cond.is_negative ? cond.checked : !cond.checked;
    if (isBad && cond.depreciation_percent > 0) {
      depreciatedValue *= (1 - cond.depreciation_percent / 100);
    }
  }

  depreciatedValue = Math.max(depreciatedValue, basePrice * 0.08);
  return { fairValue: Math.round(depreciatedValue), basePrice, age };
}

export async function getMarketStats(supabaseClient, make, model, year) {
  const { data: listings } = await supabaseClient
    .from('used_car_listings')
    .select('*')
    .eq('make', make)
    .eq('model', model);

  if (!listings || listings.length === 0) return null;

  const similar = listings.filter(l => Math.abs(l.year - year) <= 2 && l.asking_price > 0);
  if (similar.length === 0) return null;

  const prices = similar.map(l => l.asking_price).sort((a, b) => a - b);
  return {
    count: similar.length,
    min: prices[0],
    max: prices[prices.length - 1],
    avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    listings: similar.slice(0, 5).map(l => ({
      source: l.source, year: l.year, km_driven: l.km_driven, asking_price: l.asking_price,
    })),
  };
}

export function getDecision(sellerPrice, suggestedPurchasePrice) {
  if (!sellerPrice) return "Pending";
  const diffPercent = (sellerPrice - suggestedPurchasePrice) / suggestedPurchasePrice;
  if (diffPercent <= 0) return "Good Deal";
  if (diffPercent <= 0.08) return "Fair Deal";
  return "Overpriced";
}
