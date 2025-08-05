// routes/admin.js
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { ensureLoggedIn, ensureRole } = require('../middleware/auth');

// Protect everything here for business_owner
router.use(ensureLoggedIn, ensureRole('business_owner'));



/** 1) DASHBOARD (table + 7‑day trend) **/
router.get('/dashboard', (req, res) => {
  // a) recent entries
  const sqlEntries = `
    SELECT f.id,
           l.name      AS location,
           f.date_time,
           f.visitors
      FROM flow_data f
      JOIN locations l ON f.location_id = l.id
     ORDER BY f.date_time DESC
     LIMIT 20
  `;

  // b) last 7‑day trend
  const sqlTrend = `
    SELECT 
      l.name        AS location,
      DATE(f.date_time) AS day,
      TIME(f.date_time) AS time,
      SUM(f.visitors)    AS visitors
    FROM flow_data f
    JOIN locations l ON f.location_id = l.id
    WHERE f.date_time >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
    GROUP BY location, day
    ORDER BY day
    `;

  db.query(sqlEntries, (err, entries) => {
    if (err) return res.status(500).send('Entries query failed');


    db.query(sqlTrend, (err2, trendData) => {
      if (err2) {
        console.error('Trend query failed:', err2);
        // fallback to empty trend
        trendData = [];
      }

      res.render('adminDashboard', {
        title:     'Admin Dashboard',
        user:      req.session.user,
        entries,               // for the table
        trendData   // for the 7-day trend
      });
    });
  });
});



/** 2) CRUD FOR FLOW DATA **/
// Show add entry form
router.get('/add', (req, res) => {
  db.query('SELECT id,name FROM locations', (err, locations) => {
    if (err) {
      console.error('Add form load failed:', err);
      return res.sendStatus(500);
    }
    res.render('addEntry', {
      title:     'Add New Entry',
      user:      req.session.user,
      locations,
      error:     null
    });
  });
});

// Handle add entry
router.post('/add', (req, res) => {
  const { location_id, date_time, visitors } = req.body;
  if (!location_id || !date_time || !visitors) {
    // reload form on error
    return db.query('SELECT id,name FROM locations', (err, locations) => {
      res.render('addEntry', {
        title:     'Add New Entry',
        user:      req.session.user,
        locations,
        error:     'All fields are required.'
      });
    });
  }

  db.query(
    'INSERT INTO flow_data (location_id, date_time, visitors) VALUES (?, ?, ?)',
    [location_id, date_time, visitors],
    err => {
      if (err) {
        console.error('Insert failed:', err);
        return res.sendStatus(500);
      }
      res.redirect('/admin/dashboard');
    }
  );
});

// Show edit form
router.get('/edit/:id', (req, res) => {
  const entryId = req.params.id;
  db.query('SELECT * FROM flow_data WHERE id=?', [entryId], (err, rows) => {
    if (err || !rows.length) {
      console.error('Load edit failed:', err);
      return res.redirect('/admin/dashboard');
    }
    const entry = rows[0];
    db.query('SELECT id,name FROM locations', (e2, locations) => {
      res.render('editEntry', {
        title:     'Edit Entry',
        user:      req.session.user,
        entry,     // { id, location_id, date_time, visitors }
        locations,
        error:     null
      });
    });
  });
});

// Handle edit submit
router.post('/edit/:id', (req, res) => {
  const entryId = req.params.id;
  const { location_id, date_time, visitors } = req.body;
  if (!location_id || !date_time || !visitors) {
    // reload with error
    return db.query('SELECT id,name FROM locations', (err, locations) => {
      res.render('editEntry', {
        title:     'Edit Entry',
        user:      req.session.user,
        entry:     { id: entryId, location_id, date_time, visitors },
        locations,
        error:     'All fields are required.'
      });
    });
  }

  db.query(
    'UPDATE flow_data SET location_id=?, date_time=?, visitors=? WHERE id=?',
    [location_id, date_time, visitors, entryId],
    err => {
      if (err) {
        console.error('Update failed:', err);
        return res.sendStatus(500);
      }
      res.redirect('/admin/dashboard');
    }
  );
});

// Delete entry
router.post('/delete', (req, res) => {
  const { id } = req.body;
  db.query('DELETE FROM flow_data WHERE id=?', [id], err => {
    if (err) console.error('Delete failed:', err);
    res.redirect('/admin/dashboard');
  });
});



/** 3) USER MANAGEMENT **/
// List users
router.get('/users', (req, res) => {
  db.query(
    'SELECT id, username, role FROM users',
    (err, users) => {
      if (err) return res.sendStatus(500);
      res.render('adminUsers', {
        title: 'Manage Users',
        user:  req.session.user,
        users
      });
    }
  );
});


// Add user form
router.get('/users/add', (req, res) => {
  res.render('register', {
    title: 'Add New User',
    user:  req.session.user,
    error: null
  });
});

// Handle add user
router.post('/users/add', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.render('register', {
      title: 'Add New User',
      user:  req.session.user,
      error: 'All fields are required.'
    });
  }
  db.query(
    'INSERT INTO users(username,password,role) VALUES(?,?,?)',
    [username, password, role],
    err => {
      if (err) {
        console.error('User insert failed:', err);
        return res.render('register', {
          title: 'Add New User',
          user:  req.session.user,
          error: 'User exists or DB error.'
        });
      }
      res.redirect('/admin/users');
    }
  );
});

// Edit user form
router.get('/users/:id/edit', (req, res) => {
  db.query('SELECT id,username,role FROM users WHERE id=?',[req.params.id], (err, rows) => {
    if (err || !rows.length) return res.redirect('/admin/users');
    res.render('editUser', {
      title:    'Edit User',
      user:     req.session.user,
      editUser: rows[0],
      roles:    ['tourist','business_owner','city_planner'],
      error:    null
    });
  });
});

// Handle edit user
router.post('/users/:id/edit', (req, res) => {
  db.query(
    'UPDATE users SET role=? WHERE id=?',
    [req.body.role, req.params.id],
    err => err
      ? (console.error('User update failed:', err), res.sendStatus(500))
      : res.redirect('/admin/users')
  );
});

// Delete user
router.post('/users/:id/delete', (req, res) => {
  db.query('DELETE FROM users WHERE id=?', [req.params.id], err => {
    if (err) console.error('User delete failed:', err);
    res.redirect('/admin/users');
  });
});

module.exports = router;
