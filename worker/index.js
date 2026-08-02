/*
 * Cloudflare Worker: Edamam Recipe Search proxy + supporting endpoints.
 *
 * Holds EDAMAM_APP_ID / EDAMAM_APP_KEY as Worker secrets so they never
 * appear in the static site's source. The browser calls this Worker;
 * this Worker calls Edamam and returns a trimmed-down JSON payload.
 *
 * Three actions, routed by query param:
 *   ?q=...[&time=1-30]   Recipe search (existing). Cached 6h per query.
 *   ?homepage=1          Daily trending + editor's-picks pool for the
 *                         homepage. A few pooled Edamam calls/day (one per
 *                         rotating search term), cached 24h and shared by
 *                         all visitors, filtered down to reputable food
 *                         media sources.
 *   ?extract=<url>        Best-effort step-by-step instructions scraped
 *                         from the recipe's own page (schema.org JSON-LD).
 *                         No Edamam quota cost. Cached 7 days per URL.
 *
 * Deploy: see README.md "Live recipes via Edamam" section.
 */

const ALLOWED_ORIGINS = new Set([
  'https://jxnnyzhang.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
]);

const SEARCH_CACHE_TTL = 6 * 60 * 60; // 6 hours
const HOMEPAGE_CACHE_TTL = 24 * 60 * 60; // 1 day
const EXTRACT_CACHE_TTL = 7 * 24 * 60 * 60; // 1 week

const HOMEPAGE_QUERY_TERMS = ['dinner', 'chicken', 'pasta', 'salad', 'dessert', 'soup', 'breakfast', 'vegetarian', 'seafood', 'baking'];

// "Editor's Picks" — a small tier of especially well-regarded food publishers.
// Edamam has no publisher filter of its own, so this is matched client-side
// against the `source` field on whatever the daily queries happen to return;
// it can legitimately come up short some days if none of those hits.
const PRESTIGE_SOURCES = [
  'nyt cooking', 'new york times', 'bon appetit', 'bon appétit', 'serious eats',
  'food network', 'epicurious', 'food & wine', 'saveur', 'martha stewart',
  'smitten kitchen', "america's test kitchen", "cook's illustrated"
];

// "Trending" — a wider tier of recognizable, professionally edited food
// media, used to keep the general trending picks looking appetizing rather
// than pulling in random user-submitted recipes from aggregator sites.
// Includes everything in PRESTIGE_SOURCES plus more mainstream outlets.
const REPUTABLE_SOURCES = PRESTIGE_SOURCES.concat([
  'the kitchn', 'washington post', 'los angeles times', 'the guardian',
  'bbc good food', 'bbc food', 'delish', 'food52', 'simply recipes',
  'allrecipes', 'taste of home', 'eatingwell', 'cooking light',
  'southern living', 'real simple', 'better homes', 'the spruce eats',
  'once upon a chef', 'bon app'
]);

function matchesSource(source, list) {
  if (!source) return false;
  const s = String(source).toLowerCase();
  return list.some((t) => s.indexOf(t) > -1);
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://jxnnyzhang.github.io',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin'
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders(origin))
  });
}

function edamamHeadersFor(env) {
  // Some Edamam plans reject requests that include Edamam-Account-User at
  // all ("This app does not support users"), so only send it if explicitly
  // configured via the EDAMAM_ACCOUNT_USER secret.
  const headers = {};
  if (env.EDAMAM_ACCOUNT_USER) headers['Edamam-Account-User'] = env.EDAMAM_ACCOUNT_USER;
  return headers;
}

