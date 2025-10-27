/**
 * Rhine Water Level Monitor - CORS Proxy Server
 * Simple Node.js server to proxy requests to the Cologne API
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// API endpoint
const COLOGNE_API = 'https://www.stadt-koeln.de/interne-dienste/hochwasser/pegel_ws.php';

// Enable CORS for all routes
app.use(cors());

// Serve static files from the current directory
app.use(express.static(__dirname));

// API proxy endpoint
app.get('/api/pegel', async (req, res) => {
  try {
    console.log('Fetching data from Cologne API...');
    
    // Use dynamic import for node-fetch
    const fetch = (await import('node-fetch')).default;
    
    const response = await fetch(COLOGNE_API, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const xmlData = await response.text();
    
    console.log('Data fetched successfully, sending to client...');
    
    // Set appropriate headers
    res.set('Content-Type', 'text/xml; charset=utf-8');
    res.send(xmlData);

  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).json({
      error: 'Failed to fetch water level data',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🌊 Rhine Water Level Monitor - Proxy Server');
  console.log('='.repeat(60));
  console.log(`Server running at: http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/pegel`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('='.repeat(60));
  console.log('Press Ctrl+C to stop the server');
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});