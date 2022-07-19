const template = (str, vars) => {
  for (const key in vars) {
    if (vars.hasOwnProperty(key)) {
      const element = vars[key];
      const reg = new RegExp(`{{${key}}}`, 'g');

      str = str.replace(reg, element);
    }
  }

  return str;
}

module.exports = template;
