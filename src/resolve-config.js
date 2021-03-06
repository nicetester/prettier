"use strict";

const cosmiconfig = require("cosmiconfig");
const minimatch = require("minimatch");
const mem = require("mem");

const getExplorerMemoized = mem(opts =>
  cosmiconfig("prettier", {
    sync: opts.sync,
    cache: opts.cache,
    rcExtensions: true
  })
);

/** @param {{ cache: boolean, sync: boolean }} opts */
function getLoadFunction(opts) {
  // Normalize opts before passing to a memoized function
  opts = Object.assign({ sync: false, cache: false }, opts);
  return getExplorerMemoized(opts).load;
}

function resolveConfig(filePath, opts) {
  opts = Object.assign({ useCache: true }, opts);
  const load = getLoadFunction({ cache: !!opts.useCache, sync: false });
  return load(filePath, opts.config).then(result => {
    return !result ? null : mergeOverrides(result.config, filePath);
  });
}

resolveConfig.sync = (filePath, opts) => {
  opts = Object.assign({ useCache: true }, opts);
  const load = getLoadFunction({ cache: !!opts.useCache, sync: true });
  const result = load(filePath, opts.config);
  return !result ? null : mergeOverrides(result.config, filePath);
};

function clearCache() {
  mem.clear(getExplorerMemoized);
}

function resolveConfigFile(filePath) {
  const load = getLoadFunction({ sync: false });
  return load(filePath).then(result => {
    return result ? result.filepath : null;
  });
}

resolveConfigFile.sync = filePath => {
  const load = getLoadFunction({ sync: true });
  const result = load(filePath);
  return result ? result.filepath : null;
};

function mergeOverrides(config, filePath) {
  const options = Object.assign({}, config);
  if (filePath && options.overrides) {
    for (const override of options.overrides) {
      if (pathMatchesGlobs(filePath, override.files, override.excludeFiles)) {
        Object.assign(options, override.options);
      }
    }
  }

  delete options.overrides;
  return options;
}

// Based on eslint: https://github.com/eslint/eslint/blob/master/lib/config/config-ops.js
function pathMatchesGlobs(filePath, patterns, excludedPatterns) {
  const patternList = [].concat(patterns);
  const excludedPatternList = [].concat(excludedPatterns || []);
  const opts = { matchBase: true };

  return (
    patternList.some(pattern => minimatch(filePath, pattern, opts)) &&
    !excludedPatternList.some(excludedPattern =>
      minimatch(filePath, excludedPattern, opts)
    )
  );
}

module.exports = {
  resolveConfig,
  resolveConfigFile,
  clearCache
};
