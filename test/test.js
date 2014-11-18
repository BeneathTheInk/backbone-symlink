describe("Single Model Symlinks", function() {

	it("basic symlink", function() {
		var model1 = new Backbone.Model({ foo: "2", id: "1" }),
			model2 = new Backbone.Model({ id: "2" }),
			col = new Backbone.Collection([ model2 ]);

		model1.link("foo", col);
		expect(model1.get("foo")).to.equal(model2);
	});

	it("symlinks to model before model is in collection", function() {
		var model1 = new Backbone.Model({ foo: "2", id: "1" }),
			model2 = new Backbone.Model({ id: "2" }),
			col = new Backbone.Collection();

		model1.link("foo", col);
		expect(model1.get("foo")).to.equal(null);
		expect(model1.getLink("foo").valid).to.equal(false);

		col.add(model2);
		expect(model1.get("foo")).to.equal(model2);
		expect(model1.getLink("foo").valid).to.equal(true);
	});

	it("unlinks", function() {
		var model1 = new Backbone.Model({ foo: "2", id: "1" }),
			model2 = new Backbone.Model({ id: "2" }),
			col = new Backbone.Collection([ model2 ]);

		model1.link("foo", col);
		expect(model1.get("foo")).to.equal(model2);

		model1.unlink("foo");
		expect(model1.get("foo")).to.equal("2");
	});

	it("announces when a delayed model arrives", function(done) {
		var model1 = new Backbone.Model({ foo: "2", id: "1" }),
			model2 = new Backbone.Model({ id: "2" }),
			col = new Backbone.Collection();

		model1.link("foo", col);
		expect(model1.get("foo")).to.equal(null);
		expect(model1.getLink("foo").valid).to.equal(false);

		model1.onArrival("foo", function(v, link) {
			expect(v).to.equal(model2);
			expect(link.valid).to.equal(true);
			done();
		});

		col.add(model2);
	});

});

describe("Multiple Model Symlinks", function() {

	it("symlinks to list of models", function() {
		var main = new Backbone.Model({ foo: [ "2", "4" ], id: "1" }),
			sub1 = new Backbone.Model({ id: "2" }),
			sub2 = new Backbone.Model({ id: "3" }),
			sub3 = new Backbone.Model({ id: "4" }),
			col = new Backbone.Collection([ sub1, sub2, sub3 ]);

		main.link("foo", col);
		expect(main.get("foo")).to.be.instanceof(Backbone.Collection);
		expect(main.get("foo").toArray()).to.deep.equal([ sub1, sub3 ]);
	});

	it("symlinks to list of models before models are in collection", function() {
		var main = new Backbone.Model({ foo: [ "2", "4" ], id: "1" }),
			sub1 = new Backbone.Model({ id: "2" }),
			sub2 = new Backbone.Model({ id: "3" }),
			sub3 = new Backbone.Model({ id: "4" }),
			col = new Backbone.Collection([ sub3 ]);

		main.link("foo", col);
		expect(main.get("foo")).to.be.instanceof(Backbone.Collection);
		expect(main.get("foo").toArray()).to.deep.equal([ sub3 ]);
		expect(main.getLink("foo").valid).to.equal(false);

		col.add([ sub2, sub1 ]);
		expect(main.get("foo")).to.be.instanceof(Backbone.Collection);
		expect(main.get("foo").toArray()).to.deep.equal([ sub1, sub3 ]);
		expect(main.getLink("foo").valid).to.equal(true);
	});

	it("unlinks", function() {
		var main = new Backbone.Model({ foo: [ "2", "3", "4" ], id: "1" }),
			sub1 = new Backbone.Model({ id: "2" }),
			sub2 = new Backbone.Model({ id: "3" }),
			sub3 = new Backbone.Model({ id: "4" }),
			col = new Backbone.Collection([ sub1, sub3 ]);

		main.link("foo", col);
		expect(main.get("foo")).to.be.instanceof(Backbone.Collection);
		expect(main.get("foo").toArray()).to.deep.equal([ sub1, sub3 ]);
		expect(main.getLink("foo").valid).to.equal(false);

		main.unlink("foo");
		expect(main.get("foo")).to.deep.equal([ "2", "3", "4" ]);
	});

});