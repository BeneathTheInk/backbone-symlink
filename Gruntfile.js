module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		clean: [ "dist/*.js" ],
		copy: {
			main: {
				src: "lib/backbone-symlink.js",
				dest: "dist/backbone-symlink.js"
			}
		},
		wrap2000: {
			main: {
				src: 'dist/backbone-symlink.js',
				dest: 'dist/backbone-symlink.js',
				options: {
					header: "/*\n * Backbone Symlink\n * Depends on Backbone and Underscore\n * Licensed under MIT; Copyright (c) 2014 Beneath the Ink, Inc.\n * Version <%= pkg.version %>\n */\n"
				}
			}
		},
		uglify: {
			main: {
				src: "dist/backbone-symlink.js",
				dest: "dist/backbone-symlink.min.js"
			}
		},
		watch: {
			main: {
				files: [ "lib/**/*" ],
				tasks: [ 'build' ],
				options: { spawn: false }
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-wrap2000');

	grunt.registerTask('build', [ 'clean', 'copy', 'wrap2000', 'uglify' ]);
	grunt.registerTask('dev', [ 'build', 'watch' ]);

	grunt.registerTask('default', [ 'build' ]);

}
