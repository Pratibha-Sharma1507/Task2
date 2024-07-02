const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const schedule = require('node-schedule');
const os = require('os-utils');
const { exec } = require('child_process');

const app = express();
app.use(bodyParser.json());

// Configure  MySQL database connection 
const pool = mysql.createPool({
  connectionLimit: 10,
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'task2'
});

pool.getConnection(function(err, connection) {
  if (err) {
    console.error('Error connecting to MySQL:', err.sqlMessage);
  } else {
    console.log('Connection established...');
    connection.release(); 
  }
});

// Store scheduled jobs
let scheduledJobs = [];

// POST endpoint to schedule a message
app.post('/schedule-message', (req, res) => {
  const { message, day, time } = req.body;

  if (!message || !day || !time) {
    return res.status(400).send('Please provide message, day, and time.');
  }

  
  const date = new Date(`${day}T${time}`);
  if (isNaN(date.getTime())) {
    return res.status(400).send('Invalid date or time format.');
  }

  // Schedule the job
  const job = schedule.scheduleJob(date, () => {
    console.log(`Scheduled job for message: "${message}" at ${day} ${time}`);

    // Insert into MySQL database
    const query = 'INSERT INTO post_service (message, day, time) VALUES (?, ?, ?)';
    const values = [message, day, time];

    pool.query(query, values, (error, results) => {
      if (error) {
        console.error('Error inserting message:', error.stack);
        return;
      }

      console.log('Message inserted successfully');
    });
  });

  // Store the job information
  scheduledJobs.push({ message, day, time, job });

  res.send('Message scheduled successfully');
});

function checkCPUUsage() {
    os.cpuUsage((v) => {
      console.log('CPU Usage (%): ' + v * 100);
      if (v > 0.70) {
        console.log('CPU usage is above 70%');
        restartServer();
  
        // Insert message into the database directly
        const message = "Your CPU utilization has exceeded 70%";
        const day = new Date().toISOString().slice(0, 10); 
        const time = new Date().toISOString().slice(11, 19); 
  
        const query = 'INSERT INTO post_service (message, day, time) VALUES (?, ?, ?)';
        const values = [message, day, time];
  
        pool.query(query, values, (error, results) => {
          if (error) {
            console.error('Error inserting message:', error);
            return;
          }
  
          console.log('Message inserted automatically:', { message, day, time });
        });
  
        // Clear scheduled jobs after insertion 
        scheduledJobs = [];
      }
    });
  }
  
function restartServer() {
  exec('pm2 restart ', (err, stdout, stderr) => {
    if (err) {
      console.error(`Error restarting server: ${err.message}`);
      return;
    }
    console.log(`Server restarted successfully:\n${stdout}`);
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
  });
}

// Check CPU usage every 5 seconds
setInterval(checkCPUUsage, 5000);

const port = 4000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
