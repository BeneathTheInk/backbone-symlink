module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		clean: [ "dist/*.js" ],
		copy: {
			dist: {
				src: "lib/backbone-symlink.js",
				dest: "dist/backbone-symlink.js"
			}
		},
		browserify: {
			test: {
				src: "test/*.js",
				dest: "dist/backbone-symlink.test.js",
				options: {
					external: [ "jquery" ],
					browserifyOptions: { debug: true }
				}
			}
		},
		wrap2000: {
			dist: {
				src: 'dist/backbone-symlink.js',
				dest: 'dist/backbone-symlink.js',
				options: {
					header: "/*\n * Backbone Symlink\n * Depends on Backbone and Underscore\n * (c) 2015 Beneath the Ink, Inc.\n * MIT License\n * Version <%= pkg.version %>\n */\n"
				}
			},
			dev: {
				src: 'dist/backbone-symlink.dev.js',
				dest: 'dist/backbone-symlink.dev.js',
				options: {
					header: "/* Backbone Symlink / (c) 2015 Beneath the Ink, Inc. / MIT License / Version <%= pkg.version %> */"
				}
			},
			test: {
				src: 'dist/backbone-symlink.test.js',
				dest: 'dist/backbone-symlink.test.js',
				options: {
					header: "/* Backbone Symlink Tests / (c) 2015 Beneath the Ink, Inc. / MIT License / Version <%= pkg.version %> */"
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
				tasks: [ 'test' ],
				options: { spawn: false }
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-wrap2000');

	grunt.registerTask('build-test', [ 'browserify:test', 'wrap2000:test' ]);
	grunt.registerTask('build-dist', [ 'copy:dist', 'wrap2000:dist', 'uglify:dist' ]);

	grunt.registerTask('test', [ 'clean', 'build-test' ]);
	grunt.registerTask('dist', [ 'clean', 'build-dist'  ]);

	grunt.registerTask('default', [ 'clean', 'build-dist' ]);

}
