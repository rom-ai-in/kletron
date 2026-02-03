const esbuild = require('esbuild');
const path = require('path');

/**
 * Build webview assets for the Numezis Code extension
 */
async function buildWebview() {
    const isWatch = process.argv.includes('--watch');

    const config = {
        entryPoints: [path.resolve(__dirname, '../src/webview/app.ts')],
        bundle: true,
        outfile: path.resolve(__dirname, '../media/app.js'),
        format: 'iife',
        target: 'es2020',
        sourcemap: true,
        minify: process.env.NODE_ENV === 'production',
    };

    if (isWatch) {
        const ctx = await esbuild.context(config);
        await ctx.watch();
        console.log('Watching webview for changes...');
    } else {
        await esbuild.build(config);
        console.log('Webview built successfully.');
    }
}

buildWebview().catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
});
