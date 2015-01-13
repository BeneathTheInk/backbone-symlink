module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		clean: [ "dist/*.js" ],
		browserify: {
			test: {
				src: "test/*.js",
				dest: "dist/backbone-symlink.test.js",
				options: {
					browserifyOptions: { debug: true, require: [  ] }
				}
			}
		},
		copy: {
			dist: {
				src: "lib/backbone-symlink.js",
				dest: "dist/backbone-symlink.js"
			}
		},
		wrap2000: {
			dist: {
				src: 'dist/backbone-symlink.js',
				dest: 'dist/backbone-symlink.js',
				options: {
					header: "/*\n * Backbone Symlink\n * Depends on Backbone and Underscore\n * Licensed under MIT; Copyright (c) 2014 Beneath the Ink, Inc.\n * Version <%= pkg.version %>\n */\n"
				}
			},
			test: {
				src: 'dist/book-core.test.js',
				dest: 'dist/book-core.test.js',
				options: {
					header: "/* BTI Book Core Tests / (c) 2014 Beneath the Ink, Inc. / MIT License / Version <%= pkg.version %> */"
				}
			}
		},
		uglify: {
			dist: {
				src: "dist/backbone-symlink.js",
				dest: "dist/backbone-symlink.min.js"
			}
		},
		watch: {
			test: {
				files: [ "lib/**/*", "test/*.js" ],
				tasks: [ 'build-test' ],
				options: { spawn: false }
			}
		}
	});

	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-wrap2000');

	grunt.registerTask('compile-test', [ 'browserify:test', 'wrap2000:test' ]);
	grunt.registerTask('compile-dist', [ 'copy:dist', 'wrap2000:dist', 'uglify:dist' ]);

	grunt.registerTask('build-test', [ 'clean', 'compile-test' ]);
	grunt.registerTask('build-dist', [ 'clean', 'compile-dist' ]);

	grunt.registerTask('test', [ 'build-test', 'watch:test' ]);
	grunt.registerTask('dist', [ 'build-dist'  ]);

	grunt.registerTask('default', [ 'clean', 'compile-dist' ]);

}
