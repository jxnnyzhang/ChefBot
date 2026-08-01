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
  var EDAMAM_PROXY_URL = 'https://YOUR-WORKER-SUBDOMAIN.workers.dev';

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
      image: 'pokebowl.jpeg',
      link: 'https://www.delicious.com.au/recipes/poke-bowl-pickled-garlic-seaweed/ypunS37M' },
    { name: 'Carne Asada with Pico de Gallo', time: '30 min', popularity: 8,
      ingredients: ['beef', 'lime', 'garlic', 'tomato', 'onion', 'cilantro'],
      instructions: 'Marinate beef in lime and garlic, grill and slice thin, then top with a fresh pico de gallo of tomato, onion, and cilantro.',
      image: 'carneasada.jpeg',
      link: 'https://www.taste.com.au/recipes/carne-asada-pico-de-gallo/677cae67-5cb9-420e-b4de-3d8088619ccc' }
  ];

  // ---------------------------------------------------------------------
  // Live recipe lookup via the Cloudflare Worker proxy
  // ---------------------------------------------------------------------
  function fetchLiveRecipes(tokens) {
    if (!isProxyConfigured() || typeof fetch !== 'function') return Promise.resolve(null);

    var query = tokens.join(' ');
    var controller = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, 6000);
    var opts = controller ? { signal: controller.signal } : {};

    return fetch(EDAMAM_PROXY_URL + '?q=' + encodeURIComponent(query), opts)
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
          (r.ingredients || []).forEach(function (line) {
            var lower = String(line).toLowerCase();
            var hit = tokens.some(function (t) { return fuzzyIncludes(t, lower); });
            (hit ? matched : missing).push(line);
          });
          return {
            name: r.name,
            time: r.time ? Math.round(r.time) + ' min' : null,
            image: r.image,
            link: r.url,
            source: r.source,
            matched: matched,
            missing: missing.slice(0, 6)
          };
        });
        return mapped
          .filter(function (r) { return r.matched.length > 0; })
          .sort(function (a, b) { return b.matched.length - a.matched.length; })
          .slice(0, 3);
      })
      .catch(function () { return null; });
  }

  // ---------------------------------------------------------------------
  // Ingredient normalization
  // ---------------------------------------------------------------------
  var STOPWORDS = ['i', 'have', 'got', 'some', 'a', 'an', 'the', 'and', 'with', 'leftover',
    'my', 'me', 'in', 'fridge', 'pantry', 'left', 'over', 'lots', 'of', 'few', 'extra', 'to', 'use', 'up'];

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
    var normalized = tokens.map(normalizeToken).filter(Boolean);
    return dedupe(phrases.concat(normalized));
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
  function findRecipes(userTokens) {
    var scored = RECIPES.map(function (recipe) {
      var matched = [];
      recipe.ingredients.forEach(function (ing) {
        var hit = userTokens.some(function (t) { return fuzzyIncludes(t, ing); });
        if (hit) matched.push(ing);
      });
      var missing = recipe.ingredients.filter(function (ing) { return matched.indexOf(ing) === -1; });
      return { recipe: recipe, matched: matched, missing: missing };
    });
    return scored
      .filter(function (s) { return s.matched.length > 0; })
      .sort(function (a, b) {
        var coverageA = a.matched.length / a.recipe.ingredients.length;
        var coverageB = b.matched.length / b.recipe.ingredients.length;
        if (b.matched.length !== a.matched.length) return b.matched.length - a.matched.length;
        if (coverageB !== coverageA) return coverageB - coverageA;
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

  function recipeItemsFromLocal(results) {
    return results.map(function (r) {
      return {
        type: 'recipe',
        recipe: {
          name: r.recipe.name,
          time: r.recipe.time,
          image: r.recipe.image,
          link: r.recipe.link,
          matched: r.matched,
          missing: r.missing,
          instructions: r.recipe.instructions
        }
      };
    });
  }

  function recipeItemsFromLive(liveResults) {
    return liveResults.map(function (r) {
      return {
        type: 'recipe',
        recipe: {
          name: r.name,
          time: r.time,
          image: r.image,
          link: r.link,
          matched: r.matched,
          missing: r.missing,
          instructions: r.source ? 'From ' + r.source + '.' : null
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
        if (tokens.length === 0) {
          return Promise.resolve([textItem("I didn't catch any ingredients in that. Try something like \"" + sampleIngredients().join(', ') + '".')]);
        }
        return fetchLiveRecipes(tokens).then(function (live) {
          if (live && live.length) {
            var intro = live.length === 1 ? "Here's a recipe you can make:" : "Here are a few recipes you can make:";
            return [textItem(intro)].concat(recipeItemsFromLive(live));
          }
          var results = findRecipes(tokens);
          if (results.length === 0) {
            return [textItem(pick(NO_MATCH_INTRO) + ' Try other ingredients, like "' + sampleIngredients().join(', ') + '", or list a few more things you have.')];
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

    var html = '';
    if (typeof recipe.image === 'string' && recipe.image) {
      html += '<img class="recipe-thumb" src="' + escapeHtml(recipe.image) + '" alt="' + escapeHtml(recipe.name || '') + '">';
    }
    html += '<div class="recipe-card-body">';
    html += '<strong>' + escapeHtml(recipe.name || 'Recipe') + '</strong>';
    if (recipe.time) html += ' (' + escapeHtml(recipe.time) + ')';
    html += '<br>';
    if (recipe.matched && recipe.matched.length) {
      html += 'Uses what you have: ' + escapeHtml(recipe.matched.join(', ')) + '.<br>';
    }
    if (recipe.missing && recipe.missing.length) {
      html += 'You might also need: ' + escapeHtml(recipe.missing.join(', ')) + '.<br>';
    }
    if (recipe.instructions) {
      html += renderMessageText(recipe.instructions) + '<br>';
    }
    if (isHttpUrl(recipe.link)) {
      html += '<a href="' + escapeHtml(recipe.link) + '" target="_blank" rel="noopener">Full recipe</a>';
    }
    html += '</div>';

    card.innerHTML = html;
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
    if (!form || !input || !messages) return;

    addMessage(messages, "Hi! I'm ChefBot 🍳 List some ingredients you have (e.g. \"chicken, garlic, rice\") and I'll suggest recipes. You can also ask me who I am or what I do!", 'bot');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var text = input.value.trim();
      if (!text) return;
      addMessage(messages, text, 'user');
      input.value = '';
      respond(text).then(function (items) {
        items.forEach(function (item) { renderItem(messages, item); });
      });
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
