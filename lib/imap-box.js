'use strict';

const log4js = require('log4js');
const logger = log4js.getLogger('core-plugins-hw-absoluta.ImapBox');
const { Connection, repository } = require('./service');

module.exports = class ImapBox {
  constructor(config) {

    this.online = 'off';

  }

  close(done) {
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
