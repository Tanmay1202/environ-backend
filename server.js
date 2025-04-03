// backend/server.js
const express = require('express');
const vision = require('@google-cloud/vision');
const cors = require('cors');
const { Client } = require('@googlemaps/google-maps-services-js');

const app = express();

// Initialize Vision API client with credentials
let visionClient;
try {
  visionClient = new vision.ImageAnnotatorClient({
    credentials: JSON.parse(process.env.GOOGLE_CLOUD_VISION_CREDENTIALS || '{}')
  });
} catch (error) {
  console.error('Error initializing Vision API client:', error);
}

// Initialize Google Maps client
const googleMapsClient = new Client({});

// Use CORS middleware to allow requests from your frontend
app.use(cors({
  origin: [
    'https://5173-idx-environ-1742316025738.cluster-mwrgkbggpvbq6tvtviraw2knqg.cloudworkstations.dev',
    'http://localhost:5173',
    'https://environ-frontend.vercel.app',
    'https://*.vercel.app'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Middleware to parse JSON bodies with size limit
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
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

// Endpoint to classify waste using Vision API and suggest locations
app.post('/api/classify-waste', async (req, res) => {
  try {
    const { imageBase64, userLocation } = req.body;
    
    // Validate input
    if (!imageBase64) {
      return res.status(400).json({ 
        error: 'No image data provided',
        details: 'Please provide a valid base64 encoded image'
      });
    }
    
    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      return res.status(400).json({ 
        error: 'Invalid location data',
        details: 'Please provide valid latitude and longitude coordinates'
      });
    }

    // Check if Vision API client is initialized
    if (!visionClient) {
      throw new Error('Vision API client not initialized');
    }

    // Use Google Cloud Vision API for label detection
    const [visionResult] = await visionClient.labelDetection({
      image: { content: imageBase64 },
    });

    const labels = visionResult.labelAnnotations.map(label => label.description.toLowerCase());
    console.log('Vision API Labels:', labels);

    // Classify waste type
    const wasteType = classifyWasteType(labels);

    // Fetch nearby locations
    const locations = await findNearbyLocations(wasteType, userLocation);

    res.json({ 
      labels, 
      wasteType, 
      locations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in /classify-waste:', error);
    res.status(500).json({ 
      error: 'Failed to classify image',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
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