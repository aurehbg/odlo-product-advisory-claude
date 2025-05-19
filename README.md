# Odlo Product Advisory with Claude

A proof-of-concept application demonstrating how Anthropic's Claude AI can provide personalized Odlo product recommendations based on customer queries.

## Features

- AI-powered product recommendations from Odlo's catalog
- Natural language processing of customer needs and preferences
- Product-aware responses that highlight Odlo's unique features

## Setup Instructions

1. Clone this repository
2. Get an API key from [Anthropic](https://console.anthropic.com/)
3. Add your API key to the application (in script.js)
4. Open index.html in your browser or deploy to GitHub Pages

## Configuration

- The application uses a CSV product feed from Odlo
- Only the first 100 products are used to conserve API tokens
- The system prompt is customized to provide Odlo-specific recommendations

## Testing Scenarios

Try asking questions like:
- "What should I wear for winter running?"
- "I need a base layer for skiing"
- "What's good for high-intensity workouts?"

## Security Note

For a production environment, you should never expose your API key in client-side code. This POC is for demonstration purposes only.