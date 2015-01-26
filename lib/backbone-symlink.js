(function(root, factory) {

	// Set up Symlink appropriately for the environment
	// Start with AMD
	if (typeof define === 'function' && define.amd) {
		define(['underscore', 'backbone'], function(_, Backbone) {
			// Export global even in AMD case in case this script is loaded with
			// others that may still expect a global Symlink.
			root.Symlink = factory(root, _, Backbone);
		});

	// Next for Node.js or CommonJS
	} else if (typeof module === 'object' && module.exports) {
		module.exports = factory(root, require('underscore'), require("backbone"));

	// as a browser global
	} else if (root._ && root.Backbone) {
		root.Symlink = factory(root, root._, root.Backbone);
	
	// finally just throw
	} else {
		throw new Error("Symlink could not locate Backbone and/or Underscore.");
	}

}(this, function(root, _, Backbone) {

	function Symlink(model, attr, col, options) {
		// verify arguments
		if (!Symlink.isBackboneModel(model)) {
			throw new Error("Expecting instance of Backbone model.");
		}

		if (!_.isString(attr) || attr == "") {
			throw new Error("Expecting non-empty string for attribute.");
		}

		if (!Symlink.isBackboneCollection(col)) {
			throw new Error("Expecting instance of Backbone collection.");
		}

		// set properties
		this.active = false;
		this.valid = false;
		this.model = model;
		this.attribute = attr;
		this.collection = col;

		// default options
		this.options = _.defaults(options || {}, {
			collection: Backbone.Collection
		});

		// init
		this.attach();
	}

	// Symlink types
	Symlink.NULL_LINK = 0;
	Symlink.MODEL_LINK = 1;
	Symlink.COLLECTION_LINK = 2;

	Symlink.getType = function(val) {
		return _.isArray(val) ? Symlink.COLLECTION_LINK :
			_.isString(val) ? Symlink.MODEL_LINK :
			Symlink.NULL_LINK;
	}

	// the issue with NPM dependencies is that sometimes we get a real Backbone
	// model or collection that did not originate from the same Backbone library
	// as this one. A simple instanceof check on this value will fail even
	// though our code can handle it just fine. Instead, we'll use duck type
	// checking to detect features so any Backbone-looking object will pass.
	Symlink.isBackboneModel = function(val) {
		return val instanceof Backbone.Model || (
			val != null &&
			typeof val.cid === "string" &&
			typeof val.attributes === "object" &&
			typeof val.get === "function" &&
			typeof val.set === "function"
		);
	}

	Symlink.isBackboneCollection = function(val) {
		return val instanceof Backbone.Collection || (
			val != null &&
			_.isArray(val.models) &&
			typeof val.model === "function" &&
			typeof val.add === "function" &&
			typeof val.remove === "function"
		);
	}

	// Symlink methods
	_.extend(Symlink.prototype, Backbone.Events, {

		// sets up the symlink
		attach: function() {
			// detach first before reattaching
			this.detach();

			// full reset before beginning
			this.reset(false);

			// update active status
			this.active = true;

			// set initial values
			this.update();

			// listen to change on attribute
			// "change:attr" events happen before "change" events
			// which allows us to call set inside of it, but still
			// make it seem like it was only set once.
			this.listenTo(this.model, "change:" + this.attribute, this.update);

			// detach if the model is destroyed
			this.listenTo(this.model, "destroy", this.detach);

			// announce the attachment
			this.trigger("attach");

			return this;
		},

		// takes down the symlink
		detach : function() {
			if (!this.active) return this;

			// record the real value
			var val = this.value;

			// full reset without setting on the model
			this.reset(false);
			this.flushChanges();

			// update active status
			this.active = false;

			// stop listening to the model
			this.stopListening(this.model);

			// set the model value directly to the real value
			this.model.set(this.attribute, val);

			// announce the detachment
			this.trigger("detach");

			return this;
		},

		// tells the symlink to update the value in the model
		update: function() {
			var symlink, col, attr, type, listener,
				val, model, subset, models;

			// prevent overlapping events
			if (!this.active || this._updating) return;
			this._updating = true;

			symlink = this;
			col = this.collection;
			attr = this.attribute;

			// annouce the update
			this.trigger("update");
			
			// remove any previous state
			this.clean();

			// get the new value
			val = this.model.get(attr);

			// get the new type
			type = Symlink.isBackboneCollection(val) || _.isArray(val) ? Symlink.COLLECTION_LINK :
				Symlink.isBackboneModel(val) || (_.isString(val) && val !== "") ? Symlink.MODEL_LINK :
				Symlink.NULL_LINK;

			// special things when the type changes			
			if (type !== this.type) {
				// full reset
				this.reset(false);

				// auto-listen for collection reset if not a null symlink
				if (type !== Symlink.NULL_LINK) {
					this.listenTo(col, "reset", this.update);
				}
			}

			// set up symlink depending on type
			switch (type) {

				// array will return a sub collection
				case Symlink.COLLECTION_LINK:

					subset = this.getSubset();

					// if the value is the subset, this is a regular update
					if (val === subset) {
						this.mergeValueWithSubset();
					}

					// otherwise normalize and reset
					else {
						if (Symlink.isBackboneCollection(val)) val = val.toArray();

						// parse the value into an array of ids
						val = val.reduce(function(ids, m) {
							if (Symlink.isBackboneModel(m)) m = m.id;
							if (_.isString(m) && m !== "" && !_.contains(ids, m)) ids.push(m);
							return ids;
						}, []);

						// set the real value to the set of ids
						this.setValue(val);

						// translate list of ids into a list of models
						// not all models need to present immediately
						models = val.map(function(id) {
							return col.get(id);
						}).filter(function(m) {
							return m != null;
						});

						// reset the current subset
						subset.reset(models, { flush_link: false });

						// check subset is valid
						this.checkSubsetValidity();
					}

					// set the subset as the virtual value
					this.setVirtualValue(subset);

					break;

				// models and non-empty strings are used as look ups
				case Symlink.MODEL_LINK:

					// get the model from the collection
					model = col.get(val);

					// set the real value to the id
					this.setValue(_.isString(val) ? val : val.id);
					
					// if the model exists now, we set it and wait for the removal
					if (model != null) {
						col.on("remove", listener = function(m) {
							if (m === model) {
								this.set(false, null);
								this.flushChanges();
							}
						}, this);

						this.addReference(model);
						this.set(true, model);
					}

					// if the model doesn't exist, we set null and wait for it to be added
					else {
						col.on("add", listener = function(m) {
							if (m.id === val) {
								this.set(true, m);
								this.flushChanges();
							}
						}, this);

						this.set(false, null);
					}

					// add listener to be cleaned up on next update
					this._listeners.push([ col, null, listener ]);

					break;

				// otherwise we just set to null
				case Symlink.NULL_LINK:

					this.setValue(null);
					this.set(true, null);

					break;
			}

			// announce any changes
			this.flushChanges();

			// and finish
			this.isNew = false;
			delete this._updating;

			return this;
		},

		// sets the symlink's real value and type
		setValue: function(val) {
			this.value = val;
			this.type = Symlink.getType(val);
			return this;
		},

		// quick combo of setValid and setVirtualValue
		set: function(valid, val, write) {
			this.setValid(valid);
			this.setVirtualValue(val, write);
			return this;
		},

		// marks the symlink as valid or invalid
		setValid: function(bool) {
			this.valid = !!bool;
			return this;
		},

		// sets the symlink's virtual value
		setVirtualValue: function(val, write, opts) {
			// set new value
			this.virtual = val;

			// write to the model if specified
			if (write == null || write) this.writeVirtualValue(opts);
			
			return this;
		},

		// writes the virtual value to the model
		writeVirtualValue: function(opts) {
			// only write the value if the symlink is active
			if (!this.active) return this;
			this.model.set(this.attribute, this.virtual || null, opts);
			return this;
		},

		// annouces changes to virtual value and validity
		flushChanges: function(options) {
			if (!this.active) return this;

			// valid
			if (this._oldValid !== this.valid) {
				this.trigger("valid", this.valid);
				this._oldValid = this.valid;
			}

			// virtual value
			if (this._oldVirtual !== this.virtual) {
				this.trigger("change", this.virtual, this._oldVirtual);
				this._oldVirtual = this.virtual;
			}

			return this;
		},

		getSubset: function() {
			if (this.subset != null) return this.subset;

			var symlink, subset, col, updateValue;

			symlink = this;
			col = this.collection;

			// create subset from backbone collection
			this.subset = subset = new (this.options.collection)(null, {
				comparator: function(m) {
					var index, len,
						val = symlink.value;

					if (_.isArray(val)) {
						index = val.indexOf(m.id);
						len = val.length;
					} else {
						index = -1;
						len = this.length;
					}
					
					// add at index or the end
					return index > -1 ? index : len;
				}
			});

			// prepare models just like the parent does
			if (col._prepareModel) subset._prepareModel = col._prepareModel.bind(col);

			// listen to main collection for changes
			this.listenTo(col, {
				add: function(m, c, opts) {
					if (_.contains(this.value, m.id)) subset.add(m);
				},
				remove: function(m, c, opts) {
					subset.remove(m);
				}
			});

			// generic function for updating the value from subset
			updateValue = _.bind(function(add, remove, opts) {
				remove.forEach(this.removeReference, this);
				add.forEach(this.addReference, this);

				if (opts == null || opts.flush_link !== false) {
					this.mergeValueWithSubset(remove);
					this.flushChanges();
				}
			}, this);

			// listen to subset for changes
			this.listenTo(subset, {
				add:    function(m, c, opts) { updateValue([ m ], [], opts); },
				remove: function(m, c, opts) { updateValue([], [ m ], opts); },
				reset:  function(c, opts)    { updateValue(c.toArray(), opts.previousModels, opts); }
			});

			return subset;
		},

		// check if a subset is valid
		checkSubsetValidity: function() {
			if (this.subset == null) return this;

			// value is only valid if all the items are present
			this.setValid(_.every(this.value, function(id) {
				return this.subset.get(id) != null;
			}, this));

			return this;
		},

		// sets the real value of the symlink according to models in the subset
		mergeValueWithSubset: function(remove) {
			if (this.subset == null) return this;

			// get the list of ids from the subset
			var ids = this.subset.map(function(m) { return m.id; });

			// this union ensures that a race condition is not created
			// if a model hasn't arrived yet, but changes are already
			// being made on the subset; we want to ensure that models
			// are not lost from our original list.
			ids = _.union(this.value, ids);

			// if a model was removed from the subset it was
			// undoubtedly added back in the union, so this just
			// guarantees it's removed.
			remove = _.isArray(remove) ? remove : remove != null ? [ remove ] : [];
			ids = _.without.apply(_, [ ids ].concat(remove));

			// update the real value to the list of ids
			this.setValue(ids);

			// check if the subset is valid
			this.checkSubsetValidity();

			return this;
		},

		// checks if this symlink contains a model or model id
		contains: function(id) {
			// we know the answer if the symlink has no value
			if (this.value == null) return false;

			// convert models to ids
			if (isObject(id)) id = id.id;
			
			// result depends on value type
			return isArray(this.value) ?
				this.value.indexOf(id) > -1 :
				this.value === id;
		},

		// cleans up any state created by update
		clean: function() {
			// kill any listeners we've set up
			var listeners = (this._listeners || []).slice(0);
			this._listeners = [];
			listeners.forEach(function(l) {
				l[0].off(l[1], l[2], l[3]);
			});

			// remove reference in model
			if (this.type === Symlink.MODEL_LINK && this.virtual) {
				this.removeReference(this.virtual);
			}

			return this;
		},

		// sets symlink back to a null state
		reset: function(write) {
			var subset;

			// clean up listeners
			this.clean();

			// stop listening to collection
			this.stopListening(this.collection);

			// kill the subset
			if (this.subset != null) {
				subset = this.subset;
				delete this.subset;
				this.stopListening(subset);
				subset.each(this.removeReference, this);
				subset.reset();
			}

			// set null on all values
			this.isNew = true;
			this.setValue(null);
			this.set(true, null, write);

			return this;
		},

		addReference: function(model) {
			var ref = model._refSymlinks;
			if (ref == null) ref = model._refSymlinks = [];
			if (!_.contains(ref, this)) {
				ref.push(this);
				model.trigger("reference:add", this);
			}
			return this;
		},

		removeReference: function(model) {
			var ref = model._refSymlinks;
			if (ref && _.contains(ref, this)) {
				model._refSymlinks = _.without(ref, this);
				model.trigger("reference:remove", this);
			}
			return this;
		}

	});

	// Backbone Model methods
	var model_methods = {

		// creates a pointer from attr to a model in col
		symlink: function(_super) {
			return function symlink(attr, col, options) {
				if (this._symlinks == null) this._symlinks = {};

				// unlink before trying to symlink again
				this.unlink(attr);

				// create the symlink instance
				var symlink = this._symlinks[attr] = new Symlink(this, attr, col, options);

				// announce the symlink
				this.trigger("symlink", symlink);

				// return model for chaining
				return this;
			};
		},

		// returns the symlink by attribute
		getSymlink: function(_super) {
			return function getSymlink(attr) {
				return this._symlinks != null ? this._symlinks[attr] : null;
			};
		},

		// removes a symlink from an attribute
		unlink: function(_super) {
			return function unlink(attr) {
				if (!_.isObject(this._symlinks)) return this;

				// unlink everything if attr is empty
				if (attr == null) {
					for (var key in this._symlinks) {
						this.unlink(key);
					}
					return this;
				}

				// get the symlink, if it exists
				var symlink = this.getSymlink(attr);
				if (symlink == null) return this;

				// detach the symlink
				symlink.detach();
				
				// delete the symlink
				delete this._symlinks[attr];

				// announce the unlink
				this.trigger("unlink", symlink);

				return this;
			};
		},

		// gets the real value from an attribute
		deref: function(_super) {
			return function deref(attr) {
				var symlink = this.getSymlink(attr);
				if (symlink != null) return symlink.value;
			};
		},

		// waits for a symlink to become valid before calling the callback
		onArrival: function(_super) {
			return function onArrival(attr, cb) {
				var symlink = this.getSymlink(attr);
				if (symlink == null) throw new Error("No symlink at attribute '" + attr + "'.");
				if (!_.isFunction(cb)) throw new Error("Expecting function for callback.");

				cb = cb.bind(this);
				function ready() { cb(symlink.virtual, symlink); }

				if (symlink.valid) ready();
				else symlink.once("valid", ready);

				return this;
			};
		},

		// outputs the attributes with id reference instead of models
		toJSON: function(_super) {
			if (_super == null) _super = function() {
				return _.clone(this.attributes);
			}
			
			return function toJSON(options) {
				var data = _super.apply(this, arguments);
				
				// convert symlinks to real values
				if (this._symlinks != null) _.each(this._symlinks, function(link, attr) {
					if (link.active && _.has(data, attr)) data[attr] = link.value;
				});

				return data;
			}
		}

	};

	// creates an object of methods as if extends the passed object
	Symlink.methods = function(model) {
		return _.reduce(model_methods, function(m, fn, name) {
			m[name] = fn(model[name], Backbone);
			return m;
		}, {});
	}

	// attaches backbone methods to a backbone model instance
	Symlink.configure = function(model) {
		if (typeof model === "function") model = model.prototype;
		if (typeof model !== "object" || !model) {
			throw new Error("Expecting Model class or instance to attach methods to.");
		}

		return _.extend(model, Symlink.methods(model));
	}

	// restores previous Symlink global if need be
	var previousSymlink = root.Symlink;
	Symlink.noConflict = function() {
		root.Symlink = previousSymlink;
		return this;
	}

	// export the Symlink class
	return Symlink;
}));