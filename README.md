async-local-storage
===================

This is a p(r)ollyfill for a fully-async object-storage API that's simpler than
[IndexedDB](https://developer.mozilla.org/en-US/docs/IndexedDB), but hopefully
approachable for folks who are currently (ab)using
[localStorage](https://developer.mozilla.org/en-US/docs/DOM/Storage) for large-
object, early-in-page persistence.

The API maps (har har) roughly to [EcmaScript 6 Maps and
Sets](http://tc39wiki.calculist.org/es6/map-set/)

## API

To distinguish it entirely from the synchronous `window.localStorage` and to
prevent introducing a new global symbol, the API lives at `navigator.storage`.

All methods return [`Future`s](https://github.com/slightlyoff/DOMFuture/)

### Methods:

#### `navigator.storage.has(/*string*/ key)`

#### `navigator.storage.get(/*string*/ key)`

#### `navigator.storage.set(/*string*/ key, /*cloneable*/ value)`

#### `navigator.storage.delete(/*string*/ key)`

#### `navigator.storage.clear()`

#### `navigator.storage.forEach(/*function*/ callback)`

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
```