// Copyright (c) 2012 Alex Russell. All rights reserved. Use of this source code
// is governed by the license found in the LICENSE file.

(function(global, navigator) {
  "use strict";

  // Design Notes
  // ============
  //
  // After looking hard at the LocalStorage IDL, it's clear that it's entirely
  // fucked and cannot be retrofitted by just adding callbacks. Here's the IDL:
  //
  //   interface Storage {
  //     readonly attribute unsigned long length;
  //     [IndexGetter] DOMString key(in unsigned long index);
  //     [NameGetter] DOMString getItem(in DOMString key);
  //     [NameSetter] void setItem(in DOMString key, in DOMString data);
  //     [NameDeleter] void removeItem(in DOMString key);
  //     void clear();
  //   };
  //
  //  Part of the misfit with JS comes from being built in a pre-ES6 world where
  //  there wasn't agreed terminology around Maps and Sets, but those errors are
  //  exascerbated by pure-crazytown JS API design; notably the behavior of
  //  .length and the addition of named getters (like JS objects used as maps
  //  today) which makes the entire thing future hostile. .length is
  //  particularly egregious. Not only is the collection not ordered -- can
  //  something without an order *have* a length? It could have some "size"
  //  across many dimensions, and absolutely could have a "count", but a length?
  //  Nope -- but it does not even share Array's crazytown setter semantics.
  //  Worse, it's not even useful for looping. E.g., you can get the length, but
  //  to get the *key* that belongs at some index, you have to use the key()
  //  method, and only then can you de-reference a value. So instead of:
  //
  //    for(var x = 0; x < localStorage.length; x++) {
  //      // LS only sets up named getters for keys, not for the strings
  //      // representing the integer indexes...WTF?
  //      doSomethingWithItem(localStorage[x]); // Fails.
  //    }
  //
  //  You must write:
  //
  //    for(var x = 0; x < localStorage.length; x++) {
  //      doSomethingWithItem(localStorage[localStorage.key(x)]);
  //    }
  //
  //  Since LS implementations apparently make the getters enumerable, you *can*
  //  write:
  //
  //    for(var x in localStorage) {
  //      doSomethingWithItem(localStorage[x]);
  //    }
  //
  //  ...so why bother having .length at all?
  //
  //  The answer is that to be really safe and avoid keys named "key",
  //  "getItem", etc. you must use both getItem() and key() to iterate:
  //
  //    for(var x = 0; x < localStorage.length; x++) {
  //      doSomethingWithItem(localStorage.getItem(localStorage.key(x)));
  //    }
  //
  //  Why not add a forEach() or a forIn()? Who knows.
  //
  //  Note that the designers thought nothing of making the pre-defined names
  //  non-shadowable, thereby breaking all symmetry with pure JS objects, much
  //  the way that a lack of numeric-name getters breaks symmetry with Array.
  //  Not only did they only like some bits of JS, they weren't even consistent
  //  about which bits to like/emulate.
  //
  //  So what about async?
  //
  //  One possible design is to simply return a Promise whenever a callback is
  //  provided; e.g.:
  //
  //    // Callback version of getItem returns a thenable instead:
  //    localStorage.getItem("key",
  //                         function(value) {
  //                           // Enable chaining on our operation
  //                           return new Promise(function(r) {
  //                             // Do something async with the value here
  //                           });
  //                         },
  //                         function(error) { /*...*/ }).
  //      then(onFinalSuccess, onError);
  //
  //  This isn't bad, to be honest, but it doesn't sit well with the sync API
  //  when it comes to writing to storage. What if there's a failure? What
  //  happens to .length? And what if you can clear() asynchronously? What's the
  //  value of .length throught the clear() process from the perspective of
  //  synchronous code? We're mighty close to adding transactions at this point.
  //
  //  Then there are the polyfill complications: it's not possible to easily
  //  shim in another (async) storage layer underneath while preserving the
  //  current behavior of .length (however terrible it might be). Similarly,
  //  it's not simple to feature-detect the async version.
  //
  //  A better API would simply hide all of the mistakes of LS, be feature-
  //  detectable, be async all the time, and not expose design, naming, and
  //  usability hazards like .length. Here, then, is our proposed API:
  //
  //    // Use ES6 Map API names where we can. See:
  //    //
  //    //  http://tc39wiki.calculist.org/es6/map-set/
  //    //
  //    // We implement:
  //    //   has(), set(), get(), delete(), and forEach(),
  //    // This design adds an async .clear() method for harmony with LS and
  //    //
  //    // The return values differ from ES Maps as we want async.
  //    //
  //    // In an ES 6 world, will eventually add:
  //    //   *items(), *keys(), *values(),
  //    //
  //    // Usage:
  //    //
  //    var storage = navigator.storage ||          // New API, new object
  //                  navigator.alsPolyfillStorage; // Where the polyfill lives
  //
  //    storage.has(key).then(function(bool) { ... });
  //
  //    // Read and write operations are always async, returns are Promises
  //    storage.set(key, value).then(
  //      function(value) { ... },
  //      fucntion(error) { ... }
  //    );
  //    storage.get(key).then(function(value) { ... });
  //
  //    // Note that this is an iterator that fetches *keys() asynchronously and
  //    // returns a Promise that resolves upon completion of all callbacks. It's
  //    // TBD if this should behave like the proposed Promise.when():
  //    //   https://github.com/slightlyoff/DOMPromise/issues/16
  //    // E.g., should we assume that callbacks can return Promises and/or wrap
  //    // return values the way .then() does?
  //    storage.forEach(function(key, value, storage) {
  //     ...
  //    }).then(onAllItemsProcessed, onError);
  //
  //    storage.clear().then(function()      { ... },
  //                         function(error) { ... });


  // Bail if we can't possbily succeed
  if ((typeof global.window === "undefined") ||
      (global.window !== global) ||
      (typeof global.indexedDB === "undefined")){
    return;
  }

  // Constants
  var DB_NAME = "async_local_storage";
  var OBJ_STORE_NAME = "als_objects";
  var VERSION = 1.0;

  var db = null;
  var backlog = {};
  backlog.tail = new Promise(function(r) { r.fulfill(); });
  backlog.add = function(workItem, canFail) {
    // Push and return Promise for the operation.
    var t = backlog.tail;
    var runNext = function() {
      return open().then(function() {
        var f = new Promise(function(r) {
          processItem(workItem, r);
        });
        if (canFail === true) {
          return f;
        }
        // Ensure that errors don't propigate across items
        return new Promise(function(r2) {
          var a = r2.fulfill.bind(r2);
          setTimeout(function() {
            f.then(a, a);
          }, 1)
        });
      });
    };
    return backlog.tail = t.then(runNext, runNext);
  };

  var identity = function(v) { return v; };
  var trans;
  var store;
  var clearTrans = function() {
    trans = null; store = null;
  };
  // See comments below for why this terrible, terrible thing is necessary
  var isFF = (navigator.userAgent.match(/Firefox\/\d+(\.\d+)/) instanceof Array);

  var processItem = function(item, resolver) {
    var op = item.operation;
    var xform = item.transform || identity;
    // Prefer read-only for read ops so we can avoid locks
    // FIXME(slightlyoff): See below. We're yeidling anyway, so this only
    //    benefits cross-tab reads.

    // If we're in FF, we need to make sure that it's not incorrectly letting us
    // work off a stale TXN. To know if it's delivering incorrectly, we need to
    // get an exception. This doesn't appear on the first operation, only
    // subsequent ones. What a cluster-fuck.
    if (isFF && trans && store) {
      try {
        store.count();
      } catch(e) {
        console.log("  store.count failed = (");
        console.log("  clearTrans();")
        clearTrans();
      }
    }
    if (!trans) {
      // FIXME(slighlyoff): We're using "readwrite" here to avoid creating
      // "readonly" transactions which might later include operaitons that
      // want to write. The right thing to do would be to serialize a write op
      // that follows read ops into its own txn, using oncomplete of the
      // previous to open up a new one. Not sure I want to introduce that much
      // complexity ATM, b ut we'll see how it scales and adjust accordingly.
      trans = db.transaction([OBJ_STORE_NAME], "readwrite");
      /*
      trans = db.transaction([OBJ_STORE_NAME],
                                 (["get", "forEach"].indexOf(op) >= 0) ?
                                     "readonly" : "readwrite");
      */
      // Get the Object Store via the Transaction
      store = trans.objectStore(OBJ_STORE_NAME);

      // Ensure that we re-open a transaction whenever the last one closes
      trans.onabort = trans.onerror = trans.oncomplete = clearTrans;
    }

    // console.log("doing a:", op);
    // console.log("with txn:", trans, "and store:", store);
    var request = null;
    // FIXME(slightlyoff): it appears that for write ops we MUST use setTimeout.
    // We can probably do better if our last op was a read and we're a read, but
    // if we're following a write, we must yeild entirely. *sigh*
    var resolve = function(value) { resolver.resolve(xform(value)); };
    var reject = function(reason) { resolver.reject(reason); };

    switch(op) {
      case "get":
        request = store.get(item.key);
        break;
      case "set":
        request = store.put(item.value, item.key);
        break;
      case "delete":
        request = store.delete(item.key);
        break;
      case "clear":
        // request = global.indexedDB.deleteDatabase(DB_NAME);
        request = store.clear();
        break;
      case "has":
        request = store.count(item.key);
        break;
      case "count":
        request = store.count();
        break;
      case "forEach":
        // Open a cursor and iterate.
        request = store.openCursor();
        request.onsuccess = function(evt) {
          // Once the cursor is open, iterate.
          var cursor = evt.target.result;
          if (cursor) {
            try {
              item.callback.call(item.scope||null, cursor.value, cursor.key);
            } catch(e) {
              reject(e);
              return; // Stop iterating.
            }
            cursor.continue();
          } else {
            // Finished
            resolve();
          }
        };
        request.onerror = reject;
        return; // Avoid registering the default handlers on the request
    }

    if (!request) {
      reject(new Error("IDB Request Failed"));
      return;
    }
    request.onsuccess = function() {
      resolve(request.result);
    };
    request.onerror = reject;
    /*
    request.onerror = function(e) {
      console.error(e);
      reject(e);
    };
    */
  };

  var openCalled = false;
  var openResolver;
  var openPromise = new Promise(function(r) { openResolver = r; });
  var open = function() {
    if (openCalled) return openPromise;
    openCalled = true;
    // Cribbed from Paul Kinlan's HTML5 Rocks article:
    //    http://www.html5rocks.com/en/tutorials/indexeddb/todo/

    // Comment: holy fuck...how did they design this entire DB API without
    // something like Promises? This is a *nightmare* to reason about.
    // Events+state machine? For fucks's sake, get an abstraction, wouldja?
    // Flailing your implementation details all over the place for everyone
    // to see is uncivilized.

    // Open up a DB against a particular version
    var openRequest = global.indexedDB.open(DB_NAME, VERSION);

    // If this is the first time we run, upgradeneeded is thrown and we can
    // create the object store.
    openRequest.onupgradeneeded = function (e) {
      db = e.target.result;
      db.createObjectStore(OBJ_STORE_NAME);
    };

    // We can only write once the DB is opened and upgraded/created. onsuccess
    // is always called after onupgradeneeded (if upgradeneeded is true).
    openRequest.onsuccess = function(e) {
      db = e.target.result;
      openResolver.resolve(e);
    };
    openRequest.onfailure = openResolver.reject.bind(openResolver);
    return openPromise;
  };

  var methodValue = function(func) {
    return {
      configurable: true,
      enumerable: false,
      writable: false,
      value: func
    };
  };

  var storage = navigator.alsPolyfillStorage = Object.create(null, {
    // Run everything through the backlog queue and just turn the crank instead
    // of doing stuff here.
    "has":
      methodValue(function(key) {
        // FIXME: not actually returning a boolean!
        return backlog.add({
          operation: "has",
          key: key,
          transform: function(value) { return !!value; }
        });
      }),
    "set":
      methodValue(function(key, value) {
        return backlog.add({ operation: "set",
                             key: key,
                             value: value });
      }),
    "get":
      methodValue(function(key) {
        return backlog.add({ operation: "get", key: key });
      }),
    "delete":
      methodValue(function(key) {
        return backlog.add({ operation: "delete", key: key });
      }),
    "clear":
      methodValue(function() {
        return backlog.add({ operation: "clear" });
      }),
    "count":
      methodValue(function() {
        return backlog.add({ operation: "count" });
      }),
    "forEach":
      methodValue(function(callback, scope) {
        // FIXME: this doesn't match the semantic for the spec! Our future needs
        // to only resolve once we're at the end!
        return backlog.add({ operation: "forEach",
                             callback: function(key, value) {
                                callback(key, value, storage);
                             },
                             scope: scope
                           }, true);
      }),
  });
})(this, this.navigator||{});
