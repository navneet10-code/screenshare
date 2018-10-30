import babel from 'rollup-plugin-babel';
import uglify from 'rollup-plugin-uglify';

export default {
  input: 'src/index.js',
  plugins: [ babel(), uglify() ],
  output: {
    file: 'out/iframe-screenshare.min.js',
    format: 'umd'
  },
  name: 'iframeScreenshare'
};
