require('dotenv').config(); 
require('./alerts');
const express = require('express');
const path        = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const cron = require('node-cron');

// const { loadPOIs } = require('./lib/geoapify');
// const { loadTourismEstimates } = require('./lib/statsnz');
const indexRoutes = require('./routes/index');
const touristRoutes = require('./routes/tourist');
const plannerRoutes = require('./routes/planner');
const adminRoutes = require('./routes/admin');
const alertsRouter   = require('./alerts');

// create app
const app = express();

//view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
    secret: 'smart-tourism-secret',
    resave: false,
    saveUninitialized: false
}));

// make Google Maps key available in your EJS
app.locals.GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_KEY;

// routes
app.use('/', indexRoutes);
app.use('/tourist', touristRoutes);
app.use('/planner', plannerRoutes);
app.use('/admin', adminRoutes);
app.use('/alerts', alertsRouter);


// Database connection
app.post('/delete/:id', (req, res) => {
  const id = req.params.id;
  const sql = 'DELETE FROM tourist_flow WHERE id = ?';

  db.query('DELETE FROM flow_data WHERE id = ?', [id], err => {
    if (err) {
      console.error('Error deleting record:', err);
      return res.status(500).send('Error deleting record');
    }
    res.redirect('/admin/dashboard');
  });
});


// error handler
app.use((err, req, res, next) => {
  console.error('🔥 Uncaught error:', err);
  res.status(500).send('Internal server error');
});

// start the alert cron job
require('./alerts');
const alertsRoutes = require('./alerts');
app.use(alertsRoutes);

// (async () => {
//   // try {
//   //   console.log('🔄 Loading Geoapify POIs…');
//   //   await loadPOIs({ lat: -41.29, lon: 174.78, radius: 20000 });
//   //   console.log('✅ Geoapify POIs loaded.');
//   // } catch (err) {
//   //   console.error('❌ Failed loading Geoapify POIs:', err);
//   // }
//   // try {
//     console.log('🔄 Loading initial StatsNZ tourism estimates…');
//     await loadTourismEstimates({ startQ:'2023-Q1', endQ:'2024-Q1' });
//     console.log('✅ StatsNZ data loaded.');
//   } catch (err) {
//     console.error('❌ Failed loading StatsNZ data:', err.message);
//   }
// })();

// // nightly refresh at 3:00am
// cron.schedule('0 3 * * *', async () => {
//   console.log('🌙 Nightly POI refresh…');
//   try {
//     await loadPOIs({ lat: -41.29, lon: 174.78, radius: 20000 });
//     console.log('✅ POIs refreshed.');
//     await loadTourismEstimates();
//     console.log('✅ StatsNZ refreshed.');
//   } catch (err) {
//     console.error('❌ Refresh failed:', err.message);
//   }
// });

// // on startup, fetch & upsert POIs
// (async () => {
//   try {
//     console.log('🔄 Loading initial StatsNZ tourism estimates…');
//     await loadTourismEstimates({
//       startPeriod: '2023-Q1',
//       endPeriod:   '2024-Q1',
//       regionCode:  null           // null = all regions
//     });
//   } catch (e) {
//     console.error('❌ Failed loading StatsNZ data:', e);
//   }
// })();

// nightly refresh at 02:00am
cron.schedule('0 2 * * *', async () => {
  console.log('🌙 Nightly StatsNZ refresh…');
  try {
    await loadTourismEstimates({
      startPeriod: '2023-Q1',
      endPeriod:   '2024-Q1',
      regionCode:  null
    });
  } catch (e) {
    console.error('❌ Refresh failed:', e);
  }
});


//Start Server
app.listen(3000);
console.log('Node app is running on port 3000');