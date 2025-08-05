const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { ensureLoggedIn, ensureRole } = require('../middleware/auth');
const transporter = require('../mailer');
// const { loadPOIs }                = require('../lib/geoapify');
const util   = require('util');
const dbQuery = util.promisify(db.query).bind(db);

// All /tourist/* routes require a logged‑in “tourist”
router.use(ensureLoggedIn, ensureRole('tourist'));

/** 1) Dashboard **/
router.get('/dashboard', (req, res, next) => {
  const THRESHOLD = 50;

  const sqlLatest = `
    SELECT f.id,
           l.id   AS location_id,
           l.name AS location,
           f.date_time,
           f.visitors
      FROM flow_data f
      JOIN locations l ON f.location_id = l.id
     ORDER BY f.date_time DESC
     LIMIT 20
  `;

  const sqlCrowd = `
    SELECT l.name AS location,
           f.visitors
      FROM flow_data f
      JOIN locations l ON f.location_id = l.id
     WHERE f.visitors > ?
       AND f.date_time >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
  `;

  const sqlRecommend = `
    SELECT l.id            AS location_id,
           l.name          AS location,
           AVG(f.visitors) AS avg_visitors
      FROM flow_data f
      JOIN locations l ON f.location_id = l.id
     WHERE f.date_time >= DATE_SUB(NOW(), INTERVAL 1 DAY)
     GROUP BY l.id, l.name
     ORDER BY avg_visitors ASC
     LIMIT 5
  `;
  
  db.query(
    `SELECT id, name, region, category
       FROM locations
      LIMIT 20`,    // or add WHERE filters
    (err, pois) => {
      if (err) return next(err);

      // 1) fetch latest
      db.query(sqlLatest, (err, latest) => {
        if (err) return next(err);

        // 2) fetch overcrowded
        db.query(sqlCrowd, [THRESHOLD], (err2, overcrowded) => {
          if (err2) return next(err2);

          // fire alert email (non‑blocking)
          if (overcrowded.length) {
            const mailOptions = {
              from:    `"Smart Tourism Alerts" <${process.env.EMAIL_USER}>`,
              to:      process.env.ALERT_EMAIL_RECIPIENTS,
              subject: '🚨 Overcrowded Alert',
              text: `
The following location(s) have exceeded ${THRESHOLD} visitors in the last 15 minutes:
${overcrowded.map(r => `${r.location} (${r.visitors})`).join(', ')}
              `
            };
            transporter.sendMail(mailOptions, (mailErr, info) => {
              if (mailErr) console.error('Alert email error:', mailErr);
              else        console.log('Alert email sent:', info.response);
            });
          }

          // 3) fetch recommendations
          db.query(sqlRecommend, (err3, recommendations) => {
            if (err3) return next(err3);

            // 4) render once all three are ready
            res.render('touristDashboard', {
              title:           'Tourist Dashboard',
              user:            req.session.user,
              latest,               // 20 most recent
              overcrowded,          // array of {location, visitors}
              recommendations,      // array of {location_id, location, avg_visitors}
              pois
            });
          });
        });
      });
    });
});


/**
 * GET /tourist/recommendations
 * Show just the customized recommendations
 */
router.get(
  '/recommendations',
  ensureLoggedIn, 
  ensureRole('tourist'),
  (req, res) => {
    res.render('recommendations', {
      title:           'Your Recommendations',
      user:            req.session.user,
      recommendations: null   // no data yet
    });
  }
);

/**
 * POST /tourist/recommendations
 * Run a query for the selected category and show top spots
 */
router.post(
  '/recommendations',
  ensureLoggedIn, 
  ensureRole('tourist'),
  (req, res, next) => {
    const interest = req.body.interest;
    // Validate the interest against allowed categories
    const allowed = ['nature','adventure','food','historical'];
    if (!allowed.includes(interest)) {
      return res.render('recommendations', {
        title:           'Your Recommendations',
        user:            req.session.user,
        recommendations: [],
        error:           'Invalid interest selected'
      });
    }

    // Aggregate visitors in last 24h per location for that category
    const sql = `
      SELECT
        l.id AS location_id,
        l.name           AS name,
        l.region         AS region,
        l.category       AS category,
        SUM(f.visitors)  AS total_visitors
      FROM flow_data f
      JOIN locations l
        ON f.location_id = l.id
      WHERE l.category = ?
        AND f.date_time >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      GROUP BY l.id
      ORDER BY total_visitors DESC
      LIMIT 5
    `;

    db.query(sql, [interest], (err, rows) => {
      if (err) return next(err);
      res.render('recommendations', {
        title:           'Your Recommendations',
        user:            req.session.user,
        recommendations: rows,
        error:           null
      });
    });
  }
);

/** 2) Filter **/
router.get('/filter', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.redirect('/tourist/dashboard');

  const sql = `
    SELECT l.name      AS location,
           f.date_time,
           f.visitors
      FROM flow_data f
      JOIN locations l ON f.location_id = l.id
     WHERE f.date_time BETWEEN ? AND ?
     ORDER BY f.date_time DESC
  `;

  db.query(sql, [from, to], (err, rows) => {
    if (err) return res.sendStatus(500);
    res.render('touristFiltered', {
      title: 'Filtered Results',
      user:  req.session.user,
      rows,
      from, to
    });
  });
});

/** 3) Map **/
router.get('/map', ensureLoggedIn, ensureRole('tourist'), async (req, res, next) => {
  try {
    // 1) Pull POIs (must have lat/lng columns in your locations table)
    const pois = await dbQuery(
      `SELECT id, name, latitude, longitude
         FROM locations
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL`
    );

    // 2) Call the external API
    const { getLiveTraffic } = require('../services/footTraffic');
    const pins = await getLiveTraffic(pois);

    // 3) Render
    res.render('touristMap', {
      title: 'Map View',
      user:  req.session.user,
      pins
    });
  } catch (err) {
    console.error('Error loading map:', err);
    next(err);
  }
});



/** 4) Bookmarks List **/
router.get('/bookmarks', (req, res) => {
  const sql = `
    SELECT b.id,
           l.id   AS location_id,
           l.name AS location
      FROM bookmarks b
      JOIN locations l ON b.location_id = l.id
     WHERE b.user_id = ?
     ORDER BY l.name
  `;
  db.query(sql, [req.session.user.id], (err, bookmarks) => {
    if (err) return res.sendStatus(500);
    res.render('touristBookmarks', {
      title:     'Your Bookmarks',
      user:      req.session.user,
      bookmarks
    });
  });
});

/** 5) Add Bookmark **/
router.post('/bookmark', (req, res) => {
  const userId     = req.session.user.id;
  const locationId = req.body.location_id;
  if (!locationId) {
    return res.redirect('/tourist/dashboard');
  }

  db.query(
    'INSERT IGNORE INTO bookmarks (user_id, location_id) VALUES (?, ?)',
    [userId, locationId],
    err => {
      if (err) console.error('Bookmark failed:', err);
      res.redirect('/tourist/bookmarks');
    }
  );
});

module.exports = router;
