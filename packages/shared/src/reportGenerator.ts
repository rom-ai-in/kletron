/**
 * Enhanced Report Generator
 *
 * This module provides a unified interface for generating high-quality,
 * user-friendly automation reports in multiple formats.
 */

import type { AgentWorkflowResult, Finding } from "./types";
import {
    createFormattedReport as legacyCreateFormattedReport,
    createSummaryCard,
    formatFindingsTable,
    createProgressReport,
    generateJsonSummary
} from "./reportFormatting";
import {
    createHtmlReport,
    createJsonReport,
    createTextSummary,
    createPdfReadyReport,
    createReportBundle
} from "./reportEnhancement";

/**
 * Enhanced report generation options
 */
export type ReportOptions = {
    /** Include execution timeline in the report */
    includeTimeline?: boolean;
    /** Include detailed findings breakdown */
    includeFindings?: boolean;
    /** Include token usage details */
    includeTokenUsage?: boolean;
    /** Include raw output */
    includeRawOutput?: boolean;
    /** Format for the report (markdown, html, json, text, pdf) */
    format?: "markdown" | "html" | "json" | "text" | "pdf";
    /** Add custom header to the report */
    header?: string;
    /** Add custom footer to the report */
    footer?: string;
};

/**
 * Generate a comprehensive report from workflow results
 *
 * This is the main entry point for creating formatted reports.
 * It provides multiple output formats with consistent quality and structure.
 */
