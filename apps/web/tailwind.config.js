import preset from '../../packages/ui/src/tailwind-preset.ts';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx,jsx,js}',
    '../../packages/ui/src/**/*.{ts,tsx,jsx,js}',
  ],
  plugins: [],
};
