'use strict';

const EventEmitter = require('events');
const moment       = require('moment');
const log4js       = require('log4js');
const logger       = log4js.getLogger('core-plugins-hw-absoluta.Database');

moment.defineLocale('absoluta', {
  parentLocale : 'fr',
  monthsShort  : ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jui', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']
});

moment.locale(false);

moment.localeData('fr');

class Database extends EventEmitter {

  constructor() {
    super();
    this.setMaxListeners(100); // each zone adds listener

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

  addMessage(html, id) {
    const messageExtractor = />(.*)Maison(.*)</g;

    const rows = html.match(messageExtractor);
    if(!rows) {
      logger.error(`message ${id} : discarding message as it does not match the extractor rule`);
      return;
    }

    const zones = rows
      .map((row) => this._addRow(row, id))
      .filter(zone => zone);
    logger.info(`message ${id} : set zones ${zones.map(({ zone, active }) => `'${zone}' (${active ? 'on' : 'off'})`).join(', ')}`);
  }

  _addRow(row, id) {
    try {
      const inactivePrefix = 'RESTAURATION';
      const messageParser  = />(.*)\(Maison\)(\s*)\((.*)\)</g;

      const result = messageParser.exec(row);
      if(!result) {
        logger.error(`message ${id}, row ${row} : discarding row as it does not match the parser rule`);
        return;
      }
      const parts  = result.slice(1);

      let zone   = parts[0];
      let active = true;

      zone = zone.trim();
      if(zone.startsWith(inactivePrefix)) {
        active = false;
        zone = zone.substring(inactivePrefix.length);
        zone = zone.trim();
      }

      const date = moment(parts[2], 'HH:mm:ss DD/MMM/YY', 'absoluta').valueOf();
      //const date = Date.parse(parts[2]);
      if(isNaN(date)) {
        logger.error(`message ${id}, row ${row} : Invalid date in message`);
        return;
      }

      this._setState({
        zone,
        active,
        date
      });

      return { zone, active };
    } catch(err) {
      logger.error(`message ${id}, row ${row} : Error processing`, err);
    }
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