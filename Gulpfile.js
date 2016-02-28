"use strict";

const gulp = require('gulp');
const $ = require('gulp-load-plugins')();

gulp.task('default', () =>
    gulp.src('./src/form-validate.js')

        .pipe($.babel({
            presets: ['es2015']
        }))
        .pipe(gulp.dest('dist'))


        .pipe($.uglify())
        .pipe($.rename((path) => {
            path.extname = '.min' + path.extname
        }))
        .pipe(gulp.dest('dist'))
);
