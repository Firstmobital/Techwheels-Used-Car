import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const DEPRECIATION_RATES = [0, 0.15, 0.12, 0.10, 0.09, 0.08, 0.07, 0.06, 0.05, 0.05, 0.04, 0.04, 0.03, 0.03, 0.03, 0.02];

async function getCustomDepreciationRate(base44, make, model, fuel_type, transmission) {
  const rules = await base44.asServiceRole.entities.CustomDepreciation.filter({ is_active: true });
  
  // Sort by specificity (most specific first)
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

async function getBasePrice(base44, make, model, variant) {
  const entries = await base44.asServiceRole.entities.ExShowroomPrice.filter({ make, model });
  if (entries.length === 0) return 700000; // fallback
  // prefer variant match if available
  if (variant) {
    const variantMatch = entries.find(e => e.variant && e.variant.toLowerCase() === variant.toLowerCase());
    if (variantMatch) return variantMatch.ex_showroom_price;
  }
  // fallback to first make+model match (lowest price / base variant)
  return entries[0].ex_showroom_price;
}

async function calculateFairValue(base44, params) {
  const { make, model, variant, year, km_driven, fuel_type, transmission, num_owners, insurance_type } = params;

  const basePrice = await getBasePrice(base44, make, model, variant);
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;

  let depreciatedValue = basePrice;
  
  // Try to get custom depreciation rate
  const customRate = await getCustomDepreciationRate(base44, make, model, fuel_type, transmission);
  
  if (customRate !== null) {
    // Apply custom depreciation rate
    for (let i = 1; i <= age; i++) {
      depreciatedValue *= (1 - customRate);
    }
  } else {
    // Fall back to default depreciation rates
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

  // Apply custom conditions
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


async function getMarketStats(base44, make, model, year) {
  const listings = await base44.asServiceRole.entities.CarListing.filter({ make, model });
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

const LISTING_SCHEMA = {
  type: "object",
  properties: {
    listings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          make: { type: "string" }, model: { type: "string" }, variant: { type: "string" },
          year: { type: "number" }, km_driven: { type: "number" }, fuel_type: { type: "string" },
          transmission: { type: "string" }, asking_price: { type: "number" },
          listing_url: { type: "string" }, location: { type: "string" }, source: { type: "string" }
        }
      }
    },
    market_stats: {
      type: "object",
      properties: {
        min_price: { type: "number" }, max_price: { type: "number" },
        avg_price: { type: "number" }, count: { type: "number" }
      }
    }
  }
};

async function handleScrape(base44) {
  const allSources = await base44.asServiceRole.entities.ScrapeSource.filter({ is_active: true });

  if (allSources.length === 0) {
    return { message: "No active sources configured. Add sources in the Sources tab.", saved_to_db: 0 };
  }

  let totalSaved = 0;
  const results = [];

  for (const source of allSources) {
    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Search for used car listings on ${source.name} (${source.url}) in Jaipur, India.
Find 10-15 diverse used car listings. For each provide: make, model, variant, year, km_driven, fuel_type (Petrol/Diesel/CNG/Electric/Hybrid), transmission (Manual/Automatic), asking_price in INR as a number (e.g. 5.5 lakhs = 550000), listing_url, location, source name.
Also provide overall market_stats: min_price, max_price, avg_price, count.`,
      add_context_from_internet: true,
      response_json_schema: LISTING_SCHEMA,
    });

    const listings = response.listings || [];
    let sourceSaved = 0;
    for (const l of listings) {
      if (!l.make || !l.model || !l.asking_price) continue;
      await base44.asServiceRole.entities.CarListing.create({
        make: l.make, model: l.model, variant: l.variant || "",
        year: l.year || new Date().getFullYear() - 3, km_driven: l.km_driven || 0,
        fuel_type: l.fuel_type || "Petrol", transmission: l.transmission || "Manual",
        asking_price: l.asking_price, source: l.source || source.name,
        listing_url: l.listing_url || source.url, location: l.location || "Jaipur",
        scraped_date: new Date().toISOString(),
      });
      sourceSaved++;
    }
    totalSaved += sourceSaved;
    results.push({ source: source.name, count: sourceSaved });
    await base44.asServiceRole.entities.ScrapeSource.update(source.id, {
      last_scraped: new Date().toISOString(), listings_count: sourceSaved,
    });
  }

  await base44.asServiceRole.entities.ScrapeLog.create({
    scrape_date: new Date().toISOString(), listings_saved: totalSaved,
    status: totalSaved > 0 ? "Success" : "Partial",
    source: allSources.map(s => s.name).join(", "),
  });

  return { message: `Synced ${totalSaved} listings from ${allSources.length} source(s)`, saved_to_db: totalSaved, results };
}

async function handleFetchExShowroomPrice(base44, make, model, variant, fuel_type, transmission) {
  const fuelDesc = fuel_type ? ` ${fuel_type}` : "";
  const transDesc = transmission ? ` ${transmission}` : "";
  const variantDesc = variant ? ` ${variant}` : "";
  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Search for the current ex-showroom price of ${make} ${model}${variantDesc}${fuelDesc}${transDesc} in India (2024-2025).
IMPORTANT: The car is a ${fuel_type || "Petrol"} variant${transmission ? " with " + transmission + " transmission" : ""}. Make sure you return the price for the ${fuel_type || "Petrol"} version, NOT the petrol/base version if a different fuel type is specified (e.g. Electric variants are significantly more expensive than petrol).
Give the most recent ex-showroom price in INR as a number (e.g. 8.5 lakhs = 850000). 
Return the make, model, variant, and ex_showroom_price as a number only (no symbols).`,
    add_context_from_internet: true,
    response_json_schema: {
      type: "object",
      properties: {
        make: { type: "string" },
        model: { type: "string" },
        variant: { type: "string" },
        ex_showroom_price: { type: "number" },
        price_source: { type: "string" },
      }
    }
  });

  if (!response.ex_showroom_price) {
    return { error: "Could not fetch ex-showroom price" };
  }

  // Save or update in ExShowroomPrice entity — key by make+model+variant+fuel_type
  const existing = await base44.asServiceRole.entities.ExShowroomPrice.filter({ make, model });
  const variantToSave = variant || "";
  // Try to match on variant + fuel_type if possible
  const matchExact = existing.find(e => {
    const variantMatch = (e.variant || "") === variantToSave;
    const fuelMatch = !fuel_type || !e.fuel_type || e.fuel_type === fuel_type;
    return variantMatch && fuelMatch;
  });

  if (matchExact) {
    await base44.asServiceRole.entities.ExShowroomPrice.update(matchExact.id, {
      ex_showroom_price: response.ex_showroom_price,
    });
  } else {
    await base44.asServiceRole.entities.ExShowroomPrice.create({
      make,
      model,
      variant: variantToSave,
      ex_showroom_price: response.ex_showroom_price,
    });
  }

  return {
    ex_showroom_price: response.ex_showroom_price,
    price_source: response.price_source || "Web Search",
    make: response.make || make,
    model: response.model || model,
    variant: response.variant || variantToSave,
  };
}