export function generateReport(
    result: AgentWorkflowResult,
    options: ReportOptions = {}
): {
    content: string;
    format: string;
    summary: string;
} {
    const opts = {
        includeTimeline: true,
        includeFindings: true,
        includeTokenUsage: true,
        includeRawOutput: true,
        format: "markdown" as const,
        header: undefined,
        footer: undefined,
        ...options
    };

    // Calculate common metrics
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

    // Create summary
    const successRate = timeline.length > 0
        ? Math.round((timeline.filter(t => t.status === "success").length / timeline.length) * 100)
        : 0;
    const totalTokens = totalInputTokens + totalOutputTokens;

    const summary = `Automation completed with ${status}. ${findings.length} findings reported (${critical} critical, ${high} high, ${medium} medium, ${low} low). ${totalTokens.toLocaleString()} tokens used. Success rate: ${successRate}%.`;

    // Generate content based on format
    switch (opts.format) {
        case "html":
            return {
                content: createHtmlReport(result),
                format: "html",
                summary
            };

        case "json": {
            const jsonContent = createJsonReport(result);
            return {
                content: jsonContent,
                format: "json",
                summary
            };
        }

        case "text":
            return {
                content: createTextSummary(result),
                format: "text",
                summary
            };

        case "pdf":
            return {
                content: createPdfReadyReport(result),
                format: "pdf",
                summary
            };

        case "markdown":
        default:
            // Create enhanced markdown report
            let markdown = "";

            // Header
            if (opts.header) {
                markdown += `${opts.header}\n\n`;
            }

            markdown += `# 🤖 Automation Results Report\n\n`;

            const statusEmoji = status === "success" ? "✅"
                : status === "partial_success" ? "⚠️"
                : "❌";
            markdown += `**Status**: ${statusEmoji} ${status === "success" ? "Success"
                : status === "partial_success" ? "Partial Success"
                : "Failed"} | **Generated**: ${new Date().toISOString()}\n\n`;

            // Executive Summary
            markdown += `## 📊 Executive Summary\n\n`;
            markdown += `This automation workflow executed ${timeline.length} nodes with a success rate of ${successRate}%. `;
            markdown += `${findings.length} findings were identified across different severity levels. `;
            markdown += `Total token usage: ${totalTokens.toLocaleString()}.\n\n`;

            // Metrics Section
            if (opts.includeTokenUsage) {
                markdown += `## 📈 Execution Metrics\n\n`;
                markdown += `| Metric | Value |\n`;
                markdown += `|-------|-------|\n`;
                markdown += `| Total Nodes | ${timeline.length} |\n`;
                markdown += `| Successful Nodes | ${timeline.filter(t => t.status === "success").length} |\n`;
                markdown += `| Failed Nodes | ${errorCount} |\n`;
                markdown += `| Success Rate | ${successRate}% |\n`;
                markdown += `| Total Tokens | ${totalTokens.toLocaleString()} |\n\n`;
            }

            // Findings Summary
            if (findings.length > 0 && opts.includeFindings) {
                markdown += `## 🔍 Findings Overview\n\n`;

                const findingsSummary = [];
                if (critical > 0) findingsSummary.push(`🔴 **Critical**: ${critical}`);
                if (high > 0) findingsSummary.push(`⚠️ **High Priority**: ${high}`);
                if (medium > 0) findingsSummary.push(`🟡 **Medium Priority**: ${medium}`);
                if (low > 0) findingsSummary.push(`🔵 **Low Priority**: ${low}`);

                markdown += findingsSummary.join(" | ") + `\n`;
                markdown += `**Total Findings**: ${findings.length}\n\n`;

                // Severity Distribution Chart
                markdown += `### Severity Distribution\n\n`;
                const maxBarLength = 20;
                if (critical > 0) {
                    const bar = "█".repeat(Math.round((critical / findings.length) * maxBarLength));
                    markdown += `🔴 Critical: ${bar} ${Math.round((critical / findings.length) * 100)}%\n`;
                }
                if (high > 0) {
                    const bar = "█".repeat(Math.round((high / findings.length) * maxBarLength));
                    markdown += `⚠️ High: ${bar} ${Math.round((high / findings.length) * 100)}%\n`;
                }
                if (medium > 0) {
                    const bar = "█".repeat(Math.round((medium / findings.length) * maxBarLength));
                    markdown += `🟡 Medium: ${bar} ${Math.round((medium / findings.length) * 100)}%\n`;
                }
                if (low > 0) {
                    const bar = "█".repeat(Math.round((low / findings.length) * maxBarLength));
                    markdown += `🔵 Low: ${bar} ${Math.round((low / findings.length) * 100)}%\n`;
                }
            }

            // Detailed Findings
            if (findings.length > 0 && opts.includeFindings) {
                markdown += `\n## 📋 Detailed Findings\n\n`;

                // Critical findings
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

                // High findings
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

                // Medium findings
                if (medium > 0) {
                    markdown += `### 🟡 Medium Priority Issues (${medium})\n\n`;
                    findings.filter(f => f.severity === "medium").forEach((f, i) => {
                        markdown += `**${i + 1}. ${f.title}**\n`;
                        markdown += `${f.summary}\n`;
                        if (f.evidence) {
                            markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
                        }
                    });
                }

                // Low findings
                if (low > 0) {
                    markdown += `### 🔵 Low Priority Issues (${low})\n\n`;
                    findings.filter(f => f.severity === "low").forEach((f, i) => {
                        markdown += `**${i + 1}. ${f.title}**\n`;
                        markdown += `${f.summary}\n`;
                        if (f.evidence) {
                            markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
                        }
                    });
                }
            }

            // Timeline
            if (opts.includeTimeline && timeline.length > 0) {
                markdown += `\n## 📅 Execution Timeline\n\n`;
                timeline.forEach((event, i) => {
                    const statusIcon = event.status === "success" ? "✅"
                        : event.status === "error" ? "❌"
                        : event.status === "running" ? "🔄"
                        : "⏳";
                    markdown += `${i + 1}. ${statusIcon} **${event.label}** (${event.status})\n`;
                    if (event.summary) {
                        markdown += `   ${event.summary}\n`;
                    }
                    if (event.tokenUsage && event.tokenUsage.totalTokens > 0) {
                        markdown += `   Tokens: ${event.tokenUsage.totalTokens.toLocaleString()}\n`;
                    }
                });
            }

            // Raw Output
            if (opts.includeRawOutput && outputs.report) {
                const rawReport = typeof outputs.report === "string"
                    ? outputs.report
                    : JSON.stringify(outputs.report, null, 2);
                markdown += `\n## 📄 Raw Output\n\n`;
                markdown += `\`\`\`json\n${rawReport}\n\`\`\``;
            }

            // Footer
            if (opts.footer) {
                markdown += `\n---\n\n${opts.footer}`;
            }

            return {
                content: markdown,
                format: "markdown",
                summary
            };
    }
}

/**
 * Generate multiple report formats at once
 *
 * Returns a bundle with all supported formats for maximum compatibility.
 */
export function generateReportBundle(
    result: AgentWorkflowResult,
    options: ReportOptions = {}
): {
    markdown: string;
    html: string;
    json: string;
    text: string;
    pdf: string;
    summaries: Record<string, string>;
} {
    const baseOpts = {
        includeTimeline: true,
        includeFindings: true,
        includeTokenUsage: true,
        includeRawOutput: true,
        ...options
    };

    // Generate each format
    const markdownResult = generateReport(result, { ...baseOpts, format: "markdown" });
    const htmlResult = generateReport(result, { ...baseOpts, format: "html" });
    const jsonResult = generateReport(result, { ...baseOpts, format: "json" });
    const textResult = generateReport(result, { ...baseOpts, format: "text" });
    const pdfResult = generateReport(result, { ...baseOpts, format: "pdf" });

    return {
        markdown: markdownResult.content,
        html: htmlResult.content,
        json: jsonResult.content,
        text: textResult.content,
        pdf: pdfResult.content,
        summaries: {
            markdown: markdownResult.summary,
            html: htmlResult.summary,
            json: jsonResult.summary,
            text: textResult.summary,
            pdf: pdfResult.summary
        }
    };
}

