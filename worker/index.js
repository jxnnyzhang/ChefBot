/*
 * Cloudflare Worker: Edamam Recipe Search proxy.
 *
 * Holds EDAMAM_APP_ID / EDAMAM_APP_KEY as Worker secrets so they never
 * appear in the static site's source. The browser calls this Worker;
 * this Worker calls Edamam and returns a trimmed-down JSON payload.
 *
 * Responses are cached at Cloudflare's edge (free, built-in Cache API) so
 * repeat searches for the same ingredients don't cost another Edamam call —
 * this matters a lot on Edamam's free plan, which has a very small quota.
 *
 * Deploy: see README.md "Live recipes via Edamam" section.
 */

const ALLOWED_ORIGINS = new Set([
  'https://jxnnyzhang.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
]);

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 hours

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
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    if (!q) {
      return json({ error: 'Missing "q" query parameter' }, 400, origin);
    }

    // Optional total-time filter, e.g. "1-30" for "30 minutes or less".
    // Validated so only a Edamam-shaped range/number can reach the upstream call.
    const time = url.searchParams.get('time') || '';
    const validTime = /^\d{1,3}(-\d{1,3})?\+?$/.test(time) ? time : '';

    // Cache key is independent of Origin/headers so all allowed sites share
    // the same cached entry for the same query.
    const cacheKeyUrl = new URL('https://chefbot-recipe-proxy.internal/recipes');
    cacheKeyUrl.searchParams.set('q', q);
    if (validTime) cacheKeyUrl.searchParams.set('time', validTime);
    const cacheKey = new Request(cacheKeyUrl.toString());
    const cache = caches.default;

    const cachedResp = await cache.match(cacheKey);
    if (cachedResp) {
      const recipes = await cachedResp.json();
      return json({ recipes: recipes }, 200, origin);
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

    // Some Edamam plans reject requests that include Edamam-Account-User at
    // all ("This app does not support users"), so only send it if explicitly
    // configured via the EDAMAM_ACCOUNT_USER secret.
    const edamamHeaders = {};
    if (env.EDAMAM_ACCOUNT_USER) {
      edamamHeaders['Edamam-Account-User'] = env.EDAMAM_ACCOUNT_USER;
    }

    let edamamResp;
    try {
      edamamResp = await fetch(edamamUrl.toString(), { headers: edamamHeaders });
    } catch (err) {
      return json({ error: 'Failed to reach Edamam' }, 502, origin);
    }

    if (!edamamResp.ok) {
      return json({ error: 'Edamam request failed', status: edamamResp.status }, 502, origin);
    }

    const data = await edamamResp.json();
    const recipes = (data.hits || []).slice(0, 6).map((hit) => {
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
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=' + CACHE_TTL_SECONDS }
    });
    ctx.waitUntil(cache.put(cacheKey, toCache));

    return json({ recipes: recipes }, 200, origin);
  }
};
