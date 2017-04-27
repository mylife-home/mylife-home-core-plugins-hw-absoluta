'use strict';

const EventEmitter = require('events');
const Imap         = require('imap');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Listener');

class Listener extends EventEmitter {
  constructor(config) {
    super();

    this.config = Object.assign({
      keepalive: { interval: 10000, idleInterval: 10000 }
    }, config);

    this.connected = false;
    this.box = null;
    this.reconnectTimer = null;

    this.createConnection();

    this.lastUid = null;
  }

  createConnection() {
    if(this.closed) {
      return;
    }

    this.imap = new Imap(this.config);

    this.imap.on('error', (err)        => this.error(err));
    this.imap.on('end',   ()           => this.error(new Error('disonnected: end')));
    this.imap.on('close', ()           => this.error(new Error('disonnected: close')));
    this.imap.on('ready', ()           => this.openBox());
    this.imap.on('mail',  (numNewMsgs) => this.newMails(numNewMsgs));

    this.imap.connect();
  }

  releaseConnection() {
    if(this.imap) {
      this.imap.removeAllListeners();
      this.imap.destroy();
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
    this.imap.openBox('INBOX', true, (err, box) => {
      if(err) {
        return this.error(err);
      }

      logger.debug('Connected');
      this.setConnected(true);

      this.box = box;

      let search;
      if(!this.lastUid) {
        const since = new Date();
        since.setDate(since.getDate() - 3);
        search = ['SINCE', since];
      } else {
        search = ['UID', `${this.lastUid}:*`];
      }

      this.imap.search([ search ], (err, results) => {
        if(err) {
          return this.error(err);
        }

        this.lastUid = results[results.length - 1];
        this.emit('messages', results);
      });
    });
  }

  newMails(numNewMsgs) {
    if(!this.box) { return; }
    const newUids = new Array(numNewMsgs);
    for(let i=0; i<numNewMsgs; ++i) {
      newUids[i] = ++this.lastUid;
    }
    this.emit('messages', newUids);
  }
}

module.exports = Listener;
