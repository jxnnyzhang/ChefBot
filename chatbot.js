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

  // In-memory only (consistent with ChefBot's no-saved-history design):
  // tracks the most recent ingredient search so "show me more" can serve
  // further results without repeating what's already been shown.
  var lastSearch = null;

  // ---------------------------------------------------------------------
  // Recipe data (fallback, used when the live API is unavailable)
  // ---------------------------------------------------------------------
  var RECIPES = [
    { name: 'Spaghetti Aglio e Olio', time: '20 min', popularity: 9,
      ingredients: ['spaghetti', 'garlic', 'olive oil', 'red pepper flakes', 'parsley', 'parmesan'],
      instructions: ['Cook spaghetti in salted water until al dente; reserve a cup of pasta water.',
        'Gently fry thinly sliced garlic in olive oil over low heat until golden.',
        'Add red pepper flakes and cook 30 seconds more.',
        'Toss the drained pasta into the pan with a splash of pasta water, the parsley, and parmesan.'] },
    { name: 'Classic Grilled Cheese', time: '10 min', popularity: 8,
      ingredients: ['bread', 'cheese', 'butter'],
      instructions: ['Butter one side of each slice of bread.',
        'Layer cheese between the slices, butter-side out.',
        'Grill in a pan over medium heat, flipping once, until both sides are golden and the cheese has melted.'] },
    { name: 'Chicken Stir Fry', time: '25 min', popularity: 9,
      ingredients: ['chicken', 'broccoli', 'carrot', 'garlic', 'ginger', 'soy sauce', 'rice'],
      instructions: ['Sear sliced chicken in a hot pan or wok until browned; set aside.',
        'Add garlic and ginger to the pan and cook until fragrant.',
        'Add broccoli and carrot, stir-frying until crisp-tender.',
        'Return the chicken to the pan, toss with soy sauce, and serve over rice.'] },
    { name: 'Guacamole', time: '10 min', popularity: 8,
      ingredients: ['avocado', 'lime', 'onion', 'cilantro', 'tomato', 'salt'],
      instructions: ['Mash the avocado in a bowl to your preferred texture.',
        'Mix in lime juice, diced onion, tomato, and cilantro.',
        'Season with salt to taste and serve immediately.'] },
    { name: 'Fluffy Pancakes', time: '20 min', popularity: 9,
      ingredients: ['flour', 'milk', 'egg', 'butter', 'sugar', 'baking powder'],
      instructions: ['Whisk together flour, sugar, and baking powder.',
        'In a separate bowl, mix milk, egg, and melted butter.',
        'Combine wet and dry ingredients, stirring just until no dry streaks remain.',
        'Cook spoonfuls on a hot, lightly greased griddle until bubbles form, then flip until golden.'] },
    { name: 'Vegetable Fried Rice', time: '20 min', popularity: 8,
      ingredients: ['rice', 'egg', 'carrot', 'peas', 'soy sauce', 'onion', 'garlic'],
      instructions: ['Scramble the egg in a hot wok or pan and set aside.',
        'Stir-fry onion and garlic until fragrant, then add carrot and peas.',
        'Add cold, day-old rice, breaking up clumps as it fries.',
        'Fold in the soy sauce and scrambled egg, tossing until heated through.'] },
    { name: 'Beef Tacos', time: '25 min', popularity: 9,
      ingredients: ['ground beef', 'tortilla', 'onion', 'tomato', 'cheese', 'lettuce', 'lime'],
      instructions: ['Brown ground beef with diced onion and taco seasoning.',
        'Warm the tortillas.',
        'Fill each tortilla with beef, then top with tomato, cheese, and lettuce.',
        'Finish with a squeeze of lime.'] },
    { name: 'Caprese Salad', time: '10 min', popularity: 7,
      ingredients: ['tomato', 'mozzarella', 'basil', 'olive oil', 'balsamic vinegar'],
      instructions: ['Slice the tomato and mozzarella into even rounds.',
        'Layer them alternately on a plate with fresh basil leaves.',
        'Drizzle with olive oil and balsamic vinegar, and season to taste.'] },
    { name: 'Cheesy Omelette', time: '10 min', popularity: 8,
      ingredients: ['egg', 'cheese', 'butter', 'salt', 'pepper'],
      instructions: ['Whisk the eggs with salt and pepper.',
        'Melt butter in a pan over medium heat and pour in the eggs.',
        'As the edges set, sprinkle cheese over half the omelette.',
        'Fold in half once mostly set and slide onto a plate.'] },
    { name: 'Banana Bread', time: '65 min', popularity: 8,
      ingredients: ['banana', 'flour', 'sugar', 'egg', 'butter', 'baking soda'],
      instructions: ['Preheat the oven to 350°F (175°C) and grease a loaf pan.',
        'Mash the bananas and mix with melted butter, sugar, and egg.',
        'Fold in flour and baking soda until just combined.',
        'Pour into the pan and bake for about 50 minutes, until a toothpick comes out clean.'] },
    { name: 'Chocolate Chip Cookies', time: '30 min', popularity: 9,
      ingredients: ['flour', 'butter', 'sugar', 'egg', 'chocolate chips', 'baking soda'],
      instructions: ['Cream together butter and sugar until light and fluffy.',
        'Mix in the egg.',
        'Fold in flour, baking soda, and chocolate chips.',
        'Drop spoonfuls onto a baking sheet and bake at 350°F (175°C) for 10-12 minutes.'] },
    { name: 'Creamy Chicken Alfredo', time: '30 min', popularity: 9,
      ingredients: ['chicken', 'pasta', 'butter', 'garlic', 'parmesan', 'cream'],
      instructions: ['Cook the pasta according to package directions.',
        'Sear sliced chicken in a pan until cooked through; set aside.',
        'In the same pan, melt butter and cook garlic until fragrant.',
        'Whisk in cream and parmesan until a smooth sauce forms.',
        'Toss the pasta and chicken through the sauce and serve.'] },
    { name: 'Vegetable Curry', time: '35 min', popularity: 7,
      ingredients: ['potato', 'carrot', 'onion', 'garlic', 'ginger', 'curry powder', 'coconut milk'],
      instructions: ['Sauté onion, garlic, and ginger until softened.',
        'Stir in curry powder and cook until fragrant.',
        'Add potato and carrot, then pour in coconut milk.',
        'Simmer until the vegetables are tender, about 20 minutes.'] },
    { name: 'Margherita Pizza', time: '30 min', popularity: 8,
      ingredients: ['pizza dough', 'tomato', 'mozzarella', 'basil', 'olive oil'],
      instructions: ['Preheat the oven as hot as it will go, ideally with a pizza stone inside.',
        'Stretch out the dough and spread crushed tomato over it, leaving a border.',
        'Top with torn mozzarella.',
        'Bake until the crust is golden, then finish with fresh basil and a drizzle of olive oil.'] },
    { name: 'Caesar Salad', time: '15 min', popularity: 7,
      ingredients: ['lettuce', 'parmesan', 'bread', 'garlic', 'lemon', 'olive oil'],
      instructions: ['Toast cubed bread with olive oil and a rubbed garlic clove to make croutons.',
        'Toss torn lettuce with lemon juice and olive oil.',
        'Add the croutons and shaved parmesan, and toss again before serving.'] },
    { name: 'Tomato Soup', time: '30 min', popularity: 7,
      ingredients: ['tomato', 'onion', 'garlic', 'butter', 'cream'],
      instructions: ['Sauté onion and garlic in butter until soft.',
        'Add tomato and simmer for 15 minutes.',
        'Blend until smooth, then stir in a splash of cream and season to taste.'] },
    { name: 'Mac and Cheese', time: '25 min', popularity: 9,
      ingredients: ['pasta', 'cheese', 'butter', 'flour', 'milk'],
      instructions: ['Cook the pasta according to package directions.',
        'Melt butter in a saucepan and whisk in flour to make a roux.',
        'Gradually whisk in milk until smooth and thickened.',
        'Melt in the cheese, then stir through the cooked pasta.'] },
    { name: 'Garlic Shrimp Scampi', time: '20 min', popularity: 8,
      ingredients: ['shrimp', 'garlic', 'butter', 'lemon', 'pasta', 'parsley'],
      instructions: ['Cook the pasta according to package directions.',
        'Sauté shrimp in butter and garlic until just pink, about 2-3 minutes per side.',
        'Toss the cooked pasta into the pan with lemon juice and parsley.'] },
    { name: 'French Toast', time: '15 min', popularity: 8,
      ingredients: ['bread', 'egg', 'milk', 'cinnamon', 'butter'],
      instructions: ['Whisk together egg, milk, and cinnamon in a shallow dish.',
        'Soak each slice of bread briefly on both sides.',
        'Pan-fry in butter over medium heat until golden on both sides.'] },
    { name: 'Egg Fried Rice', time: '15 min', popularity: 7,
      ingredients: ['rice', 'egg', 'soy sauce', 'onion', 'peas'],
      instructions: ['Scramble the egg in a hot pan or wok and set aside.',
        'Stir-fry onion and peas briefly.',
        'Add cold rice, breaking up clumps, and stir-fry until heated through.',
        'Fold in the soy sauce and scrambled egg.'] },
    { name: 'Black Bean Tacos', time: '20 min', popularity: 7,
      ingredients: ['black beans', 'tortilla', 'corn', 'onion', 'lime', 'cilantro', 'cheese'],
      instructions: ['Warm the black beans and corn with diced onion in a pan.',
        'Warm the tortillas.',
        'Spoon the bean mixture into the tortillas.',
        'Top with lime, cilantro, and cheese.'] },
    { name: 'Honey Garlic Salmon', time: '25 min', popularity: 8,
      ingredients: ['salmon', 'honey', 'garlic', 'soy sauce', 'lemon'],
      instructions: ['Preheat the oven to 400°F (200°C).',
        'Whisk together honey, minced garlic, soy sauce, and lemon juice.',
        'Pour the mixture over the salmon in a baking dish.',
        'Bake for about 12-15 minutes, until the salmon flakes easily.'] },
    { name: 'Chicken Noodle Soup', time: '40 min', popularity: 8,
      ingredients: ['chicken', 'carrot', 'celery', 'onion', 'noodles', 'garlic'],
      instructions: ['Simmer chicken with onion, carrot, celery, and garlic in broth for about 20 minutes.',
        'Remove the chicken, shred it, and return it to the pot.',
        'Add noodles and cook until tender, about 8 minutes more.'] },
    { name: 'Greek Yogurt Parfait', time: '5 min', popularity: 6,
      ingredients: ['yogurt', 'honey', 'banana', 'oats'],
      instructions: ['Spoon a layer of yogurt into a glass.',
        'Add a drizzle of honey, sliced banana, and a sprinkle of oats.',
        'Repeat the layers and serve.'] },
    { name: 'Crispy Pan-Fried Tofu', time: '20 min', popularity: 8,
      ingredients: ['tofu', 'cornstarch', 'soy sauce', 'garlic', 'green onion', 'oil'],
      instructions: ['Press the tofu for 10 minutes to remove excess water, then cube it.',
        'Toss the cubes in cornstarch until lightly coated.',
        'Pan-fry in oil over medium-high heat, turning until crisp and golden on all sides.',
        'Add garlic and a splash of soy sauce in the last minute of cooking, and finish with sliced green onion.'] },
    { name: 'Tofu Stir Fry', time: '25 min', popularity: 8,
      ingredients: ['tofu', 'broccoli', 'carrot', 'garlic', 'ginger', 'soy sauce', 'rice'],
      instructions: ['Press and cube the tofu, then pan-fry until golden on all sides; set aside.',
        'Add garlic and ginger to the pan and cook until fragrant.',
        'Add broccoli and carrot, stir-frying until crisp-tender.',
        'Return the tofu to the pan, toss with soy sauce, and serve over rice.'] },
    { name: 'Miso Tofu Soup', time: '15 min', popularity: 7,
      ingredients: ['tofu', 'miso paste', 'seaweed', 'green onion', 'water'],
      instructions: ['Bring water to a gentle simmer (do not boil).',
        'Whisk a spoonful of the hot liquid with miso paste until smooth, then stir it back into the pot.',
        'Add cubed tofu and seaweed, and warm through.',
        'Garnish with sliced green onion before serving.'] },
    { name: 'Poke Bowl with Pickled Garlic and Seaweed', time: '25 min', popularity: 8,
      ingredients: ['rice', 'salmon', 'garlic', 'seaweed', 'soy sauce', 'cucumber'],
      instructions: ['Cook and season the rice, then let it cool slightly.',
        'Cube the salmon and toss with a little soy sauce.',
        'Top the rice with salmon, pickled garlic, seaweed, and sliced cucumber.',
        'Drizzle with more soy sauce before serving.'],
      link: 'https://www.delicious.com.au/recipes/poke-bowl-pickled-garlic-seaweed/ypunS37M' },
    { name: 'Carne Asada with Pico de Gallo', time: '30 min', popularity: 8,
      ingredients: ['beef', 'lime', 'garlic', 'tomato', 'onion', 'cilantro'],
      instructions: ['Marinate the beef in lime juice and minced garlic for at least 20 minutes.',
        'Grill over high heat to your preferred doneness, then let it rest.',
        'Slice the beef thin against the grain.',
        'Top with a fresh pico de gallo of diced tomato, onion, and cilantro.'],
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
        // Full sorted pool (up to 9), not just the top 3 — lets "show me more"
        // serve further rounds from the same fetch instead of costing another
        // Edamam call.
        return candidates.sort(function (a, b) {
          if (hasTokens && a.matched.length !== b.matched.length) return b.matched.length - a.matched.length;
          if (constraints.wantsSimple && a.ingredientCount !== b.ingredientCount) return a.ingredientCount - b.ingredientCount;
          if (constraints.wantsQuick && (a.timeMinutes || 999) !== (b.timeMinutes || 999)) return (a.timeMinutes || 999) - (b.timeMinutes || 999);
          return 0;
        });
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

    // Full sorted pool, not just the top 3 — "show me more" serves further
    // rounds straight from this list, no extra work needed.
    return candidates.sort(function (a, b) {
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
    });
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
    if (isMoreRequest(t)) return 'more';
    return 'ingredients';
  }

  // Strict full-message match on purpose, so a genuine ingredient sentence
  // like "I have chicken and more rice" doesn't get misread as this intent.
  function isMoreRequest(t) {
    return /^(more|more options?|show me more|give me more( options?)?|other options?|others?|something else|(a\s)?different (one|options?)?|anything else|not (this|these|it)\.?|none of (these|those)|not (satisfied|convinced)|i don'?t (like|want) (these|those|this|any of (these|those))|no thanks?,? (more|another))[.!?]*$/.test(t);
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
          hasRealLink: hasRealLink,
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
          hasRealLink: hasRealLink,
          source: hasRealLink ? (r.source || hostnameOf(r.link)) : null,
          linkLabel: hasRealLink ? null : 'Search for this recipe',
          matched: r.matched,
          missing: r.missing,
          // Edamam's API itself doesn't include step-by-step directions.
          // ChefBot tries to pull real steps from the recipe's own page
          // (see fetchInstructionsFor) when the card is expanded.
          instructions: null
        }
      };
    });
  }

  function handleMoreRequest() {
    if (!lastSearch || lastSearch.shown >= lastSearch.pool.length) {
      var msg = lastSearch
        ? "That's everything I found for those ingredients — try adding another ingredient, or a time budget, for different options."
        : "I don't have a previous search to build on yet — tell me some ingredients first!";
      return [textItem(msg)];
    }
    var nextBatch = lastSearch.pool.slice(lastSearch.shown, lastSearch.shown + 3);
    lastSearch.shown += nextBatch.length;
    var items = lastSearch.source === 'live' ? recipeItemsFromLive(nextBatch) : recipeItemsFromLocal(nextBatch);
    return [textItem('Here are some more options:')].concat(items);
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
      case 'more': return Promise.resolve(handleMoreRequest());
      case 'ingredients':
      default:
        var tokens = extractIngredients(userText);
        var constraints = parseConstraints(userText);
        if (tokens.length === 0 && !hasConstraints(constraints)) {
          return Promise.resolve([textItem("I didn't catch any ingredients in that. Try something like \"" + sampleIngredients().join(', ') + '".')]);
        }
        return fetchLiveRecipes(tokens, constraints).then(function (live) {
          if (live && live.length) {
            lastSearch = { source: 'live', pool: live, shown: Math.min(3, live.length) };
            var shown = live.slice(0, 3);
            var intro = shown.length === 1 ? "Here's a recipe you can make:" : "Here are a few recipes you can make:";
            return [textItem(intro)].concat(recipeItemsFromLive(shown));
          }
          var results = findRecipes(tokens, constraints);
          if (results.length === 0) {
            lastSearch = null;
            var suggestion = constraints.maxTime
              ? ' Try a longer time budget, or list a few ingredients you have.'
              : ' Try other ingredients, like "' + sampleIngredients().join(', ') + '", or list a few more things you have.';
            return [textItem(pick(NO_MATCH_INTRO) + suggestion)];
          }
          lastSearch = { source: 'local', pool: results, shown: Math.min(3, results.length) };
          var shownLocal = results.slice(0, 3);
          var intro2 = shownLocal.length === 1 ? "Here's a recipe you can make:" : "Here are a few recipes you can make:";
          return [textItem(intro2)].concat(recipeItemsFromLocal(shownLocal));
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

  function renderSteps(steps) {
    var html = '<ol class="recipe-steps">';
    steps.forEach(function (step) {
      html += '<li>' + renderMessageText(step) + '</li>';
    });
    html += '</ol>';
    return html;
  }

  // Best-effort: pulls real step-by-step instructions from the recipe's own
  // page (schema.org JSON-LD) via the Worker. Many larger publishers block
  // automated requests, so this can legitimately come back empty — callers
  // must handle a null/empty result gracefully.
  function fetchInstructionsFor(pageUrl) {
    if (!isProxyConfigured() || typeof fetch !== 'function') return Promise.resolve(null);
    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, 8000);
    var opts = controller ? { signal: controller.signal } : {};
    return fetch(EDAMAM_PROXY_URL + '?extract=' + encodeURIComponent(pageUrl), opts)
      .then(function (resp) {
        if (timer) clearTimeout(timer);
        if (!resp.ok) throw new Error('extract failed');
        return resp.json();
      })
      .then(function (data) { return (data && Array.isArray(data.steps)) ? data.steps : null; })
      .catch(function () { return null; });
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

    var infoHtml = '';
    if (recipe.missing && recipe.missing.length) {
      infoHtml += "You'll also need: " + escapeHtml(recipe.missing.join(', ')) + '.<br>';
    }
    if (recipe.servings) {
      infoHtml += 'Servings: ' + escapeHtml(String(recipe.servings)) + '<br>';
    }

    var hasSteps = Array.isArray(recipe.instructions) && recipe.instructions.length > 0;
    var hasLink = isHttpUrl(recipe.link);
    var canExtract = hasLink && recipe.hasRealLink && !hasSteps;

    if (infoHtml || hasLink || hasSteps || canExtract) {
      var detailsEl = document.createElement('div');
      detailsEl.className = 'recipe-details';
      detailsEl.hidden = true;
      if (infoHtml) {
        var infoEl = document.createElement('div');
        infoEl.innerHTML = infoHtml;
        detailsEl.appendChild(infoEl);
      }

      var stepsEl = document.createElement('div');
      stepsEl.className = 'recipe-steps-wrap';
      if (hasSteps) {
        stepsEl.innerHTML = renderSteps(recipe.instructions);
      } else if (canExtract) {
        stepsEl.innerHTML = '<p class="recipe-steps-status">Looking up step-by-step instructions&hellip;</p>';
      } else {
        stepsEl.innerHTML = '<p class="recipe-steps-status">ChefBot doesn\'t have step-by-step directions for ' +
          'this one &mdash; use the link below for the full method.</p>';
      }
      detailsEl.appendChild(stepsEl);

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
      var extractStarted = false;
      toggleBtn.addEventListener('click', function () {
        var opening = detailsEl.hidden;
        detailsEl.hidden = !opening;
        toggleBtn.textContent = opening ? 'Show less' : 'Tell me more';
        container.scrollTop = container.scrollHeight;

        if (opening && canExtract && !extractStarted) {
          extractStarted = true;
          fetchInstructionsFor(recipe.link).then(function (steps) {
            stepsEl.innerHTML = (steps && steps.length)
              ? renderSteps(steps)
              : '<p class="recipe-steps-status">Couldn\'t automatically pull directions for this one ' +
                '&mdash; use the link below for the full method.</p>';
            container.scrollTop = container.scrollHeight;
          });
        }
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
      lastSearch = null;
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

    initDiscover();
  }

  // ---------------------------------------------------------------------
  // Discover section: Trending + Editor's Picks, pulled live from Edamam
  // and cached at the edge for a day (see worker's ?homepage=1), so this
  // costs about one shared Edamam call/day regardless of visitor count.
  // ---------------------------------------------------------------------
  function trendingTileHtml(r) {
    var name = escapeHtml(r.name || 'Recipe');
    var source = escapeHtml(r.source || 'the source');
    return '<div class="trending-tile">' +
      '<img class="trending-photo" src="' + escapeHtml(r.image) + '" alt="' + name + '" loading="lazy">' +
      '<h3>' + name + '</h3>' +
      '<a class="trending-link" href="' + escapeHtml(r.url) + '" target="_blank" rel="noopener">View recipe on ' + source + ' ↗</a>' +
      '</div>';
  }

  function renderTiles(container, list, emptyMessage) {
    if (!container) return;
    if (!list || !list.length) {
      container.innerHTML = '<p class="trending-empty">' + escapeHtml(emptyMessage) + '</p>';
      return;
    }
    container.innerHTML = list.map(trendingTileHtml).join('');
  }

  function initDiscover() {
    var trendingEl = document.getElementById('trending-tiles');
    var editorsEl = document.getElementById('editors-tiles');
    var tabBtns = document.querySelectorAll('.tab-btn');
    if (!trendingEl || !editorsEl) return;

    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabBtns.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var tab = btn.getAttribute('data-tab');
        trendingEl.hidden = tab !== 'trending';
        editorsEl.hidden = tab !== 'editors';
      });
    });

    var unavailable = "Live picks aren't available right now — try again later.";
    if (!isProxyConfigured() || typeof fetch !== 'function') {
      renderTiles(trendingEl, [], unavailable);
      renderTiles(editorsEl, [], unavailable);
      return;
    }

    fetch(EDAMAM_PROXY_URL + '?homepage=1')
      .then(function (resp) {
        if (!resp.ok) throw new Error('homepage fetch failed');
        return resp.json();
      })
      .then(function (data) {
        renderTiles(trendingEl, data.trending, unavailable);
        renderTiles(editorsEl, data.editorsPicks,
          "No picks from top publishers matched today's batch — check back tomorrow!");
      })
      .catch(function () {
        renderTiles(trendingEl, [], unavailable);
        renderTiles(editorsEl, [], unavailable);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // exposed for potential debugging/testing
  window.ChefBot = { respond: respond, extractIngredients: extractIngredients, findRecipes: findRecipes };
})();
