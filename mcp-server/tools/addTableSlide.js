/**
 * add_table_slide - Add a slide with a formatted table (for pricing, comparisons, etc.)
 */

import { getPresentation } from "./presentationState.js";

export const addTableSlide = {
    description: "Add a slide with a formatted table. Ideal for pricing tables, comparison charts, or structured data.",
    inputSchema: {
        type: "object",
        properties: {
            title: {
                type: "string",
                description: "Slide title displayed above the table",
            },
            headers: {
                type: "array",
                items: { type: "string" },
                description: "Array of column header labels (e.g., ['Service', 'Monthly Fee', 'Annual Fee'])",
            },
            rows: {
                type: "array",
                items: {
                    type: "array",
                    items: { type: "string" },
                },
                description: "Array of rows, each row is an array of cell values (e.g., [['Payroll', '500 CHF', '5,400 CHF']])",
            },
            columnWidths: {
                type: "array",
                items: { type: "number" },
                description: "Optional array of column widths in inches. If not provided, columns are distributed evenly.",
            },
            notes: {
                type: "string",
                description: "Optional footnote text displayed below the table (e.g., 'Prices exclude VAT')",
            },
        },
        required: ["title", "headers", "rows"],
    },
    async run({ title, headers, rows, columnWidths, notes }) {
        const pres = getPresentation();
        const slide = pres.addSlide();

        // Add title at top
        slide.addText(title, {
            x: 0.5,
            y: 0.3,
            w: "90%",
            h: 0.7,
            fontSize: 28,
            fontFace: "Arial",
            bold: true,
            color: "1A1A2E",
        });

        // Calculate column widths
        const tableWidth = 12; // inches (for 16:9 wide format)
        const numColumns = headers.length;
        const defaultColWidth = tableWidth / numColumns;
        const colWidths = columnWidths && columnWidths.length === numColumns
            ? columnWidths
            : Array(numColumns).fill(defaultColWidth);

        // Build table data: header row + data rows
        const tableData = [
            // Header row with styling
            headers.map(h => ({
                text: h,
                options: {
                    bold: true,
                    fill: { color: "1A1A2E" },
                    color: "FFFFFF",
                    align: "center",
                    valign: "middle",
                },
            })),
            // Data rows
            ...rows.map((row, rowIdx) =>
                row.map(cell => ({
                    text: cell,
                    options: {
                        fill: { color: rowIdx % 2 === 0 ? "F5F5F5" : "FFFFFF" },
                        color: "333333",
                        align: "left",
                        valign: "middle",
                    },
                }))
            ),
        ];

        // Add table
        slide.addTable(tableData, {
            x: 0.5,
            y: 1.2,
            w: tableWidth,
            colW: colWidths,
            border: { pt: 0.5, color: "CCCCCC" },
            fontFace: "Arial",
            fontSize: 14,
            rowH: 0.5,
            autoPage: false,
        });

        // Add notes/footnote if provided
        if (notes) {
            const tableHeight = (rows.length + 1) * 0.5 + 0.2; // header + rows + padding
            slide.addText(notes, {
                x: 0.5,
                y: 1.2 + tableHeight,
                w: "90%",
                h: 0.4,
                fontSize: 10,
                fontFace: "Arial",
                italic: true,
                color: "666666",
            });
        }

        const slideIndex = pres.slides.length - 1;

        return {
            slideIndex,
            slideNumber: slideIndex + 1,
            type: "table",
            title,
            columns: headers.length,
            rows: rows.length,
            hasNotes: !!notes,
        };
    },
};
