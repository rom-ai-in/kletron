#!/usr/bin/env python3
"""
Export LangGraph workflow as a visual graph (PNG)
"""

from graph import app
import json
import os

def export_graph_to_dot(layout="LR"):
    """Export graph structure to Graphviz DOT format
    
    Args:
        layout: "LR" for left-to-right (wide), "TB" for top-to-bottom (tall)
    """
    
    # Get graph structure
    graph_info = app.get_graph()
    
    # Build DOT file content
    dot_lines = [
        "digraph FinanceAnalyzer {",
        f"    rankdir={layout};",
        "    node [shape=box, style=rounded, fontname=Arial, fontsize=11];",
        "    edge [fontname=Arial, fontsize=9, arrowsize=0.8];",
        "    graph [dpi=300, bgcolor=white];",
        ""
    ]
    
    # Add nodes with colors
    node_colors = {
        "__start__": "lightgray",
        "__end__": "lightgray",
        "supervisor": "#FF1493",  # Deep Pink - Supervisor (handles chat too)
        "data_quality": "#4A90E2",  # Blue
        "data_processing": "#9370DB",  # Medium Purple - Subgraph (Load→Clean→Analyze)
        "insights": "#9B59B6",  # Purple
        "visualization": "#FFD700",  # Gold
        "forecasting": "#FF6B6B",  # Red
        "anomaly_detection": "#FF6B6B",  # Red
        "risk_analysis": "#FF8C00",  # Orange
        "report_generator": "#20B2AA"  # Light Sea Green
        # Chat node removed - supervisor handles chat directly
        # Subgraph contains: load_inspect → clean_normalize → analyze
    }
    
    node_labels = {
        "__start__": "START",
        "__end__": "END",
        "supervisor": "Supervisor\nAgent\n(handles chat)",
        "data_quality": "Data Quality\nAgent",
        "data_processing": "Data Processing\nSubgraph\n(Load→Clean→Analyze)",
        "insights": "Generate\nInsights",
        "visualization": "Visualization\nAgent",
        "forecasting": "Forecasting\nAgent",
        "anomaly_detection": "Anomaly\nDetection",
        "risk_analysis": "Risk Analysis\nAgent",
        "report_generator": "Report\nGenerator"
        # Chat node removed - supervisor handles chat directly
        # Subgraph contains: load_inspect → clean_normalize → analyze
    }
    
    # Add all nodes
    for node in sorted(graph_info.nodes.keys()):
        color = node_colors.get(node, "lightblue")
        label = node_labels.get(node, node.replace("_", "\n"))
        dot_lines.append(f'    "{node}" [label="{label}", fillcolor="{color}", style="rounded,filled"];')
    
    dot_lines.append("")
    
    # Add edges - TRUE SUPERVISOR PATTERN (No Chat Node)
    # Supervisor handles chat directly OR routes to agents
    # All agents return to supervisor after completion
    
    # Entry point
    dot_lines.append('    "__start__" -> "supervisor" [style=dashed, label="entry"];')
    
    # Supervisor routes to agents (conditional - supervisor decides)
    dot_lines.append('    "supervisor" -> "data_quality" [style=dashed, label="if needed"];')
    dot_lines.append('    "supervisor" -> "data_processing" [style=dashed, label="process data"];')
    dot_lines.append('    "supervisor" -> "insights" [style=dashed, label="if needed"];')
    dot_lines.append('    "supervisor" -> "visualization" [style=dashed, label="if requested"];')
    dot_lines.append('    "supervisor" -> "forecasting" [style=dashed, label="if requested"];')
    dot_lines.append('    "supervisor" -> "anomaly_detection" [style=dashed, label="if requested"];')
    dot_lines.append('    "supervisor" -> "risk_analysis" [style=dashed, label="if requested"];')
    dot_lines.append('    "supervisor" -> "report_generator" [style=dashed, label="if requested"];')
    dot_lines.append('    "supervisor" -> "__end__" [style=solid, label="handles chat"];')
    
    # All agents return to supervisor (supervisor orchestrates)
    dot_lines.append('    "data_quality" -> "supervisor" [style=dotted, label="done"];')
    dot_lines.append('    "data_processing" -> "supervisor" [style=dotted, label="done"];')
    dot_lines.append('    "insights" -> "supervisor" [style=dotted, label="done"];')
    dot_lines.append('    "visualization" -> "supervisor" [style=dotted, label="done"];')
    dot_lines.append('    "forecasting" -> "supervisor" [style=dotted, label="done"];')
    dot_lines.append('    "anomaly_detection" -> "supervisor" [style=dotted, label="done"];')
    dot_lines.append('    "risk_analysis" -> "supervisor" [style=dotted, label="done"];')
    dot_lines.append('    "report_generator" -> "supervisor" [style=dotted, label="done"];')
    
    # Add comment about subgraph structure
    dot_lines.append('    // Note: data_processing is a subgraph containing: load_inspect → clean_normalize → analyze')
    
    dot_lines.append("}")
    
    dot_content = "\n".join(dot_lines)
    
    # Save DOT file
    layout_suffix = "_horizontal" if layout == "LR" else "_vertical"
    dot_path = f"graph/finance_analyzer{layout_suffix}.dot"
    with open(dot_path, "w") as f:
        f.write(dot_content)
    
    print(f"✅ DOT file saved: {dot_path}")
    return dot_path, dot_content


