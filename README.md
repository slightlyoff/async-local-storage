async-local-storage
===================

This is a p(r)ollyfill for a fully-async object-storage API that's simpler than
[IndexedDB](https://developer.mozilla.org/en-US/docs/IndexedDB), but also async,
removing many of the [performance hazards of `localStorage`](https://web.archive.org/web/20160519152301/https://blog.mozilla.org/tglek/2012/02/22/psa-dom-local-storage-considered-harmful/).

The API is roughly mirrors the [ES6 Map type](http://tc39wiki.calculist.org/es6/map-set/), but all methods return
[`Future`](https://github.com/slightlyoff/DOMFuture/) instances to enable async
operation.

To get started quickly, use one of the pre-built versions from the [`bin/`
directory](https://github.com/slightlyoff/async-local-storage/tree/master/bin).
To work from source, make sure you `git submodule update --init` after cloning.

## API

The API lives at `navigator.storage` to distinguish it from
`window.localStorage` and to prevent introducing a new global symbol,

### Methods:

```js
var storage = navigator.storage ||          // New API, new object
              navigator.alsPolyfillStorage; // Where the polyfill lives

storage.has(/*string*/ key)
    .then(function(bool) {});

storage.get(/*string*/ key)
    .then(function(value) {});

storage.set(/*string*/ key, /*cloneable*/ value)
    .then(function() {});

storage.delete(/*string*/ key)
    .then(function() {});

storage.clear()
    .then(function() {});

storage.count()
    .then(function(integer) {});

storage.forEach(/*function*/ callback, /*any*/ scope)
    .then(function() {});
```

## Examples

```js
var storage = navigator.storage ||
              navigator.alsPolyfillStorage;

// Testing for a value
storage.has("thinger").then(function(doesHaveThinger) {
  if (doesHaveThinger) {
    // ...
  }
});

// Getting a value
storage.get("thinger").then(
  function(value) {
    // ...
  },
  function(e) { console.log("get failed with error:", e); }
);

// Setting a value without error handling is simple:
storage.set("thinger", "blarg");

// But setting is also async, so to read related values, it's best to wait
storage.set("thinger", "othervalue").then(function() {
  storage.get("...").then(function(value) {
    // ...
  });
});

// Iteration is also async. The returned Future resolves when the passed
// callback has been invoked for each item (or when one fails, in case of error)
var itemCount = 0;
storage.forEach(function(value, key) {
  itemCount++;
}).then(function() { console.log(itemCount, "items in storage"); });

// The above is equivalent to using .count():
storage.count().then(function(c) { console.log(c, "items in storage"); });
```

## Browser Support

This code is only meant to work on browsers with modern IndexedDB support and
has been tested in stable-channel Chrome and Firefox as of Spring '13.

## License

Apache v2 License. See the [LICENSE file](https://github.com/slightlyoff/async-local-storage/blob/master/LICENSE).
