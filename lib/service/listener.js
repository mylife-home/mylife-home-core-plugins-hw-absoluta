'use strict';

const EventEmitter = require('events');
const inbox        = require('inbox');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Listener');

class Listener extends EventEmitter {
  constructor(config) {
    super();
    this.imap = inbox.createConnection(parseInt(config.port), config.host, {
        secureConnection: config.tls,
        auth: {
            user: config.user,
            pass: config.password
        }
    });

    this.imap.on('error', (err) => this.error(err));
    this.imap.on('connect', () => this.openBox());
    this.imap.on('close', () => this.disconnected());
    this.imap.on('new', (msg) => this.newMail(msg));

    this.imap.connect();

    this.connected = false;
    this.box = null;
  }

  disconnected() {
    if(this.closed) { return; }
    this.error(new Error('disonnected!'));
  }

  error(err) {
    logger.error(err);
    this.emit('error', err);
    this.imap.end();
    this.setConnected(false);
    this.box = null;

    setTimeout(() => {
      if(this.closed) { return; }
      this.imap.connect();
    }, 5000);
  }

  close() {
    this.closed = true;
    this.imap.close();
    logger.debug('Closed');
    this.setConnected(false);
  }

  setConnected(value) {
    if(this.connected === value) { return; }
    this.connected = value;
    this.emit('connected', value);
  }

  openBox() {
    this.imap.openMailbox('INBOX', { readOnly: true }, (err, box) => {
      if(err) {
        return this.error(err);
      }

      logger.debug('Connected');
      this.setConnected(true);

      this.box = box;

      const since = new Date();
      since.setDate(since.getDate() - 3);

      this.imap.search({ since }, (err, results) => {
        if(err) {
          return this.error(err);
        }

        this.emit('messages', results);
      });
    });
  }

  newMail(msg) {
    if(!this.box) { return; }
    this.emit('messages', [msg.UID]);
  }
}

module.exports = Listener;
