const fs = require('fs');

// 默认数据结构
const defaultData = {
  projects: {}
};

const dataFilename = __dirname + '/../data.json';

if (!fs.existsSync(dataFilename)) {
  fs.writeFileSync(dataFilename, JSON.stringify(defaultData, null, '  '));
}

const baseData = JSON.parse(fs.readFileSync(dataFilename));

if (!baseData.projects) {
  baseData.projects = {};
}

module.exports = baseData;
