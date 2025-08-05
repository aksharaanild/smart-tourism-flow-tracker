// routes/planner.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { ensureLoggedIn, ensureRole } = require('../middleware/auth');
const { Parser } = require('json2csv');

// all /planner/* require city_planner role
router.use(ensureLoggedIn, ensureRole('city_planner'));

router.get('/dashboard', (req, res, next) => {
  // optional filters from querystring
  const { region, from, to } = req.query;
  const params = [];
  let where = 'WHERE 1=1';
  if (region) {
    where += ' AND l.region = ?';
    params.push(region);
  }
  if (from && to) {
    where += ' AND f.date_time BETWEEN ? AND ?';
    params.push(from, to);
  }

  // 1) Aggregate by region
  const sqlAgg = `
    SELECT
      l.region,
      SUM(f.visitors) AS total_visitors
    FROM flow_data f
    JOIN locations l ON f.location_id = l.id
    ${where}
    GROUP BY l.region
    ORDER BY total_visitors DESC
  `;

  // 2) Time series (daily totals) for chart & trend
  const sqlTime = `
    SELECT
      DATE(f.date_time) AS day,
      SUM(f.visitors)    AS total
    FROM flow_data f
    JOIN locations l ON f.location_id = l.id
    ${where}
    GROUP BY day
    ORDER BY day
  `;

  db.query(sqlAgg, params, (err, aggRows) => {
    if (err) return next(err);
    db.query(sqlTime, params, (err2, timeRows) => {
      if (err2) return next(err2);
      // 3) compute simple “prediction”: carry forward last 7‑day average
      const last7 = timeRows.slice(-7).map(r => r.total);
      const pred = last7.length
        ? Math.round(last7.reduce((a,b)=>a+b,0)/last7.length)
        : 0;

      // **HERE**: build a filter object with defaults
      const filter = {
        region: region || '',
        from:   from   || '',
        to:     to     || ''
      };

      res.render('plannerDashboard', {
        title:        'Planner Dashboard',
        user:         req.session.user,
        aggData:      aggRows,      // [{region, total_visitors}, …]
        timeSeries:   timeRows,     // [{day, total}, …]
        prediction:   pred,
        filter
      });
    });
  });
});

router.get('/stats', ensureRole('city_planner'), (req, res, next) => {
  db.query(
    'SELECT region, period, visitors FROM tourism_estimates ORDER BY region, period',
    (err, rows) => {
      if (err) return next(err);
      res.render('plannerStatsNZ', {
        title: 'Official NZ Tourism Estimates',
        user: req.session.user,
        stats: rows
      });
    }
  );
});

// CSV export
router.get(
  '/dashboard.csv',
  ensureLoggedIn, ensureRole('city_planner'),
  (req, res, next) => {
    const sql = `
      SELECT
        l.region,
        DATE(f.date_time) AS day,
        SUM(f.visitors)   AS total_visitors
      FROM flow_data f
      JOIN locations l ON f.location_id = l.id
      GROUP BY l.region, day
      ORDER BY l.region, day
    `;

    db.query(sql, (err, rows) => {
      if (err) return next(err);

      console.log('Exporting', rows.length, 'records');
      const { Parser } = require('json2csv');
      const parser = new Parser({ fields: ['region','day','total_visitors'] });
      const csv    = parser.parse(rows);

      res.header('Content-Type','text/csv');
      res.attachment('planner_report.csv');
      res.send(csv);
    });
  }
);

module.exports = router;
