(function() {
"use strict";

var deleteDb = function() {
  window.indexedDB.deleteDatabase("async_local_storage");
};

var t = doh;
var storage = navigator.alsPolyfillStorage;
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
                t.is(false, value);
                d.callback();
              });
            })
          });
        });
      });
    return d;
  },

  function get() {
    var d = new doh.Deferred();
    var key = "thinger";
    var value = "blarg";
    storage.set(key, value).then(function() {
      storage.get(key).done(function(v) {
        t.is(value, v);
        d.callback();
      });
    });
    return d;
  },

  function has() {
    var d = new doh.Deferred();
    var key = "thinger";
    var value = "blarg";
    storage.clear().done(function() {
      storage.set(key, value).then(function() {
        storage.has(key).done(function(v) {
          t.is("boolean", typeof v);
          t.is(true, v);
        });
      }).
      then(function() {
        storage.has("thing that doesn't exist").done(function(v) {
          t.is("boolean", typeof v);
          t.is(false, v);
          d.callback();
        });
      });
    });
    return d;
  },

  function del() {
    var d = new doh.Deferred();
    var key = "thinger";
    var value = "blarg";
    storage.clear().done(function() {
      storage.set(key, value).then(function() {
        storage.has(key).done(function(v) {
          t.is("boolean", typeof v);
          t.is(true, v);
        });
      }).
      then(function() { return storage.delete(key); }).
      then(function() {
        storage.has(key).done(function(v) {
          t.is("boolean", typeof v);
          t.is(false, v);
          d.callback();
        });
      });
    });
    return d;
  },

  function forEach() {
    var d = new doh.Deferred();
    storage.clear().then(function() {
      storage.set("foo", "bar");
      return storage.set("thinger", "blarg");
    }).then(function() {
      return storage.count().then(function(c) {
        t.is(2, c);
      });
    }).then(function() {
      var count = 0;
      return storage.forEach(function() {
        count++;
      }).then(function() {
        t.is(count, 2);
        d.callback();
      });
    });
    return d;
  },

  function forEachThrows() {
    var d = new doh.Deferred();
    storage.clear().then(function() {
      storage.set("foo", "bar");
      return storage.set("thinger", "blarg");
    }).then(function() {

      return storage.count().done(function(c) {
        t.is(2, c);
      });

    }).then(function(c) {

      return storage.forEach(
        function(value, key) {
          throw new Error("synthetic");
        }
      ).catch(
        function(e) {
          t.t(e instanceof Error);
        }
      ).done(
        function(value) {
          storage.get("foo").done(function(v) {
            t.is("bar", v);
            d.callback();
          });
        },
        console.error.bind(console)
      );
    });
    return d;
  },

  function deep_cloneable_object() {
    var d = new doh.Deferred();
    var deepCloneable = {
      "key with spaces": true,
      "key with object value": { thinger: "blarg" },
      "key with integer value": 12,
    };
    storage.clear().then(function() {
      return storage.set("cloneable", deepCloneable);
    }).then(function() {
      return storage.get("cloneable");
    }).then(function(value) {
      t.is(deepCloneable, value);
      d.callback();
    });
    return d;
  },

  function blob_storage() {
    var d = new doh.Deferred();
    // WTF...YUNO "new Blob()", web platform!?!
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "test.html", true);
    xhr.responseType = "blob";
    xhr.send();
    xhr.onreadystatechange = function() {
      if (xhr.readyState == 4) {
        // TODOC(slightlyoff):
        //    Does not pass in Chrome, IDB fails on Blobs!
        storage.set("blob", xhr.response).then(function() {
          return storage.get("blob").then(function(value) {
            t.t(value instanceof Blob);
            d.callback();
          }, log);
        }, function(e) { d.errback(e); });
      }
    };
    return d;
  },
], deleteDb, deleteDb);

})();
