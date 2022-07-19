const fs = require('fs');

module.exports = {
  read(filepath) {
    let result;

    try {
      result = JSON.parse(fs.readFileSync(filepath));
    }
    catch (e) {
      result = {};
    }

    return result;
  },

  write(filepath, data) {
    return fs.writeFileSync(filepath, JSON.stringify(data, null, '  '));
  }
};
