'use strict';
/* eslint-env es6 */
/* eslint-disable no-unused-vars */

var Q = require('q');
var Hoxy = require('hoxy');
var Mongoose = require('mongoose');
Mongoose.Promise = require('q').Promise;
const Prettyjson = require('prettyjson');
const _ = require('lodash');
const __ = require('./lodash-like.js');
const Child_process = require('child_process');
var mongoDB;

exports.version = require('./package.json').version;
exports.serve = function(configParams) {
  var servicesShemaModel =
    {
      url: String,
      method: String,
      headers: Object,
      body: Object,
      responseData: Object,
      responseStatusCode: Number,
      timeStamp: Date
    },
    ServicesSchema, proxy;

  function formatHeaders(headers) {
    return _.omit(headers, ['host', 'user-agent', 'accept', 'accept-language', 'accept-encoding', 'dnt',
      'x-requested-with', 'content-type', 'referer', 'content-length', 'cookie', 'origin',
      'connection', 'pragma', 'cache-control']);
  }

  function respondEntry(response, entry) {
    var responseData = entry.responseData;
    response.statusCode = entry.responseStatusCode || 200;
    response.string = JSON.stringify(responseData);
  }

  function updateRequestEntry(request, response, entry) {
    entry.responseData = response.json;
    return entry;
  }

  function createRequestEntry(request, response) {
    (new ServicesSchema({
      url: request.url,
      method: request.method,
      headers: __.sortObjectDeep(formatHeaders(request.headers), true),
      body: __.sortObjectDeep(request.json, true),
      responseData: response.json,
      responseStatusCode: response.statusCode,
      timeStamp: Date.now()
    })).save(function(error) {
      if (error) return console.error(error);
    });
  }

  function responseInterceptor(request, response) {
    if (!configParams.filter ||
    Child_process.spawnSync(configParams.filter, [JSON.stringify(response.json)]).status === 0) {
      createRequestEntry(request, response);
    } if ((configParams.logLevel === 'error') && (!configParams.filter || response.statusCode !== 200)) {
      requestPrintLog(request);
    }

    if (configParams.logLevel === 'verbose') {
      requestPrintLog(request);
    }
  }

  function printSearchNeedle(searchNeedle, useOptional) {
    if (useOptional) {
      console.info('============ Search Needle (optional excluded) ============');
    } else {
      console.info('===================== Serach Needle =======================');
    }
    console.info(Prettyjson.render({searchedTimeStamp: String(Date.now())}));
    console.info();
    console.info(Prettyjson.render(__.sortObjectDeep(searchNeedle.source, true)));
  }

  function requestPrintLog(request) {
    console.info('========= Request from green-tomato -> server =============');
    console.info(Prettyjson.render({requestTimeStamp: String(Date.now())}));
    console.info();
    console.info(Prettyjson.render(request));
  }

  function getSearchNeedle(request, useOptional) {
    var searchNeedle =
      {
        url: _.clone(request.url),
        method: _.clone(request.method)
      },
      parsedHeaders = __.sortObjectDeep(formatHeaders(request.headers));

    if (configParams.regexp && configParams.substitution) {
      request.url = request.url.replace(configParams.regex.search, configParams.regex.replace);
    }

    if (!_.isEmpty(parsedHeaders)) {
      searchNeedle.headers = parsedHeaders;
    }

    if (request.string) {
      searchNeedle.body = __.sortObjectDeep(JSON.parse(request.string));
    }

    if (configParams.searchIgnore) {
      __.unassign(searchNeedle, configParams.searchIgnore);

      if (useOptional) {
        __.unassign(searchNeedle, configParams.searchOptional);
      }
    }

    return {
      query: __.toPath(searchNeedle),
      source: searchNeedle
    };
  }

  function respondError(response) {
    response.statusCode = 418;
    response.string = 'I\'m a teapot';
  }

  function searchForRequest(resolve, reject, request, response, useOptional) {
    var searchNeedle = getSearchNeedle(request, useOptional);

    if (configParams.logLevel === 'verbose') {
      printSearchNeedle(searchNeedle, useOptional);
    }

    ServicesSchema.find(searchNeedle.query)
    .sort({timeStamp: -1}).findOne().exec()
    .then((entry) => {
      respondEntry(response, entry), resolve(200);
    }).catch(() => {
      if (useOptional) {
        if (configParams.logLevel === 'error') {
          printSearchNeedle(searchNeedle, useOptional);
        }
        respondError(response), reject(new Error(418));
      } else {
        searchForRequest(resolve, reject, request, response, true);
      }
    })
  }

  function requestInterceptor(request, response) {
    return Q.Promise((resolve, reject) => {
      searchForRequest(resolve, reject, request, response);
    });
  }

  function attachInterceptors() {
    var method = /post|get|put|delete/i;

    if (configParams.forceCache) {
      proxy.intercept({
        phase: 'request',
        as: 'string',
        method: method
      }, requestInterceptor);
    } else {
      proxy.intercept({
        phase: 'request',
        as: 'json',
        method: method
      }, function(request) {
        if (configParams.regexp.search && configParams.regexp.replace) {
          request.url = request.url.replace(configParams.regexp.search, configParams.regexp.replace);
        }
      }.bind(this));

      proxy.intercept({
        phase: 'response',
        as: 'json',
        method: method
      }, responseInterceptor);
    }
  }

  function initDB() {
    Mongoose.connect('mongodb://localhost/green-tomato', {
      server: {
        auto_reconnect: true,
        socketOptions : {
          keepAlive: 1
        }
      }
    });

    mongoDB = Mongoose.connection;
    mongoDB.once('open', function () {
      ServicesSchema = Mongoose.model(configParams.mongoSchema, Mongoose.Schema(servicesShemaModel));
    });
    mongoDB.on('error', console.error.bind(console, 'Error:'));
  }

  function parseOptionalIgnoredProps(configParams) {
    configParams.searchOptional = _.cloneDeep(configParams.searchIgnore);
    __.keysDeep(configParams.searchOptional).forEach(function(prop) {
      if (_.get(configParams.searchIgnore, prop) !== 'optional') {
        _.unset(configParams.searchOptional, prop);
      } else {
        _.unset(configParams.searchIgnore, prop);
      }
    });
  }

  function initialize() {
    initDB();
    proxy = Hoxy.createServer({
      reverse: configParams.proxyHost
    }).listen(configParams.port);

    if (configParams.searchIgnore) {
      parseOptionalIgnoredProps(configParams);
    }

    attachInterceptors();
  }

  initialize();
};
