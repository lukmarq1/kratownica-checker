require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(express.json());

app.use(express.static(__dirname + '/public'));
app.use('/admin', express.static(__dirname + '/admin'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50
});

app.use(limiter);

const attempts = {};
const bans = {};

app.post('/api/verify', (req, res) => {

  const ip =
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress;

  const angle =
    parseInt(req.body.angle, 10);

  if(!attempts[ip]){
    attempts[ip] = 0;
  }

  if(bans[ip] && bans[ip] > Date.now()){

    return res.json({
      blocked:true
    });
  }

  if(angle === 42){

    return res.json({
      correct:true
    });
  }

  attempts[ip]++;

  const left = 2 - attempts[ip];

  if(attempts[ip] >= 2){

    bans[ip] =
      Date.now() + 24*60*60*1000;

    return res.json({
      blocked:true
    });
  }

  res.json({
    correct:false,
    left
  });
});

app.post('/api/admin/login', (req, res) => {

  const { username, password } =
    req.body;

  if(
    username === 'admin' &&
    password === 'admin123'
  ){

    return res.json({
      success:true
    });
  }

  res.status(401).json({
    error:'invalid'
  });
});

app.get('/api/admin/logs', (req, res) => {

  res.json([
    {
      status:'system',
      ip:'render-server',
      angle:'-',
      created_at:new Date()
    }
  ]);
});

app.listen(process.env.PORT || 3000, () => {

  console.log('SERVER RUNNING');
});