/**
 * Create a quick summary for CLI/display purposes
 *
 * Returns a concise, formatted summary suitable for immediate display.
 */
export function generateQuickSummary(result: AgentWorkflowResult): string {
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

    const successRate = timeline.length > 0
        ? Math.round((timeline.filter(t => t.status === "success").length / timeline.length) * 100)
        : 0;
    const totalTokens = totalInputTokens + totalOutputTokens;

    // Create ASCII art border
    const border = "═".repeat(60);
    let summary = `╔${border}╗\n`;
    summary += `║  🤖 AUTOMATION RESULTS SUMMARY                     ║\n`;
    summary += `╠${border}╣\n`;

    const statusEmoji = status === "success" ? "✅" : status === "partial_success" ? "⚠️" : "❌";
    summary += `║ Status: ${statusEmoji} ${status.toUpperCase()}                          ║\n`;
    summary += `║                                                  ║\n`;

    // Execution metrics
    const nodesLine = `Nodes: ${timeline.length} (${successRate}% success)`;
    const findingsLine = `Findings: ${findings.length}`;
    const tokensLine = `Tokens: ${totalTokens.toLocaleString()}`;

    summary += `║ ${nodesLine.padEnd(56)} ║\n`;
    summary += `║ ${findingsLine.padEnd(56)} ║\n`;
    summary += `║ ${tokensLine.padEnd(56)} ║\n`;
    summary += `║                                                  ║\n`;

    // Findings breakdown
    if (critical > 0) {
        const criticalLine = `🔴 Critical:     ${critical}`;
        summary += `║ ${criticalLine.padEnd(56)} ║\n`;
    }
    if (high > 0) {
        const highLine = `⚠️ High:        ${high}`;
        summary += `║ ${highLine.padEnd(56)} ║\n`;
    }
    if (medium > 0) {
        const mediumLine = `🟡 Medium:      ${medium}`;
        summary += `║ ${mediumLine.padEnd(56)} ║\n`;
    }
    if (low > 0) {
        const lowLine = `🔵 Low:         ${low}`;
        summary += `║ ${lowLine.padEnd(56)} ║\n`;
    }

    summary += `╚${border}╝`;

    return summary;
}

/**
 * Generate a report specifically for human review
 *
 * Focuses on readability and actionable insights.
 */
export function generateHumanReadableReport(result: AgentWorkflowResult): string {
    const bundle = createReportBundle(result);
    return bundle.markdown;
}

/**
 * Generate a report specifically for machine consumption
 *
 * Optimized for parsing and programmatic use.
 */
export function generateMachineReadableReport(result: AgentWorkflowResult): string {
    return createJsonReport(result);
}

/**
 * Create a comparison report between multiple workflow results
 *
 * Useful for tracking progress across multiple runs.
 */
export function generateComparisonReport(
    results: AgentWorkflowResult[],
    labels?: string[]
): string {
    if (results.length === 0) {
        return "# Comparison Report\n\nNo results provided.\n";
    }

    let markdown = `# 📊 Automation Results Comparison\n\n`;

    // Summary table
    markdown += `## Summary Table\n\n`;
    markdown += `| Metric | ${labels ? labels.join(" | ") : results.map((_, i) => `Run ${i + 1}`).join(" | ")} |\n`;
    markdown += `|-------|${" --- |".repeat(results.length)}\n`;

    // Calculate metrics for each result
    const metrics = results.map(result => {
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

        return {
            nodes: timeline.length,
            successRate: timeline.length > 0
                ? Math.round((timeline.filter(t => t.status === "success").length / timeline.length) * 100)
                : 0,
            totalTokens: totalInputTokens + totalOutputTokens,
            critical,
            high,
            medium,
            low,
            totalFindings: findings.length,
            status
        };
    });

    // Add rows for each metric
    const metricNames = ["Nodes", "Success Rate (%)", "Total Tokens", "Critical", "High", "Medium", "Low", "Total Findings"];
    metrics.forEach((metric, i) => {
        markdown += `| ${metricNames[i]} | `;
        markdown += metrics.map(m =>
            i === 1 ? `${m.successRate}%` : // Success rate
            i === 2 ? `${m.totalTokens.toLocaleString()}` : // Tokens
            `${m[metricNames[i].toLowerCase().replace(' ', '_') as keyof typeof m]}`
        ).join(" | ");
        markdown += " |\n";
    });

    return markdown;
}

export default {
    generateReport,
    generateReportBundle,
    generateQuickSummary,
    generateHumanReadableReport,
    generateMachineReadableReport,
    generateComparisonReport
};