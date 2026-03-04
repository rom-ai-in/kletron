/**
 * Report Formatting Module
 *
 * Provides advanced formatting capabilities for automation reports,
 * including markdown, HTML, and console output formats.
 */

import type { Finding, TimelineEvent, AgentWorkflowResult } from "./types";
import { calculateExecutionMetrics, calculateTokenUsage, countFindingsBySeverity } from "./reportUtils";

/**
 * Format a finding as a rich markdown block
 */
export function formatFinding(finding: Finding): string {
    const severityIcon = {
        critical: "❌",
        high: "⚠️",
        medium: "🔶",
        low: "🔵"
    }[finding.severity || "low"];

    let markdown = `### ${severityIcon} ${finding.title}\n\n`;
    markdown += `**Severity**: ${finding.severity?.toUpperCase() || "LOW"}\n\n`;
    markdown += `${finding.summary}\n\n`;

    if (finding.evidence) {
        markdown += `\`\`\`\n${finding.evidence}\n\`\`\`\n`;
    }

    return markdown;
}

/**
 * Format timeline events as a table
 */
export function formatTimelineTable(timeline: TimelineEvent[]): string {
    if (timeline.length === 0) return "No timeline events available.\n";

    let table = "| Status | Label | Summary |\n";
    table += "|--------|-------|---------|\n";

    for (const event of timeline) {
        const statusIcon = {
            pending: "⏳",
            running: "🔄",
            success: "✅",
            error: "❌"
        }[event.status] || "⚪";

        table += `| ${statusIcon} | ${event.label} | ${event.summary} |\n`;
    }

    return table;
}

/**
 * Format execution metrics as a summary
 */
export function formatExecutionMetrics(metrics: ReturnType<typeof calculateExecutionMetrics>): string {
    const successColor = metrics.successRate >= 80 ? "🟢" : metrics.successRate >= 60 ? "🟡" : "🔴";
    return `**${successColor} Execution Metrics**
- Success Rate: ${metrics.successRate}%
- Total Operations: ${metrics.totalOperations}
- Failed Operations: ${metrics.failedOperations}`;
}

/**
 * Format token usage as a summary
 */
export function formatTokenUsage(usage: ReturnType<typeof calculateTokenUsage>): string {
    const total = usage.totalTokens;
    let costEstimate = "N/A";
    if (total > 0) {
        // Approximate cost based on common pricing ($0.01 per 1K tokens)
        const costPerThousand = 0.01;
        costEstimate = `$${(total / 1000 * costPerThousand).toFixed(2)}`;
    }

    return `**💬 Token Usage**
- Input Tokens: ${usage.inputTokens.toLocaleString()}
- Output Tokens: ${usage.outputTokens.toLocaleString()}
- Total Tokens: ${total.toLocaleString()}
- Estimated Cost: ${costEstimate}`;
}

/**
 * Format findings summary by severity
 */
export function formatFindingsSummary(findings: Finding[]): string {
    const counts = countFindingsBySeverity(findings);
    let summary = "**🔍 Findings Summary**\n";

    if (counts.critical > 0) {
        summary += `- ❌ Critical Issues: ${counts.critical}\n`;
    }
    if (counts.high > 0) {
        summary += `- ⚠️ High Priority: ${counts.high}\n`;
    }
    if (counts.medium > 0) {
        summary += `- 🔶 Medium Priority: ${counts.medium}\n`;
    }
    if (counts.low > 0) {
        summary += `- 🔵 Low Priority: ${counts.low}\n`;
    }

    summary += `- Total Findings: ${findings.length}`;

    return summary;
}

/**
 * Create a console-friendly report
 */
