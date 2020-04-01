# @quentinadam/rollup-plugin-typescript

[![npm version](https://img.shields.io/npm/v/@quentinadam/rollup-plugin-typescript.svg?style=flat-square)](https://www.npmjs.com/package/@quentinadam/rollup-plugin-typescript)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://prettier.io/)

## Installation

```
npm install @quentinadam/rollup-plugin-typescript
```

## Usage with Rollup.js
### rollup.config.js
```javascript
// rollup.config.js
import typescript from '@quentinadam/rollup-plugin-typescript';

export default {
  input: './src/index.ts',
  output: [{
    file: './dist/index.js',
    format: 'iife',
  }],
  plugins: [
    typescript(),
  ],
};
```
### File structure
```
dist/
src/
  index.ts
  ...
rollup.config.js
tsconfig.json
```