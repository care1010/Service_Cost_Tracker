const mysql = require('mysql2');
const path = require('path');
// This line ensures it finds the .env file in the current folder
require('dotenv').config({ path: path.join(__dirname, '../.env') }); 

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'data_project',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

module.exports = pool.promise();