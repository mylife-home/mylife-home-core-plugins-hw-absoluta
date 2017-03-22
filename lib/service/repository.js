'use strict';

const EventEmitter = require('events');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Repository');

class Repository extends EventEmitter {
  constructor() {
    super();

    this.databases = new Map();
  }

  add(key, database) {
    this.databases.set(key, database);
    logger.debug('Added database: ' + key);
    this.emit('changed', { type: 'add', key} );
  }

  remove(key) {
    this.databases.delete(key);
    logger.debug('Removed database: ' + key);
    this.emit('changed', { type: 'remove', key} );
  }

  get(key) {
    return this.databases.get(key);
  }
}

module.exports = new Repository();