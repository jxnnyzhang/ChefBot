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
         node recipe.js
Once the code is running, it will start an Express server that listens on port 3000. The chatbot can be accessed through the /webhook endpoint.


**Integration with Dialogflow...**

To integrate ChefBot with Dialogflow, follow these steps:
1. Deploy the ChefBot JavaScript code to a hosting platform that provides a stable URL. I used the Amazon S3 service in AWS Cloud.
2. In the Dialogflow console, go to your agent settings.
3. In the "Fulfillment" section, enable the webhook and provide the URL of your deployed ChefBot code as the fulfillment webhook URL.
4. Save the changes in Dialogflow.

Now, when users interact with your Dialogflow agent, the requests will be sent to your ChefBot code for processing, and the response will be returned to Dialogflow for presentation to the user.

**Website Integration**

ChefBot can be integrated into a website using the Dialogflow API. Follow these steps to add ChefBot to your website:

1. Create an HTML page for your website and include the necessary styling and structure.
2. Add a button or a link that triggers the ChefBot chatbot.
3. In your HTML file, include the Dialogflow API script by adding the following code snippet within the <script> tag:

            <script>
                    function loadChatbot() {
                        var chatbotContainer = document.createElement('div');
                        chatbotContainer.className = 'chatbot-container';
                        var chatbotIframe = document.createElement('iframe');
                        chatbotIframe.className = 'chatbot-iframe';
                        chatbotIframe.src = 'https://console.dialogflow.com/api-client/demo/embedded/76322a98-4e88-437e-991f-d557a657b8b2?disableGoogleLogo=true&hideControls=true';
                        chatbotContainer.appendChild(chatbotIframe);
                        document.body.appendChild(chatbotContainer);
                    }
                </script>
    
 4. Finally, create a button or a link that calls the loadChatbot() function when clicked:

            <button onclick="loadChatbot()">Try ChefBot</button>

Now, when users click the "Try ChefBot" button on your website, the ChefBot chatbot will be loaded and displayed.

**About Page**
To create an "About" page for ChefBot, follow these steps:

1. Create a new HTML file named about.html.
2. Add the necessary styling and structure for the "About" page.
3. Include any relevant information about ChefBot, such as its features, purpose, and technology stack.
4. Customize the content of the page to suit your requirements.
5. Link to the "About" page from your main website or navigation menu.

**Contributing...**

Contributions to this project are welcome! If you find any issues or have ideas for improvements, please open an issue or submit a pull request.

Feel free to modify and customize the README file to include any additional information specific to your implementation of the ChefBot JavaScript code.


