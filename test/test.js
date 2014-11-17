describe("Backbone Links", function() {

	it("basic link pointing to model", function() {
		var model1 = new Backbone.Model({ foo: "2", id: "1" }),
			model2 = new Backbone.Model({ id: "2" }),
			col = new Backbone.Collection([ model2 ]);

		model1.link("foo", col);
		expect(model1.get("foo")).to.equal(model2);
	});

});