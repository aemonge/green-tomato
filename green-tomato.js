'use strict';
/* eslint-disable no-unused-vars */

// jscs:disable disallowMultipleVarDecl
var Q = require('q');
var Hoxy = require('hoxy');
var Mongoose = require('mongoose');
Mongoose.Promise = require('q').Promise;
var mongoDB;
var Prettyjson = require('prettyjson');
var _ = require('lodash');
var __ = require('./lodash-like.js');

exports.serve = function(configParams) {
  // jshint validthis:true
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
    var responseData = entry.responseData || entry.successData; // <- legacy support.
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
    createRequestEntry(request, response);
    if (!configParams.quiet) {
      requestPrintLog(request);
    }
  }

  function printSearchNeedle(searchNeedle) {
    console.info('===================== Serach Needle =======================');
    console.info(Prettyjson.render({searchedTimeStamp: String(Date.now())}));
    console.info();
    console.info(Prettyjson.render(__.sortObjectDeep(searchNeedle.source, true)));
  }

  function requestPrintLog(request) {
    console.info('============ Request from greenTomato -> server ===============');
    console.info(Prettyjson.render({requestTimeStamp: String(Date.now())}));
    console.info();
    console.info(Prettyjson.render(request));
  }

  function getSearchNeedle(request) {
    var searchNeedle =
      {
        url: _.clone(request.url),
        method: _.clone(request.method)
      },
      parsedHeaders = __.sortObjectDeep(formatHeaders(request.headers));

    if (!_.isEmpty(parsedHeaders)) {
      searchNeedle.headers = parsedHeaders;
    }

    if (request.json) {
      searchNeedle.body = __.sortObjectDeep(request.json);
    }

    if (configParams.searchIgnore) {
      __.unassign(searchNeedle, configParams.searchIgnore);
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

  function requestInterceptor(request, response) {
    var searchNeedle;

    if (configParams.regexp && configParams.substitution) {
      request.url = request.url.replace(configParams.regex.search, configParams.regex.replace);
    }

    searchNeedle = getSearchNeedle(request);
    if (!configParams.quiet) {
      printSearchNeedle(searchNeedle);
    }

    return ServicesSchema.find(searchNeedle.query)
      .sort({timeStamp: -1})
      .findOne()
      .exec()
      .then(respondEntry.bind(this, response))
      .catch(respondError.bind(this, response))
    ;
  }

  function attachInterceptors() {
    var method = /post|get|put|delete/i;

    if (configParams.forceCache) {
      proxy.intercept({
        phase: 'request',
        method: method
      }, requestInterceptor);
    } else {
      if (configParams.regexp) {
        proxy.intercept({
          phase: 'request',
          method: method
        }, function(request) {
          request.url = request.url.replace(configParams.regexp.search, configParams.regexp.replace);
        });
      }

      proxy.intercept({
        phase: 'response',
        as: 'json',
        method: method
      }, responseInterceptor);
    }
  }

  function initDB() {
    Mongoose.connect('mongodb://localhost/greenTomato', {
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

  function initialize() {
    initDB();
    proxy = Hoxy.createServer({
      reverse: configParams.proxyHost
    }).listen(configParams.port);

    attachInterceptors();
  }

  initialize();
};
