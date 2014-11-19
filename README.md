# Backbone Symbolic Links

Lets take a common data browser data pattern. Your database stores documents with IDs pointing to other documents in the database and unfortunately the database does not have a concept of joins (looking at you CouchDB). You want the database to continue storing IDs, but you want to `.get()` and `.set()` with Backbone models.

This is where the Backbone Symlink library comes in. This gives Backbone models a few methods for tethering IDs to other models in other collections. Calls to `.get()` and `.set()` return the value as a model, but `.toJSON()` will return a string ID its place. This allows Backbone models to play nice with relational data.

## Install

Download the latest version from our [release page](https://github.com/BeneathTheInk/Temple/releases) and use via a script tag. This library depends on both Backbone and Underscore, so just make sure they are included before Backbone Symlink.

In browsers:

```html
<script type="text/javascript" src="underscore.js"></script>
<script type="text/javascript" src="backbone.js"></script>
<script type="text/javascript" src="backbone-symlink.js"></script>
```

With Node.js, include Backbone and Underscore in the package.json under `dependencies` and then use Backbone with one require:

```javascript
var Backbone = require("backbone-symlink");
```