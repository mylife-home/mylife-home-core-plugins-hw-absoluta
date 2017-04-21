'use strict';

const { Connection, Database } = require('../lib/service/');

process.on('uncaughtException', err => {
  console.trace(err);
  process.exit(1);
});

const con = new Connection({
  user     : process.argv[2],
  password : process.argv[3],
  host     : 'imap.gmail.com',
  port     : 993,
  tls      : true
});

const db = new Database();

con.on('fetchBegin', () => db.beginBulk());
con.on('fetchEnd', () => db.endBulk());

con.on('message', (msg) => {
  db.addMessage(msg.bodies.TEXT, msg.attributes.uid);
});

db.on('activeChanged', console.log);

con.on('error', () => {});