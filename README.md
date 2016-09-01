# green-tomato
A reverse caching proxy that stores the server responses in mongoDB, to save developers ss\'s whenever server fails.

Called green tomato due to the inmensa JavaScript salad over the web, such as cucumber, tomato.


## Dependencies

* (mongo|https://www.mongodb.com/)
* (node|https://nodejs.org/en/)

## Install

`npm install green-tomato`

## Usage
Use it from nodejs, if you want to use it from a CLI (command line interface) I strongly suggest the following two
libraries:
  * (vorpal|http://vorpal.js.org/)
  * (commander|https://github.com/tj/commander.js)

Use it with a

```javascript
var greenTomato = require('./green-tomato.js');

  greenTomato.greenTomato({
    forceCache: false,
    proxyHost: 'http://example.com',
    searchIgnore: 'path/to/ignore/file',
    quiet: true,
    port: 5000,
    mongoSchema: 'default'
    regexp: null,
  });
```

## Options

* *forceCache (Boolean)*: Used switch between modes. If true then green-tomato won't return nor request the proxy-host server, instead
    it will answer based on the current cache build. If false it will forward the request to the proxy-host server and
    store the answer in the cached database.

* *proxyHost (String):* The target host to create the reverse proxy to.

* *searchIgnore (String):* [only on forceCache mode] A JSON file that will include properties from it to ignore
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

* *quiet (Boolean):* Used to output or not into the console.

* *port (Number):* Set the :port number to use for the reverse proxy server at localhost, by default it will use :5000

* *delay (Milliseconds):* [only on forceCache mode] Set time in milliseconds to delay the answer from the cache mode,
usefull to test timeouts.

* *mongoSchema (String):* The collection to save the cache, used to save diferente escenarios. By default [default]

* *regexp (Object):* [only on NOT forceCache mode] A regexp (javascript) to search and replace in the URL.
  * regexp.search (RegExp). The regular expresion to be passed to ULR.replace(*regexp.serach*, regexp.replace).
  * regexp.replace (String). The susbtitution string to be passed to ULR.replace(regexp.serach, *regexp.replace*).

## Simple recipe *commander*

```bash
  git clone https://github.com/aemonge/green-tomato.git
  cd green-tomato
  npm install && npm install commander
  touch index.js
```

Edit the file **index.js**, and include:

```javascript
  var Program = require('commander');
  var greenTomato = require('./green-tomato.js');

  Program
    .option('-f, --force-cache', '')
    .parse(process.argv);

  greenTomato.serve({
    forceCache: Program.forceCache,
    proxyHost: 'http://example.com',
    quiet: false,
    port: '5000',
    mongoSchema: 'default',
  });
```

```bash
  node index.js
  node index.js -f
```
