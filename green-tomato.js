"use strict";
/* eslint no-console: 0 */

var Q = require("q");
var Hoxy = require("hoxy");
// require("tungus"); @NOTE: wait until they support mongoose 5.X
var Mongoose = require("mongoose");
Mongoose.Promise = require("q").Promise;
if (Mongoose.pluralize) {
  Mongoose.pluralize(null);
}
const Prettyjson = require("prettyjson");
const _ = require("lodash");
const __ = require("./lodash-like.js");
const Child_process = require("child_process");

const version = require("./package.json").version;

class GreenTomato {
  formatHeaders(headers) {
    return _.omit(headers, ["host", "user-agent", "accept", "accept-language", "accept-encoding", "dnt",
      "x-requested-with", "content-type", "referer", "content-length", "cookie", "origin",
      "connection", "pragma", "cache-control"]);
  }

  respondEntry(response, entry) {
    var responseData = entry.responseData;
    const type = typeof responseData;
    response.statusCode = entry.responseStatusCode || 200;
    response.string = JSON.stringify(responseData);
    response.headers["content-type"] = `${(type === "object" ? "application/json" : "text/html;")} ; charset=UTF-8`;
  }

  createRequestEntry(request, response) {
    var searchNeedle = this.getSearchNeedle(request);

    this.ServicesSchema.find(searchNeedle.query)
      .findOne().exec()
      .then((entry) => { // Aka just create the request entry, when not on previous searches found
        if (!entry) {
          (new this.ServicesSchema({
            url: request.url,
            method: request.method,
            headers: __.sortObjectDeep(this.formatHeaders(request.headers), true),
            body: __.sortObjectDeep(request.json, true),
            responseData: response.json,
            responseStatusCode: response.statusCode
          })).save((error) => {
            if (error) return console.error(error);
          });
        }
      });
  }

  responseInterceptor(request, response) {
    var filterStatus = (!this.config.filter ||
      Child_process.spawnSync(this.config.filter, [JSON.stringify(response.json)])
    );

    if (filterStatus.status === null) {
      console.error("Problem with the response filter:");
      console.error(filterStatus.error);
      filterStatus.status = 0;
    }

    if (!this.config.filter || filterStatus.status === 0) {
      this.createRequestEntry(request, response);
    } if ((this.config.logLevel === "verbose") && (!this.config.filter || response.statusCode !== 200)) {
      this.requestPrintLog(request, true);
    }

    if (this.config.logLevel === "verbose") {
      this.requestPrintLog(request, true);
    }

    response.headers["content-type"] = `${(typeof response.json === "object" ? "application/json" : "text/html;")} ; charset=UTF-8`;
  }

  printSearchNeedle(searchNeedle) {
    if (this.config.useOptional) {
      console.info("(", String(Date.now()), " uts) ", "============ Search Needle (optional excluded) ============");
    } else {
      console.info("(", String(Date.now()), " uts) ", "===================== Serach Needle =======================");
    }
    console.info(Prettyjson.render(__.sortObjectDeep(searchNeedle.source, true), {
      format: "path"
    }));
    console.info();
  }

  requestPrintLog(request, isDirectionToServer) {
    if (isDirectionToServer)  {
      console.info("(", String(Date.now()), " uts) ========= Request from green-tomato -> server =============");
    } else {
      console.info("(", String(Date.now()), " uts) ========= Request from client -> green-tomato =============");
    }
    console.info(Prettyjson.render(request));
    console.info();
  }

  getSearchNeedle(request) {
    var searchNeedle =
      {
        url: _.clone(request.url),
        method: _.clone(request.method)
      },
      parsedHeaders = __.sortObjectDeep(this.formatHeaders(request.headers));

    if (this.config.regexp && this.config.substitution) {
      request.url = request.url.replace(this.config.regex.search, this.config.regex.replace);
    }

    if (!_.isEmpty(parsedHeaders)) {
      searchNeedle.headers = parsedHeaders;
    }

    if (request.json) {
      searchNeedle.body = request.json;
    }

    if (this.config.searchIgnore) {
      __.unassign(searchNeedle, this.config.searchIgnore);

      if (this.config.useOptional) {
        __.unassign(searchNeedle, this.config.searchOptional);
      }
    }


    return {
      query: __.toPath(searchNeedle),
      source: searchNeedle
    };
  }

