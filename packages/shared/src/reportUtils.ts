/**
 * Report Utilities
 *
 * This module provides utility functions for generating, formatting,
 * and enhancing automation reports to improve quality and user experience.
 */

import type { Finding, TimelineEvent, AgentWorkflowResult } from "./types";

/**
 * Calculate execution metrics from timeline events
 */
export function calculateExecutionMetrics(timeline: TimelineEvent[]): {
    successRate: number;
    totalOperations: number;
    failedOperations: number;
} {
    const total = timeline.length;
    if (total === 0) return { successRate: 0, totalOperations: 0, failedOperations: 0 };

    const successful = timeline.filter(t => t.status === "success").length;
    const failed = timeline.filter(t => t.status === "error").length;

    return {
        successRate: Math.round((successful / total) * 100),
        totalOperations: total,
        failedOperations: failed
    };
}

/**
 * Calculate token usage summary from timeline events
 */
export function calculateTokenUsage(timeline: TimelineEvent[]): {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
} {
    let input = 0, output = 0;

    for (const event of timeline) {
        if (event.tokenUsage) {
            input += event.tokenUsage.inputTokens || 0;
            output += event.tokenUsage.outputTokens || 0;
        }
    }

    return {
        inputTokens: input,
        outputTokens: output,
        totalTokens: input + output
    };
}

/**
 * Count findings by severity
 */
export function countFindingsBySeverity(findings: Finding[]): Record<"low" | "medium" | "high" | "critical", number> {
    return {
        low: findings.filter(f => f.severity === "low").length,
        medium: findings.filter(f => f.severity === "medium").length,
        high: findings.filter(f => f.severity === "high").length,
        critical: findings.filter(f => f.severity === "critical").length
    };
}

/**
 * Determine overall status based on execution metrics and findings
 */
export function determineOverallStatus(
    successRate: number,
    failedOperations: number,
    totalOperations: number,
    hasCriticalFindings: boolean
): "success" | "partial_success" | "failure" | "error" {
    if (failedOperations >= Math.max(1, Math.floor(totalOperations / 2))) {
        return "failure";
    }

    if (hasCriticalFindings) {
        return "partial_success";
    }

    if (successRate < 80) {
        return "partial_success";
    }

    return "success";
}

/**
 * Generate executive summary for a workflow result
 */
export function generateExecutiveSummary(result: AgentWorkflowResult): string {
    const timeline = result.timeline || [];
    const findings = Array.isArray(result.outputs?.findings)
        ? result.outputs.findings
        : [];

    const metrics = calculateExecutionMetrics(timeline);
    const tokenUsage = calculateTokenUsage(timeline);
    const severityCounts = countFindingsBySeverity(findings);
    const hasCritical = severityCounts.critical > 0;

    const status = determineOverallStatus(
        metrics.successRate,
        metrics.failedOperations,
        metrics.totalOperations,
        hasCritical
    );

    return `Automation completed with ${status}. ${findings.length} findings reported (${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low). ${tokenUsage.totalTokens.toLocaleString()} tokens used.`;
}

/**
 * Create a formatted markdown report from workflow results
 */
export function createMarkdownReport(result: AgentWorkflowResult): string {
    const outputs = result.outputs || {};
    const timeline = result.timeline || [];
    const events = result.eventStream || [];

    // Calculate metrics
    const metrics = calculateExecutionMetrics(timeline);
    const tokenUsage = calculateTokenUsage(timeline);
    const findings = Array.isArray(outputs.findings) ? outputs.findings : [];
    const severityCounts = countFindingsBySeverity(findings);

    // Determine overall status
    const hasCritical = severityCounts.critical > 0;
    const status = determineOverallStatus(
        metrics.successRate,
        metrics.failedOperations,
        metrics.totalOperations,
        hasCritical
    );

    let markdown = `# Automation Results Report\n\n`;
    markdown += `---\n\n`;

    // Executive Summary
    markdown += `## 📊 Executive Summary\n\n`;
    markdown += `**Status**: ${status === "success" ? "✅ Success" : status === "partial_success" ? "⚠️ Partial Success" : "❌ Failed"}\n\n`;

    // Execution Metrics
    const successCount = timeline.filter(t => t.status === "success").length;
    markdown += `### 🔢 Execution Metrics\n`;
    markdown += `- **Total Nodes**: ${timeline.length}\n`;
    markdown += `- **Successful**: ${successCount}\n`;
    markdown += `- **Failed**: ${metrics.failedOperations}\n`;
    markdown += `- **Success Rate**: ${metrics.successRate}%\n\n`;

    // Token Usage
    const totalTokens = tokenUsage.totalTokens;
    markdown += `### 💬 Token Usage\n`;
    markdown += `- **Input Tokens**: ${tokenUsage.inputTokens.toLocaleString()}\n`;
    markdown += `- **Output Tokens**: ${tokenUsage.outputTokens.toLocaleString()}\n`;
    markdown += `- **Total Tokens**: ${totalTokens.toLocaleString()}\n\n`;

    // Findings Summary
    const totalFindings = findings.length;
    markdown += `### 🔍 Findings Summary\n`;
    if (severityCounts.critical > 0) {
        markdown += `- ❌ **Critical Issues**: ${severityCounts.critical}\n`;
    }
    if (severityCounts.high > 0) {
        markdown += `- ⚠️ **High Priority**: ${severityCounts.high}\n`;
    }
    if (severityCounts.medium > 0) {
        markdown += `- 🔶 **Medium Priority**: ${severityCounts.medium}\n`;
    }
    if (severityCounts.low > 0) {
        markdown += `- 🔵 **Low Priority**: ${severityCounts.low}\n`;
    }
    markdown += `- **Total Findings**: ${totalFindings}\n\n`;

    // Detailed Findings Section
    if (findings.length > 0) {
        markdown += `## 📋 Detailed Findings\n\n`;

        if (severityCounts.critical > 0) {
            markdown += `### ❌ Critical Issues (${severityCounts.critical})\n\n`;
            findings.filter(f => f.severity === "critical").forEach((f, i) => {
                markdown += `**${i + 1}. ${f.title}**\n`;
                markdown += `${f.summary}\n`;
                if (f.evidence) {
                    markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
                }
                markdown += "\n";
            });
        }

        if (severityCounts.high > 0) {
            markdown += `### ⚠️ High Priority (${severityCounts.high})\n\n`;
            findings.filter(f => f.severity === "high").forEach((f, i) => {
                markdown += `**${i + 1}. ${f.title}**\n`;
                markdown += `${f.summary}\n`;
                if (f.evidence) {
                    markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
                }
                markdown += "\n";
            });
        }

        if (severityCounts.medium > 0) {
            markdown += `### 🔶 Medium Priority (${severityCounts.medium})\n\n`;
            findings.filter(f => f.severity === "medium").forEach((f, i) => {
                markdown += `**${i + 1}. ${f.title}**\n`;
                markdown += `${f.summary}\n`;
                if (f.evidence) {
                    markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
                }
                markdown += "\n";
            });
        }

        if (severityCounts.low > 0) {
            markdown += `### 🔵 Low Priority (${severityCounts.low})\n\n`;
            findings.filter(f => f.severity === "low").forEach((f, i) => {
                markdown += `**${i + 1}. ${f.title}**\n`;
                markdown += `${f.summary}\n`;
                if (f.evidence) {
                    markdown += `\`\`\`\n${f.evidence}\n\`\`\`\n`;
                }
                markdown += "\n";
            });
        }
    } else {
        markdown += `## 📋 Detailed Findings\n\nNo findings reported.\n\n`;
    }

    // Raw Output Section
    const rawReport = typeof outputs.report === "string" ? outputs.report : JSON.stringify(outputs.report || "", null, 2);
    markdown += `---\n\n`;
    markdown += `## 📄 Raw Output\n\n\`\`\`json\n${rawReport}\n\`\`\``;

    return markdown;
}

