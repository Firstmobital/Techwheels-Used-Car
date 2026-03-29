// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

async function gemini(prompt: string, schema: object): Promise<unknown> {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
      tools: [{ google_search: {} }],
    }),
  });
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return JSON.parse(text);
}

const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    listings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          make: { type: 'string' },
          model: { type: 'string' },
          variant: { type: 'string' },
          year: { type: 'number' },
          km_driven: { type: 'number' },
          fuel_type: { type: 'string' },
          transmission: { type: 'string' },
          asking_price: { type: 'number' },
          listing_url: { type: 'string' },
          location: { type: 'string' },
          source: { type: 'string' },
        },
      },
    },
    market_stats: {
      type: 'object',
      properties: {
        min_price: { type: 'number' },
        max_price: { type: 'number' },
        avg_price: { type: 'number' },
        count: { type: 'number' },
      },
    },
  },
};

async function handleFetchExShowroomPrice(supabase: ReturnType<typeof createClient>, params: Record<string, string>) {
  const { make, model, variant, fuel_type, transmission } = params;
  const fuelDesc = fuel_type ? ` ${fuel_type}` : '';
  const transDesc = transmission ? ` ${transmission}` : '';
  const variantDesc = variant ? ` ${variant}` : '';

  const prompt = `Search for the current ex-showroom price of ${make} ${model}${variantDesc}${fuelDesc}${transDesc} in India (2024-2025).
IMPORTANT: The car is a ${fuel_type || 'Petrol'} variant${transmission ? ' with ' + transmission + ' transmission' : ''}. Make sure you return the price for the ${fuel_type || 'Petrol'} version, NOT the petrol/base version if a different fuel type is specified (e.g. Electric variants are significantly more expensive than petrol).
Give the most recent ex-showroom price in INR as a number (e.g. 8.5 lakhs = 850000).
Return the make, model, variant, and ex_showroom_price as a number only (no symbols).`;

  const schema = {
    type: 'object',
    properties: {
      make: { type: 'string' },
      model: { type: 'string' },
      variant: { type: 'string' },
      ex_showroom_price: { type: 'number' },
      price_source: { type: 'string' },
    },
  };

  const response = await gemini(prompt, schema) as Record<string, unknown>;

  if (!response.ex_showroom_price) {
    return { error: 'Could not fetch ex-showroom price' };
  }

  const variantToSave = variant || '';
  const { data: existing } = await supabase
    .from('used_car_ex_showroom_prices')
    .select('*')
    .eq('make', make)
    .eq('model', model);

  const matchExact = (existing ?? []).find((e: Record<string, unknown>) => {
    const variantMatch = (e.variant || '') === variantToSave;
    const fuelMatch = !fuel_type || !e.fuel_type || e.fuel_type === fuel_type;
    return variantMatch && fuelMatch;
  });

  if (matchExact) {
    await supabase.from('used_car_ex_showroom_prices').update({ ex_showroom_price: response.ex_showroom_price }).eq('id', matchExact.id);
  } else {
    await supabase.from('used_car_ex_showroom_prices').insert({
      make,
      model,
      variant: variantToSave,
      fuel_type: fuel_type || null,
      ex_showroom_price: response.ex_showroom_price,
    });
  }

  return {
    ex_showroom_price: response.ex_showroom_price,
    price_source: response.price_source || 'Web Search',
    make: response.make || make,
    model: response.model || model,
    variant: response.variant || variantToSave,
  };
}

