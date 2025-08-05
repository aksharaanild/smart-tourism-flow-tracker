// lib/statsnz.js
const fetch = require('node-fetch');
const db    = require('../db');
const API    = 'https://api.stats.govt.nz/v1/data/TE_MR/data';

/**
 * Fetch quarterly visitor estimates and upsert them into tourism_estimates.
 */
async function loadTourismEstimates({ startQ='2023-Q1', endQ='2024-Q1'}={}) {
  const url = `https://api.stats.govt.nz/v1/data/TE_MR/data?startPeriod=${startQ}&endPeriod=${endQ}`;
  console.log('→ StatsNZ URL:', url);

  const resp = await fetch(url);
  if (resp.status === 502) {
    console.warn('⚠️ StatsNZ is down (502), skipping this run.');
    return;
  }
  if (!resp.ok) {
    throw new Error(`StatsNZ ${resp.status}: ${resp.statusText}`);
  }
  const json = await resp.json();

  // Create table if it doesn’t exist:
  await new Promise((r, rej) => db.query(`
    CREATE TABLE IF NOT EXISTS tourism_estimates (
      region      VARCHAR(64),
      period      VARCHAR(16),
      visitors    INT,
      PRIMARY KEY(region, period)
    )`, err => err ? rej(err) : r())
  );

  // Upsert each series
  for (let series of json.data) {
    const region   = series.dimensions.Region;
    for (let obs of series.observations) {
      const period  = obs.period;
      const visitors = obs.value;
      await new Promise((r, rej) => db.query(`
        INSERT INTO tourism_estimates 
          (region, period, visitors) 
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE visitors = VALUES(visitors)
      `, [region, period, visitors], err => err ? rej(err) : r()));
    }
  }
}

module.exports = { loadTourismEstimates };