// ---------------------------------------------------------------------
// Recipe search (existing behavior)
// ---------------------------------------------------------------------
async function handleSearch(url, env, ctx, origin) {
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  if (!q) return json({ error: 'Missing "q" query parameter' }, 400, origin);

  const time = url.searchParams.get('time') || '';
  const validTime = /^\d{1,3}(-\d{1,3})?\+?$/.test(time) ? time : '';

  const cacheKeyUrl = new URL('https://chefbot-recipe-proxy.internal/recipes');
  cacheKeyUrl.searchParams.set('q', q);
  if (validTime) cacheKeyUrl.searchParams.set('time', validTime);
  const cacheKey = new Request(cacheKeyUrl.toString());
  const cache = caches.default;

  const cachedResp = await cache.match(cacheKey);
  if (cachedResp) {
    return json({ recipes: await cachedResp.json() }, 200, origin);
  }

  if (!env.EDAMAM_APP_ID || !env.EDAMAM_APP_KEY) {
    return json({ error: 'Worker is not configured with Edamam credentials' }, 500, origin);
  }

  const edamamUrl = new URL('https://api.edamam.com/api/recipes/v2');
  edamamUrl.searchParams.set('type', 'public');
  edamamUrl.searchParams.set('q', q);
  edamamUrl.searchParams.set('app_id', env.EDAMAM_APP_ID);
  edamamUrl.searchParams.set('app_key', env.EDAMAM_APP_KEY);
  if (validTime) edamamUrl.searchParams.set('time', validTime);

  let edamamResp;
  try {
    edamamResp = await fetch(edamamUrl.toString(), { headers: edamamHeadersFor(env) });
  } catch (err) {
    return json({ error: 'Failed to reach Edamam' }, 502, origin);
  }
  if (!edamamResp.ok) {
    return json({ error: 'Edamam request failed', status: edamamResp.status }, 502, origin);
  }

  const data = await edamamResp.json();
  // Sliced to 9 (not 3) so "show me more" can serve two extra rounds from
  // the same cached batch before ever needing another Edamam call.
  const recipes = (data.hits || []).slice(0, 9).map((hit) => {
    const r = hit.recipe || {};
    return {
      name: r.label,
      url: r.url,
      time: r.totalTime,
      servings: r.yield,
      source: r.source,
      ingredients: r.ingredientLines || []
    };
  });

  const toCache = new Response(JSON.stringify(recipes), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + SEARCH_CACHE_TTL }
  });
  ctx.waitUntil(cache.put(cacheKey, toCache));

  return json({ recipes: recipes }, 200, origin);
}

// ---------------------------------------------------------------------
// Homepage trending + editor's picks (one shared Edamam call per day)
// ---------------------------------------------------------------------
async function handleHomepage(env, ctx, origin) {
  const day = Math.floor(Date.now() / 86400000);
  const cacheKeyUrl = new URL('https://chefbot-recipe-proxy.internal/homepage-v2');
  cacheKeyUrl.searchParams.set('day', String(day));
  const cacheKey = new Request(cacheKeyUrl.toString());
  const cache = caches.default;

  const cachedResp = await cache.match(cacheKey);
  if (cachedResp) return json(await cachedResp.json(), 200, origin);

  if (!env.EDAMAM_APP_ID || !env.EDAMAM_APP_KEY) {
    return json({ error: 'Worker is not configured with Edamam credentials' }, 500, origin);
  }

  // Pool a few different searches (rotating daily) so there's enough variety
  // left after filtering down to reputable/prestige sources.
  const n = HOMEPAGE_QUERY_TERMS.length;
  const start = (day * 3) % n;
  const terms = [HOMEPAGE_QUERY_TERMS[start], HOMEPAGE_QUERY_TERMS[(start + 1) % n], HOMEPAGE_QUERY_TERMS[(start + 2) % n]];

  let hits = [];
  for (const term of terms) {
    const edamamUrl = new URL('https://api.edamam.com/api/recipes/v2');
    edamamUrl.searchParams.set('type', 'public');
    edamamUrl.searchParams.set('q', term);
    edamamUrl.searchParams.set('app_id', env.EDAMAM_APP_ID);
    edamamUrl.searchParams.set('app_key', env.EDAMAM_APP_KEY);
    try {
      const resp = await fetch(edamamUrl.toString(), { headers: edamamHeadersFor(env) });
      if (resp.ok) {
        const d = await resp.json();
        hits = hits.concat(d.hits || []);
      }
    } catch (err) {
      // skip this term, keep going with whatever else we got
    }
  }

  if (hits.length === 0) {
    return json({ error: 'Failed to reach Edamam' }, 502, origin);
  }

  const seenUrls = new Set();
  const mapped = [];
  hits.forEach((hit) => {
    const r = hit.recipe || {};
    if (!r.label || !r.image || !r.url) return;
    if (seenUrls.has(r.url)) return;
    seenUrls.add(r.url);
    mapped.push({ name: r.label, image: r.image, url: r.url, source: r.source, time: r.totalTime });
  });

  const editorsPicks = mapped.filter((r) => matchesSource(r.source, PRESTIGE_SOURCES)).slice(0, 3);
  const editorsUrls = new Set(editorsPicks.map((r) => r.url));
  const trending = mapped
    .filter((r) => matchesSource(r.source, REPUTABLE_SOURCES) && !editorsUrls.has(r.url))
    .slice(0, 3);

  const payload = { trending: trending, editorsPicks: editorsPicks, terms: terms };

  const toCache = new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + HOMEPAGE_CACHE_TTL }
  });
  ctx.waitUntil(cache.put(cacheKey, toCache));

  return json(payload, 200, origin);
}

