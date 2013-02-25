(function() {
"use strict";

var deleteDb = function() {
  window.indexedDB.deleteDatabase("async_local_storage");
};

var t = doh;
var storage = navigator.storage;
var log = console.log.bind(console);

t.registerGroup("async-local-storage", [
  function sanity() {
    t.is("object",   typeof storage);
    t.is("function", typeof storage.has);
    t.is("function", typeof storage.set);
    t.is("function", typeof storage.delete);
    t.is("function", typeof storage.clear);
    t.is("function", typeof storage.forEach);
  },

  function clear() {
    var d = new doh.Deferred();
    storage.clear().done(function() { d.callback(); });
    return d;
  },

  function set() {
    var d = new doh.Deferred();
    storage.set("foo", "bar").
      then(storage.get.bind(storage, "foo")).
      done(d.callback.bind(d));
    return d;
  },

  function clear_with_items() {
    var d = new doh.Deferred();
    storage.set("foo", "bar").
      then(function() {
        storage.has("foo").done(function(v) {
          t.t(!!v);
          storage.clear().then(function() {
            storage.count().then(function(c) {
              storage.has("foo").done(function(value) {
                t.is(undefined, value);
                d.callback();
              });
            })
          });
        });
      });
    return d;
  },

  /*
  function get() {
  },
  */

  /*
  function has() {
  },

  function del() {
  },

  function forEach() {
  },
  */
], deleteDb, deleteDb);

})();
