// alerts.js
const express    = require('express');
const router     = express.Router();
const cron       = require('node-cron');
const db         = require('./db');
const transporter = require('./mailer');

const THRESHOLD = 50;

cron.schedule('*/15 * * * *', () => {
  const sql = `
    SELECT l.name, f.visitors
      FROM flow_data f
      JOIN locations l ON f.location_id = l.id
     WHERE f.date_time >= DATE_SUB(NOW(), INTERVAL 15 MINUTE)
       AND f.visitors > ?
  `;
  db.query(sql, [THRESHOLD], (err, rows) => {
    if (err) return console.error('🔥 Alert-cron DB error:', err);
    if (!rows.length) return;        // nothing to alert

    const list = rows.map(r => `${r.name} (${r.visitors})`).join(', ');
    const mailOptions = {
      from:    `"Tourism Alerts" <${process.env.EMAIL_USER}>`,
      to:      process.env.ALERT_EMAIL_RECIPIENTS,
      subject: '🚨 Overcrowding Alert',
      text:    `These locations exceeded ${THRESHOLD} visitors in the last 15 min:\n${list}`
    };
    transporter.sendMail(mailOptions, (mailErr, info) => {
      if (mailErr) console.error('🔥 Alert email error:', mailErr);
      else        console.log('✅ Alert email sent:', info.response);
    });
  });
});

// NEW: Manual test endpoint
router.get('/alerts/send-test', (req, res) => {
  const mailOptions = {
    from:    `"Tourism Alerts Test" <${process.env.EMAIL_USER}>`,
    to:      process.env.ALERT_EMAIL_RECIPIENTS,
    subject: '🚨 Test Email from Smart Tourism Flow Tracker',
    text:    'This is a test of the alerting system.'
  };

  

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error('Test email error:', err);
      return res.status(500).send('Test email failed. Check server console.');
    }
    console.log('Test email sent:', info.response);
    res.send('✅ Test email sent! Check your inbox (and spam).');
  });
});



// export router so app.js can mount it
module.exports = router;
