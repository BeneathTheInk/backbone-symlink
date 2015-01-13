var Backbone = require("backbone"),
	Symlink = require("../"),
	expect = require("chai").expect;

Symlink.configure(Backbone.Model);

describe("Single Model Symlinks", function() {
	var model1, model2, col;

	beforeEach(function() {
		model1 = new Backbone.Model({ foo: "2", id: "1" });
		model2 = new Backbone.Model({ id: "2" });
		col = new Backbone.Collection();
	});

	afterEach(function() {
		model1.unlink();
		col.reset();
	});

	it("basic symlink", function() {
		col.add(model2);
		model1.symlink("foo", col);
		expect(model1.get("foo")).to.equal(model2);
	});

	it("symlinks to model before model is in collection", function() {
		model1.symlink("foo", col);
		expect(model1.get("foo")).to.equal(null);
		expect(model1.getSymlink("foo").valid).to.equal(false);

		col.add(model2);
		expect(model1.get("foo")).to.equal(model2);
		expect(model1.getSymlink("foo").valid).to.equal(true);
	});

	it("unlinks", function() {
		col.add(model2);

		model1.symlink("foo", col);
		expect(model1.get("foo")).to.equal(model2);

		model1.unlink("foo");
		expect(model1.get("foo")).to.equal("2");
	});

	it("announces when a delayed model arrives", function(done) {
		model1.symlink("foo", col);
		expect(model1.get("foo")).to.equal(null);
		expect(model1.getSymlink("foo").valid).to.equal(false);

		model1.onArrival("foo", function(v, symlink) {
			expect(v).to.equal(model2);
			expect(symlink.valid).to.equal(true);
			done();
		});

		col.add(model2);
	});

	it("toJSON does not include model, only the id", function() {
		col.add(model2);
		model1.symlink("foo", col);
		expect(model1.toJSON()).to.deep.equal({ foo: model2.id, id: model1.id });
	});

});

describe("Multiple Model Symlinks", function() {
	var main, sub1, sub2, sub3, col;

	beforeEach(function() {
		main = new Backbone.Model({ foo: [], id: "1" });
		sub1 = new Backbone.Model({ id: "2" });
		sub2 = new Backbone.Model({ id: "3" });
		sub3 = new Backbone.Model({ id: "4" });
		col = new Backbone.Collection();
	});

	afterEach(function() {
		main.unlink();
		col.reset();
	});

	it("symlinks to list of models", function() {
		main.set("foo", [ "2", "4" ]);
		col.add([ sub1, sub2, sub3 ]);

		main.symlink("foo", col);
		expect(main.get("foo")).to.be.instanceof(Backbone.Collection);
		expect(main.get("foo").toArray()).to.deep.equal([ sub1, sub3 ]);
	});

	it("symlinks to list of models before models are in collection", function() {
		main.set("foo", [ "2", "4" ]);
		col.add([ sub3 ]);

		main.symlink("foo", col);
		expect(main.get("foo")).to.be.instanceof(Backbone.Collection);
		expect(main.get("foo").toArray()).to.deep.equal([ sub3 ]);
		expect(main.getSymlink("foo").valid).to.equal(false);

		col.add([ sub2, sub1 ]);
		expect(main.get("foo")).to.be.instanceof(Backbone.Collection);
		expect(main.get("foo").toArray()).to.deep.equal([ sub1, sub3 ]);
		expect(main.getSymlink("foo").valid).to.equal(true);
	});

	it("unlinks", function() {
		main.set("foo", [ "2", "3", "4" ]);
		col.add([ sub1, sub3 ]);

		main.symlink("foo", col);
		expect(main.get("foo")).to.be.instanceof(Backbone.Collection);
		expect(main.get("foo").toArray()).to.deep.equal([ sub1, sub3 ]);
		expect(main.getSymlink("foo").valid).to.equal(false);

		main.unlink("foo");
		expect(main.get("foo")).to.deep.equal([ "2", "3", "4" ]);
	});

	it("ids of models added to subset appear in real value", function() {
		col.add([ sub1 ]);

		main.symlink("foo", col);
		expect(main.get("foo")).to.be.instanceof(Backbone.Collection);
		expect(main.get("foo").length).to.equal(0);

		main.get("foo").add(sub1);
		expect(main.deref("foo")).to.deep.equal([ sub1.id ]);
	});

});