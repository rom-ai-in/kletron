#!/usr/bin/env python3
"""
Chart Renderer Script
Converts Plotly JSON chart files to PNG images using matplotlib.

Usage:
    python render_charts.py [chart_name]
    
If chart_name is provided, only that chart will be rendered.
Otherwise, all JSON files in graph/charts/ will be converted.
"""

import os
import json
import sys
import base64
from pathlib import Path

try:
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    import numpy as np
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    print("Error: matplotlib is required. Install it with: pip install matplotlib")
    sys.exit(1)

try:
    import plotly.graph_objects as go
    import plotly.io as pio
    PLOTLY_AVAILABLE = True
except ImportError:
    print("Error: plotly is required. Install it with: pip install plotly")
    sys.exit(1)


def decode_plotly_array(value):
    """Decode Plotly's base64-encoded arrays"""
    if isinstance(value, list):
        return value
    elif isinstance(value, dict) and 'bdata' in value:
        # Base64 encoded array
        dtype = value.get('dtype', 'f8')
        bdata = value['bdata']
        decoded = base64.b64decode(bdata)
        if dtype == 'f8':
            return np.frombuffer(decoded, dtype=np.float64).tolist()
        elif dtype == 'f4':
            return np.frombuffer(decoded, dtype=np.float32).tolist()
        elif dtype == 'i8':
            return np.frombuffer(decoded, dtype=np.int64).tolist()
        elif dtype == 'i4':
            return np.frombuffer(decoded, dtype=np.int32).tolist()
    return value


def render_bar_chart(json_path, output_path, title, xlabel, ylabel):
    """Render a bar chart from Plotly JSON using matplotlib"""
    with open(json_path, 'r') as f:
        plotly_data = json.load(f)
    
    # Extract data from Plotly JSON
    data = plotly_data['data'][0]
    x_values = decode_plotly_array(data['x'])
    y_values = decode_plotly_array(data['y'])
    
    fig, ax = plt.subplots(figsize=(10, 6))
    colors = ['#4C72B0', '#55A868', '#C44E52', '#8172B2', '#CCB974', '#F79F79']
    bars = ax.bar(x_values, y_values, color=colors[:len(x_values)])
    
    ax.set_xlabel(xlabel, fontsize=12)
    ax.set_ylabel(ylabel, fontsize=12)
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.tick_params(axis='x', rotation=45)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))
    
    # Add value labels on bars
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
               f'${height:,.0f}',
               ha='center', va='bottom', fontsize=9)
    
    plt.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"✓ Rendered {os.path.basename(output_path)}")


def render_pie_chart(json_path, output_path, title):
    """Render a pie chart from Plotly JSON using matplotlib"""
    with open(json_path, 'r') as f:
        plotly_data = json.load(f)
    
    # Extract data from Plotly JSON
    data = plotly_data['data'][0]
    values = decode_plotly_array(data['values'])
    labels = decode_plotly_array(data['labels'])
    
    fig, ax = plt.subplots(figsize=(8, 8))
    colors = ['#4C72B0', '#55A868', '#C44E52', '#8172B2', '#CCB974', '#F79F79']
    
    wedges, texts, autotexts = ax.pie(values, labels=labels, autopct='%1.1f%%',
                                     colors=colors[:len(values)], startangle=90)
    ax.set_title(title, fontsize=14, fontweight='bold')
    
    plt.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"✓ Rendered {os.path.basename(output_path)}")


def render_line_chart(json_path, output_path, title, xlabel, ylabel):
    """Render a line chart from Plotly JSON using matplotlib"""
    with open(json_path, 'r') as f:
        plotly_data = json.load(f)
    
    # Extract data from Plotly JSON
    data = plotly_data['data'][0]
    x_values = decode_plotly_array(data['x'])
    y_values = decode_plotly_array(data['y'])
    
    fig, ax = plt.subplots(figsize=(12, 6))
    ax.plot(x_values, y_values, marker='o', linewidth=2, markersize=6, color='#4C72B0')
    
    ax.set_xlabel(xlabel, fontsize=12)
    ax.set_ylabel(ylabel, fontsize=12)
    ax.set_title(title, fontsize=14, fontweight='bold')
    ax.tick_params(axis='x', rotation=45)
    ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:,.0f}'))
    ax.grid(True, alpha=0.3)
    
    plt.tight_layout()
    fig.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)
    print(f"✓ Rendered {os.path.basename(output_path)}")


def render_heatmap(json_path, output_path, title):
    """Render a heatmap from Plotly JSON using matplotlib"""
    # For heatmaps, we need to reconstruct the data from the Plotly figure
    # This is more complex, so we'll use plotly's to_image if available
    try:
        import kaleido
        fig = go.Figure(json.load(open(json_path)))
        fig.write_image(output_path, width=800, height=600, scale=2)
        print(f"✓ Rendered {os.path.basename(output_path)} (using kaleido)")
        return
    except Exception:
        pass
    
    # Fallback: try to extract data and render with matplotlib
    print(f"⚠ Skipping {os.path.basename(json_path)} - heatmap rendering requires kaleido or manual data extraction")


def main():
    charts_dir = Path(__file__).parent / "graph" / "charts"
    
    if not charts_dir.exists():
        print(f"Error: Charts directory not found: {charts_dir}")
        sys.exit(1)
    
    # Get list of JSON files
    json_files = list(charts_dir.glob("*.json"))
    
    if not json_files:
        print("No JSON chart files found in graph/charts/")
        return
    
    # Filter by chart name if provided
    if len(sys.argv) > 1:
        chart_name = sys.argv[1]
        json_files = [f for f in json_files if chart_name in f.stem]
        if not json_files:
            print(f"No chart found matching: {chart_name}")
            return
    
    print(f"Found {len(json_files)} chart(s) to render...\n")
    
    for json_path in json_files:
        chart_name = json_path.stem
        output_path = json_path.with_suffix('.png')
        
        try:
            # Determine chart type and render accordingly
            if 'gross_sales_by_country' in chart_name or 'sales_by_country' in chart_name:
                title = "Gross Sales by Country" if 'gross' in chart_name else "Sales by Country"
                render_bar_chart(json_path, output_path, title, "Country", "Gross Sales ($)")
            elif 'profit_by_segment' in chart_name:
                render_pie_chart(json_path, output_path, "Profit Distribution by Segment")
            elif 'monthly_sales_trend' in chart_name or 'trend' in chart_name:
                render_line_chart(json_path, output_path, "Monthly Sales Trend", "Month", "Total Sales ($)")
            elif 'heatmap' in chart_name:
                render_heatmap(json_path, output_path, "Profit Margin Heatmap")
            else:
                # Try generic bar chart rendering
                render_bar_chart(json_path, output_path, chart_name.replace('_', ' ').title(), "X", "Y")
        except Exception as e:
            print(f"✗ Failed to render {chart_name}: {str(e)}")
    
    print(f"\n✓ Rendering complete! PNG images saved to {charts_dir}")


if __name__ == "__main__":
    main()

