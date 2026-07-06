// backend/server.js
require('dotenv').config();
const express = require('express');
const vision = require('@google-cloud/vision');
const cors = require('cors');
const { Client } = require('@googlemaps/google-maps-services-js');

const app = express();

// Initialize Vision API client with credentials if provided
let visionClient = null;
const credentialsStr = process.env.GOOGLE_CLOUD_VISION_CREDENTIALS;
if (credentialsStr && credentialsStr.trim() !== '' && credentialsStr !== 'your_google_cloud_credentials_json') {
  try {
    visionClient = new vision.ImageAnnotatorClient({
      credentials: JSON.parse(credentialsStr)
    });
    console.log('Google Cloud Vision Client initialized successfully');
  } catch (err) {
    console.error('Failed to parse Google Cloud Vision credentials, using mock mode:', err.message);
  }
} else {
  console.log('Google Cloud Vision credentials not provided, running in mock mode');
}

// Initialize Google Maps client
const googleMapsClient = new Client({});

// Use CORS middleware with proper configuration
app.use(cors({
  origin: '*',  // Be more specific in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware to parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// Root endpoint for health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Classify waste type based on Vision API labels
const classifyWasteType = (labels) => {
  const recyclableLabels = ['plastic bottle', 'bottle', 'can', 'paper', 'plastic', 'glass', 'metal'];
  const hazardousLabels = ['battery', 'electronics', 'chemical', 'paint'];
  const donatableLabels = ['clothes', 'furniture', 'book'];
  const organicLabels = ['food', 'organic'];

  const matchedLabel = labels.find(label =>
    [...recyclableLabels, ...hazardousLabels, ...donatableLabels, ...organicLabels].some(key => label.includes(key))
  );

  if (!matchedLabel) {
    return 'General Waste';
  }

  if (recyclableLabels.some(key => matchedLabel.includes(key))) {
    return 'Recyclable';
  } else if (hazardousLabels.some(key => matchedLabel.includes(key))) {
    return 'Hazardous';
  } else if (donatableLabels.some(key => matchedLabel.includes(key))) {
    return 'Donatable';
  } else if (organicLabels.some(key => matchedLabel.includes(key))) {
    return 'Organic';
  } else {
    return 'General Waste';
  }
};

// Generate mock labels based on the uploaded file name
const getMockLabels = (imageName) => {
  if (!imageName) {
    return ['plastic bottle', 'bottle', 'plastic', 'water bottle'];
  }
  const name = imageName.toLowerCase();
  if (name.includes('bottle') || name.includes('coke') || name.includes('pepsi') || name.includes('sprite')) {
    return ['plastic bottle', 'bottle', 'plastic', 'water bottle'];
  }
  if (name.includes('can') || name.includes('soda') || name.includes('tin') || name.includes('aluminum')) {
    return ['can', 'metal', 'aluminum'];
  }
  if (name.includes('paper') || name.includes('cardboard') || name.includes('box') || name.includes('envelope')) {
    return ['paper', 'cardboard'];
  }
  if (name.includes('food') || name.includes('banana') || name.includes('apple') || name.includes('orange') || name.includes('fruit') || name.includes('vegetable') || name.includes('compost') || name.includes('organic')) {
    return ['food', 'organic', 'organic waste'];
  }
  if (name.includes('wrapper') || name.includes('chip') || name.includes('snack') || name.includes('candy')) {
    return ['wrapper', 'plastic film', 'plastic'];
  }
  if (name.includes('glass') || name.includes('jar') || name.includes('cup') || name.includes('mug')) {
    return ['glass', 'glass container'];
  }
  if (name.includes('battery') || name.includes('cell')) {
    return ['battery', 'hazardous'];
  }
  if (name.includes('phone') || name.includes('laptop') || name.includes('computer') || name.includes('electronic') || name.includes('tv') || name.includes('cable') || name.includes('charger') || name.includes('device')) {
    return ['electronics', 'electronic device', 'hazardous'];
  }
  if (name.includes('chemical') || name.includes('toxic') || name.includes('spray') || name.includes('acid')) {
    return ['chemical', 'hazardous'];
  }
  if (name.includes('paint') || name.includes('can of paint')) {
    return ['paint', 'hazardous'];
  }
  if (name.includes('cloth') || name.includes('shirt') || name.includes('pants') || name.includes('jacket') || name.includes('sock') || name.includes('shoe')) {
    return ['clothes', 'clothing', 'donatable'];
  }
  if (name.includes('chair') || name.includes('table') || name.includes('desk') || name.includes('sofa') || name.includes('furniture')) {
    return ['furniture', 'donatable'];
  }
  if (name.includes('book') || name.includes('notebook') || name.includes('magazine') || name.includes('novel')) {
    return ['book', 'donatable', 'paper'];
  }
  if (name.includes('metal') || name.includes('steel') || name.includes('iron') || name.includes('copper')) {
    return ['metal', 'scrap metal'];
  }
  if (name.includes('plastic')) {
    return ['plastic', 'plastic container'];
  }

  // Fallback to random choice from the main categories to make mock mode feel alive
  const fallbacks = [
    ['plastic bottle', 'bottle', 'plastic', 'water bottle'],
    ['can', 'metal', 'aluminum'],
    ['paper', 'cardboard'],
    ['food', 'organic', 'organic waste'],
    ['wrapper', 'plastic film', 'plastic'],
    ['glass', 'glass container'],
    ['battery', 'hazardous'],
    ['electronics', 'electronic device', 'hazardous'],
    ['clothes', 'clothing', 'donatable'],
    ['book', 'donatable', 'paper']
  ];
  const randomIndex = Math.floor(Math.random() * fallbacks.length);
  return fallbacks[randomIndex];
};

// Function to classify image using Gemini API
const classifyWithGemini = async (imageBase64, apiKey) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "Classify the item in this image for waste sorting. Identify what the item is and return a list of lowercase labels describing it. One of the labels must be from this list if applicable: 'plastic bottle', 'bottle', 'can', 'paper', 'plastic', 'glass', 'metal', 'organic', 'battery', 'electronics', 'chemical', 'paint', 'clothes', 'furniture', 'book', 'wrapper', 'food'. Return the result strictly as a JSON array of strings, e.g., [\"label1\", \"label2\"]. Do not include any markdown formatting, backticks, or any text other than the JSON array itself."
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: imageBase64
                  }
                }
              ]
            }
          ]
        })
      }
    );

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error?.message || `Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    let text = data.candidates[0].content.parts[0].text.trim();
    
    // Clean JSON response from markdown blocks if any
    if (text.startsWith('```')) {
      text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
    }
    
    const parsedLabels = JSON.parse(text);
    if (Array.isArray(parsedLabels)) {
      return parsedLabels.map(l => l.toLowerCase());
    }
    return [];
  } catch (error) {
    console.error('Error classifying with Gemini API:', error.message);
    throw error;
  }
};