  respondError(response) {
    response.statusCode = 418;
    response.string = "I\"m a teapot";
  }

  searchForRequest(resolve, reject, request, response) {
    var searchNeedle = this.getSearchNeedle(request);

    if (this.config.logLevel === "verbose") {
      this.printSearchNeedle(searchNeedle);
    }

    this.ServicesSchema.find(searchNeedle.query)
      .findOne().exec()
      .then((entry) => {
        this.respondEntry(response, entry), resolve(200);
      }).catch(() => {
        if (this.config.useOptional) {
          if (this.config.logLevel === "error") {
            this.printSearchNeedle(searchNeedle);
          }
          this.respondError(response), reject(new Error(418));
        } else {
          this.searchForRequest(resolve, reject, request, response, true);
        }
      });
  }

  requestInterceptor(request, response) {
    return Q.Promise((resolve, reject) => {
      this.searchForRequest(resolve, reject, request, response);
    });
  }

  attachInterceptors() {
    var method = /post|get|put|delete/i;

    if (this.config.useRecords) {
      this.proxy.intercept({
        phase: "request",
        as: "json",
        method: method
      }, this.requestInterceptor.bind(this));
    } else {
      this.proxy.intercept({
        phase: "request",
        as: "json",
        method: method
      }, (request) => {
        if (this.config.regexp.search && this.config.regexp.replace) {
          request.url = request.url.replace(this.config.regexp.search, this.config.regexp.replace);
        }
        if (this.config.logLevel === "verbose") {
          this.requestPrintLog(request, false);
        }
      });

      this.proxy.intercept({
        phase: "response",
        as: "json",
        method: method
      }, this.responseInterceptor.bind(this));
    }
  }

  initDB() {
    Mongoose.connect(this.config.dataBase,  {useNewUrlParser: true, useUnifiedTopology: true });

    this.mongoDB = Mongoose.connection;
    this.mongoDB.once("open", () => {
      this.ServicesSchema = Mongoose.model(this.config.mongoSchema, this.servicesShemaModel);
    });
    this.mongoDB.on("error", console.error.bind(console, "Error:"));
  }

  parseOptionalIgnoredProps() {
    this.config.searchOptional = _.cloneDeep(this.config.searchIgnore);
    __.keysDeep(this.config.searchOptional).forEach((prop) => {
      if (_.get(this.config.searchIgnore, prop) !== "optional") {
        _.unset(this.config.searchOptional, prop);
      } else {
        _.unset(this.config.searchIgnore, prop);
      }
    });
  }

  start() {
    this.initDB();
    this.proxy = Hoxy.createServer({
      reverse: this.config.proxyHost
    }).listen(this.config.port);

    if (this.config.searchIgnore) {
      this.parseOptionalIgnoredProps();
    }

    this.attachInterceptors();
    this.config.running = true;
  }

  stop() {
    this.proxy.close();
    this.config.running = false;
    this.mongoDB.close();
  }

  restart(newConfig) {
    if (this.config.running) {
      this.stop();
    }
    this.setConfig(newConfig);
    this.start();
  }

  setConfig(configParams) {
    this.config = _.assign(this.config, configParams);
    this.config.useOptional = !!(this.config.searchIgnore);
  }

  constructor() {
    this.config = {
      running: false,
      dataBase: "mongodb://localhost:27017/green-tomato"
    };
    this.setConfig(arguments[0]);
    this.ServicesSchema;
    this.proxy;
    this.servicesShemaModel = Mongoose.Schema({
      url: String,
      method: String,
      headers: Object,
      body: Object,
      responseData: Object,
      responseStatusCode: Number
    });
  }
}

module.exports = {
  version, GreenTomato
};
