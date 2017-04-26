'use strict';

const EventEmitter = require('events');
const inbox        = require('inbox');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Listener');

class Listener extends EventEmitter {
  constructor(config) {
    super();

    this.config = {
      port    : parseInt(config.port),
      host    : config.host,
      options : {
        secureConnection : config.tls,
        auth : {
          user : config.user,
          pass : config.password
        }
      }
    };

    this.connected = false;
    this.box = null;
    this.reconnectTimer = null;

    this.createConnection();
  }

  createConnection() {
    if(this.closed) {
      return;
    }

    this.imap = inbox.createConnection(this.config.port, this.config.host, this.config.options);

    this.imap.on('error', (err) => this.error(err));
    this.imap.on('connect', () => this.openBox());
    this.imap.on('new', (msg) => this.newMail(msg));

    this.imap.connect();
  }

  releaseConnection() {
    if(this.imap) {
      this.imap._close(); // internal call to do proper cleanup, remove all listeners ...
      this.imap = null;
    }

    if(this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setConnected(false);
    this.box = null;
  }

  error(err) {
    logger.error(err);
    this.emit('error', err);

    this.releaseConnection();

    if(this.closed) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.createConnection();
    }, 5000);
  }

  close() {
    this.closed = true;
    this.releaseConnection();
    logger.debug('Closed');
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
