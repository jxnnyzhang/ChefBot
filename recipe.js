    const axios = require('axios');
    const express = require('express');
    const bodyParser = require('body-parser');

    // Edamam API credentials
    const api_id = 'a74af650';
    const app_key = '49e1b8300d3d1a39ab09bf876438e1af';

    // Create an Express app
    const app = express();
    app.use(bodyParser.json());

    // Define the webhook endpoint
    app.post('/webhook', (req, res) => {
      // Extract the user input from the Dialogflow request
      const userInput = req.body.queryResult.queryText;

      // Call the processUserInput function with the user input
      processUserInput(userInput)
        .then((formattedResponse) => {
          // Send the response back to Dialogflow
          res.json({
            fulfillmentText: formattedResponse.fulfillmentText,
            fulfillmentMessages: formattedResponse.fulfillmentMessages,
          });
        })
        .catch((error) => {
          console.error('Error:', error.message);
          // Handle and format the error response
          const errorResponse = formatErrorResponse(error);

          // Send the error response back to Dialogflow
          res.json(errorResponse);
        });
    });

    // Start the Express server
    app.listen(3000, () => {
      console.log('Server is listening on port 3000');
    });


    
    // Function to handle user inputs and process queries
    async function processUserInput(userInput) {

    // Make a request to the Spoonacular API
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
        const recipes = response.data.hits.map(hit => hit.recipe);
        console.log('Recipes:', recipes);
        const formattedResponse = processRecipesAndFormatResponse(recipes);
        return formattedResponse;

      } catch (error) {
        console.error('Error retrieving recipes:', error);
        throw new Error('Failed to retrieve recipes. Please try again.');
      }
    }

    // Function to process the recipes and format the response
    function processRecipesAndFormatResponse(recipes) {
      
      // Process the recipes and return the formatted response
      const processedRecipes = recipes.map((recipe) => {
        return {
          title: recipe.label,
          ingredients: recipe.ingredientLines,
          nutritionalFacts: recipe.totalNutrients,
        };
      });
      
      return{
      fulfillmentText: 'Recipes found:',
      fulfillmentMessages: processedRecipes.map((recipe) => ({
        text: {
          text: [
            `Title: ${recipe.title}`,
            'Ingredients:',
            ...recipe.ingredients,
            'Nutritional Facts:',
            JSON.stringify(recipe.nutritionalFacts),
          ],
        },
      })),
    };
  }

    // Function to format the error response
    function formatErrorResponse(error) {
      // Format the error response according to your desired format
      const errorResponse = {
        fulfillmentText: 'An error occurred: ' + error.message,
      };
      return errorResponse;
    }


