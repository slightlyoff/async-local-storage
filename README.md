async-local-storage
===================

This is a p(r)ollyfill for a fully-async object-storage API that's simpler than
[IndexedDB](https://developer.mozilla.org/en-US/docs/IndexedDB), but also async,
removing many of the [performance hazards of `localStorage`](https://blog.mozilla.org/tglek/2012/02/22/psa-dom-local-storage-considered-harmful/).

The API is roughly mirrors the [ES6 Map type](http://tc39wiki.calculist.org/es6/map-set/), but all methods return
[`Future`](https://github.com/slightlyoff/DOMFuture/) instances to enable async
operation.

## API

The API lives at `navigator.storage` to distinguish it from
`window.localStorage` and to prevent introducing a new global symbol,

### Methods:

```js
navigator.storage.has(/*string*/ key)
    .then(function(bool) {});

navigator.storage.get(/*string*/ key)
    .then(function(value) {});

navigator.storage.set(/*string*/ key, /*cloneable*/ value)
    .then(function() {});

navigator.storage.delete(/*string*/ key)
    .then(function() {});

navigator.storage.clear()
    .then(function() {});

navigator.storage.count()
    .then(function(integer) {});

navigator.storage.forEach(/*function*/ callback, /*any*/ scope)
    .then(function() {});
```

## Examples

```js
var storage = navigator.storage;

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