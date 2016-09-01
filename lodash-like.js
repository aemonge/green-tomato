'use strict';

var _ = require('lodash');

function toPath(object) {
  function _keysDeep(parent, child, finalLeaves) {
    var prefix = (parent.length > 0 ? parent + '.' : '');

    _.each(child, function(value, keyName) {
      if (typeof value === 'object' && value !== null) {
        _keysDeep(prefix + keyName, value, finalLeaves);
      } else {
        finalLeaves[prefix + keyName] = value;
      }
    });

    return finalLeaves;
  }

  return _keysDeep('', object, {});
}

function keysDeep(object) {
  function _keysDeep(parent, child, finalLeaves) {
    var prefix = (parent.length > 0 ? parent + '.' : '');

    _.each(child, function(value, keyName) {
      if (typeof value === 'object' && value !== null) {
        _keysDeep(prefix + keyName, value, finalLeaves);
      } else {
        finalLeaves.push(prefix + keyName);
      }
    });

    return finalLeaves;
  }

  return _keysDeep('', object, []);
}

function unassign() {
  var ignoreProperties;
  var args = (arguments.length === 1 ? [arguments[0]] : Array.apply(null, arguments));
  var filteredResult = args.shift();

  while ((ignoreProperties = args.shift()) !== undefined) {
    keysDeep(ignoreProperties).forEach(function(ignoreProperty) {
      _.unset(filteredResult, ignoreProperty);
    });
  }

  return filteredResult;
}

function sortObjectDeep(source, doReverse) {
  var keys = _.keys(source).sort();
  var dest = {};

  if (doReverse) {
    keys.reverse();
  }

  if (_.isEmpty(keys)) {
    return null;
  }

  _.each(keys, function(key) {
    dest[key] = (typeof source[key] === 'object' ?
      sortObjectDeep(source[key], doReverse) :
      source[key]
    );
  });

  return dest;
}

exports.toPath = toPath;
exports.keysDeep = keysDeep;
exports.unassign = unassign;
exports.sortObjectDeep = sortObjectDeep;
