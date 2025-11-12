# 📊 Finance Analyzer Graph Visualization

## Files

### Visualizations
- **`finance_analyzer.png`** - Main PNG (horizontal layout, best for presentations) ⭐
- **`finance_analyzer_horizontal.png`** - Horizontal layout (wide, left-to-right)
- **`finance_analyzer_vertical.png`** - Vertical layout (tall, top-to-bottom)

### Source Files
- **`finance_analyzer_horizontal.dot`** - Graphviz DOT format (horizontal)
- **`finance_analyzer_vertical.dot`** - Graphviz DOT format (vertical)
- **`finance_analyzer.json`** - JSON format (for programmatic use)

## Graph Structure

### Nodes (14 total)

**Entry/Exit:**
- `__start__` - Entry point
- `__end__` - Exit point

**Supervisor:**
- `supervisor` - Supervisor Agent (intelligent routing) ⭐

**Data Processing:**
- `data_quality` - Data Quality Agent (validates data)
- `load_inspect` - Load & Inspect CSV
- `clean_normalize` - Clean & Normalize data
- `analyze` - Analyze & compute KPIs
- `insights` - Generate AI insights

**Analysis Agents:**
- `visualization` - Visualization Agent (creates charts)
- `forecasting` - Forecasting Agent (predicts trends)
- `anomaly_detection` - Anomaly Detection Agent (finds issues)
- `risk_analysis` - Risk Analysis Agent (assesses risks)
- `report_generator` - Report Generator Agent (creates reports)

**Interaction:**
- `chat` - Chat Agent (interactive Q&A)

### Edges (13 total)

**Entry & Routing:**
```
__start__ → supervisor (conditional entry)
supervisor → data_quality (if needs_full_analysis)
supervisor → chat (if simple chat)
```

**Full Analysis Pipeline:**
```
data_quality → load_inspect
load_inspect → clean_normalize
clean_normalize → analyze
analyze → insights
insights → visualization
visualization → forecasting
forecasting → anomaly_detection
anomaly_detection → risk_analysis
risk_analysis → report_generator
report_generator → chat (conditional)
chat → __end__
```

**Fast Path (Simple Chat):**
```
supervisor → chat → __end__
```

## Regenerating the PNG

To regenerate the PNG visualization:

```bash
# From project root
dot -Tpng -o graph/finance_analyzer.png graph/finance_analyzer.dot
```

Or use the export script:

```bash
python export_graph.py
```

## Color Coding

- 🔴 **Deep Pink**: Supervisor Agent (intelligent routing)
- 🔵 **Blue**: Data Quality Agent
- 🟢 **Green**: Data Processing (Load, Clean)
- 🟣 **Purple**: Analysis (Analyze, Insights)
- 🟡 **Gold**: Visualization & Chat
- 🔴 **Red**: Forecasting & Anomaly Detection
- 🟠 **Orange**: Risk Analysis
- 🔷 **Teal**: Report Generator
- ⚪ **Gray**: Start/End nodes

## 🎯 Smart Routing

The Supervisor Agent intelligently routes requests:

- **Simple Greetings** ("hi", "hello") → Direct to Chat (fast path)
- **CSV Analysis** → Full Pipeline (complete analysis)
- **Data Questions** (no data) → Full Pipeline (loads & analyzes)
- **Data Questions** (data exists) → Direct to Chat (uses existing analysis)

## Usage

The PNG file (`finance_analyzer.png`) shows the complete workflow with all agents and edges. Perfect for presentations and documentation!

