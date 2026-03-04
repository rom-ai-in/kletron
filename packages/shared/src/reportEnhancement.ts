/**
 * Enhanced Report Formatting Utilities
 *
 * This module provides advanced functions to transform raw automation results
 * into professional, user-friendly reports with improved readability and insights.
 */

import type { AgentWorkflowResult, Finding, TimelineEvent } from "./types";

/**
 * Create a comprehensive HTML report for web display
 */
export function createHtmlReport(result: AgentWorkflowResult): string {
    const outputs = result.outputs || {};
    const timeline = result.timeline || [];
    const events = result.eventStream || [];

    // Calculate metrics
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    timeline.forEach(t => {
        if (t.tokenUsage) {
            totalInputTokens += t.tokenUsage.inputTokens || 0;
            totalOutputTokens += t.tokenUsage.outputTokens || 0;
        }
    });

    const findings = Array.isArray(outputs.findings) ? outputs.findings : [];
    const critical = findings.filter(f => f.severity === "critical").length;
    const high = findings.filter(f => f.severity === "high").length;
    const medium = findings.filter(f => f.severity === "medium").length;
    const low = findings.filter(f => f.severity === "low").length;

    let status: "success" | "partial_success" | "failure" | "error" = "success";
    const errorCount = timeline.filter(t => t.status === "error").length;
    if (errorCount > 0) {
        status = errorCount >= timeline.length / 2 ? "failure" : "partial_success";
    }

    // HTML Template
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Automation Results Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
        }
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 14px;
        }
        .status-success { background-color: #d4edda; color: #155724; }
        .status-partial { background-color: #fff3cd; color: #856404; }
        .status-failure { background-color: #f8d7da; color: #721c24; }

        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #7f8c8d;
            font-size: 14px;
        }

        .timeline-item {
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            background-color: #fff;
            border-left: 4px solid #3498db;
        }
        .timeline-item.success { border-left-color: #2ecc71; }
        .timeline-item.error { border-left-color: #e74c3c; }
        .timeline-item.running { border-left-color: #f39c12; }

        .findings-grid {
            display: grid;
            gap: 20px;
        }
        .findings-category {
            margin-bottom: 30px;
        }
        .finding-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .finding-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .severity-badge {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }
        .severity-critical { background-color: #f17869; color: white; }
        .severity-high { background-color: #f5a623; color: white; }
        .severity-medium { background-color: #f8d04c; color: #333; }
        .severity-low { background-color: #74b9ff; color: white; }

        .code-block {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 6px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            margin: 10px 0;
        }

        .summary-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 Automation Results Report</h1>
        <div class="status-badge status-${status}">
            ${status === "success" ? "✅ Success" : status === "partial_success" ? "⚠️ Partial Success" : "❌ Failed"}
        </div>
    </div>

    <div class="summary-section">
        <h2>📊 Executive Summary</h2>
        <p style="font-size: 18px; margin-top: 15px;">
            This automation workflow analyzed ${timeline.length} nodes and identified
            ${findings.length} findings across different severity levels.
        </p>
    </div>

    <div class="card-grid">
        <div class="metric-card">
            <div class="metric-value">${timeline.length}</div>
            <div class="metric-label">Total Nodes</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${errorCount === 0 ? timeline.filter(t => t.status === "success").length : errorCount}</div>
            <div class="metric-label">${errorCount === 0 ? "Successful" : "Failed"}</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${findings.length}</div>
            <div class="metric-label">Findings</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${(totalInputTokens + totalOutputTokens).toLocaleString()}</div>
            <div class="metric-label">Tokens Used</div>
        </div>
    </div>

    <div class="card">
        <h2>🔍 Findings Breakdown</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px;">
            ${critical > 0 ? `<div style="text-align: center;"><div class="severity-badge severity-critical">🔴 Critical</div><div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${critical}</div></div>` : ''}
            ${high > 0 ? `<div style="text-align: center;"><div class="severity-badge severity-high">⚠️ High</div><div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${high}</div></div>` : ''}
            ${medium > 0 ? `<div style="text-align: center;"><div class="severity-badge severity-medium">🟡 Medium</div><div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${medium}</div></div>` : ''}
            ${low > 0 ? `<div style="text-align: center;"><div class="severity-badge severity-low">🔵 Low</div><div style="font-size: 24px; font-weight: bold; margin-top: 5px;">${low}</div></div>` : ''}
        </div>

        ${critical > 0 ? `
        <h3>❌ Critical Issues (${critical})</h3>
        ${findings.filter(f => f.severity === "critical").map((f, i) => `
            <div class="finding-item">
                <div class="finding-header">
                    <strong>${i + 1}. ${f.title}</strong>
                    <span class="severity-badge severity-critical">Critical</span>
                </div>
                <p>${f.summary}</p>
                ${f.evidence ? `<div class="code-block">${f.evidence}</div>` : ''}
            </div>
        `).join('')}
        ` : ''}

        ${high > 0 ? `
        <h3>⚠️ High Priority (${high})</h3>
        ${findings.filter(f => f.severity === "high").map((f, i) => `
            <div class="finding-item">
                <div class="finding-header">
                    <strong>${i + 1}. ${f.title}</strong>
                    <span class="severity-badge severity-high">High</span>
                </div>
                <p>${f.summary}</p>
                ${f.evidence ? `<div class="code-block">${f.evidence}</div>` : ''}
            </div>
        `).join('')}
        ` : ''}

        ${medium > 0 ? `
        <h3>🟡 Medium Priority (${medium})</h3>
        ${findings.filter(f => f.severity === "medium").map((f, i) => `
            <div class="finding-item">
                <div class="finding-header">
                    <strong>${i + 1}. ${f.title}</strong>
                    <span class="severity-badge severity-medium">Medium</span>
                </div>
                <p>${f.summary}</p>
                ${f.evidence ? `<div class="code-block">${f.evidence}</div>` : ''}
            </div>
        `).join('')}
        ` : ''}

        ${low > 0 ? `
        <h3>🔵 Low Priority (${low})</h3>
        ${findings.filter(f => f.severity === "low").map((f, i) => `
            <div class="finding-item">
                <div class="finding-header">
                    <strong>${i + 1}. ${f.title}</strong>
                    <span class="severity-badge severity-low">Low</span>
                </div>
                <p>${f.summary}</p>
                ${f.evidence ? `<div class="code-block">${f.evidence}</div>` : ''}
            </div>
        `).join('')}
        ` : ''}
    </div>

    <div class="card">
        <h2>📈 Execution Timeline</h2>
        ${timeline.map((event, i) => {
            const statusIcon = event.status === "success" ? "✅"
                : event.status === "error" ? "❌"
                : event.status === "running" ? "🔄"
                : "⏳";
            return `
            <div class="timeline-item ${event.status}">
                <strong>${i + 1}. ${statusIcon} ${event.label}</strong>
                <p>${event.summary || 'No summary available'}</p>
                ${event.tokenUsage && event.tokenUsage.totalTokens > 0 ? `<small>Tokens: ${event.tokenUsage.totalTokens.toLocaleString()}</small>` : ''}
            </div>
            `;
        }).join('')}
    </div>

    <div class="card">
        <h2>📄 Raw Output</h2>
        <div class="code-block">${typeof outputs.report === "string" ? outputs.report : JSON.stringify(outputs.report || "", null, 2)}</div>
    </div>

    <div style="text-align: center; margin-top: 40px; color: #7f8c8d; font-size: 14px;">
        Report generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}
    </div>
</body>
</html>`;

    return html;
}

/**
 * Create a JSON report with enhanced structure for programmatic consumption
 */
export function createJsonReport(result: AgentWorkflowResult): string {
    const outputs = result.outputs || {};
    const timeline = result.timeline || [];
    const events = result.eventStream || [];

    // Calculate comprehensive metrics
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    timeline.forEach(t => {
        if (t.tokenUsage) {
            totalInputTokens += t.tokenUsage.inputTokens || 0;
            totalOutputTokens += t.tokenUsage.outputTokens || 0;
        }
    });

    const findings = Array.isArray(outputs.findings) ? outputs.findings : [];
    const critical = findings.filter(f => f.severity === "critical").length;
    const high = findings.filter(f => f.severity === "high").length;
    const medium = findings.filter(f => f.severity === "medium").length;
    const low = findings.filter(f => f.severity === "low").length;

    let status: "success" | "partial_success" | "failure" | "error" = "success";
    const errorCount = timeline.filter(t => t.status === "error").length;
    if (errorCount > 0) {
        status = errorCount >= timeline.length / 2 ? "failure" : "partial_success";
    }

    // Create enhanced JSON structure
    const report = {
        metadata: {
            sessionId: result.sessionId,
            generatedAt: new Date().toISOString(),
            status,
            conclusion: result.conclusion
        },
        executionSummary: {
            totalNodes: timeline.length,
            successCount: timeline.filter(t => t.status === "success").length,
            errorCount,
            successRate: timeline.length > 0 ? Math.round((timeline.filter(t => t.status === "success").length / timeline.length) * 100) : 0
        },
        tokenUsage: {
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            totalTokens: totalInputTokens + totalOutputTokens,
            breakdownByNode: timeline.map(t => ({
                nodeId: t.id,
                label: t.label,
                tokens: t.tokenUsage
            })).filter(t => t.tokens)
        },
        findingsSummary: {
            total: findings.length,
            bySeverity: {
                critical,
                high,
                medium,
                low
            },
            severityDistribution: {
                critical: Math.round((critical / findings.length) * 100),
                high: Math.round((high / findings.length) * 100),
                medium: Math.round((medium / findings.length) * 100),
                low: Math.round((low / findings.length) * 100)
            }
        },
        timeline: timeline.map(t => ({
            id: t.id,
            label: t.label,
            status: t.status,
            summary: t.summary,
            startedAt: t.startedAt,
            endedAt: t.endedAt,
            duration: t.startedAt && t.endedAt ? calculateDuration(t.startedAt, t.endedAt) : undefined,
            tokenUsage: t.tokenUsage
        })),
        findings: findings.map(f => ({
            id: findings.indexOf(f),
            title: f.title,
            summary: f.summary,
            severity: f.severity,
            evidence: f.evidence,
            confidenceScore: calculateConfidenceScore(f)
        })),
        rawOutput: typeof outputs.report === "string" ? outputs.report : JSON.stringify(outputs.report || ""),
        eventStreamSummary: {
            totalEvents: events.length,
            systemEvents: events.filter(e => e.kind === "system").length,
            userEvents: events.filter(e => e.kind === "user").length,
            assistantEvents: events.filter(e => e.kind === "assistant").length,
            toolEvents: events.filter(e => e.kind === "tool").length
        }
    };

    return JSON.stringify(report, null, 2);
}

/**
 * Create a text summary suitable for CLI output
 */
export function createTextSummary(result: AgentWorkflowResult): string {
    const outputs = result.outputs || {};
    const timeline = result.timeline || [];
    const findings = Array.isArray(outputs.findings) ? outputs.findings : [];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    timeline.forEach(t => {
        if (t.tokenUsage) {
            totalInputTokens += t.tokenUsage.inputTokens || 0;
            totalOutputTokens += t.tokenUsage.outputTokens || 0;
        }
    });

    const critical = findings.filter(f => f.severity === "critical").length;
    const high = findings.filter(f => f.severity === "high").length;
    const medium = findings.filter(f => f.severity === "medium").length;
    const low = findings.filter(f => f.severity === "low").length;

    let status: "success" | "partial_success" | "failure" | "error" = "success";
    const errorCount = timeline.filter(t => t.status === "error").length;
    if (errorCount > 0) {
        status = errorCount >= timeline.length / 2 ? "failure" : "partial_success";
    }

    let summary = `╔════════════════════════════════════════════════════════════╗\n`;
    summary += `║          AUTOMATION RESULTS SUMMARY                     ║\n`;
    summary += `╚════════════════════════════════════════════════════════════╝\n\n`;

    summary += `Status: ${status === "success" ? "✅ SUCCESS" : status === "partial_success" ? "⚠️  PARTIAL" : "❌ FAILED"}\n\n`;

    summary += `Execution Metrics:\n`;
    summary += `  • Total Nodes: ${timeline.length}\n`;
    summary += `  • Successful: ${timeline.filter(t => t.status === "success").length}\n`;
    summary += `  • Failed: ${errorCount}\n`;
    summary += `  • Success Rate: ${timeline.length > 0 ? Math.round((timeline.filter(t => t.status === "success").length / timeline.length) * 100) : 0}%\n\n`;

    summary += `Token Usage:\n`;
    summary += `  • Input Tokens:  ${totalInputTokens.toLocaleString()}\n`;
    summary += `  • Output Tokens: ${totalOutputTokens.toLocaleString()}\n`;
    summary += `  • Total Tokens:  ${(totalInputTokens + totalOutputTokens).toLocaleString()}\n\n`;

    summary += `Findings Summary:\n`;
    if (critical > 0) summary += `  • 🔴 Critical:     ${critical}\n`;
    if (high > 0) summary += `  • ⚠️  High:        ${high}\n`;
    if (medium > 0) summary += `  • 🟡 Medium:      ${medium}\n`;
    if (low > 0) summary += `  • 🔵 Low:         ${low}\n`;
    summary += `  • Total:        ${findings.length}\n\n`;

    if (findings.length > 0) {
        summary += `Top Findings:\n`;
        const topFindings = [...findings]
            .sort((a, b) => {
                const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
                return (severityOrder[b.severity as keyof typeof severityOrder] || 0) -
                       (severityOrder[a.severity as keyof typeof severityOrder] || 0);
            })
            .slice(0, 5);

        topFindings.forEach((f, i) => {
            const severityIcon = f.severity === "critical" ? "🔴"
                : f.severity === "high" ? "⚠️"
                : f.severity === "medium" ? "🟡"
                : "🔵";
            summary += `  ${i + 1}. ${severityIcon} ${f.title}\n`;
        });
    }

    return summary;
}

/**
 * Create a PDF-ready text report
 */
export function createPdfReadyReport(result: AgentWorkflowResult): string {
    const outputs = result.outputs || {};
    const timeline = result.timeline || [];
    const findings = Array.isArray(outputs.findings) ? outputs.findings : [];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    timeline.forEach(t => {
        if (t.tokenUsage) {
            totalInputTokens += t.tokenUsage.inputTokens || 0;
            totalOutputTokens += t.tokenUsage.outputTokens || 0;
        }
    });

    const critical = findings.filter(f => f.severity === "critical").length;
    const high = findings.filter(f => f.severity === "high").length;
    const medium = findings.filter(f => f.severity === "medium").length;
    const low = findings.filter(f => f.severity === "low").length;

    let status: "success" | "partial_success" | "failure" | "error" = "success";
    const errorCount = timeline.filter(t => t.status === "error").length;
    if (errorCount > 0) {
        status = errorCount >= timeline.length / 2 ? "failure" : "partial_success";
    }

    let report = `Automation Results Report\n`;
    report += `============================================================\n\n`;

    report += `Status: ${status === "success" ? "SUCCESS" : status === "partial_success" ? "PARTIAL SUCCESS" : "FAILED"}\n\n`;

    report += `EXECUTION METRICS\n`;
    report += `-----------------\n`;
    report += `Total Nodes:        ${timeline.length}\n`;
    report += `Successful Nodes:   ${timeline.filter(t => t.status === "success").length}\n`;
    report += `Failed Nodes:       ${errorCount}\n`;
    report += `Success Rate:       ${timeline.length > 0 ? Math.round((timeline.filter(t => t.status === "success").length / timeline.length) * 100) : 0}%\n\n`;

    report += `TOKEN USAGE\n`;
    report += `------------\n`;
    report += `Input Tokens:       ${totalInputTokens.toLocaleString()}\n`;
    report += `Output Tokens:      ${totalOutputTokens.toLocaleString()}\n`;
    report += `Total Tokens:       ${(totalInputTokens + totalOutputTokens).toLocaleString()}\n\n`;

    report += `FINDINGS SUMMARY\n`;
    report += `----------------\n`;
    if (critical > 0) report += `Critical Issues:   ${critical}\n`;
    if (high > 0) report += `High Priority:     ${high}\n`;
    if (medium > 0) report += `Medium Priority:   ${medium}\n`;
    if (low > 0) report += `Low Priority:      ${low}\n`;
    report += `Total Findings:    ${findings.length}\n\n`;

    if (critical > 0) {
        report += `\nCRITICAL ISSUES\n`;
        report += `--------------\n`;
        findings.filter(f => f.severity === "critical").forEach((f, i) => {
            report += `${i + 1}. ${f.title}\n`;
            report += `   ${f.summary}\n`;
            if (f.evidence) {
                report += `\n   Evidence:\n   ${f.evidence.split('\n').join('\n   ')}\n`;
            }
        });
    }

    if (high > 0) {
        report += `\nHIGH PRIORITY ISSUES\n`;
        report += `--------------------\n`;
        findings.filter(f => f.severity === "high").forEach((f, i) => {
            report += `${i + 1}. ${f.title}\n`;
            report += `   ${f.summary}\n`;
            if (f.evidence) {
                report += `\n   Evidence:\n   ${f.evidence.split('\n').join('\n   ')}\n`;
            }
        });
    }

    return report;
}

/**
 * Calculate duration between two ISO timestamps
 */
function calculateDuration(start: string, end: string): string {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * Calculate confidence score based on finding severity
 */
function calculateConfidenceScore(finding: Finding): number {
    const severityScores = { critical: 1.0, high: 0.8, medium: 0.6, low: 0.4 };
    return (severityScores[finding.severity as keyof typeof severityScores] || 0.5) * 100;
}

/**
 * Create a comprehensive multi-format report bundle
 */
export function createReportBundle(result: AgentWorkflowResult): {
    markdown: string;
    html: string;
    json: string;
    text: string;
    pdfReady: string;
} {
    return {
        markdown: createMarkdownReport(result),
        html: createHtmlReport(result),
        json: createJsonReport(result),
        text: createTextSummary(result),
        pdfReady: createPdfReadyReport(result)
    };
}

/**
 * Create a markdown report with enhanced formatting
 */
function createMarkdownReport(result: AgentWorkflowResult): string {
    const outputs = result.outputs || {};
    const timeline = result.timeline || [];
    const events = result.eventStream || [];

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    timeline.forEach(t => {
        if (t.tokenUsage) {
            totalInputTokens += t.tokenUsage.inputTokens || 0;
            totalOutputTokens += t.tokenUsage.outputTokens || 0;
        }
    });

    const findings = Array.isArray(outputs.findings) ? outputs.findings : [];
    const critical = findings.filter(f => f.severity === "critical").length;
    const high = findings.filter(f => f.severity === "high").length;
    const medium = findings.filter(f => f.severity === "medium").length;
    const low = findings.filter(f => f.severity === "low").length;

    let status: "success" | "partial_success" | "failure" | "error" = "success";
    const errorCount = timeline.filter(t => t.status === "error").length;
    if (errorCount > 0) {
        status = errorCount >= timeline.length / 2 ? "failure" : "partial_success";
    }

    let markdown = `# 🤖 Automation Results Report\n\n`;
    markdown += `**Status**: ${status === "success" ? "✅ Success" : status === "partial_success" ? "⚠️ Partial Success" : "❌ Failed"}\n\n`;

    // Metrics Table
    markdown += `## 📊 Execution Metrics\n\n`;
    markdown += `| Metric | Value |\n`;
    markdown += `|-------|-------|\n`;
    markdown += `| Total Nodes | ${timeline.length} |\n`;
    markdown += `| Successful | ${timeline.filter(t => t.status === "success").length} |\n`;
    markdown += `| Failed | ${errorCount} |\n`;
    markdown += `| Success Rate | ${timeline.length > 0 ? Math.round((timeline.filter(t => t.status === "success").length / timeline.length) * 100) : 0}% |\n\n`;

    // Token Usage
    markdown += `## 💬 Token Usage\n\n`;
    markdown += `| Type | Count |\n`;
    markdown += `|------|-------|\n`;
    markdown += `| Input Tokens | ${totalInputTokens.toLocaleString()} |\n`;
    markdown += `| Output Tokens | ${totalOutputTokens.toLocaleString()} |\n`;
    markdown += `| Total Tokens | ${(totalInputTokens + totalOutputTokens).toLocaleString()} |\n\n`;

    // Findings Summary
    markdown += `## 🔍 Findings Summary\n\n`;
    if (critical > 0) {
        markdown += `- 🔴 **Critical Issues**: ${critical}\n`;
    }
    if (high > 0) {
        markdown += `- ⚠️ **High Priority**: ${high}\n`;
    }
    if (medium > 0) {
        markdown += `- 🟡 **Medium Priority**: ${medium}\n`;
    }
    if (low > 0) {
        markdown += `- 🔵 **Low Priority**: ${low}\n`;
    }
    markdown += `- **Total Findings**: ${findings.length}\n\n`;

    // Detailed Findings
    if (critical > 0) {
        markdown += `### 🔴 Critical Issues (${critical})\n\n`;
        findings.filter(f => f.severity === "critical").forEach((f, i) => {
            markdown += `**${i + 1}. ${f.title}**\n`;
            markdown += `${f.summary}\n`;
            if (f.evidence) {
                markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
            }
        });
    }

    if (high > 0) {
        markdown += `### ⚠️ High Priority Issues (${high})\n\n`;
        findings.filter(f => f.severity === "high").forEach((f, i) => {
            markdown += `**${i + 1}. ${f.title}**\n`;
            markdown += `${f.summary}\n`;
            if (f.evidence) {
                markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
            }
        });
    }

    // Timeline
    markdown += `## 📈 Execution Timeline\n\n`;
    timeline.forEach((event, i) => {
        const statusIcon = event.status === "success" ? "✅"
            : event.status === "error" ? "❌"
            : event.status === "running" ? "🔄"
            : "⏳";
        markdown += `${i + 1}. ${statusIcon} **${event.label}** (${event.status})\n`;
        if (event.summary) {
            markdown += `   ${event.summary}\n`;
        }
    });

    // Raw Output
    const rawReport = typeof outputs.report === "string" ? outputs.report : JSON.stringify(outputs.report || "", null, 2);
    markdown += `\n## 📄 Raw Output\n\n\`\`\`json\n${rawReport}\n\`\`\``;

    return markdown;
}