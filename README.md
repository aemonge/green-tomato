# green-tomato
A sandbox (mock server), that allows the user to **record** the mocks from the APIs, avoiding the struggle of the
creation of the mock data. It uses mongoDB to store such data, and also to manually add the mock in the following
format.

```json
{
  "url": "/get",
  "method": "GET",
  "headers": null,
  "body": null,
  "responseData": "can be plain text, or a json object",
  "responseStatusCode": { "$numberInt": "200" },
  "timeStamp": { "$date": { "$numberLong": "1585741795795" } }
}
```

## Features
* Run it as a server and/or locally.
* Record the mocks automatically from a real request to the server.
* Respond custom headers and HTTP errors.
* Supports different sessions by changing the scheme name.

## Dependencies

* https://www.mongodb.com/
* https://nodejs.org/en/

## Install

`npm install green-tomato`

## Usage
Use it from nodejs, if you want to use it from a CLI (command line interface) I strongly suggest the following three
libraries:
  * [vorpal](http://vorpal.js.org/)
  * [commander](https://github.com/tj/commander.js)
  * [Web-CLI](https://github.com/M1T0zd/Web-CLI#readme)

#### Import and example

```javascript
var greenTomato = require('./green-tomato.js');

  greenTomato.serve({
    useRecords: false,
    proxyHost: 'https://httpbin.org',
    port: 5000,
    mongoSchema: 'default',
    //searchIgnore: 'path/to/ignore/file',
    //logLevel: 'quiet',
    //delay: 0,
    //regexp: null,
    //filter: './command'
  });
```

## Options

* *useRecords (Boolean)*: Used switch between modes. If true then green-tomato won't return nor request the proxy-host server, instead
    it will answer based on the current cache build. If false it will forward the request to the proxy-host server and
    store the answer in the cached database.

* *proxyHost (String):* The target host to create the reverse proxy to.

* *searchIgnore (String):* [only on useRecords mode] A JSON file that will include properties from it to ignore
    searching in the cache to be more flexible. So if you don't mind the ID of the body request from your cache, you
    would include the following.

    **ignoreFile.json**
    ```json
    {
      "body": {
        "id": "ignore"
      }
    }
    ```

    _* you can also set to "optional" instead of "ignore" to peform two searches, one with the property and another
    without it. So if by searching with the optional property (ex. :type) no results are found, green-tomato will try
    another search without the optional property before returnig a server error (418)._

    **ignoreFile.json**
    ```json
    {
      "body": {
        "id": "ignore",
        "type": "optional"
      }
    }
    ```

* *logLevel (String):* Used to determine the amount of information to show in the console. From nothign ("*quiet*" or
  *null*) to only the errors in requests ("*error*") which can be the error from the server, those marked as error from
  the error filter or any search that didn't found any result. And finally the log lever can be
  ("verbose") logging all request and searches.

* *port (Number):* Set the :port number to use for the reverse proxy server at localhost, by default it will use :5000

* *delay (Milliseconds):* [only on useRecords mode] Set time in milliseconds to delay the answer from the cache mode,
usefull to test timeouts.

* *mongoSchema (String):* The collection to save the cache, used to save different scenarios. By default [default]

* *regexp (Object):* [only on NOT useRecords mode] A regexp (javascript) to search and replace in the URL.
  * regexp.search (RegExp). The regular expresion to be passed to ULR.replace(*regexp.serach*, regexp.replace).
  * regexp.replace (String). The susbtitution string to be passed to ULR.replace(regexp.serach, *regexp.replace*).

* *filter (bin):* [only on useRecords mode] A command that takes as an argument the response from the server, and if returns a successful exit code(0) it will store the response on the cache database. Example:
  ```javascript
    // -------
      filter: './userIdFilter.js'
    // -------
  ```

  **userIdFilter.js**
    ```javascript
    #!/usr/bin/env node

    var response = JSON.parse(process.argv[2]); // Parse the response as JSON with node ;)

    if (response.userId  === 5) {
      process.exit(0); // This will be included in the cache databases
    } else {
      process.exit(1); // This returns error, so green-tomato know that for the current request skip it from storing it.
    }
    ```


## Simple recipe *commander*, command line interface

```bash
  npm install green-tomato commander
  touch index.js
```

Edit the file **index.js**, and include:

```javascript
  const Program = require('commander');
  const { GreenTomato } = require('green-tomato');

  Program
    .option('-f, --use-records', '')
    .parse(process.argv);

  let greenTomato = new GreenTomato({
    useRecords: Program.useRecords,
    proxyHost: 'https://httpbin.org',
    logLevel: 'error',
    port: '5000',
    mongoSchema: 'default',
  });
```

```bash
  $ node index.js # to start recording
  $ node index.js -f # to use records
```

## Simple recipe *webCli*, web command line interface

```bash
  npm install green-tomato zd-webcli
  touch index.js
```

Edit the file **index.js**, and include:

```javascript
  const webCLI = require('zd-webcli');
  const { GreenTomato } = require('green-tomato');

  let greenTomato = new GreenTomato({
    useRecords: false,
    port: 8090,
    logLevel: 'error',
    mongoSchema: 'default'
  });
  webCLI.setPassword("1234"); //Set the password.
  webCLI.setPort(8080); //Set the port.

  webCLI.interpreter((command, args) => {
    switch(command) {
      case 'start':
        greenTomato.start();
        break;
      case 'restart':
        greenTomato.restart();
        break;
      case 'stop':
        greenTomato.stop();
        break;
    }
  });
  webCLI.start(); //Start! (Do at the very end!)
```

```bash
  $ node index.js
```

Then open a browser in http://localhost:8080