export function createConsoleReport(result: AgentWorkflowResult): string {
    const timeline = result.timeline || [];
    const findings = Array.isArray(result.outputs?.findings) ? result.outputs.findings : [];

    const metrics = calculateExecutionMetrics(timeline);
    const tokenUsage = calculateTokenUsage(timeline);

    let report = "╔════════════════════════════════════════════════════════════╗\n";
    report += "║         AUTOMATION RESULTS REPORT                     ║\n";
    report += "╚════════════════════════════════════════════════════════════╝\n\n";

    // Status
    const status = metrics.successRate >= 80 ? "✅ SUCCESS" : metrics.successRate >= 60 ? "⚠️ PARTIAL" : "❌ FAILED";
    report += `Status: ${status}\n\n`;

    // Metrics
    report += formatExecutionMetrics(metrics) + "\n\n";

    // Token Usage
    report += formatTokenUsage(tokenUsage) + "\n\n";

    // Findings Summary
    if (findings.length > 0) {
        report += formatFindingsSummary(findings) + "\n\n";
    }

    // Timeline
    report += "═════════════════════════════════════════════════════════\n";
    report += "Timeline Events\n";
    report += "═════════════════════════════════════════════════════════\n";
    report += formatTimelineTable(timeline) + "\n";

    // Detailed Findings
    if (findings.length > 0) {
        report += "═════════════════════════════════════════════════════════\n";
        report += "Detailed Findings\n";
        report += "═════════════════════════════════════════════════════════\n";

        const critical = findings.filter(f => f.severity === "critical");
        if (critical.length > 0) {
            report += `\n❌ CRITICAL ISSUES (${critical.length})\n`;
            for (const finding of critical) {
                report += `  • ${finding.title}\n`;
                report += `    ${finding.summary}\n\n`;
            }
        }

        const high = findings.filter(f => f.severity === "high");
        if (high.length > 0) {
            report += `\n⚠️ HIGH PRIORITY (${high.length})\n`;
            for (const finding of high) {
                report += `  • ${finding.title}\n`;
                report += `    ${finding.summary}\n\n`;
            }
        }

        const medium = findings.filter(f => f.severity === "medium");
        if (medium.length > 0) {
            report += `\n🔶 MEDIUM PRIORITY (${medium.length})\n`;
            for (const finding of medium) {
                report += `  • ${finding.title}\n`;
                report += `    ${finding.summary}\n\n`;
            }
        }

        const low = findings.filter(f => f.severity === "low");
        if (low.length > 0) {
            report += `\n🔵 LOW PRIORITY (${low.length})\n`;
            for (const finding of low) {
                report += `  • ${finding.title}\n`;
                report += `    ${finding.summary}\n\n`;
            }
        }
    }

    report += "═════════════════════════════════════════════════════════\n";
    report += `Session ID: ${result.sessionId}\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += "═════════════════════════════════════════════════════════\n";

    return report;
}

/**
 * Create an HTML report
 */
export function createHtmlReport(result: AgentWorkflowResult): string {
    const timeline = result.timeline || [];
    const findings = Array.isArray(result.outputs?.findings) ? result.outputs.findings : [];

    const metrics = calculateExecutionMetrics(timeline);
    const tokenUsage = calculateTokenUsage(timeline);

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Automation Results Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .status-success { background-color: #d4edda; color: #155724; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .status-partial { background-color: #fff3cd; color: #856404; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .status-failed { background-color: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .metric-card { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 10px 0; }
        .findings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin: 20px 0; }
        .finding-card { border: 1px solid #dee2e6; padding: 15px; border-radius: 4px; }
        .critical { border-left: 4px solid #dc3545; }
        .high { border-left: 4px solid #fd7e14; }
        .medium { border-left: 4px solid #ffc107; }
        .low { border-left: 4px solid #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6; }
        .timeline-item { margin: 10px 0; padding: 10px; background-color: #f8f9fa; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Automation Results Report</h1>

        <div class="${metrics.successRate >= 80 ? 'status-success' : metrics.successRate >= 60 ? 'status-partial' : 'status-failed'}">
            Status: ${metrics.successRate >= 80 ? '✅ Success' : metrics.successRate >= 60 ? '⚠️ Partial Success' : '❌ Failed'}
        </div>

        <h2>📊 Execution Metrics</h2>
        <div class="metric-card">
            <strong>Success Rate:</strong> ${metrics.successRate}%<br>
            <strong>Total Operations:</strong> ${metrics.totalOperations}<br>
            <strong>Failed Operations:</strong> ${metrics.failedOperations}
        </div>

        <h2>💬 Token Usage</h2>
        <div class="metric-card">
            <strong>Input Tokens:</strong> ${tokenUsage.inputTokens.toLocaleString()}<br>
            <strong>Output Tokens:</strong> ${tokenUsage.outputTokens.toLocaleString()}<br>
            <strong>Total Tokens:</strong> ${tokenUsage.totalTokens.toLocaleString()}
        </div>`;

    if (findings.length > 0) {
        html += `
        <h2>🔍 Findings Summary</h2>
        <div class="metric-card">
            <strong>Total Findings:</strong> ${findings.length}
        </div>

        <h2>📋 Detailed Findings</h2>
        <div class="findings-grid">`;

        const critical = findings.filter(f => f.severity === "critical");
        if (critical.length > 0) {
            for (const finding of critical) {
                html += `
                    <div class="finding-card critical">
                        <h3>❌ ${finding.title}</h3>
                        <strong>Severity:</strong> CRITICAL<br>
                        <p>${finding.summary}</p>`;
                if (finding.evidence) {
                    html += `<pre><code>${finding.evidence}</code></pre>`;
                }
                html += `</div>`;
            }
        }

        const high = findings.filter(f => f.severity === "high");
        if (high.length > 0) {
            for (const finding of high) {
                html += `
                    <div class="finding-card high">
                        <h3>⚠️ ${finding.title}</h3>
                        <strong>Severity:</strong> HIGH<br>
                        <p>${finding.summary}</p>`;
                if (finding.evidence) {
                    html += `<pre><code>${finding.evidence}</code></pre>`;
                }
                html += `</div>`;
            }
        }

        const medium = findings.filter(f => f.severity === "medium");
        if (medium.length > 0) {
            for (const finding of medium) {
                html += `
                    <div class="finding-card medium">
                        <h3>🔶 ${finding.title}</h3>
                        <strong>Severity:</strong> MEDIUM<br>
                        <p>${finding.summary}</p>`;
                if (finding.evidence) {
                    html += `<pre><code>${finding.evidence}</code></pre>`;
                }
                html += `</div>`;
            }
        }

        const low = findings.filter(f => f.severity === "low");
        if (low.length > 0) {
            for (const finding of low) {
                html += `
                    <div class="finding-card low">
                        <h3>🔵 ${finding.title}</h3>
                        <strong>Severity:</strong> LOW<br>
                        <p>${finding.summary}</p>`;
                if (finding.evidence) {
                    html += `<pre><code>${finding.evidence}</code></pre>`;
                }
                html += `</div>`;
            }
        }

        html += `</div>`;
    }

    html += `
        <h2>📈 Timeline</h2>
        <table>
            <thead>
                <tr><th>Status</th><th>Label</th><th>Summary</th></tr>
            </thead>
            <tbody>`;

    for (const event of timeline) {
        const statusIcon = {
            pending: "⏳",
            running: "🔄",
            success: "✅",
            error: "❌"
        }[event.status] || "⚪";

        html += `
                <tr>
                    <td>${statusIcon}</td>
                    <td>${event.label}</td>
                    <td>${event.summary}</td>
                </tr>`;
    }

    html += `
            </tbody>
        </table>

        <footer>
            <p>Session ID: ${result.sessionId}</p>
            <p>Generated: ${new Date().toISOString()}</p>
        </footer>
    </div>
</body>
</html>`;

    return html;
}

