# ChefBot Code
This repository contains the JavaScript code for ChefBot, a chatbot that provides recipe recommendations based on user input. The code interacts with the Edamam API to retrieve recipe data and formats the response for display.

**Prerequisites...**
Before running the ChefBot JavaScript code, ensure you have the following dependencies installed:
- Node.js
- npm (Node Package Manager)

**Installation...**
1. Clone this repository to your local machine or download the code as a ZIP file.
2. Navigate to the project directory in your terminal or command prompt.
3. Run the following command to install the required dependencies:
            npm install
Or in my case, due to certain permissions I used:
            sudo npm install
            
**Configuration...**
1. Before running the code, make sure to set up the necessary API credentials. Follow these steps:
2. Obtain an API ID and API Key from the Edamam API website.
3. Open the chefbot.js file and locate the following lines:

          // Edamam API credentials
          
          const api_id = 'YOUR_API_ID';
          const app_key = 'YOUR_APP_KEY';
4. Replace YOUR_API_ID and YOUR_APP_KEY with your actual API credentials.  

**Usage...**

To run the ChefBot JavaScript code, use the following command in the terminal:
        //Using the name of your code file
         node chefbot.js
Once the code is running, it will start an Express server that listens on port 3000. The chatbot can be accessed through the /webhook endpoint.


**Integration with Dialogflow...**

To integrate ChefBot with Dialogflow, follow these steps:
1. Deploy the ChefBot JavaScript code to a hosting platform that provides a stable URL. I used the Amazon S3 service in AWS Cloud.
2. In the Dialogflow console, go to your agent settings.
3. In the "Fulfillment" section, enable the webhook and provide the URL of your deployed ChefBot code as the fulfillment webhook URL.
4. Save the changes in Dialogflow.

Now, when users interact with your Dialogflow agent, the requests will be sent to your ChefBot code for processing, and the response will be returned to Dialogflow for presentation to the user.

**Contributing...**

Contributions to this project are welcome! If you find any issues or have ideas for improvements, please open an issue or submit a pull request.

Feel free to modify and customize the README file to include any additional information specific to your implementation of the ChefBot JavaScript code.


