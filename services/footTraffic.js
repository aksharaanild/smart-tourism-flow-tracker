// services/footTraffic.js
const API_KEY = process.env.BESTTIME_API_KEY;

async function getLiveTraffic(pois) {
  // pois: array of { id, name, latitude, longitude }
  const calls = pois.map(async ({ id, name, latitude, longitude }) => {
    const url =
      `https://besttime.app/api/v1/foot_traffic/live` +
      `?latitude=${latitude}&longitude=${longitude}&api_key=${API_KEY}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const json = await res.json();

    return {
      id,
      name,
      lat: latitude,
      lng: longitude,
      density: json.data.traffic_score     // or whatever field they return
    };
  });

  return Promise.all(calls);
}

module.exports = { getLiveTraffic };
