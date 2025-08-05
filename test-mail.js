require('dotenv').config();
const nodemailer = require('nodemailer');

(async () => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  try {
    let info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to:   process.env.ALERT_EMAIL_RECIPIENTS,
      subject: '🚨 Test Email from Smart Tourism Flow Tracker',
      text: 'This is a test of the alerting system.'
    });
    console.log('SMTP OK:', info.response);
  } catch (err) {
    console.error('SMTP error:', err);
  }
})();
