'use strict';

const { Connection } = require('../lib/service/');

const con = new Connection({
  user     : process.argv[2],
  password : process.argv[3],
  host     : 'imap.gmail.com',
  port     : 993,
  tls      : true
});

con.on('error', (err) => console.error(err));