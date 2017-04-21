'use strict';

const EventEmitter = require('events');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Repository');

class Repository extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(100); // each zone adds listener

    this.accesses = new Map();
  }

  add(key, access) {
    this.accesses.set(key, access);
    logger.debug('Added access: ' + key);
    this.emit('changed', { type: 'add', key} );
  }

  remove(key) {
    this.accesses.delete(key);
    logger.debug('Removed access: ' + key);
    this.emit('changed', { type: 'remove', key} );
  }

  get(key) {
    return this.accesses.get(key);
  }
}

module.exports = new Repository();