def export_graph_to_json():
    """Export graph structure to JSON"""
    graph_info = app.get_graph()
    
    graph_data = {
        "nodes": list(graph_info.nodes.keys()),
        "edges": [
            {"source": "data_quality", "target": "load_inspect"},
            {"source": "load_inspect", "target": "clean_normalize"},
            {"source": "clean_normalize", "target": "analyze"},
            {"source": "analyze", "target": "insights"},
            {"source": "insights", "target": "visualization"},
            {"source": "visualization", "target": "forecasting"},
            {"source": "forecasting", "target": "anomaly_detection"},
            {"source": "anomaly_detection", "target": "risk_analysis"},
            {"source": "risk_analysis", "target": "report_generator"},
            {"source": "report_generator", "target": "chat"},
            {"source": "chat", "target": "__end__"},
            {"source": "__start__", "target": "data_quality", "conditional": True}
        ],
        "node_info": {
            node: {
                "type": "agent" if "agent" in node.lower() or node in ["visualization", "forecasting", "anomaly_detection", "risk_analysis", "report_generator"] else "node"
            }
            for node in graph_info.nodes.keys()
        }
    }
    
    json_path = "graph/finance_analyzer.json"
    with open(json_path, "w") as f:
        json.dump(graph_data, f, indent=2)
    
    print(f"✅ JSON file saved: {json_path}")
    return json_path


def convert_dot_to_png(dot_path):
    """Convert DOT file to PNG using graphviz"""
    try:
        import subprocess
        import sys
        
        # Determine output filename based on input
        if "horizontal" in dot_path:
            png_path = "graph/finance_analyzer_horizontal.png"
        elif "vertical" in dot_path:
            png_path = "graph/finance_analyzer_vertical.png"
        else:
            png_path = dot_path.replace(".dot", ".png")
        
        # Try to use graphviz command line tool
        result = subprocess.run(
            ["dot", "-Tpng", "-o", png_path, dot_path],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print(f"✅ PNG file saved: {png_path}")
            return png_path
        else:
            print(f"⚠️  Graphviz 'dot' command failed: {result.stderr}")
            print("   Install graphviz: brew install graphviz (Mac) or apt-get install graphviz (Linux)")
            return None
            
    except FileNotFoundError:
        print("⚠️  Graphviz not found. Install it:")
        print("   Mac: brew install graphviz")
        print("   Linux: sudo apt-get install graphviz")
        print("   Windows: Download from https://graphviz.org/download/")
        return None
    except Exception as e:
        print(f"⚠️  Error converting to PNG: {e}")
        return None


def print_graph_summary():
    """Print a text summary of the graph"""
    print("\n" + "="*70)
    print("📊 FINANCE ANALYZER GRAPH STRUCTURE")
    print("="*70)
    print()
    print("Nodes (13 total):")
    print("  🟢 Entry/Exit:")
    print("     - __start__")
    print("     - __end__")
    print()
    print("  🔵 Data Processing:")
    print("     - data_quality (Data Quality Agent)")
    print("     - load_inspect (Load & Inspect)")
    print("     - clean_normalize (Clean & Normalize)")
    print("     - analyze (Analyze)")
    print("     - insights (Generate Insights)")
    print()
    print("  🟡 Analysis Agents:")
    print("     - visualization (Visualization Agent)")
    print("     - forecasting (Forecasting Agent)")
    print("     - anomaly_detection (Anomaly Detection Agent)")
    print("     - risk_analysis (Risk Analysis Agent)")
    print("     - report_generator (Report Generator Agent)")
    print()
    print("  💬 Interaction:")
    print("     - chat (Chat Agent)")
    print()
    print("Edges (11 total):")
    print("  __start__ → data_quality (conditional)")
    print("  data_quality → load_inspect")
    print("  load_inspect → clean_normalize")
    print("  clean_normalize → analyze")
    print("  analyze → insights")
    print("  insights → visualization")
    print("  visualization → forecasting")
    print("  forecasting → anomaly_detection")
    print("  anomaly_detection → risk_analysis")
    print("  risk_analysis → report_generator")
    print("  report_generator → chat")
    print("  chat → __end__")
    print()
    print("="*70)
    print()


if __name__ == "__main__":
    print("🔄 Exporting graph structure...")
    print()
    
    # Create graph directory
    os.makedirs("graph", exist_ok=True)
    
    # Export DOT - horizontal layout (better for presentations)
    dot_path_lr, dot_content_lr = export_graph_to_dot("LR")
    png_path_lr = convert_dot_to_png(dot_path_lr)
    
    # Export DOT - vertical layout (alternative)
    dot_path_tb, dot_content_tb = export_graph_to_dot("TB")
    png_path_tb = convert_dot_to_png(dot_path_tb)
    
    # Export JSON
    json_path = export_graph_to_json()
    
    # Print summary
    print_graph_summary()
    
    # Create main PNG (horizontal, best for presentations)
    if png_path_lr:
        import shutil
        main_png = "graph/finance_analyzer.png"
        shutil.copy(png_path_lr, main_png)
        print(f"✅ Main PNG (horizontal) saved: {main_png}")
    
    print()
    print("📁 Files created:")
    print(f"   - {dot_path_lr} (horizontal layout)")
    print(f"   - {dot_path_tb} (vertical layout)")
    print(f"   - {json_path}")
    if png_path_lr:
        print(f"   - {png_path_lr} (horizontal - best for presentations)")
    if png_path_tb:
        print(f"   - {png_path_tb} (vertical - alternative layout)")
    if png_path_lr:
        print(f"   - graph/finance_analyzer.png (main file, copy of horizontal)")
    if not png_path_lr and not png_path_tb:
        print("   - PNG: Not generated (install graphviz)")
    print()
    print("💡 To regenerate PNGs manually:")
    print(f"   dot -Tpng -o graph/finance_analyzer_horizontal.png {dot_path_lr}")
    print(f"   dot -Tpng -o graph/finance_analyzer_vertical.png {dot_path_tb}")

