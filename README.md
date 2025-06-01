# Environ Backend

A Node.js backend service for the Environ project, providing AI-powered waste classification and location-based disposal recommendations.

## 🚀 Features

- **AI-Powered Waste Classification**: Integration with Google Cloud Vision API for image analysis
- **Location-Based Recommendations**: Find nearby disposal facilities using Google Maps API
- **Waste Type Classification**: Intelligent categorization of waste into recyclable, hazardous, donatable, and organic
- **RESTful API**: Clean and well-documented endpoints
- **CORS Support**: Secure cross-origin resource sharing
- **Error Handling**: Comprehensive error handling and logging

## 🛠️ Tech Stack

- **Runtime**: Node.js (>=18.0.0)
- **Framework**: Express.js
- **AI Services**: Google Cloud Vision API
- **Location Services**: Google Maps Places API
- **Development**: Nodemon for hot reloading
- **Deployment**: Vercel

## 📦 Installation

1. Clone the repository:
```bash
git clone [your-repository-url]
cd environ-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
GOOGLE_CLOUD_VISION_CREDENTIALS=your_google_cloud_credentials_json
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
PORT=3000
```

## 🚀 Development

Start the development server:
```bash
npm run dev
```

Start the production server:
```bash
npm start
```

## 📁 Project Structure

```
environ-backend/
├── server.js          # Main application file
├── package.json       # Project dependencies and scripts
├── vercel.json        # Vercel deployment configuration
└── .env              # Environment variables (not in repo)
```

## 🔧 Configuration

- **Express**: Configured in `server.js`
- **CORS**: Enabled with secure defaults
- **Vercel**: Configured in `vercel.json`

## 📡 API Endpoints

### Health Check
- `GET /` - Root endpoint
- `GET /api/health` - Health check endpoint

### Waste Classification
- `POST /api/classify-waste`
  - Request Body:
    ```json
    {
      "imageBase64": "base64_encoded_image",
      "userLocation": {
        "lat": latitude,
        "lng": longitude
      }
    }
    ```
  - Response:
    ```json
    {
      "labels": ["label1", "label2", ...],
      "wasteType": "Recyclable|Hazardous|Donatable|Organic|General Waste",
      "locations": [
        {
          "name": "Location Name",
          "address": "Location Address",
          "rating": "Rating or N/A"
        }
      ]
    }
    ```

## 🚀 Deployment

The application is configured for deployment on Vercel. The deployment process is automated through the Vercel platform.

### Environment Variables
- `GOOGLE_CLOUD_VISION_CREDENTIALS`: JSON string of Google Cloud credentials
- `GOOGLE_MAPS_API_KEY`: Google Maps API key
- `PORT`: Server port (optional, defaults to 3000)


## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support, please contact [linkedin](https://www.linkedin.com/in/tanmay1202/), [X](https://x.com/tanmaybenot). 
