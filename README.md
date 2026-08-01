# ChefBot

ChefBot is a small recipe-finding chatbot. It runs entirely as a static site — no server, no API keys, no build step — so it can be hosted directly on GitHub Pages.

## How it works

- `index.html` — the page, including the chat widget markup.
- `about.html` — the about page.
- `chatbot.js` — all of the chatbot logic:
  - **Small talk**: recognizes greetings ("hi", "hello"), identity questions ("who are you?"), capability questions ("what do you do?"), thanks, and goodbyes.
  - **Recipe matching**: everything else is treated as a list of ingredients. Ingredients are normalized (plurals, common synonyms like "tomatoes" → "tomato") and matched against a hand-curated recipe dataset using fuzzy string matching (Levenshtein distance), so small typos like "chiken" still match "chicken".
  - Recipes are scored by how many of your ingredients they use and returned as the top 3 matches, each with what you have, what you're missing, and short instructions.

There's no backend and no external API calls, so there are no credentials to manage or expose.

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