// ---------------------------------------------------------------------
// Step-by-step instruction extraction (schema.org Recipe JSON-LD)
// ---------------------------------------------------------------------

// Some sites embed raw HTML entities/tags inside their JSON-LD text fields.
// Decode + strip here so the client only ever gets clean plain text (which
// it then escapes itself before rendering).
function cleanStepText(str) {
  return String(str)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&(#39|apos);/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeInstructions(ri) {
  if (!ri) return null;
  if (typeof ri === 'string') {
    const steps = ri.split(/\r?\n+/).map(cleanStepText).filter(Boolean);
    return steps.length ? steps : null;
  }
  if (Array.isArray(ri)) {
    const steps = [];
    ri.forEach((item) => {
      if (typeof item === 'string') {
        steps.push(cleanStepText(item));
      } else if (item && typeof item === 'object') {
        if (item.text) steps.push(cleanStepText(item.text));
        else if (item.name) steps.push(cleanStepText(item.name));
        if (Array.isArray(item.itemListElement)) {
          item.itemListElement.forEach((sub) => {
            if (typeof sub === 'string') steps.push(cleanStepText(sub));
            else if (sub && sub.text) steps.push(cleanStepText(sub.text));
          });
        }
      }
    });
    const cleaned = steps.filter(Boolean);
    return cleaned.length ? cleaned : null;
  }
  return null;
}

function findRecipeNode(data) {
  const nodes = Array.isArray(data) ? data : (data && Array.isArray(data['@graph']) ? data['@graph'] : [data]);
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || !node['@type']) continue;
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    if (types.some((t) => String(t).toLowerCase() === 'recipe')) return node;
  }
  return null;
}

async function extractStepsFromPage(pageUrl) {
  let resp;
  try {
    resp = await fetch(pageUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChefBotExtractor/1.0)' },
      redirect: 'follow'
    });
  } catch (err) {
    return null;
  }
  if (!resp.ok) return null;

  const html = await resp.text();
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRe.exec(html)) !== null) {
    let data;
    try {
      data = JSON.parse(m[1].trim());
    } catch (err) {
      continue;
    }
    const recipeNode = findRecipeNode(data);
    if (recipeNode) {
      const steps = normalizeInstructions(recipeNode.recipeInstructions);
      if (steps) return steps;
    }
  }
  return null;
}

async function handleExtract(url, env, ctx, origin) {
  const target = url.searchParams.get('extract') || '';
  if (!/^https?:\/\//.test(target)) {
    return json({ error: 'Invalid or missing "extract" URL' }, 400, origin);
  }

  const cacheKey = new Request('https://chefbot-recipe-proxy.internal/extract-v2?u=' + encodeURIComponent(target));
  const cache = caches.default;
  const cachedResp = await cache.match(cacheKey);
  if (cachedResp) return json({ steps: await cachedResp.json() }, 200, origin);

  const steps = await extractStepsFromPage(target);

  const toCache = new Response(JSON.stringify(steps), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + EXTRACT_CACHE_TTL }
  });
  ctx.waitUntil(cache.put(cacheKey, toCache));

  return json({ steps: steps }, 200, origin);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    const url = new URL(request.url);

    if (url.searchParams.get('homepage')) {
      return handleHomepage(env, ctx, origin);
    }
    if (url.searchParams.has('extract')) {
      return handleExtract(url, env, ctx, origin);
    }
    return handleSearch(url, env, ctx, origin);
  }
};