async function handleScrape(supabase: ReturnType<typeof createClient>) {
  const { data: allSources } = await supabase
    .from('used_car_scrape_sources')
    .select('*')
    .eq('is_active', true);

  if (!allSources || allSources.length === 0) {
    return { message: 'No active sources configured. Add sources in the Sources tab.', saved_to_db: 0 };
  }

  let totalSaved = 0;
  const results = [];

  for (const source of allSources) {
    const prompt = `Search for used car listings on ${source.name} (${source.url}) in Jaipur, India.
Find 10-15 diverse used car listings. For each provide: make, model, variant, year, km_driven, fuel_type (Petrol/Diesel/CNG/Electric/Hybrid), transmission (Manual/Automatic), asking_price in INR as a number (e.g. 5.5 lakhs = 550000), listing_url, location, source name.
Also provide overall market_stats: min_price, max_price, avg_price, count.`;

    const response = await gemini(prompt, LISTING_SCHEMA) as { listings?: Record<string, unknown>[] };
    const listings = response.listings ?? [];
    let sourceSaved = 0;

    for (const l of listings) {
      if (!l.make || !l.model || !l.asking_price) continue;
      await supabase.from('used_car_listings').insert({
        make: l.make, model: l.model, variant: l.variant || '',
        year: l.year || new Date().getFullYear() - 3, km_driven: l.km_driven || 0,
        fuel_type: l.fuel_type || 'Petrol', transmission: l.transmission || 'Manual',
        asking_price: l.asking_price, source: l.source || source.name,
        listing_url: l.listing_url || source.url, location: l.location || 'Jaipur',
        scraped_date: new Date().toISOString(),
      });
      sourceSaved++;
    }

    totalSaved += sourceSaved;
    results.push({ source: source.name, count: sourceSaved });
    await supabase.from('used_car_scrape_sources').update({
      last_scraped: new Date().toISOString(),
      listings_count: sourceSaved,
    }).eq('id', source.id);
  }

  await supabase.from('used_car_scrape_logs').insert({
    scrape_date: new Date().toISOString(),
    listings_saved: totalSaved,
    status: totalSaved > 0 ? 'Success' : 'Partial',
    source: allSources.map((s: Record<string, unknown>) => s.name).join(', '),
  });

  return { message: `Synced ${totalSaved} listings from ${allSources.length} source(s)`, saved_to_db: totalSaved, results };
}

async function handleFetchTargetedMarketData(supabase: ReturnType<typeof createClient>, params: Record<string, unknown>) {
  const { make, model, year } = params;

  const prompt = `Find real-time used car market data for a ${year} ${make} ${model} in Jaipur, India.
Search across platforms like Cars24, CarDekho, OLX, Spinny, etc.
List 10-12 specific listings with source, year, km_driven, fuel_type, transmission, asking_price (INR as a number, e.g. 5.5 lakhs = 550000), listing_url.
Also provide market_stats: min_price, max_price, avg_price, count of similar listings found.`;

  const response = await gemini(prompt, LISTING_SCHEMA) as { listings?: Record<string, unknown>[]; market_stats?: Record<string, number> };
  const listings = response.listings ?? [];
  const stats = response.market_stats ?? {};

  for (const l of listings) {
    if (!l.asking_price) continue;
    await supabase.from('used_car_listings').insert({
      make: l.make || make, model: l.model || model, variant: l.variant || '',
      year: l.year || year, km_driven: l.km_driven || 0,
      fuel_type: l.fuel_type || 'Petrol', transmission: l.transmission || 'Manual',
      asking_price: l.asking_price, source: l.source || 'LLM Search',
      listing_url: l.listing_url || '', location: l.location || 'Jaipur',
      scraped_date: new Date().toISOString(),
    });
  }

  return {
    min: stats.min_price,
    max: stats.max_price,
    avg: stats.avg_price,
    count: stats.count || listings.length,
    listings: listings.slice(0, 10).map(l => ({
      source: l.source, year: l.year, km_driven: l.km_driven, asking_price: l.asking_price,
    })),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action, params } = body;

    let result;

    if (action === 'scrape') {
      result = await handleScrape(supabase);
    } else if (action === 'fetchExShowroomPrice') {
      result = await handleFetchExShowroomPrice(supabase, params);
    } else if (action === 'fetchTargetedMarketData') {
      result = await handleFetchTargetedMarketData(supabase, params);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
