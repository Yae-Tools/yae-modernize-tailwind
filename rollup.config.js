import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'es',
    sourcemap: false,
    banner: '#!/usr/bin/env node',
  },
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
  ],
  external: [
    'yargs',
    'yargs/helpers',
    'fs/promises',
    'glob',
    'inquirer',
    'simple-git',
    'chalk',
    'ora',
  ],
};
