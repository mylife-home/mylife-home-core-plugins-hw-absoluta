'use strict';

const EventEmitter = require('events');
const Imap         = require('imap');
const streamReader = require('read-all-stream');
const libqp        = require('libqp');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Connection');

class Connection extends EventEmitter {
  constructor(config) {
    super();
    this.imap = new Imap(config);

    this.imap.on('error', (err) => this.error(err));
    this.imap.on('ready', () => this.beginOpenBox());

    this.imap.on('mail', (count) => {
      if(!this.box) { return; } // first is total count
      const total = this.box.messages.total;
      this.fetchMessages(`${total-count+1}:${total}`);
    });

    this.imap.connect();
  }

  error(err) {
    logger.error(err);
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

    logger.debug('Connected');

    this.box = box;

    const since = new Date();
    since.setDate(since.getDate() - 3);

    this.imap.search([ ['SINCE', since] ], (err, results) => {
      if(err) {
        return this.error(err);
      }

      this.fetchMessages(results);
    });

  }

  fetchMessages(msgs) {
    const fetch = this.imap.fetch(msgs, { bodies: ['HEADER.FIELDS (FROM SUBJECT)', 'TEXT'] });
    fetch.on('error', (err) => this.error(err));
    fetch.on('message', (msg, seqno) => this.readMessage(msg, seqno));
  }

  readMessage(msg, seqno) {
    const message   = { seqno, bodies: {} };
    let streamCount = 0;
    let ended       = false;

    const dispatchMessageIfReady = () => {
      if(ended && streamCount === 0) {
        this.emit('message', message);
      }
    }

    msg.on('attributes', (attributes) => message.attributes = attributes);

    msg.on('end', () => {
      ended = true;
      dispatchMessageIfReady();
    });

    msg.on('body', (stream, info) => {
      ++streamCount;

      if(info.which === 'TEXT') {
        const decoder = new libqp.Decoder();
        stream = stream.pipe(decoder);
      }

      streamReader(stream, 'utf8', (err, data) => {
        --streamCount;

        if(err) {
          return this.error(err);
        }

        if(info.which.startsWith('HEADER')) {
          data = Imap.parseHeader(data);
          if(Array.isArray(data.from) && data.from.length === 1) {
            data.from = data.from[0];
          }
          if(Array.isArray(data.subject) && data.subject.length === 1) {
            data.subject = data.subject[0];
          }
        }

        message.bodies[info.which] = data;

        dispatchMessageIfReady();
      });
    });
  }
}

module.exports = Connection;