async function handleFetchTargetedMarketData(base44, make, model, year) {
  const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Find real-time used car market data for a ${year} ${make} ${model} in Jaipur, India.
Search across platforms like Cars24, CarDekho, OLX, Spinny, etc.
List 10-12 specific listings with source, year, km_driven, fuel_type, transmission, asking_price (INR as a number, e.g. 5.5 lakhs = 550000), listing_url.
Also provide market_stats: min_price, max_price, avg_price, count of similar listings found.`,
    add_context_from_internet: true,
    response_json_schema: LISTING_SCHEMA,
  });

  const listings = response.listings || [];
  const stats = response.market_stats || {};

  for (const l of listings) {
    if (!l.asking_price) continue;
    await base44.asServiceRole.entities.CarListing.create({
      make: l.make || make, model: l.model || model, variant: l.variant || "",
      year: l.year || year, km_driven: l.km_driven || 0,
      fuel_type: l.fuel_type || "Petrol", transmission: l.transmission || "Manual",
      asking_price: l.asking_price, source: l.source || "LLM Search",
      listing_url: l.listing_url || "", location: l.location || "Jaipur",
      scraped_date: new Date().toISOString(),
    });
  }

  return {
    market_stats: {
      min: stats.min_price, max: stats.max_price, avg: stats.avg_price,
      count: stats.count || listings.length,
      listings: listings.slice(0, 10).map(l => ({
        source: l.source, year: l.year, km_driven: l.km_driven, asking_price: l.asking_price,
      })),
    }
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, params, sourceIds } = body;

    if (action === "scrape") {
      const result = await handleScrape(base44);
      return Response.json(result);
    }

    if (action === "fetchExShowroomPrice") {
      const { make, model, variant, fuel_type, transmission } = params;
      const result = await handleFetchExShowroomPrice(base44, make, model, variant, fuel_type, transmission);
      return Response.json(result);
    }

    if (action === "fetchTargetedMarketData") {
      const { make, model, year } = params;
      const result = await handleFetchTargetedMarketData(base44, make, model, year);
      return Response.json(result);
    }

    if (action === "calculate") {
      const { fairValue, basePrice, age } = await calculateFairValue(base44, params);
      const suggestedPurchasePrice = Math.round(fairValue / 1.10);
      const marketStats = await getMarketStats(base44, params.make, params.model, params.year);

      let decision = "Pending";
      if (params.seller_asking_price) {
        const diffPercent = (params.seller_asking_price - suggestedPurchasePrice) / suggestedPurchasePrice;
        if (diffPercent <= 0) decision = "Good Deal";
        else if (diffPercent <= 0.08) decision = "Fair Deal";
        else decision = "Overpriced";
      }

      return Response.json({
        fair_value: fairValue,
        suggested_purchase_price: suggestedPurchasePrice,
        decision,
        breakdown: { base_price_used: basePrice, age_years: age },
        market_stats: marketStats,
      });
    }

    return Response.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});