// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash'; // ✅ stable model available to all users

// Step 1: Grounded search (google_search tool) — returns plain text
async function geminiSearch(prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
    }),
  });
  const json = await res.json();
  if (json.error) {
    console.error('Gemini search error:', json.error.code, json.error.message);
    return '';
  }
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  console.log('Gemini search response length:', text.length);
  return text;
}

// Step 2: Structured extraction (responseSchema) — no google_search here
async function geminiExtract(prompt: string, schema: object): Promise<unknown> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  });
  const json = await res.json();
  if (json.error) {
    console.error('Gemini extract error:', json.error.code, json.error.message);
    return {};
  }
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  try { return JSON.parse(text); } catch { return {}; }
}

const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    listings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          make: { type: 'string' }, model: { type: 'string' }, variant: { type: 'string' },
          year: { type: 'number' }, km_driven: { type: 'number' }, fuel_type: { type: 'string' },
          transmission: { type: 'string' }, asking_price: { type: 'number' },
          listing_url: { type: 'string' }, location: { type: 'string' }, source: { type: 'string' },
        },
      },
    },
    market_stats: {
      type: 'object',
      properties: {
        min_price: { type: 'number' }, max_price: { type: 'number' },
        avg_price: { type: 'number' }, count: { type: 'number' },
      },
    },
  },
};

async function handleFetchExShowroomPrice(supabase, params) {
  const { make, model, variant, fuel_type, transmission } = params;

  if (!GEMINI_API_KEY) {
    return { error: 'GEMINI_API_KEY secret is not set in Supabase Edge Function secrets.' };
  }

  const variantDesc = variant ? ` ${variant}` : '';
  const fuelDesc = fuel_type ? ` ${fuel_type}` : '';

  // Step 1: search with grounding
  const searchPrompt = `What is the current ex-showroom price of ${make} ${model}${variantDesc}${fuelDesc} in India in 2024-2025? Give the exact price in rupees.`;
  const searchResult = await geminiSearch(searchPrompt);

  if (!searchResult) {
    return { error: 'Gemini API call failed. Check edge function logs for the exact error.' };
  }

  // Step 2: extract structured number from search result
  const extractPrompt = `Based on this information:
"${searchResult.slice(0, 2000)}"

Extract the ex-showroom price for ${make} ${model}${variantDesc}${fuelDesc} in India.
Return ex_showroom_price as a plain number in INR (e.g. 8.5 lakhs = 850000).`;

  const schema = {
    type: 'object',
    properties: {
      make: { type: 'string' }, model: { type: 'string' }, variant: { type: 'string' },
      ex_showroom_price: { type: 'number' }, price_source: { type: 'string' },
    },
    required: ['ex_showroom_price'],
  };

  const response = await geminiExtract(extractPrompt, schema) as Record<string, unknown>;
  console.log('Extracted price:', JSON.stringify(response));

  if (!response.ex_showroom_price || Number(response.ex_showroom_price) < 10000) {
    return { error: 'Could not parse price from search results.' };
  }

  const variantToSave = variant || '';
  const { data: existing } = await supabase
    .from('used_car_ex_showroom_prices').select('*').eq('make', make).eq('model', model);

  const matchExact = (existing ?? []).find((e) =>
    (e.variant || '') === variantToSave && (!fuel_type || !e.fuel_type || e.fuel_type === fuel_type)
  );

  if (matchExact) {
    await supabase.from('used_car_ex_showroom_prices')
      .update({ ex_showroom_price: response.ex_showroom_price }).eq('id', matchExact.id);
  } else {
    await supabase.from('used_car_ex_showroom_prices').insert({
      make, model, variant: variantToSave, fuel_type: fuel_type || null,
      ex_showroom_price: response.ex_showroom_price,
    });
  }

  return {
    ex_showroom_price: response.ex_showroom_price,
    price_source: response.price_source || 'Google Search via Gemini',
    make: response.make || make, model: response.model || model, variant: response.variant || variantToSave,
  };
}

async function handleScrape(supabase) {
  const { data: allSources } = await supabase
    .from('used_car_scrape_sources').select('*').eq('is_active', true);

  if (!allSources || allSources.length === 0) {
    return { message: 'No active sources configured.', saved_to_db: 0 };
  }

  let totalSaved = 0;
  const results = [];

  for (const source of allSources) {
    const searchPrompt = `Search for 10-15 used car listings on ${source.name} (${source.url}) in Jaipur, India. List make, model, year, km driven, fuel type, transmission, asking price for each.`;
    const searchResult = await geminiSearch(searchPrompt);
    if (!searchResult) continue;

    const extractPrompt = `Based on these used car listings:
"${searchResult.slice(0, 3000)}"
Extract all listings. Asking prices in INR as plain numbers (5.5 lakhs = 550000).`;

    const response = await geminiExtract(extractPrompt, LISTING_SCHEMA) as { listings?: Record<string, unknown>[] };
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
      last_scraped: new Date().toISOString(), listings_count: sourceSaved,
    }).eq('id', source.id);
  }

  await supabase.from('used_car_scrape_logs').insert({
    scrape_date: new Date().toISOString(), listings_saved: totalSaved,
    status: totalSaved > 0 ? 'Success' : 'Partial',
    source: allSources.map((s) => s.name).join(', '),
  });

  return { message: `Synced ${totalSaved} listings from ${allSources.length} source(s)`, saved_to_db: totalSaved, results };
}

async function handleFetchTargetedMarketData(supabase, params) {
  const { make, model, year } = params;

  const searchPrompt = `Find 10-12 used car listings for ${year} ${make} ${model} in Jaipur, India on Cars24, CarDekho, OLX, Spinny. List source, year, km driven, fuel type, transmission, asking price.`;
  const searchResult = await geminiSearch(searchPrompt);
  if (!searchResult) return { market_stats: null };

  const extractPrompt = `Based on these listings:
"${searchResult.slice(0, 3000)}"
Extract all listings and market stats. Asking prices in INR as plain numbers.`;

  const response = await geminiExtract(extractPrompt, LISTING_SCHEMA) as { listings?: Record<string, unknown>[]; market_stats?: Record<string, number> };
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
    market_stats: {
      min: stats.min_price, max: stats.max_price, avg: stats.avg_price,
      count: stats.count || listings.length,
      listings: listings.slice(0, 10).map(l => ({
        source: l.source, year: l.year, km_driven: l.km_driven, asking_price: l.asking_price,
      })),
    }
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
    if (action === 'scrape') result = await handleScrape(supabase);
    else if (action === 'fetchExShowroomPrice') result = await handleFetchExShowroomPrice(supabase, params);
    else if (action === 'fetchTargetedMarketData') result = await handleFetchTargetedMarketData(supabase, params);
    else return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
});