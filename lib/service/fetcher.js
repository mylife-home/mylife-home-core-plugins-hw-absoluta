'use strict';

const EventEmitter = require('events');
const Imap         = require('imap');
const streamReader = require('read-all-stream');
const libqp        = require('libqp');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Fetcher');

class Fetcher extends EventEmitter {
  constructor(config) {
    super();
    this.imap = new Imap(config);

    this.imap.on('error', (err) => this.error(err));
    this.imap.on('ready', () => this.beginOpenBox());

    this.imap.connect();

    this.connected = false;
    this.box = null;
    this.setStatus('connecting');
  }

  error(err) {
    logger.error(err);
    this.status !== 'closed' && this.emit('error', err); // else nobody will listen and this will crash node
    this.imap.end();
    this.status = 'error';
  }

  close() {
    this.imap.end();
    logger.debug('Closed');
    this.setStatus('closed');
  }

  beginOpenBox() {
    this.imap.openBox('INBOX', true, (err, box) => this.endOpenBox(err, box));
  }

  endOpenBox(err, box) {
    if(err) {
      return this.error(err);
    }

    this.box = box;

    logger.debug('Connected');
    this.setStatus('idle');
    this.emit('connected');
  }

  setStatus(status) {
    if(this.status === status) { return; }
    this.status = status;
    this.emit('status', this.status);
  }

  fetchMessages(msgs) {
    if(this.status !== 'idle') {
      throw new Error(`Unable to fetch with status ${this.status}`);
    }

    if(msgs.length < 10) {
      logger.debug(`fetching messages with ids ${msgs}`);
    } else {
      logger.debug(`fetching ${msgs.length} messages (first=${msgs[0]}, last=${msgs[msgs.length - 1]})`);
    }

    this.setStatus('fetching');
    const fetch = this.imap.fetch(msgs, { bodies: ['HEADER.FIELDS (FROM SUBJECT)', 'TEXT'] });
    fetch.on('error', (err) => this.error(err));

    let ended = false;
    let readingCount = 0;

    const dispatchEndIfEnded = () => {
      if(ended && readingCount === 0) {
        this.setStatus('idle');
        this.emit('fetchEnd');
      }
    }

    fetch.on('message', (msg) => {
      ++readingCount;
      this.readMessage(msg, () => {
        --readingCount;
        dispatchEndIfEnded();
      });
    });

    fetch.on('end', () => {
      ended = true;
      dispatchEndIfEnded();
    });

    this.emit('fetchBegin');
  }

  readMessage(msg, done) {
    const message   = { bodies: {} };
    let streamCount = 0;
    let ended       = false;

    const dispatchMessageIfReady = () => {
      if(ended && streamCount === 0) {
        this.emit('message', message);
        done();
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

module.exports = Fetcher;
