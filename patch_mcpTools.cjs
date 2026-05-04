const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, 'packages/agent-core/src/tools/mcpTools.ts');
let code = fs.readFileSync(targetFile, 'utf8');

// 1. Update callMcpTool signature
code = code.replace(
  /async function callMcpTool<TArgs extends Record<string, unknown> \| undefined>\(\n  name: string,\n  args\?: TArgs\n\) {/g,
  `async function callMcpTool<TArgs extends Record<string, unknown> | undefined>(
  name: string,
  args?: TArgs,
  config?: any
) {`
);

// 2. Update defaultDir assignment
code = code.replace(
  /const rootDir =\n    workspaceContext\?.rootPath \?\? \(await getConfig\(\)\)\.workingFolder;/g,
  `const rootDir =
    config?.configurable?.workspaceRoot ?? workspaceContext?.rootPath ?? (await getConfig()).workingFolder;`
);

// 3. Update tool definitions to accept config
code = code.replace(/async \((input: \{[\s\S]*?\})\) => \{/g, 'async ($1, config: any) => {');
code = code.replace(/async \(\{([^}]+)\}: \{([^}]+)\}\) => \{/g, 'async ({{$1}}: {{$2}}, config: any) => {'.replace(/\{\{/g, '{').replace(/\}\}/g, '}'));

// 4. Update callMcpTool invocations
code = code.replace(/await callMcpTool\("([^"]+)",\s*([^)]+?)\s*\)/g, 'await callMcpTool("$1", $2, config)');
code = code.replace(/await callMcpTool\("([^"]+)"\)/g, 'await callMcpTool("$1", undefined, config)');

fs.writeFileSync(targetFile, code);
console.log('Successfully patched mcpTools.ts');
