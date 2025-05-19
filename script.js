
// Main script for Odlo Product Advisor POC

// Global variables
let products = [];
let isLoading = false;
let apiKey = ''; // Will be loaded from config.js

// DOM elements
const elements = {
    csvUrl: document.getElementById('csvUrl'),
    loadCatalog: document.getElementById('loadCatalog'),
    catalogStatus: document.getElementById('catalogStatus'),
    chatContainer: document.getElementById('chatContainer'),
    userInput: document.getElementById('userInput'),
    sendButton: document.getElementById('sendButton'),
    exampleQueries: document.querySelectorAll('.example-query')
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    if (typeof CONFIG !== 'undefined' && CONFIG.ANTHROPIC_API_KEY) {
        apiKey = CONFIG.ANTHROPIC_API_KEY;
        console.log('API key loaded from config');
        const apiKeyContainer = document.querySelector('.api-key-container');
        if (apiKeyContainer) {
            apiKeyContainer.style.display = 'none';
        }
    } else {
        showError("API key not found in config.js. Please add a config.js file with your API key.");
    }

    elements.loadCatalog.addEventListener('click', loadCatalog);
    elements.sendButton.addEventListener('click', sendMessage);
    elements.userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    elements.exampleQueries.forEach(button => {
        button.addEventListener('click', () => {
            elements.userInput.value = button.textContent;
            sendMessage();
        });
    });

    addMessage("Welcome to the Odlo Product Advisor POC! Click 'Load Product Catalog' to begin.", "system");
});

/**
 * Loads the product catalog from the provided CSV URL
 */
async function loadCatalog() {
    const csvUrl = elements.csvUrl.value.trim();

    if (!apiKey) {
        showError("API key not found. Please check your config.js file.");
        return;
    }

    if (!csvUrl) {
        showError("Please enter a CSV URL");
        return;
    }

    elements.catalogStatus.innerHTML = '<span class="loading"></span> Loading catalog...';
    elements.loadCatalog.disabled = true;

    try {
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const csvText = await blob.text();

        Papa.parse(csvText, {
            header: true,
            complete: function(results) {
                products = results.data.slice(0, 100).filter(p => p.id && p.title);
                elements.catalogStatus.innerHTML = `<span class="text-success">✓</span> Loaded ${products.length} products successfully!`;
                elements.loadCatalog.disabled = false;
                elements.userInput.disabled = false;
                elements.sendButton.disabled = false;
                addMessage("Product catalog loaded successfully! I can now provide personalized Odlo product recommendations. How can I help you today?", "assistant");
            },
            error: function(error) {
                showError(`Error parsing CSV: ${error}`);
                elements.loadCatalog.disabled = false;
            }
        });
    } catch (error) {
        showError(`Error loading CSV: ${error.message}`);
        elements.loadCatalog.disabled = false;
    }
}

/**
 * Sends the user message to Claude API and displays the response
 */
async function sendMessage() {
    const userInput = elements.userInput.value.trim();
    if (!userInput || isLoading) return;

    if (!apiKey) {
        showError("API key not found. Please check your config.js file.");
        return;
    }

    if (products.length === 0) {
        showError("Please load the product catalog first");
        return;
    }

    addMessage(userInput, "user");
    elements.userInput.value = '';

    isLoading = true;
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.innerHTML = '<span class="loading"></span> Thinking...';
    elements.chatContainer.appendChild(loadingDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;

    try {
        const productSample = products.map(p => ({
            id: p.id || '',
            title: p.title || '',
            description: p.description || '',
            price: p.price || '',
            link: p.link || '',
            image_link: p.image_link || '',
            availability: p.availability || '',
            product_type: p.product_type || '',
            google_product_category: p.google_product_category || '',
            condition: p.condition || ''
        }));

        const systemPrompt = `You are Odlo's product recommendation assistant. Your job is to help customers find the perfect Odlo products based on their needs.

GUIDELINES:
1. ONLY recommend products from the catalog provided below.
2. If a customer asks for something not in the catalog, suggest the closest alternative.
3. NEVER mention competitors or compare to other brands.
4. Always highlight Odlo's unique features like fabric technology, sustainability aspects, and performance benefits.
5. Format your responses in a conversational, helpful manner.
6. When recommending products, clearly state the product name, ID, and key features.

Here's the available product catalog (first 100 products only):
${JSON.stringify(productSample)}`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1000,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userInput }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Unknown API error');
        }

        const data = await response.json();
        elements.chatContainer.removeChild(loadingDiv);
        isLoading = false;
        addMessage(data.content[0].text, 'assistant');

    } catch (error) {
        elements.chatContainer.removeChild(loadingDiv);
        isLoading = false;
        showError(`API Error: ${error.message}`);
    }
}

/**
 * Adds a message to the chat container
 */
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    elements.chatContainer.appendChild(messageDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
}

/**
 * Shows an error message in the chat
 */
function showError(message) {
    addMessage(`Error: ${message}`, 'system');
}
