/**
 * Presentation State Manager
 * 
 * Singleton module to manage the pptx-automizer instance
 * across multiple MCP tool calls within a session.
 * 
 * Uses pptx-automizer for template-based generation (preserves styles)
 * with pptxgenjs integration for shape creation.
 */

import { Automizer, ModifyTextHelper } from "pptx-automizer";
import PptxGenJS from "pptxgenjs";
import { resolveRepoPath } from "./pathUtils.js";
import path from "path";
import fs from "fs/promises";

// Singleton state
let automizer = null;
let currentPresentation = null;
let presentationId = null;
let templateInfo = null;

/**
 * Get the templates directory from the working folder
 */
export function getTemplatesDir() {
  const workingFolder = resolveRepoPath();
  return path.join(workingFolder, "PowerPoint");
}

/**
 * Get the default output directory
 */
export function getOutputDir() {
  const workingFolder = resolveRepoPath();
  return workingFolder; // Output to root of working folder
}

/**
 * Resolve a template name to its full path
 * Uses multiple strategies: direct path, extension guessing, and glob search
 */
export async function resolveTemplatePath(templateName) {
  const templatesDir = getTemplatesDir();
  console.error("[resolveTemplatePath] templatesDir:", templatesDir);
  console.error("[resolveTemplatePath] looking for:", templateName);

  // Strategy 1: Try exact match with common extensions
  const extensions = [".potx", ".pptx", ""];
  for (const ext of extensions) {
    const fullPath = path.join(templatesDir, templateName + ext);
    console.error("[resolveTemplatePath] trying:", fullPath);
    try {
      await fs.access(fullPath);
      console.error("[resolveTemplatePath] FOUND via direct path:", fullPath);
      return fullPath;
    } catch {
      // Continue to next extension
    }
  }

  // Strategy 2: Use glob to find files matching the template name pattern
  console.error("[resolveTemplatePath] trying glob search...");
  try {
    const { glob } = await import("glob");
    const pattern = `**/${templateName}*`;
    const files = await glob(pattern, {
      cwd: templatesDir,
      nodir: true,
      ignore: ["**/~$*"],
    });

    console.error("[resolveTemplatePath] glob found:", files);

    if (files.length > 0) {
      // Prefer .potx over .pptx
      const potxFile = files.find(f => f.endsWith(".potx"));
      const chosen = potxFile || files[0];
      const fullPath = path.join(templatesDir, chosen);
      console.error("[resolveTemplatePath] FOUND via glob:", fullPath);
      return fullPath;
    }
  } catch (err) {
    console.error("[resolveTemplatePath] glob error:", err.message);
  }

  console.error("[resolveTemplatePath] NOT FOUND");
  return null;
}

/**
 * Create a new pptx-automizer session with a template
 * 
 * IMPORTANT: pptx-automizer requires:
 * 1. loadRoot() - sets the base template structure for output
 * 2. load() - registers templates we can copy slides FROM
 */
export async function createAutomizerSession(templatePath, options = {}) {
  const templatesDir = getTemplatesDir();
  const outputDir = getOutputDir();

  // Initialize automizer with configuration
  automizer = new Automizer({
    templateDir: templatesDir,
    outputDir: outputDir,
    // Always import slide masters from template to preserve branding
    autoImportSlideMasters: true,
    // Start fresh - we'll add slides from template
    removeExistingSlides: true,
    // Cleanup unused files for smaller output
    cleanup: true,
    // Medium compression for balance of speed/size
    compression: 5,
    // Show some logging for debugging
    verbosity: 1,
    // Integrate pptxgenjs for shape generation if needed
    pptxGenJs: PptxGenJS,
  });

  // Get just the filename for loading
  const templateFilename = path.basename(templatePath);

  // loadRoot sets the BASE template structure for output
  currentPresentation = automizer.loadRoot(templateFilename);

  // CRITICAL: .load() registers the template so we can reference it in addSlide()
  // We use 'template' as the label for consistency
  currentPresentation.load(templateFilename, "template");

  presentationId = `pres_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Store template info for later reference
  templateInfo = {
    path: templatePath,
    filename: templateFilename,
    name: path.basename(templateFilename, path.extname(templateFilename)),
    label: "template", // The label used in .load()
  };

  return { pres: currentPresentation, id: presentationId, template: templateInfo };
}

/**
 * Create a blank presentation using pptxgenjs (fallback when no template)
 */
export function createBlankPresentation() {
  // Import PptxGenJS for blank presentations
  const pres = new PptxGenJS();
  presentationId = `pres_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Set default properties
  pres.author = "PayMe AI Agent";
  pres.company = "Forvis Mazars";
  pres.subject = "Generated Presentation";
  pres.title = "Untitled Presentation";
  pres.layout = "LAYOUT_WIDE";

  // Store as legacy format
  currentPresentation = { _pptxgenjs: pres, _isBlank: true };
  templateInfo = null;

  return { pres, id: presentationId };
}

/**
 * Get the current presentation/automizer session
 */
export function getPresentation() {
  if (!currentPresentation) {
    throw new Error("No presentation is currently open. Call create_presentation first.");
  }
  return currentPresentation;
}

/**
 * Check if using automizer (template-based) or pptxgenjs (blank)
 */
export function isUsingAutomizer() {
  return currentPresentation && !currentPresentation._isBlank;
}

/**
 * Get the underlying pptxgenjs instance (for blank presentations or shape generation)
 */
export function getPptxGenInstance() {
  if (currentPresentation?._pptxgenjs) {
    return currentPresentation._pptxgenjs;
  }
  return null;
}

/**
 * Get the automizer instance
 */
export function getAutomizer() {
  return automizer;
}

/**
 * Get template info
 */
export function getTemplateInfo() {
  return templateInfo;
}

/**
 * Check if a presentation exists
 */
export function hasPresentation() {
  return currentPresentation !== null;
}

/**
 * Get the current presentation ID
 */
export function getPresentationId() {
  return presentationId;
}

/**
 * Clear the current presentation (after save or on reset)
 */
export function clearPresentation() {
  currentPresentation = null;
  presentationId = null;
  automizer = null;
  templateInfo = null;
}

// Track slides added from template
let addedSlides = [];

export function trackSlide(slideInfo) {
  addedSlides.push(slideInfo);
  return addedSlides.length - 1;
}

export function getAddedSlides() {
  return addedSlides;
}

export function clearAddedSlides() {
  addedSlides = [];
}

export const presentationState = {
  getPresentation,
  createAutomizerSession,
  createBlankPresentation,
  hasPresentation,
  getPresentationId,
  clearPresentation,
  getTemplatesDir,
  getOutputDir,
  resolveTemplatePath,
  isUsingAutomizer,
  getPptxGenInstance,
  getAutomizer,
  getTemplateInfo,
  trackSlide,
  getAddedSlides,
  clearAddedSlides,
};
