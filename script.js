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
    // Load API key from config
    if (typeof CONFIG !== 'undefined' && CONFIG.ANTHROPIC_API_KEY) {
        apiKey = CONFIG.ANTHROPIC_API_KEY;
        console.log('API key loaded from config');
    } else {
        showError("API key not found in config.js. Please add a config.js file with your API key.");
    }
   
    // Load catalog button
    elements.loadCatalog.addEventListener('click', loadCatalog);
   
    // Send message button and Enter key
    elements.sendButton.addEventListener('click', sendMessage);
    elements.userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
   
    // Example query buttons
    elements.exampleQueries.forEach(button => {
        button.addEventListener('click', () => {
            elements.userInput.value = button.textContent;
            sendMessage();
        });
    });
   
    // Add initial welcome message
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
   
    // Show loading status
    elements.catalogStatus.innerHTML = '<span class="loading"></span> Loading catalog...';
    elements.loadCatalog.disabled = true;
   
    try {
        // Fetch CSV data
        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
       
        const csvText = await response.text();
       
        // Parse CSV using PapaParse with pipe delimiter
        Papa.parse(csvText, {
            header: true,
            delimiter: '|', // Set the delimiter to pipe
            skipEmptyLines: true,
            complete: function(results) {
                // Limit to first 100 products to save on token usage
                products = results.data.slice(0, 100).filter(p => p.id && p.title);
               
                // If no products were found, check if we need to use different field names
                if (products.length === 0) {
                    // Try to infer field names from the data
                    const fields = results.meta.fields;
                    if (fields && fields.length > 0) {
                        // Map common field names
                        const idField = fields.find(f => f.toLowerCase().includes('id') && !f.includes('group')) || 'id';
                        const titleField = fields.find(f => f.toLowerCase().includes('title')) || 'title';
                        const descField = fields.find(f => f.toLowerCase().includes('desc')) || 'description';
                       
                        // Retry filtering with inferred field names
                        products = results.data.slice(0, 100).filter(p => p[idField] && p[titleField]);
                    }
                }
               
                if (products.length === 0) {
                    showError("No valid products found in the feed. Please check the format.");
                    elements.loadCatalog.disabled = false;
                    return;
                }
               
                elements.catalogStatus.innerHTML = `<span class="text-success">✓</span> Loaded ${products.length} products successfully!`;
                elements.loadCatalog.disabled = false;
               
                // Enable chat interface
                elements.userInput.disabled = false;
                elements.sendButton.disabled = false;
               
                // Add success message to chat
                addMessage("Product catalog loaded successfully! I can now provide personalized Odlo product recommendations. How can I help you today?", "assistant");
               
                // Log first product for debugging
                console.log("Sample product:", products[0]);
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
   
    // Add user message to chat
    addMessage(userInput, "user");
    elements.userInput.value = '';
   
    // Show loading indicator
    isLoading = true;
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message assistant';
    loadingDiv.innerHTML = '<span class="loading"></span> Thinking...';
    elements.chatContainer.appendChild(loadingDiv);
    elements.chatContainer.scrollTop = elements.chatContainer.scrollHeight;
   
    try {
        // Prepare product catalog for Claude
        // Map fields to ensure consistency regardless of CSV structure
        const productSample = products.map(p => {
            // Handle possible field name variations
            return {
                id: p.id || p.gtin || p.mpn || '',
                title: p.title || '',
                description: p.description || '',
                price: p.price || p.sale_price || '',
                link: p.link || p.mobile_link || '',
                image_link: p.image_link || '',
                availability: p.availability || '',
                product_type: p.product_type || p.google_product_category || '',
                color: p.color || '',
                size: p.size || '',
                gender: p.gender || '',
                material: p.material || ''
            };
        });
       
        // Create system prompt
        const systemPrompt = `You are Odlo's product recommendation assistant. Your job is to help customers find the perfect Odlo products based on their needs.

GUIDELINES:
1. ONLY recommend products from the catalog provided below.
2. If a customer asks for something not in the catalog, suggest the closest alternative.
3. NEVER mention competitors or compare to other brands.
4. Always highlight Odlo's unique features like fabric technology, sustainability aspects, and performance benefits.
5. Format your responses in a conversational, helpful manner.
6. When recommending products, clearly state the product name, ID, and key features.
7. Focus on technical performance aspects of the garments that make Odlo products superior.

Here's the available product catalog (first 100 products only):
${JSON.stringify(productSample)}`;

        // Call Claude API
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307', // Using Haiku to save costs for POC
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
       
        // Remove loading message
        elements.chatContainer.removeChild(loadingDiv);
        isLoading = false;
       
        // Add Claude's response
        addMessage(data.content[0].text, 'assistant');
       
    } catch (error) {
        // Remove loading message
        elements.chatContainer.removeChild(loadingDiv);
        isLoading = false;
       
        // Add error message
        showError(`API Error: ${error.message}`);
    }
}

/**
 * Adds a message to the chat container
 * @param {string} text - The message text
 * @param {string} sender - The sender (user, assistant, or system)
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
 * @param {string} message - The error message
 */
function showError(message) {
    addMessage(`Error: ${message}`, 'system');
}