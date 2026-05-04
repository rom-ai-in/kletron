# GitHub labels

Apply these labels so contributors can filter work. Create them manually or with [`gh`](https://cli.github.com/):

```bash
gh label create "good first issue" --color "7057FF" --description "Small mentor-friendly tasks"
gh label create "help wanted" --color "008672" --description "Extra attention welcome"
gh label create "design discussion" --color "D4C5F9" --description "Needs consensus before code"
gh label create "area:web" --color "0E8A16" --description "Next.js / web"
gh label create "area:graphs" --color "1D76DB" --description "Agent graphs / presets"
gh label create "area:mcp" --color "FBCA04" --description "MCP servers / tools"
gh label create "area:desktop" --color "B60205" --description "Electron desktop"
gh label create "area:docs" --color "F9D0C4" --description "README / guides"
gh label create "area:community" --color "C2E0C6" --description "community/ examples"
```

The same set is mirrored in [`.github/labels.yml`](../.github/labels.yml) for documentation only (GitHub does not load that file automatically).
