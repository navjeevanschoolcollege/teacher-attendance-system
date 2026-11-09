const mainHandler = require('./index.js');

module.exports = async function handler(req, res) {
  return mainHandler(req, res);
};