/**
 * Create a summary object for quick overview
 */
export function createSummary(result: AgentWorkflowResult): {
    status: string;
    findingsCount: number;
    successRate: number;
    tokenUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
} {
    const timeline = result.timeline || [];
    const findings = Array.isArray(result.outputs?.findings) ? result.outputs.findings : [];

    const metrics = calculateExecutionMetrics(timeline);
    const tokenUsage = calculateTokenUsage(timeline);
    const severityCounts = countFindingsBySeverity(findings);
    const hasCritical = severityCounts.critical > 0;

    const status = determineOverallStatus(
        metrics.successRate,
        metrics.failedOperations,
        metrics.totalOperations,
        hasCritical
    );

    return {
        status: status === "success" ? "✅ Success" : status === "partial_success" ? "⚠️ Partial Success" : "❌ Failed",
        findingsCount: findings.length,
        successRate: metrics.successRate,
        tokenUsage
    };
}

/**
 * Generate a JSON report structure
 */
export function createJsonReport(result: AgentWorkflowResult): any {
    const outputs = result.outputs || {};
    const timeline = result.timeline || [];
    const events = result.eventStream || [];

    // Calculate metrics
    const metrics = calculateExecutionMetrics(timeline);
    const tokenUsage = calculateTokenUsage(timeline);
    const findings = Array.isArray(outputs.findings) ? outputs.findings : [];
    const severityCounts = countFindingsBySeverity(findings);

    return {
        metadata: {
            sessionId: result.sessionId,
            conclusion: result.conclusion,
            generatedAt: new Date().toISOString()
        },
        executionMetrics: {
            successRate: metrics.successRate,
            totalOperations: metrics.totalOperations,
            failedOperations: metrics.failedOperations
        },
        tokenUsage: {
            inputTokens: tokenUsage.inputTokens,
            outputTokens: tokenUsage.outputTokens,
            totalTokens: tokenUsage.totalTokens
        },
        findingsSummary: {
            total: findings.length,
            bySeverity: severityCounts,
            critical: severityCounts.critical > 0,
            highPriority: severityCounts.high > 0
        },
        timeline: timeline.map(t => ({
            id: t.id,
            label: t.label,
            status: t.status,
            summary: t.summary,
            startedAt: t.startedAt,
            endedAt: t.endedAt,
            tokenUsage: t.tokenUsage
        })),
        findings: findings.map(f => ({
            title: f.title,
            summary: f.summary,
            severity: f.severity,
            evidence: f.evidence
        })),
        outputs: {
            context: outputs.context,
            targetFiles: outputs.target_files,
            rawClaims: outputs.raw_claims,
            verifiedFindings: outputs.verified_findings,
            tasks: outputs.tasks,
            report: typeof outputs.report === "string" ? outputs.report : outputs.report?.json
        }
    };
}

/**
 * Enhance workflow result with formatted reports and metrics
 */
export function enhanceWorkflowResult(result: AgentWorkflowResult): AgentWorkflowResult {
    const markdown = createMarkdownReport(result);
    const jsonReport = createJsonReport(result);
    const summary = generateExecutiveSummary(result);

    // Update outputs to include formatted report
    if (!result.outputs) {
        result.outputs = {} as any;
    }

    result.outputs.report = {
        markdown,
        json: JSON.stringify(jsonReport, null, 2),
        summary
    };

    return result;
}

export default {
    calculateExecutionMetrics,
    calculateTokenUsage,
    countFindingsBySeverity,
    determineOverallStatus,
    generateExecutiveSummary,
    createMarkdownReport,
    createJsonReport,
    enhanceWorkflowResult
};