# @quentinadam/rollup-plugin-typescript

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