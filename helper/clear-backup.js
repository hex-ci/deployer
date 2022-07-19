const fs = require('fs');
const path = require('path');

// 默认过期时间
const defaultExpires = 7;

const clearBackup = (currentPath, expires) => {
  if (!expires) {
    expires = defaultExpires;
  }

  const now = new Date().getTime();
  const expiresTimestamp = 1000 * 60 * 60 * 24 * Number(expires);

  try {
    const list = fs.readdirSync(currentPath);

    list.forEach((file) => {
      const fileTimestamp = Number(file.split('-')[0]);

      if (now - fileTimestamp > expiresTimestamp) {
        // 文件过期
        fs.unlinkSync(path.join(currentPath, file));
      }
    });
  }
  catch (e) {
  }
};

module.exports = clearBackup;
