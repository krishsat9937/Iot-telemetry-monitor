module.exports = {
  plugins: {
    '@tailwindcss/postcss': { config: './tw.config.js' }, // <- point to renamed file
    autoprefixer: {},
  },
};
