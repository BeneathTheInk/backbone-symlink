(function (global, factory) {
	'use strict';

	// Common JS (i.e. browserify) environment
	if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
		module.exports = factory(require('backbone'), require('underscore'));
	}

	// AMD?
	else if (typeof define === 'function' && define.amd) {
		define([ 'backbone', 'underscore' ], factory);
	}

	// browser global
	else if (global.Backbone && global._) {
		factory(global.Backbone, global._);
	}

	else {
		throw new Error("Could not locate Backbone and/or Underscore.");
	}

}(typeof window !== 'undefined' ? window : this, function (Backbone, _) {

	function Link(model, attr, col, options) {
		// verify arguments
		if (!(model instanceof Backbone.Model)) {
			throw new Error("Expecting instance of Backbone model.");
		}

		if (!_.isString(attr) || attr == "") {
			throw new Error("Expecting non-empty string for attribute.");
		}

		if (!(col instanceof Backbone.Collection)) {
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

	// Link types
	Link.NULL_LINK = 0;
	Link.MODEL_LINK = 1;
	Link.COLLECTION_LINK = 2;

	Link.getType = function(val) {
		return _.isArray(val) ? Link.COLLECTION_LINK :
			_.isString(val) ? Link.MODEL_LINK :
			Link.NULL_LINK;
	}

	// Link methods
	_.extend(Link.prototype, Backbone.Events, {

		// sets up the link
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

			// announce the attachment
			this.trigger("attach");

			return this;
		},

		// takes down the link
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

		// tells the link to update the value in the model
		update: function() {
			var link, col, attr, type, listener, Collection, firstRun,
				val, model, subset, updateValue, models;

			// prevent overlapping events
			if (!this.active || this._updating) return;
			this._updating = true;

			link = this;
			col = this.collection;
			attr = this.attribute;
			Collection = this.options.collection;

			// annouce the update
			this.trigger("update");
			
			// remove any previous state
			this.clean();

			// get the new value
			val = this.model.get(attr);

			// get the new type
			type = val instanceof Backbone.Collection || _.isArray(val) ? Link.COLLECTION_LINK :
				val instanceof Backbone.Model || (_.isString(val) && val !== "") ? Link.MODEL_LINK :
				Link.NULL_LINK;

			// special things when the type changes			
			if (type !== this.type) {
				// full reset
				this.reset(false);

				// auto-listen for collection reset if not a null link
				if (type !== Link.NULL_LINK) {
					this.listenTo(col, "reset", this.update);
				}
			}

			// set up link depending on type
			switch (type) {

				// array will return a sub collection
				case Link.COLLECTION_LINK:

					subset = this.subset;

					if (val instanceof Backbone.Collection) {
						// if the value is the subset, we just want to refresh the subset content
						val = val === subset ? this.value : val.toArray();
					}

					// parse the value into an array of ids
					val = val.reduce(function(ids, m) {
						if (m instanceof Backbone.Model) m = m.id;
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

					// make a new subset
					if (subset == null) {
						this.subset = subset = new Collection(models, {
							comparator: function(m) {
								return _.isArray(link.value) ? link.value.indexOf(m.id) : -1;
							}
						});

						// listen to main collection for changes
						this.listenTo(col, {
							add: function(m, c, opts) {
								if (_.contains(val, m.id)) subset.add(m);
							},
							remove: function(m, c, opts) {
								subset.remove(m);
							}
						});

						// generic function for updating the value from subset
						updateValue = _.bind(function(opts, remove) {
							if (opts.flush_link !== false) {
								this.updateValueFromSubset(remove);
								this.flushChanges();
							}
						}, this);

						// listen to subset for changes
						this.listenTo(subset, {
							add:    function(m, c, opts) { updateValue(opts);       },
							remove: function(m, c, opts) { updateValue(opts, m.id); },
							reset:  function(c, opts)    { updateValue(opts);       }
						});
					}

					// or just update the current subset
					else {
						subset.set(models, { merge: false, flush_link: false });
					}

					// set the real value and check validity
					this.updateValueFromSubset();

					// set the subset as the virtual value
					this.setVirtualValue(subset);

					break;

				// models and non-empty strings are used as look ups
				case Link.MODEL_LINK:

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
				case Link.NULL_LINK:

					this.setValue(null);
					this.set(true, null);

					break;
			}

			// announce any changes
			this.flushChanges();

			// and finish
			this.firstRun = false;
			delete this._updating;

			return this;
		},

		// sets the link's real value and type
		setValue: function(val) {
			this.value = val;
			this.type = Link.getType(val);
			return this;
		},

		// quick combo of setValid and setVirtualValue
		set: function(valid, val, write) {
			this.setValid(valid);
			this.setVirtualValue(val, write);
			return this;
		},

		// marks the link as valid or invalid
		setValid: function(bool) {
			this.valid = !!bool;
			return this;
		},

		// sets the link's virtual value
		setVirtualValue: function(val, write) {
			// set new value
			this.virtual = val;

			// write to the model if specified
			if (write == null || write) this.writeVirtualValue();
			
			return this;
		},

		// writes the virtual value to the model
		writeVirtualValue: function() {
			// only write the value if the link is active
			if (!this.active) return this;
			this.model.set(this.attribute, this.virtual || null);
			return this;
		},

		// annouces changes to virtual value and validity
		flushChanges: function() {
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

		// sets the real value of the link according to models in the subset
		updateValueFromSubset: function(remove) {
			if (this.subset == null) return this;

			// get the list of ids from the subset
			var ids = this.subset.map(function(m) { return m.id; });

			// if the link isn't valid yet, make sure to get all the ids
			if (this.firstRun || !this.valid) {
				// this union ensures that a race condition is not created
				// if a model hasn't arrived yet, but changes are already
				// being made on the subset; we want to ensure that models
				// are not lost from our original list.
				ids = _.union(this.value, ids);

				// if a model was removed from the subset it was
				// undoubtedly added back in the union, so this just
				// guarantees it's removed.
				if (remove != null) ids = _.without(ids, remove);
			}

			// update the real value to the list of ids
			this.setValue(ids);

			// value is only valid if all the items are present
			this.setValid(_.every(ids, function(id) {
				return this.subset.get(id) != null;
			}, this));

			return this;
		},

		// checks if this link contains a model or model id
		contains: function(id) {
			// we know the answer if the link has no value
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

			return this;
		},

		// sets link back to a null state
		reset: function(write) {
			// clean up listeners
			this.clean();

			// stop listening to collection
			this.stopListening(this.collection);

			// kill the subset
			if (this.subset != null) {
				this.stopListening(this.subset);
				delete this.subset;
			}

			// set null on all values
			this.firstRun = true;
			this.setValue(null);
			this.set(true, null, write);

			return this;
		}

	});

	// Backbone Model methods
	var model_methods = {

		// creates a pointer from attr to a model in col
		link: function(attr, col, options) {
			if (this._links == null) this._links = {};

			// unlink before trying to link again
			this.unlink(attr);

			// create the link instance
			var link = this._links[attr] = new Link(this, attr, col, options);

			// announce the link
			this.trigger("link", link);

			// return model for chaining
			return this;
		},

		// returns the link by attribute
		getLink: function(attr) {
			if (this._links == null) this._links = {};
			return this._links[attr];
		},

		// removes a link from an attribute
		unlink: function(attr) {
			if (!_.isObject(this._links)) return this;

			// unlink everything if attr is empty
			if (attr == null) {
				for (var key in this._links) {
					this.unlink(key);
				}
				return this;
			}

			// get the link, if it exists
			var link = this.getLink(attr);
			if (link == null) return this;

			// detach the link
			link.detach();
			
			// delete the link
			delete this._links[attr];

			// announce the unlink
			this.trigger("unlink", link);

			return this;
		},

		// gets the real value from an attribute
		deref: function(attr) {
			var link = this.getLink(attr);
			if (link != null) return link.value;
		},

		// waits for a link to become valid before calling the callback
		onArrival: function(attr, cb) {
			var link = this.getLink(attr);
			if (link == null) throw new Error("No link at attribute '" + attr + "'.");
			if (!_.isFunction(cb)) throw new Error("Expecting function for callback.");

			cb = cb.bind(this);
			function ready() { cb(link.virtual, link); }

			if (link.valid) ready();
			else link.once("valid", ready);

			return this;
		}
	};

	// attaches backbone methods to a backbone instance
	Link.configure = function(Backbone) {
		_.extend(Backbone.Model.prototype, model_methods);
		Backbone.Link = Link;
		return Backbone;
	}

	// autoconfigure and export the current Backbone instance
	return Link.configure(Backbone);
}));