'use strict';

const log4js = require('log4js');
const logger = log4js.getLogger('core-plugins-hw-absoluta.ImapBox');
const { Connection, Database, repository } = require('./service');

module.exports = class ImapBox {
  constructor(config) {

    this.online = 'off';

    this._key = config.key;
    this._connection = new Connection(config);
    const database = new Database();

    this._connection.on('connected', (value) => (this.online = value ? 'on' : 'off'));

    this._connection.on('fetchBegin', () => database.beginBulk());
    this._connection.on('fetchEnd', () => database.endBulk());

    this._connection.on('message', (msg) => {
      database.addMessage(msg.bodies.TEXT);
    });

    repository.add(this._key, database);
  }

  close(done) {
    repository.remove(this._key);

    this._connection.close();
    setImmediate(done);
  }

  static metadata(builder) {
    const binary = builder.enum('off', 'on');

    builder.usage.driver();

    builder.attribute('online', binary);

    builder.config('key', 'string');
    builder.config('user', 'string');
    builder.config('password', 'string');
    builder.config('host', 'string');
    builder.config('port', 'string');
    builder.config('tls', 'boolean');
  }
};
