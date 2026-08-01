/*
 * Cloudflare Worker: Edamam Recipe Search proxy.
 *
 * Holds EDAMAM_APP_ID / EDAMAM_APP_KEY as Worker secrets so they never
 * appear in the static site's source. The browser calls this Worker;
 * this Worker calls Edamam and returns a trimmed-down JSON payload.
 *
 * Deploy: see README.md "Live recipes via Edamam" section.
 */

const ALLOWED_ORIGINS = new Set([
  'https://jxnnyzhang.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
]);

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
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }

    if (request.method !== 'GET') {
      return json({ error: 'Method not allowed' }, 405, origin);
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get('q') || '').trim();
    if (!q) {
      return json({ error: 'Missing "q" query parameter' }, 400, origin);
    }

    if (!env.EDAMAM_APP_ID || !env.EDAMAM_APP_KEY) {
      return json({ error: 'Worker is not configured with Edamam credentials' }, 500, origin);
    }

    const edamamUrl = new URL('https://api.edamam.com/api/recipes/v2');
    edamamUrl.searchParams.set('type', 'public');
    edamamUrl.searchParams.set('q', q);
    edamamUrl.searchParams.set('app_id', env.EDAMAM_APP_ID);
    edamamUrl.searchParams.set('app_key', env.EDAMAM_APP_KEY);

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
        image: r.image,
        url: r.url,
        time: r.totalTime,
        servings: r.yield,
        source: r.source,
        ingredients: r.ingredientLines || []
      };
    });

    return json({ recipes: recipes }, 200, origin);
  }
};
