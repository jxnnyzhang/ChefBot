const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');

// Edamam API credentials
const api_id = 'a74af650';
const app_key = '49e1b8300d3d1a39ab09bf876438e1af';

// Create an Express app
const app = express();
app.use(bodyParser.json());

// Define the recipes variable at the top level
let recipes = [];

// Define the webhook endpoint for Dialogflow
app.post('/dialogflow-webhook', async (req, res) => {
  try {
    // Extract the user input from the Dialogflow request
    const intent = req.body.queryResult?.intent?.displayName;
    const userInput = req.body.queryResult?.parameters?.recipe;
    const restrictions = req.body.queryResult?.parameters?.restrictions;

    if (intent === 'RecipeFinder') {
      // Call the processUserInput function with the user input
      const formattedResponse = await processUserInput(userInput);

      // Send the response back to Dialogflow
      res.json({
        fulfillmentText: formattedResponse.fulfillmentText,
        fulfillmentMessages: formattedResponse.fulfillmentMessages,
      });
    } else if (intent === 'Restrictions') {
      // Process the restrictions and perform necessary actions
      // For example, you can filter recipes based on the given restrictions
      const filteredRecipes = filterRecipesByRestrictions(recipes, restrictions);

      // Prepare the response message
      const responseText = `Recipes filtered by restrictions: ${filteredRecipes.length}`;

      // Send the response back to Dialogflow
      res.json({
        fulfillmentText: responseText,
        fulfillmentMessages: [
          {
            text: {
              text: [responseText],
            },
          },
        ],
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
    // Handle and format the error response
    const errorResponse = formatErrorResponse(error);

    // Send the error response back to Dialogflow
    res.json(errorResponse);
  }
});

// Define the endpoint for recipe search
app.get('/search-recipes', async (req, res) => {
  const userInput = req.query.q;
  try {
    const response = await axios.get('https://api.edamam.com/search', {
      params: {
        q: userInput,
        app_key: app_key,
        app_id: api_id,
      },
    });

    console.log('API response:', response.data);

    // Check the structure of the response data
    console.log('Response data structure:', Object.keys(response.data));

    // Extract the recipe results from the API response
    recipes = response.data.hits.map((hit) => hit.recipe);
    console.log('Recipes:', recipes);
    res.json({ success: true });
  } catch (error) {
    console.error('Error retrieving recipes:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve recipes. Please try again.' });
  }
});

// Start the Express server
app.listen(3000, () => {
  console.log('Server is listening on port 3000');
});

// Function to handle user inputs and process queries
async function processUserInput(userInput) {
  try {
    const response = await axios.get('http://localhost:3000/search-recipes', {
      params: {
        q: userInput,
      },
    });

    // Prepare the response message
    const responseText = `Found ${response.data.success ? recipes.length : '0'} recipes for "${userInput}"`;

    // Send the response back to Dialogflow
    return {
      fulfillmentText: responseText,
      fulfillmentMessages: [
        {
          text: {
            text: [responseText],
          },
        },
      ],
    };
  } catch (error) {
    console.error('Error retrieving recipes:', error);
    throw new Error('Failed to retrieve recipes. Please try again.');
  }
}

// Function to filter recipes based on restrictions
function filterRecipesByRestrictions(recipes, restrictions) {
  // Implement the logic to filter recipes based on restrictions
  // For example, you can iterate over the recipes and check if they match the given restrictions
  const filteredRecipes = recipes.filter((recipe) => {
    // Implement your restriction checking logic here
    // For example, check if the recipe ingredients contain any restricted ingredient
    return !recipe.ingredients.some((ingredient) => restrictions.includes(ingredient));
  });

  return filteredRecipes;
}

// Function to format error responses
function formatErrorResponse(error) {
  return {
    fulfillmentText: `An error occurred: ${error.message}`,
    fulfillmentMessages: [
      {
        text: {
          text: [`An error occurred: ${error.message}`],
        },
      },
    ],
  };
}



