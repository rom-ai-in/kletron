import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    tokens: 'src/tokens/index.ts',
    types: 'src/types.ts',
    'components/design-system': 'src/components/design-system.ts',
    'tailwind-preset': 'src/tailwind-preset.ts',
  },
  format: ['esm'],
  tsconfig: 'tsconfig.build.json',
  dts: true,
  splitting: true,
  treeshake: true,
  external: ['react', 'react-dom', 'clsx', 'lucide-react', '@monaco-editor/react', 'monaco-editor'],
  outDir: 'dist',
  clean: true,
});
