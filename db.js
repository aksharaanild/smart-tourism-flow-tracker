const mysql = require('mysql');
require('dotenv').config();

const pool  = mysql.createPool({
    host:            process.env.DB_HOST     || 'localhost',
    port:            process.env.DB_PORT     || 3307,
    user:            process.env.DB_USER     || 'root',
    password:        process.env.DB_PASS     || '',
    database:        process.env.DB_NAME     || 'tourism_db',
    connectionLimit: 10
    // host: 'localhost',
    // port           : 3307,
    // user: 'root',        //MySQL username
    // password: '',        //MySQL password
    // database: 'tourism_db',
    // connectionLimit: 10,
    // connectTimeout: 10000
});

pool.on('error', err => {
    console.error('❌ MySQL pool connection error:', err);
});

// export a convenience wrapper
module.exports = {
  query(sql, params, cb) {
    return pool.query(sql, params, cb);
  },
  promiseQuery(sql, params=[]) {
    return new Promise((res, rej) =>
      pool.query(sql, params, (e,r) => e ? rej(e) : res(r))
    );
  }
};
