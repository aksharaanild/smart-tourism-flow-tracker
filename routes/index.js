var express = require('express');
var router = express.Router();
var db = require('../db');


// Homepage
router.get('/', (req, res) => {
    res.render('index', { user: req.session.user || null });
});



//middleware for role-based access control
function requireRole(role) {
  return function (req, res, next) {
    if (req.session.user && req.session.user.role === role) {
      next();
    } else {
      res.status(403).send('Access denied');
    }
  };
}

//get data
router.get('/add', requireRole('business_owner'), (req, res) => {
  db.query('SELECT id, name FROM locations', (err, locations) => {
    if (err) {
      console.error(err);
      return res.send("Error fetching locations");
    }
    res.render('add', { error: null, locations, user: req.session.user });
  });
});



//Add data
router.post('/add', requireRole('business_owner'), (req, res) => {
  const { location_id, date_time, visitors } = req.body;

  if (!location_id || !date_time || !visitors) {
    return res.render('add', { error: 'All fields are required.', locations: [], user: req.session.user });
  }

  db.query(
    'INSERT INTO flow_data (location_id, date_time, visitors) VALUES (?, ?, ?)',
    [location_id, date_time, visitors],
    (err) => {
      if (err) {
        console.error(err);
        return res.render('add', { error: 'Database error', locations: [], user: req.session.user });
      }
      res.redirect('/admin/dashboard');
    }
  );
});


// About
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Us',
    user: req.session.user
  });
});

// Contact
router.get('/contact', (req, res) => {
  res.render('contact', {
    title:   'Contact Us',
    user:    req.session.user,
    success: req.query.success,   // from a redirect after POST
    error:   req.query.error
  });
});


// in routes/index.js
router.post('/contact', (req, res) => {
  const { name, email, message } = req.body;

  // Simple server‑side validation
  if (!name || !email || !message) {
    // Render with error and return immediately
    return res.render('contact', {
      title: 'Contact Us',
      user:  req.session.user,
      error: 'All fields are required.',
      success: null
    });
  }

  // (Here you might save to DB or send mail…)

  // On success, redirect once
  return res.redirect('/contact?success=Thank you! We’ll be in touch.');
  
});



//login form
router.get('/login', (req, res) => {
  res.render('login', {
    title: 'Login',
    user: req.session.user || null,
    error: null
  });
});

//Handle Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.query(
    'SELECT * FROM users WHERE username = ? AND password = ?',
    [username, password],
    (err, results) => {
      if (err) {
        console.error(err);
        return res.render('login', {
          title: 'Login',
          user: req.session.user || null,
          error: 'Database error'
        });
      }
      if (results.length > 0) {
        req.session.user = results[0];
        return res.redirect('/');
      } else {
        return res.render('login', {
          title: 'Login',
          user: req.session.user || null,
          error: 'Invalid username or password'
        });
      }
    }
  );
});

//logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

//Middleware to check if user is logged in 
function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
}

//register form
router.get('/register', (req, res) => {
  res.render('register', {
    user: req.session.user || null,
    title: 'Register',
    error: null
  });
});


router.post('/register', (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.render('register', { error: 'All fields are required' });
  }

  db.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, role], (err) => {
    if (err) {
      console.error(err);
      return res.render('register', { error: 'User already exists or database error' });
    }
    res.redirect('/login');
  });
});

// Redirect based on user role
router.get('/', (req, res) => {
  const user = req.session.user;

  if (user) {
    if (user.role === 'business_owner') return res.redirect('/admin/dashboard');
    if (user.role === 'city_planner') return res.redirect('/planner/dashboard');
     return res.redirect('/tourist/touristDashboard');
  }

  res.render('index', { user: null });
});




module.exports = router;
