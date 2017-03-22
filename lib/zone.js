'use strict';

const log4js = require('log4js');
const logger = log4js.getLogger('core-plugins-hw-absoluta.Zone');
const { repository } = require('./service');

module.exports = class Zone {
  constructor(config) {
    this._label = config.label;
    this._key   = config.boxKey;
    this.online = 'off';
    this.active = 'off';

    this._connectedCallback  = (value) => (this.online = value ? 'on' : 'off');
    this._activeCallback     = (zone, active) => (zone === this._label && (this.active = active ? 'on' : 'off'));
    this._repositoryCallback = (evt) => {
      if(evt.key !== this._key) { return; }
      this._refreshAccess();
    }

    repository.on('changed', this._repositoryCallback);

    this._refreshAccess();
  }

  close(done) {
    this._releaseAccess(true);
    repository.removeListener('changed', this._repositoryCallback);
    setImmediate(done);
  }

  _releaseAccess(closing = false) {

    if(!closing) {
      this.online = 'off';
      this.active = 'off';
    }

    if(!this._access) { return; }

    this._access.connection.removeListener('connected', this._connectedCallback);
    this._access.database.removeListener('activeChanged', this._activeCallback);
    this._access = null;
  }

  _refreshAccess() {
    const access = repository.get(this._key);
    if(!access) {
      this._releaseAccess();
      return;
    }

    if(this._access) { return; }

    this._access = access;
    this._access.connection.on('connected', this._connectedCallback);
    this._access.database.on('activeChanged', this._activeCallback);

    this._connectedCallback(this._access.connection.connected);
    this._activeCallback(this._label, this._access.database.isActive(this._label));
  }

  static metadata(builder) {
    const binary          = builder.enum('off', 'on');

    builder.usage.driver();

    builder.attribute('online', binary);
    builder.attribute('active', binary);

    builder.config('boxKey', 'string');
    builder.config('label', 'string');
  }
};
