# ChefBot

ChefBot is a small recipe-finding chatbot. The site itself is fully static — no build step — so it hosts directly on GitHub Pages. Live recipe search is powered by the Edamam Recipe API through a small Cloudflare Worker proxy (see below); ChefBot works without it too, using a local recipe dataset as a fallback.

## How it works

- `index.html` — the page, including the chat widget and the Discover (Trending / Editor's Picks) tabs.
- `about.html` — the about page.
- `chatbot.js` — all of the chatbot logic:
  - **Small talk**: recognizes greetings ("hi", "hello"), identity questions ("who are you?"), capability questions ("what do you do?"), thanks, and goodbyes.
  - **Recipe matching**: everything else is treated as a list of ingredients, plus optional time/complexity constraints ("a quick 20 min recipe", "something simple"). Ingredients are normalized (plurals, common synonyms like "tomatoes" → "tomato").
  - If `EDAMAM_PROXY_URL` at the top of `chatbot.js` is set, ChefBot queries the Worker proxy for live Edamam results first, matching returned ingredient lines against what you listed and, when a time budget was given, filtering server-side via Edamam's own `time` parameter.
  - If the proxy isn't configured (or the request fails/times out), ChefBot falls back to a small hand-curated local dataset, matched with fuzzy string matching (Levenshtein distance) so small typos like "chiken" still match "chicken".
  - **"Show me more"**: each search fetches a larger pool than it displays; asking for more options ("something else", "give me more") serves the next round from that same pool — no extra Edamam call for the first couple of rounds.
  - **"Tell me more"**: each recipe card expands in place to show remaining ingredients, servings, and step-by-step instructions — real written steps for local recipes, or a best-effort live extraction (see below) for Edamam results.
- `worker/index.js` — the Cloudflare Worker. Three actions, routed by query param:
  - `?q=...` — recipe search (as above). Cached 6h per query.
  - `?homepage=1` — trending + editor's-picks pool for the homepage Discover tabs, refreshed daily and cached 24h so it costs about one shared Edamam call per day regardless of visitor count. "Editor's Picks" filters results client-side against a list of well-known food publishers (Edamam has no publisher filter of its own), so it can legitimately come up short some days.
  - `?extract=<url>` — best-effort step-by-step instructions scraped from the recipe's own page (schema.org `Recipe` JSON-LD). No Edamam quota cost, cached 7 days per URL. **Many larger publishers (NYT Cooking, AllRecipes, Bon Appétit, etc.) block automated requests and will return no steps** — this is bot-protection on their end, not a bug here. It works well for smaller/independent food blogs. When it comes back empty, ChefBot says so honestly and points to the source link instead.
  
  It holds the Edamam credentials as Worker secrets so they never appear in this repo or in the site's source.

## Live recipes via Edamam

GitHub Pages can only serve static files — it can't hide a secret. Any API key placed directly in `chatbot.js` would be visible to anyone who opens dev tools. The Worker in `worker/` solves this: it's a separate, tiny piece of server-side code (free to run) that holds your Edamam credentials, and the browser talks to *it* instead of Edamam directly.

**1. Get Edamam credentials**
- Sign up free at [developer.edamam.com](https://developer.edamam.com), create an application for the **Recipe Search API**, and note your Application ID and Application Key.

**2. Deploy the Worker** (free Cloudflare account required)
```
npm install -g wrangler
cd worker
wrangler login
wrangler deploy
wrangler secret put EDAMAM_APP_ID
wrangler secret put EDAMAM_APP_KEY
```
`wrangler deploy` prints your Worker's URL, something like `https://chefbot-recipe-proxy.<your-subdomain>.workers.dev`.

**3. Point the site at it**

In `chatbot.js`, set:
```js
var EDAMAM_PROXY_URL = 'https://chefbot-recipe-proxy.<your-subdomain>.workers.dev';
```

**4. Update allowed origins**

`worker/index.js` only accepts requests from an allow-list (`ALLOWED_ORIGINS`) to stop other sites from riding on your Edamam quota. It's pre-set to `https://jxnnyzhang.github.io` and `http://localhost:8000` — update it if your Pages URL differs.

Commit and push; the live site will now show real Edamam recipes when available, still falling back to the local dataset if the Worker is ever unreachable.

## Running locally

Just open `index.html` in a browser, or serve the folder with any static file server, e.g.:

```
python3 -m http.server 8000
```

then visit `http://localhost:8000`.

## Deploying to GitHub Pages

1. Push to the `main` branch.
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. If a custom domain is set under "Custom domain", clear it unless you own and control that domain — a stale custom domain there will make GitHub try to redirect to it instead of serving the site.
5. Your site will be published at `https://<username>.github.io/<repo>/`.

## Extending the recipe dataset

To add recipes, edit the `RECIPES` array at the top of `chatbot.js`. Each entry needs a `name`, `time`, `popularity` (rough 1-10 ranking used for tie-breaking), `ingredients` (array of normalized ingredient names), and short `instructions`. An optional `link` can point to a full external recipe.