// Fetch nearby locations based on waste type and user location
const findNearbyLocations = async (wasteType, userLocation) => {
  let query;
  switch (wasteType) {
    case 'Recyclable':
      query = 'recycling center';
      break;
    case 'Hazardous':
      query = 'hazardous waste disposal';
      break;
    case 'Donatable':
      query = 'thrift store OR donation center';
      break;
    case 'Organic':
      query = 'compost facility';
      break;
    default:
      query = 'waste disposal';
  }

  if (!process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY.trim() === '' || process.env.GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key') {
    console.log('Google Maps API Key not set, returning mock locations');
    switch (wasteType) {
      case 'Recyclable':
        return [
          { name: 'EcoCycle Recycling Center', address: '100 Green Planet Way', rating: 4.7 },
          { name: 'City Bottle & Can Return', address: '220 Recycle Ave', rating: 4.3 }
        ];
      case 'Hazardous':
        return [
          { name: 'Hazardous Material Disposal Depot', address: '400 Industrial Blvd', rating: 4.6 }
        ];
      case 'Donatable':
        return [
          { name: 'Goodwill Donation Center', address: '15 Goodwill Lane', rating: 4.4 },
          { name: 'Hope Thrift Store', address: '88 Charity Street', rating: 4.8 }
        ];
      case 'Organic':
        return [
          { name: 'Community Composting Facility', address: '55 Soil & Sprout Way', rating: 4.9 }
        ];
      default:
        return [
          { name: 'General Waste Transfer Station', address: '99 Dump Site Road', rating: 3.9 }
        ];
    }
  }

  try {
    const response = await googleMapsClient.placesNearby({
      params: {
        location: userLocation,
        radius: 5000,
        keyword: query,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    if (response.data.status !== 'OK') {
      console.error('Google Maps API Error:', response.data.status, response.data.error_message);
      return [];
    }

    return response.data.results.slice(0, 3).map(place => ({
      name: place.name,
      address: place.vicinity,
      rating: place.rating || 'N/A',
    }));
  } catch (error) {
    console.error('Error fetching nearby locations:', error);
    return [];
  }
};

// Endpoint to classify waste using Vision API / Gemini API / Mock fallback and suggest locations
app.post('/api/classify-waste', async (req, res) => {
  try {
    const { imageBase64, userLocation, imageName } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      return res.status(400).json({ error: 'User location (lat, lng) is required' });
    }

    let labels = [];
    let methodUsed = 'mock';

    // 1. Try Google Cloud Vision if initialized
    if (visionClient) {
      try {
        const [visionResult] = await visionClient.labelDetection({
          image: { content: imageBase64 },
        });
        labels = visionResult.labelAnnotations.map(label => label.description.toLowerCase());
        methodUsed = 'google-vision';
        console.log('Vision API Labels:', labels);
      } catch (err) {
        console.error('Vision API call failed:', err.message);
      }
    }

    // 2. If Vision failed or wasn't configured, try Gemini API if available
    if (labels.length === 0 && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
      try {
        console.log('Attempting classification with Gemini API...');
        labels = await classifyWithGemini(imageBase64, process.env.GEMINI_API_KEY);
        methodUsed = 'gemini';
        console.log('Gemini API Labels:', labels);
      } catch (err) {
        console.error('Gemini API classification failed:', err.message);
      }
    }

    // 3. Fallback to mock labels based on imageName
    if (labels.length === 0) {
      console.log('Running in mock mode, returning mock labels for filename:', imageName);
      labels = getMockLabels(imageName);
      methodUsed = 'mock';
    }

    // Classify waste type
    const wasteType = classifyWasteType(labels);

    // Fetch nearby locations
    const locations = await findNearbyLocations(wasteType, userLocation);

    res.json({ labels, wasteType, locations, methodUsed });
  } catch (error) {
    console.error('Error in /classify-waste:', error);
    res.status(500).json({ error: error.message || 'Failed to classify image' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

// Export the Express app for Vercel
module.exports = app;