'use strict';

const EventEmitter = require('events');
const Imap         = require('imap');
const streamReader = require('read-all-stream');
const libqp        = require('libqp');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Connection');
const Listener     = require('./listener');
const Fetcher      = require('./fetcher');

const STATUS = {
  pending  : 0,
  fetching : 1
};

class Connection extends EventEmitter {
  constructor(config) {
    super();
    this.emitter.setMaxListeners(100); // each zone adds listener

    this.config = config;

    this.fetchQueue = new Map();
    this.fetcher = null;
    this.fetcherIdleTimeout = null;

    this.listener = new Listener(this.config);
    this.listener.on('connected', (value) => this.emit('connected', value));
    this.listener.on('error', (err) => this.emit('error', err));
    this.listener.on('messages', (list) => this.messages(list));
  }

  get connected() {
    return this.listener.connected;
  }

  close() {
    this.listener.close();
    this.deleteFetcher();
  }

  messages(list) {
    for(const id of list) {
      this.fetchQueue.set(id, STATUS.pending);
    }

    this.executeFetch();
  }

  executeFetch() {
    this.fetcherIdleTimeout && clearTimeout(this.fetcherIdleTimeout);

    if(!this.fetcher) {
      this.createFetcher();
      return;
    }

    if(this.fetcher.status !== 'idle') {
      return;
    }

    if(this.fetchQueue.size) {
      for(const key of this.fetchQueue.keys()) {
        this.fetchQueue.set(key, STATUS.fetching);
      }

      this.fetcher.fetchMessages(Array.from(this.fetchQueue.keys()));
      return;
    }

    // nothing to do, prepare to idle
    this.fetcherIdleTimeout = setTimeout(() => this.deleteFetcher(), 30000);
  }

  createFetcher() {
    this.fetcher = new Fetcher(this.config);

    this.fetcher.on('fetchEnd', () => {
      this.emit('fetchEnd');
      this.executeFetch();
    });

    this.fetcher.on('fetchBegin', () => this.emit('fetchBegin'));

    this.fetcher.on('message', (msg) => {
      this.fetchQueue.delete(msg.attributes.uid);
      this.emit('message', msg);
    });

    this.fetcher.on('error', (err) => {
      for(const key of this.fetchQueue.keys()) {
        this.fetchQueue.set(key, STATUS.pending);
      }

      this.emit('error', err);
    });

    this.fetcher.on('connected', () => this.executeFetch());
  }

  deleteFetcher() {
    this.fetcherIdleTimeout && clearTimeout(this.fetcherIdleTimeout);
    this.fetcherIdleTimeout = null;
    if(!this.fetcher) { return; }
    this.fetcher.close();
    this.fetcher = null;
  }
}

module.exports = Connection;
