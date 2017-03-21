'use strict';

const EventEmitter = require('events');
const Imap         = require('imap');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Connection');

class Connection extends EventEmitter {
  constructor(config) {
    super();
    this.imap = new Imap(config);

    this.imap.on('error', (err) => this.error(err));
    this.imap.on('ready', () => this.beginOpenBox());

    // TODO: get ids
    this.imap.on('mail', (count) => {
      if(!this.box) { return; } // first is total count
      const total = this.box.messages.total;
      this.beginReadMessages(`${total-count}:${total}`);
    });

    this.imap.connect();
  }

  error(err) {
    this.emit('error', err);
    this.imap.end();
    this.box = null;
    setTimeout(() => {
      if(this.closed) { return; }
      this.imap.connect();
    }, 5000);
  }

  close() {
    this.closed = true;
    this.imap.end();
  }

  beginOpenBox() {
    this.imap.openBox('INBOX', true, (err, box) => this.endOpenBox(err, box));
  }

  endOpenBox(err, box) {
    if(err) {
      return this.error(err);
    }

    this.box = box;

    const since = new Date();
    since.setDate(since.getDate() - 3);

    this.imap.search([ ['SINCE', since] ], (err, results) => {
      if(err) {
        return this.error(err);
      }

      this.beginReadMessages(results);
    });

  }

  beginReadMessages(msgs) {
    console.log(msgs);
  }
}

module.exports = Connection;
