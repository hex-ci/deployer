module.exports = {
  get(data) {
    const exclude = [
      // 默认值
      '.*',
      '.*/'
    ].concat(data.exclude);

    const include = [
      // 默认值
    ].concat(data.include);

    const excludeStr = exclude.map((value) => {
      return `--exclude="${value}"`;
    }).join(' ');

    const includeStr = include.map((value) => {
      return `--include="${value}"`;
    }).join(' ');

    return {
      include: includeStr,
      exclude: excludeStr
    };
  }
};
