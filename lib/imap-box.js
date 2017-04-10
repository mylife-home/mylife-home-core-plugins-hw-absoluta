'use strict';

const log4js = require('log4js');
const logger = log4js.getLogger('core-plugins-hw-absoluta.ImapBox');
const { Connection, Database, repository } = require('./service');

module.exports = class ImapBox {
  constructor(config) {

    this.online = 'off';

    const connection = new Connection(config);
    const database   = new Database();
    this._key        = config.key;
    this._access     = { connection, database };

    connection.on('connected', (value) => (this.online = value ? 'on' : 'off'));

    connection.on('fetchBegin', () => database.beginBulk());
    connection.on('fetchEnd', () => database.endBulk());

    // logging and reconnection already handled, nothing more to do but if an error event is untrapped on nodejs the process will terminate
    connection.on('error', () => {});

    connection.on('message', (msg) => {
      database.addMessage(msg.bodies.TEXT, msg.attributes.uid);
    });

    repository.add(this._key, this._access);
  }

  close(done) {
    repository.remove(this._key);

    this._access.connection.close();
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
