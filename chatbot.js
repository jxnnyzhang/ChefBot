/*
 * ChefBot — a small client-side chatbot.
 * No backend of its own: small talk and ingredient matching run entirely
 * in the browser. Live recipe lookups go through a Cloudflare Worker proxy
 * (see worker/) that holds the Edamam API credentials server-side, so no
 * secret ever ships in this file. If the proxy is unreachable or not yet
 * configured, ChefBot falls back to a small local recipe dataset.
 */
(function () {
  'use strict';

  // Set this to your deployed Worker URL (see README.md "Live recipes via
  // Edamam"). Left as a placeholder, ChefBot just uses the local dataset.
  var EDAMAM_PROXY_URL = 'https://chefbot-recipe-proxy.jennyzhang893.workers.dev';

  function isProxyConfigured() {
    return typeof EDAMAM_PROXY_URL === 'string' && EDAMAM_PROXY_URL.indexOf('YOUR-WORKER-SUBDOMAIN') === -1;
  }

  // ---------------------------------------------------------------------
  // Recipe data (fallback, used when the live API is unavailable)
  // ---------------------------------------------------------------------
  var RECIPES = [
    { name: 'Spaghetti Aglio e Olio', time: '20 min', popularity: 9,
      ingredients: ['spaghetti', 'garlic', 'olive oil', 'red pepper flakes', 'parsley', 'parmesan'],
      instructions: 'Cook spaghetti until al dente. Gently fry sliced garlic in olive oil until golden, add red pepper flakes, then toss with the pasta, parsley, and parmesan.' },
    { name: 'Classic Grilled Cheese', time: '10 min', popularity: 8,
      ingredients: ['bread', 'cheese', 'butter'],
      instructions: 'Butter two slices of bread, add cheese between them, and grill in a pan over medium heat until golden on both sides.' },
    { name: 'Chicken Stir Fry', time: '25 min', popularity: 9,
      ingredients: ['chicken', 'broccoli', 'carrot', 'garlic', 'ginger', 'soy sauce', 'rice'],
      instructions: 'Sear sliced chicken, add garlic and ginger, then broccoli and carrot. Toss with soy sauce and serve over rice.' },
    { name: 'Guacamole', time: '10 min', popularity: 8,
      ingredients: ['avocado', 'lime', 'onion', 'cilantro', 'tomato', 'salt'],
      instructions: 'Mash avocado and mix in lime juice, diced onion, tomato, cilantro, and salt.' },
    { name: 'Fluffy Pancakes', time: '20 min', popularity: 9,
      ingredients: ['flour', 'milk', 'egg', 'butter', 'sugar', 'baking powder'],
      instructions: 'Whisk dry ingredients, mix in milk, egg, and melted butter, then cook spoonfuls on a griddle until bubbly and golden.' },
    { name: 'Vegetable Fried Rice', time: '20 min', popularity: 8,
      ingredients: ['rice', 'egg', 'carrot', 'peas', 'soy sauce', 'onion', 'garlic'],
      instructions: 'Scramble egg and set aside. Stir-fry onion, garlic, carrot, and peas, then add cold rice and soy sauce, folding in the egg at the end.' },
    { name: 'Beef Tacos', time: '25 min', popularity: 9,
      ingredients: ['ground beef', 'tortilla', 'onion', 'tomato', 'cheese', 'lettuce', 'lime'],
      instructions: 'Brown ground beef with onion and taco seasoning, then serve in tortillas topped with tomato, cheese, lettuce, and a squeeze of lime.' },
    { name: 'Caprese Salad', time: '10 min', popularity: 7,
      ingredients: ['tomato', 'mozzarella', 'basil', 'olive oil', 'balsamic vinegar'],
      instructions: 'Layer sliced tomato and mozzarella, top with basil leaves, and drizzle with olive oil and balsamic vinegar.' },
    { name: 'Cheesy Omelette', time: '10 min', popularity: 8,
      ingredients: ['egg', 'cheese', 'butter', 'salt', 'pepper'],
      instructions: 'Whisk eggs with salt and pepper, cook in butter over medium heat, sprinkle with cheese, and fold in half.' },
    { name: 'Banana Bread', time: '65 min', popularity: 8,
      ingredients: ['banana', 'flour', 'sugar', 'egg', 'butter', 'baking soda'],
      instructions: 'Mash bananas and mix with melted butter, sugar, and egg, then fold in flour and baking soda. Bake at 350°F for about 50 minutes.' },
    { name: 'Chocolate Chip Cookies', time: '30 min', popularity: 9,
      ingredients: ['flour', 'butter', 'sugar', 'egg', 'chocolate chips', 'baking soda'],
      instructions: 'Cream butter and sugar, mix in egg, then fold in flour, baking soda, and chocolate chips. Bake at 350°F for 10-12 minutes.' },
    { name: 'Creamy Chicken Alfredo', time: '30 min', popularity: 9,
      ingredients: ['chicken', 'pasta', 'butter', 'garlic', 'parmesan', 'cream'],
      instructions: 'Cook pasta. Sear chicken and set aside. Make a sauce with butter, garlic, cream, and parmesan, then toss with pasta and sliced chicken.' },
    { name: 'Vegetable Curry', time: '35 min', popularity: 7,
      ingredients: ['potato', 'carrot', 'onion', 'garlic', 'ginger', 'curry powder', 'coconut milk'],
      instructions: 'Saute onion, garlic, and ginger, add potato and carrot with curry powder, then simmer in coconut milk until vegetables are tender.' },
    { name: 'Margherita Pizza', time: '30 min', popularity: 8,
      ingredients: ['pizza dough', 'tomato', 'mozzarella', 'basil', 'olive oil'],
      instructions: 'Spread crushed tomato over dough, top with mozzarella, bake at high heat until golden, then finish with fresh basil and olive oil.' },
    { name: 'Caesar Salad', time: '15 min', popularity: 7,
      ingredients: ['lettuce', 'parmesan', 'bread', 'garlic', 'lemon', 'olive oil'],
      instructions: 'Toss torn lettuce with garlicky croutons, parmesan, lemon juice, and olive oil.' },
    { name: 'Tomato Soup', time: '30 min', popularity: 7,
      ingredients: ['tomato', 'onion', 'garlic', 'butter', 'cream'],
      instructions: 'Saute onion and garlic in butter, add tomato and simmer, then blend until smooth and stir in a splash of cream.' },
    { name: 'Mac and Cheese', time: '25 min', popularity: 9,
      ingredients: ['pasta', 'cheese', 'butter', 'flour', 'milk'],
      instructions: 'Make a roux with butter and flour, whisk in milk, melt in cheese, then stir through cooked pasta.' },
    { name: 'Garlic Shrimp Scampi', time: '20 min', popularity: 8,
      ingredients: ['shrimp', 'garlic', 'butter', 'lemon', 'pasta', 'parsley'],
      instructions: 'Saute shrimp in butter and garlic, toss with cooked pasta, lemon juice, and parsley.' },
    { name: 'French Toast', time: '15 min', popularity: 8,
      ingredients: ['bread', 'egg', 'milk', 'cinnamon', 'butter'],
      instructions: 'Whisk egg, milk, and cinnamon, soak bread slices, then pan-fry in butter until golden on both sides.' },
    { name: 'Egg Fried Rice', time: '15 min', popularity: 7,
      ingredients: ['rice', 'egg', 'soy sauce', 'onion', 'peas'],
      instructions: 'Scramble egg, add cooked rice, peas, and onion, and stir-fry with soy sauce until heated through.' },
    { name: 'Black Bean Tacos', time: '20 min', popularity: 7,
      ingredients: ['black beans', 'tortilla', 'corn', 'onion', 'lime', 'cilantro', 'cheese'],
      instructions: 'Warm black beans and corn with onion, spoon into tortillas, and top with lime, cilantro, and cheese.' },
    { name: 'Honey Garlic Salmon', time: '25 min', popularity: 8,
      ingredients: ['salmon', 'honey', 'garlic', 'soy sauce', 'lemon'],
      instructions: 'Whisk honey, garlic, soy sauce, and lemon, pour over salmon, and bake at 400°F for about 15 minutes.' },
    { name: 'Chicken Noodle Soup', time: '40 min', popularity: 8,
      ingredients: ['chicken', 'carrot', 'celery', 'onion', 'noodles', 'garlic'],
      instructions: 'Simmer chicken with onion, carrot, celery, and garlic in broth, then add noodles and cook until tender.' },
    { name: 'Greek Yogurt Parfait', time: '5 min', popularity: 6,
      ingredients: ['yogurt', 'honey', 'banana', 'oats'],
      instructions: 'Layer yogurt with honey, sliced banana, and oats in a glass.' },
    { name: 'Poke Bowl with Pickled Garlic and Seaweed', time: '25 min', popularity: 8,
      ingredients: ['rice', 'salmon', 'garlic', 'seaweed', 'soy sauce', 'cucumber'],
      instructions: 'Serve seasoned rice topped with cubed salmon, pickled garlic, seaweed, and cucumber, drizzled with soy sauce.',
      link: 'https://www.delicious.com.au/recipes/poke-bowl-pickled-garlic-seaweed/ypunS37M' },
    { name: 'Carne Asada with Pico de Gallo', time: '30 min', popularity: 8,
      ingredients: ['beef', 'lime', 'garlic', 'tomato', 'onion', 'cilantro'],
      instructions: 'Marinate beef in lime and garlic, grill and slice thin, then top with a fresh pico de gallo of tomato, onion, and cilantro.',
      link: 'https://www.taste.com.au/recipes/carne-asada-pico-de-gallo/677cae67-5cb9-420e-b4de-3d8088619ccc' }
  ];

  // ---------------------------------------------------------------------
  // Live recipe lookup via the Cloudflare Worker proxy
  // ---------------------------------------------------------------------
  function fetchLiveRecipes(tokens, constraints) {
    if (!isProxyConfigured() || typeof fetch !== 'function') return Promise.resolve(null);

    var hasTokens = tokens.length > 0;
    var query = hasTokens ? tokens.join(' ')
      : (constraints.wantsQuick ? 'quick' : '') + (constraints.wantsSimple ? ' easy' : '');
    query = query.trim() || 'popular';

    var proxyUrl = EDAMAM_PROXY_URL + '?q=' + encodeURIComponent(query);
    if (constraints.maxTime) {
      proxyUrl += '&time=1-' + constraints.maxTime;
    }

    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, 6000);
    var opts = controller ? { signal: controller.signal } : {};

    return fetch(proxyUrl, opts)
      .then(function (resp) {
        if (timer) clearTimeout(timer);
        if (!resp.ok) throw new Error('proxy responded with ' + resp.status);
        return resp.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.recipes)) return null;
        var mapped = data.recipes.map(function (r) {
          var matched = [];
          var missing = [];
          if (hasTokens) {
            (r.ingredients || []).forEach(function (line) {
              var lower = String(line).toLowerCase();
              var hit = tokens.some(function (t) { return fuzzyIncludes(t, lower); });
              (hit ? matched : missing).push(line);
            });
          }
          return {
            name: r.name,
            time: r.time ? Math.round(r.time) + ' min' : null,
            timeMinutes: r.time || null,
            servings: r.servings || null,
            ingredientCount: (r.ingredients || []).length,
            link: r.url,
            source: r.source,
            matched: matched,
            missing: missing
          };
        });
        var candidates = hasTokens ? mapped.filter(function (r) { return r.matched.length > 0; }) : mapped;
        return candidates
          .sort(function (a, b) {
            if (hasTokens && a.matched.length !== b.matched.length) return b.matched.length - a.matched.length;
            if (constraints.wantsSimple && a.ingredientCount !== b.ingredientCount) return a.ingredientCount - b.ingredientCount;
            if (constraints.wantsQuick && (a.timeMinutes || 999) !== (b.timeMinutes || 999)) return (a.timeMinutes || 999) - (b.timeMinutes || 999);
            return 0;
          })
          .slice(0, 3);
      })
      .catch(function () { return null; });
  }

  // ---------------------------------------------------------------------
  // Ingredient normalization
  // ---------------------------------------------------------------------
  var STOPWORDS = ['i', 'have', 'got', 'some', 'a', 'an', 'the', 'and', 'with', 'leftover',
    'my', 'me', 'in', 'fridge', 'pantry', 'left', 'over', 'lots', 'of', 'few', 'extra', 'to', 'use', 'up',
    'want', 'wanna', 'need', 'looking', 'for', 'please', 'can', 'you', 'give', 'suggest', 'find',
    'recipe', 'recipes', 'something', 'anything', 'using', 'make', 'cook', 'cooking', 'dish', 'meal',
    'quick', 'quickly', 'fast', 'rapid', 'simple', 'easy', 'is', 'that', 'min', 'mins', 'minute', 'minutes',
    'under', 'less', 'than', 'around', 'about', 'or'];

  var SYNONYMS = {
    'tomatoes': 'tomato', 'onions': 'onion', 'eggs': 'egg', 'potatoes': 'potato',
    'carrots': 'carrot', 'peppers': 'pepper', 'noodle': 'noodles', 'noodles': 'noodles',
    'chicken breast': 'chicken', 'chicken breasts': 'chicken', 'ground chicken': 'chicken',
    'beef mince': 'ground beef', 'mince': 'ground beef', 'minced beef': 'ground beef',
    'shrimps': 'shrimp', 'prawns': 'shrimp', 'prawn': 'shrimp',
    'lemons': 'lemon', 'limes': 'lime', 'bananas': 'banana', 'avocados': 'avocado',
    'mushrooms': 'mushroom', 'beans': 'black beans', 'cheddar': 'cheese', 'mozzarella cheese': 'mozzarella',
    'spring onion': 'onion', 'scallion': 'onion', 'scallions': 'onion',
    'tortillas': 'tortilla', 'oat': 'oats'
  };

  function normalizeToken(token) {
    var t = token.toLowerCase().trim();
    if (!t) return '';
    if (SYNONYMS[t]) return SYNONYMS[t];
    // naive singularization
    if (t.length > 3 && t.endsWith('ies')) t = t.slice(0, -3) + 'y';
    else if (t.length > 3 && t.endsWith('es') && !t.endsWith('ces')) t = t.slice(0, -2);
    else if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) t = t.slice(0, -1);
    return SYNONYMS[t] || t;
  }

  function extractIngredients(text) {
    var raw = text.toLowerCase()
      .replace(/[^a-z0-9\s,]/g, ' ')
      .split(/,| and | with |\n/);
    var tokens = [];
    raw.forEach(function (chunk) {
      chunk.split(/\s+/).forEach(function (word) {
        word = word.trim();
        if (word && STOPWORDS.indexOf(word) === -1) tokens.push(word);
      });
    });
    // also try to keep two-word phrases (e.g. "ground beef", "soy sauce") intact
    var phrases = [];
    var text2 = ' ' + text.toLowerCase() + ' ';
    Object.keys(SYNONYMS).forEach(function (phrase) {
      if (phrase.indexOf(' ') > -1 && text2.indexOf(' ' + phrase + ' ') > -1) {
        phrases.push(SYNONYMS[phrase]);
      }
    });
    var normalized = tokens.map(normalizeToken).filter(Boolean).filter(function (t) { return !/^\d+$/.test(t); });
    return dedupe(phrases.concat(normalized));
  }

  // ---------------------------------------------------------------------
  // Time / complexity constraints ("quick", "simple", "5 min", "under 20 minutes")
  // ---------------------------------------------------------------------
  function parseConstraints(text) {
    var t = text.toLowerCase();
    var wantsQuick = /\b(quick|quickly|fast|rapid)\b/.test(t);
    var wantsSimple = /\b(simple|easy)\b/.test(t);
    var explicitMatch = t.match(/(\d{1,3})\s*[\s-]*min(?:ute)?s?\b/);
    var maxTime = explicitMatch ? parseInt(explicitMatch[1], 10) : (wantsQuick ? 30 : null);
    return { maxTime: maxTime, wantsQuick: wantsQuick, wantsSimple: wantsSimple };
  }

  function hasConstraints(c) {
    return !!(c.maxTime || c.wantsQuick || c.wantsSimple);
  }

  function parseMinutes(timeStr) {
    if (!timeStr) return null;
    var m = String(timeStr).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function dedupe(arr) {
    var seen = {};
    var out = [];
    arr.forEach(function (x) {
      if (!seen[x]) { seen[x] = true; out.push(x); }
    });
    return out;
  }

  // ---------------------------------------------------------------------
  // Fuzzy matching (Levenshtein distance)
  // ---------------------------------------------------------------------
  function levenshtein(a, b) {
    var m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    var prev = new Array(n + 1);
    var curr = new Array(n + 1);
    for (var j = 0; j <= n; j++) prev[j] = j;
    for (var i = 1; i <= m; i++) {
      curr[0] = i;
      for (var k = 1; k <= n; k++) {
        var cost = a[i - 1] === b[k - 1] ? 0 : 1;
        curr[k] = Math.min(prev[k] + 1, curr[k - 1] + 1, prev[k - 1] + cost);
      }
      var tmp = prev; prev = curr; curr = tmp;
    }
    return prev[n];
  }

  function fuzzyIncludes(userToken, recipeIngredient) {
    if (!userToken) return false;
    if (recipeIngredient.indexOf(userToken) > -1 || userToken.indexOf(recipeIngredient) > -1) return true;
    var words = recipeIngredient.split(' ');
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var tolerance = w.length <= 4 ? 1 : 2;
      if (levenshtein(userToken, w) <= tolerance) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------
  // Recipe search
  // ---------------------------------------------------------------------
  function findRecipes(userTokens, constraints) {
    constraints = constraints || {};
    var hasTokens = userTokens.length > 0;

    var scored = RECIPES.map(function (recipe) {
      var matched = [];
      if (hasTokens) {
        recipe.ingredients.forEach(function (ing) {
          var hit = userTokens.some(function (t) { return fuzzyIncludes(t, ing); });
          if (hit) matched.push(ing);
        });
      }
      var missing = hasTokens ? recipe.ingredients.filter(function (ing) { return matched.indexOf(ing) === -1; }) : [];
      return { recipe: recipe, matched: matched, missing: missing };
    });

    var candidates = hasTokens ? scored.filter(function (s) { return s.matched.length > 0; }) : scored;

    if (constraints.maxTime) {
      var underBudget = candidates.filter(function (s) {
        var mins = parseMinutes(s.recipe.time);
        return mins === null || mins <= constraints.maxTime;
      });
      if (underBudget.length > 0) candidates = underBudget;
    }

    return candidates
      .sort(function (a, b) {
        if (hasTokens && b.matched.length !== a.matched.length) return b.matched.length - a.matched.length;
        if (constraints.wantsSimple && a.recipe.ingredients.length !== b.recipe.ingredients.length) {
          return a.recipe.ingredients.length - b.recipe.ingredients.length;
        }
        if (constraints.wantsQuick || constraints.maxTime) {
          var ma = parseMinutes(a.recipe.time) || 999;
          var mb = parseMinutes(b.recipe.time) || 999;
          if (ma !== mb) return ma - mb;
        }
        return b.recipe.popularity - a.recipe.popularity;
      })
      .slice(0, 3);
  }

  // ---------------------------------------------------------------------
  // Intent detection
  // ---------------------------------------------------------------------
  function detectIntent(text) {
    var t = text.toLowerCase().trim();
    if (!t) return 'empty';
    if (/^(hi|hello|hey|hiya|yo|howdy|sup|good\s?(morning|afternoon|evening))\b/.test(t)) return 'greeting';
    if (/who\s?('?s| is| are)?\s?(you|u)\b|what('?s| is) your name/.test(t)) return 'identity';
    if (/what (do|can) you do|what.*(you )?(help|offer)|how (do|can) (i|you) use (you|this)|how does (this|chefbot) work/.test(t)) return 'capability';
    if (/^thank|thanks/.test(t)) return 'thanks';
    if (/^(bye|goodbye|see ya|see you|later)\b/.test(t)) return 'bye';
    return 'ingredients';
  }

  var GREETINGS = [
    "Hi there! 👋 I'm ChefBot. Tell me what ingredients you have and I'll suggest something to cook.",
    "Hello! Ready to cook something good? List a few ingredients you have on hand."
  ];
  var IDENTITY = "I'm ChefBot 🍳 — a little recipe assistant. List the ingredients you have (like \"chicken, garlic, rice\") and I'll match them to recipes.";
  var CAPABILITY = "I can chat, and I can suggest recipes! Just tell me what's in your fridge or pantry — e.g. \"I have eggs, cheese, and bread\" — and I'll find matching recipes, even if you misspell an ingredient.";
  var THANKS = "You're welcome! Happy cooking 🍽️";
  var BYE = "Bye! Come back anytime you need recipe ideas. 👋";
  var EMPTY = "Say something! You can greet me, ask what I do, or list ingredients you have.";
  var NO_MATCH_INTRO = [
    "I couldn't find a recipe with quite those ingredients.",
    "Hmm, nothing matched those exactly."
  ];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function sampleIngredients() {
    var pool = ['chicken', 'garlic', 'egg', 'rice', 'tomato', 'cheese', 'onion', 'pasta', 'lemon', 'shrimp'];
    var out = [];
    while (out.length < 3) {
      var pick_ = pool[Math.floor(Math.random() * pool.length)];
      if (out.indexOf(pick_) === -1) out.push(pick_);
    }
    return out;
  }

  function textItem(text) { return { type: 'text', text: text }; }

  function hostnameOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return null; }
  }

  function searchLinkFor(name) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(name + ' recipe');
  }

  function recipeItemsFromLocal(results) {
    return results.map(function (r) {
      var hasRealLink = !!r.recipe.link;
      return {
        type: 'recipe',
        recipe: {
          name: r.recipe.name,
          time: r.recipe.time,
          servings: null,
          link: hasRealLink ? r.recipe.link : searchLinkFor(r.recipe.name),
          source: hasRealLink ? hostnameOf(r.recipe.link) : null,
          linkLabel: hasRealLink ? null : 'Search for this recipe',
          matched: r.matched,
          missing: r.missing,
          instructions: r.recipe.instructions
        }
      };
    });
  }

  function recipeItemsFromLive(liveResults) {
    return liveResults.map(function (r) {
      var hasRealLink = !!r.link;
      return {
        type: 'recipe',
        recipe: {
          name: r.name,
          time: r.time,
          servings: r.servings,
          link: hasRealLink ? r.link : searchLinkFor(r.name),
          source: hasRealLink ? (r.source || hostnameOf(r.link)) : null,
          linkLabel: hasRealLink ? null : 'Search for this recipe',
          matched: r.matched,
          missing: r.missing,
          // Edamam's API doesn't include step-by-step directions, only
          // metadata + ingredients, so there's no real instructions text here.
          instructions: null
        }
      };
    });
  }

  function respond(userText) {
    var intent = detectIntent(userText);
    switch (intent) {
      case 'empty': return Promise.resolve([textItem(EMPTY)]);
      case 'greeting': return Promise.resolve([textItem(pick(GREETINGS))]);
      case 'identity': return Promise.resolve([textItem(IDENTITY)]);
      case 'capability': return Promise.resolve([textItem(CAPABILITY)]);
      case 'thanks': return Promise.resolve([textItem(THANKS)]);
      case 'bye': return Promise.resolve([textItem(BYE)]);
      case 'ingredients':
      default:
        var tokens = extractIngredients(userText);
        var constraints = parseConstraints(userText);
        if (tokens.length === 0 && !hasConstraints(constraints)) {
          return Promise.resolve([textItem("I didn't catch any ingredients in that. Try something like \"" + sampleIngredients().join(', ') + '".')]);
        }
        return fetchLiveRecipes(tokens, constraints).then(function (live) {
          if (live && live.length) {
            var intro = live.length === 1 ? "Here's a recipe you can make:" : "Here are a few recipes you can make:";
            return [textItem(intro)].concat(recipeItemsFromLive(live));
          }
          var results = findRecipes(tokens, constraints);
          if (results.length === 0) {
            var suggestion = constraints.maxTime
              ? ' Try a longer time budget, or list a few ingredients you have.'
              : ' Try other ingredients, like "' + sampleIngredients().join(', ') + '", or list a few more things you have.';
            return [textItem(pick(NO_MATCH_INTRO) + suggestion)];
          }
          var intro2 = results.length === 1 ? "Here's a recipe you can make:" : "Here are a few recipes you can make:";
          return [textItem(intro2)].concat(recipeItemsFromLocal(results));
        });
    }
  }

  // ---------------------------------------------------------------------
  // UI wiring
  // ---------------------------------------------------------------------
  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderMessageText(text) {
    // minimal markdown: **bold** and newlines
    var escaped = escapeHtml(text);
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
  }

  function addMessage(container, text, sender) {
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + sender;
    bubble.innerHTML = renderMessageText(text);
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  }

  function isHttpUrl(str) {
    return typeof str === 'string' && /^https?:\/\//.test(str);
  }

  function addRecipeCard(container, recipe) {
    var card = document.createElement('div');
    card.className = 'chat-bubble bot recipe-card';

    var summary = '<strong>' + escapeHtml(recipe.name || 'Recipe') + '</strong>';
    if (recipe.time) summary += ' (' + escapeHtml(recipe.time) + ')';
    summary += '<br>';
    if (recipe.matched && recipe.matched.length) {
      summary += 'Uses what you have: ' + escapeHtml(recipe.matched.join(', ')) + '.';
    }
    card.innerHTML = summary;

    var detailsHtml = '';
    if (recipe.missing && recipe.missing.length) {
      detailsHtml += "You'll also need: " + escapeHtml(recipe.missing.join(', ')) + '.<br>';
    }
    if (recipe.servings) {
      detailsHtml += 'Servings: ' + escapeHtml(String(recipe.servings)) + '<br>';
    }
    if (recipe.instructions) {
      detailsHtml += renderMessageText(recipe.instructions) + '<br>';
    } else if (recipe.source) {
      detailsHtml += "ChefBot's live recipe data doesn't include full step-by-step directions " +
        '&mdash; here\'s everything else ChefBot has. Use the link below for the complete method.<br>';
    }

    var hasLink = isHttpUrl(recipe.link);
    if (detailsHtml || hasLink) {
      var detailsEl = document.createElement('div');
      detailsEl.className = 'recipe-details';
      detailsEl.hidden = true;
      detailsEl.innerHTML = detailsHtml;

      if (hasLink) {
        var label = recipe.linkLabel || (recipe.source ? 'View recipe on ' + recipe.source : 'View full recipe');
        var linkEl = document.createElement('a');
        linkEl.className = 'recipe-link';
        linkEl.href = recipe.link;
        linkEl.target = '_blank';
        linkEl.rel = 'noopener';
        linkEl.textContent = label + ' ↗';
        detailsEl.appendChild(linkEl);
      }

      var toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'recipe-more-btn';
      toggleBtn.textContent = 'Tell me more';
      toggleBtn.addEventListener('click', function () {
        var opening = detailsEl.hidden;
        detailsEl.hidden = !opening;
        toggleBtn.textContent = opening ? 'Show less' : 'Tell me more';
        container.scrollTop = container.scrollHeight;
      });

      card.appendChild(toggleBtn);
      card.appendChild(detailsEl);
    }

    container.appendChild(card);
    container.scrollTop = container.scrollHeight;
  }

  function renderItem(container, item) {
    if (item.type === 'recipe') {
      addRecipeCard(container, item.recipe);
    } else {
      addMessage(container, item.text, 'bot');
    }
  }

  function init() {
    var form = document.getElementById('chat-form');
    var input = document.getElementById('chat-input');
    var messages = document.getElementById('chat-messages');
    var homeBtn = document.getElementById('brand-home-btn');
    var chips = document.querySelectorAll('.chip');
    if (!form || !input || !messages) return;

    function activateChatView() {
      if (!document.body.classList.contains('chat-active')) {
        document.body.classList.add('chat-active');
      }
    }

    function resetToHome() {
      document.body.classList.remove('chat-active');
      messages.innerHTML = '';
      input.value = '';
      input.focus();
    }

    function sendMessage(text) {
      text = text.trim();
      if (!text) return;
      activateChatView();
      addMessage(messages, text, 'user');
      input.value = '';
      respond(text).then(function (items) {
        items.forEach(function (item) { renderItem(messages, item); });
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      sendMessage(input.value);
    });

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        sendMessage(chip.getAttribute('data-msg') || '');
      });
    });

    if (homeBtn) {
      homeBtn.addEventListener('click', resetToHome);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // exposed for potential debugging/testing
  window.ChefBot = { respond: respond, extractIngredients: extractIngredients, findRecipes: findRecipes };
})();
