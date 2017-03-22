'use strict';

const EventEmitter = require('events');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Database');

class Database extends EventEmitter {

  constructor() {
    super();

    this.states    = new Map();
    this.bulkLevel = 0;
    this.bulkSet   = new Set();
  }

  beginBulk() {
    ++this.bulkLevel;
  }

  endBulk() {
    --this.bulkLevel;
    if(this.bulkLevel) { return; }

    for(const zone of this.bulkSet) {
      const state = this.states.get(zone);
      this.emit('activeChanged', state.zone, state.active);
    }
    this.bulkSet.clear();
  }

  addMessage(html) {
    const messageExtractor = />(.*)Maison(.*)</g;

    const rows = html.match(messageExtractor);
    rows.forEach((row) => this._addRow(row));
  }

  _addRow(row) {
    const inactivePrefix = 'RESTAURATION';
    const messageParser  = /> (.*)\(Maison\) \((.*)\)</g;

    const result = messageParser.exec(row);
    const parts  = result.slice(1);

    let zone   = parts[0];
    let active = true;

    zone = zone.trim();
    if(zone.startsWith(inactivePrefix)) {
      active = false;
      zone = zone.substring(inactivePrefix.length);
      zone = zone.trim();
    }

    const date = Date.parse(parts[1]);
    if(isNaN(date)) {
      logger.error(`Invalid date in message: ${row}`);
      return;
    }

    this._setState({
      zone,
      active,
      date
    });
  }

  _setState(state) {
    const { zone } = state;
    const currentState = this.states.get(zone);
    if(currentState && currentState.date >= state.date) {
      return; // currentState is newer
    }

    this.states.set(zone, state);


    const oldActive = currentState && currentState.active;
    const newActive = state.active;
    if(oldActive === newActive) {
      return;
    }

    if(this.bulkLevel) {
      this.bulkSet.add(zone);
      return;
    }

    this.emit('activeChanged', zone, newActive);
  }

  isActive(zone) {
    const state = this.states.get(zone);
    return state && state.active;
  }
}

module.exports = Database;