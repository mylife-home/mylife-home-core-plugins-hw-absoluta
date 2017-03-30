'use strict';

const EventEmitter = require('events');
const Imap         = require('imap');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Listener');

class Listener extends EventEmitter {
  constructor(config) {
    super();
    this.imap = new Imap(config);

    this.imap.on('error', (err) => this.error(err));
    this.imap.on('ready', () => this.beginOpenBox());
    this.imap.on('mail', (numNewMsgs) => this.newMails(numNewMsgs));

    this.imap.connect();

    this.connected = false;
    this.box = null;
    this.lastUid = null;
  }

  error(err) {
    logger.error(err);
    this.emit('error', err);
    this.imap.end();
    this.setConnected(false);
    this.box = null;
    this.lastUid = null;

    setTimeout(() => {
      if(this.closed) { return; }
      this.imap.connect();
    }, 5000);
  }

  close() {
    this.closed = true;
    this.imap.end();
    logger.debug('Closed');
    this.setConnected(false);
  }

  setConnected(value) {
    if(this.connected === value) { return; }
    this.connected = value;
    this.emit('connected', value);
  }

  beginOpenBox() {
    this.imap.openBox('INBOX', true, (err, box) => this.endOpenBox(err, box));
  }

  endOpenBox(err, box) {
    if(err) {
      return this.error(err);
    }

    logger.debug('Connected');
    this.setConnected(true);

    this.box = box;

    const since = new Date();
    since.setDate(since.getDate() - 3);

    this.imap.search([ ['SINCE', since] ], (err, results) => {
      if(err) {
        return this.error(err);
      }

      this.lastUid = results[results.length - 1];

      this.emit('messages', results);
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