/**
 * Create a summary card for quick overview
 */
export function createSummaryCard(result: AgentWorkflowResult): string {
    const timeline = result.timeline || [];
    const findings = Array.isArray(result.outputs?.findings) ? result.outputs.findings : [];

    const metrics = calculateExecutionMetrics(timeline);
    const tokenUsage = calculateTokenUsage(timeline);

    let card = "╔════════════════════════════════════════════════════════════╗\n";
    card += "║           AUTOMATION SUMMARY CARD                      ║\n";
    card += "╚════════════════════════════════════════════════════════════╝\n\n";

    // Status
    const status = metrics.successRate >= 80 ? "✅ SUCCESS" : metrics.successRate >= 60 ? "⚠️ PARTIAL" : "❌ FAILED";
    card += `Status: ${status}\n\n`;

    // Quick Metrics
    card += `📊 Success Rate: ${metrics.successRate}%\n`;
    card += `🔢 Operations: ${metrics.totalOperations} total, ${metrics.failedOperations} failed\n`;
    card += `💬 Tokens: ${tokenUsage.totalTokens.toLocaleString()}\n`;

    // Findings
    if (findings.length > 0) {
        const counts = countFindingsBySeverity(findings);
        card += `\n🔍 Findings:\n`;
        if (counts.critical > 0) card += `  ❌ Critical: ${counts.critical}\n`;
        if (counts.high > 0) card += `  ⚠️ High: ${counts.high}\n`;
        if (counts.medium > 0) card += `  🔶 Medium: ${counts.medium}\n`;
        if (counts.low > 0) card += `  🔵 Low: ${counts.low}\n`;
    } else {
        card += `\n🔍 Findings: None reported\n`;
    }

    card += "\n═════════════════════════════════════════════════════════\n";
    card += `Session: ${result.sessionId}\n`;
    card += "═════════════════════════════════════════════════════════\n";

    return card;
}

export default {
    formatFinding,
    formatTimelineTable,
    formatExecutionMetrics,
    formatTokenUsage,
    formatFindingsSummary,
    createConsoleReport,
    createHtmlReport,
    createSummaryCard
};