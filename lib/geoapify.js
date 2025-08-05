// lib/geoapify.js
const fetch = require('node-fetch');
const db    = require('../db');
const API_KEY = process.env.GEOAPIFY_KEY;

async function loadPOIs({ lon, lat, radius = 10000 }) {
  const url = new URL('https://api.geoapify.com/v2/places'+ 
    `categories=tourism.sights` +
    `&filter=circle:${lon},${lat},${radius}` +
    `&limit=50&apiKey=${API_KEY}`
  );
  url.search = new URLSearchParams({
    apiKey:     API_KEY,
    categories: 'tourism.sights|tourism.attraction|tourism.information',
    filter:     `circle:${lon},${lat},${radius}`,
    limit:      '50'
  }).toString();

  console.log('→ Geoapify URL:', url.toString());

  const resp = await fetch(url);
  const json = await resp.json();
  if (!Array.isArray(json.features)) {
    throw new Error(
      `Geoapify error ${resp.status}: ${json.error || json.message || 'no features'}`
    );
  }

  for (let feat of json.features) {
    const p = feat.properties;
    await new Promise((resolve, reject) => {
      db.query(
        `INSERT INTO locations
           (id, name, region, category, latitude, longitude)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name      = VALUES(name),
           region    = VALUES(region),
           category  = VALUES(category),
           latitude  = VALUES(latitude),
           longitude = VALUES(longitude)
        `,
        [
          p.xid,
          p.name           || 'Unknown',
          p.state          || p.country || '',
          p.categories?.split(',')[0] || '',
          p.lat,
          p.lon
        ],
        (err) => err ? reject(err) : resolve()
      );
    });
  }

  console.log(`✅ Upserted ${json.features.length} POIs into locations.`);
}

module.exports = { loadPOIs };
