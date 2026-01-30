/**
 * Presentation State Manager
 * 
 * Singleton module to manage the current PptxGenJS presentation instance
 * across multiple MCP tool calls within a session.
 */

import PptxGenJS from "pptxgenjs";
import { resolveRepoPath } from "./pathUtils.js";
import path from "path";

// Singleton state
let currentPresentation = null;
let presentationId = null;

/**
 * Get or create a presentation instance
 */
export function getPresentation() {
  if (!currentPresentation) {
    throw new Error("No presentation is currently open. Call create_presentation first.");
  }
  return currentPresentation;
}

/**
 * Create a new presentation and store it
 */
export function createNewPresentation() {
  currentPresentation = new PptxGenJS();
  presentationId = `pres_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  // Set default properties
  currentPresentation.author = "PayMe AI Agent";
  currentPresentation.company = "Forvis Mazars";
  currentPresentation.subject = "Generated Presentation";
  currentPresentation.title = "Untitled Presentation";
  
  return { pres: currentPresentation, id: presentationId };
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
}

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
  return path.join(workingFolder, "Generated");
}

export const presentationState = {
  getPresentation,
  createNewPresentation,
  hasPresentation,
  getPresentationId,
  clearPresentation,
  getTemplatesDir,
  getOutputDir,
};
