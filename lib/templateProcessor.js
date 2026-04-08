/**
 * Template file processor for Ren'Py project creation
 * Handles updating gui.rpy, options.rpy with project-specific values
 */

import fs from 'fs/promises';

/**
 * Slugify a project name for use in save directory and build name
 * Converts to lowercase, replaces spaces/special chars with hyphens
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars except hyphen
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

/**
 * Sanitize a project name for build.name
 * Similar to slugify but allows more characters (letters, digits, underscore, hyphen)
 */
function sanitizeBuildName(text) {
  return text
    .toString()
    .trim()
    .replace(/\s+/g, '_')           // Replace spaces with _
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars except hyphen
    .replace(/[_\-]+/g, '_')        // Replace multiple _/- with single _
    .replace(/^[_\-]+/, '')         // Trim _/- from start
    .replace(/[_\-]+$/, '');        // Trim _/- from end
}

/**
 * Update gui.rpy with resolution and color defines
 * @param {string} filePath - Path to gui.rpy
 * @param {number} width - Game width
 * @param {number} height - Game height
 * @param {Object} colors - Derived GUI colors object
 */
async function updateGuiRpy(filePath, width, height, colors) {
  let content = await fs.readFile(filePath, 'utf-8');

  // Update gui.init(width, height)
  content = content.replace(
    /gui\.init\(\s*\d+\s*,\s*\d+\s*\)/,
    `gui.init(${width}, ${height})`
  );

  // Update all color defines
  // Each color definition looks like: define gui.accent_color = "#00b8c3"
  const colorReplacements = {
    'gui.accent_color': colors.accent_color,
    'gui.hover_color': colors.hover_color,
    'gui.muted_color': colors.muted_color,
    'gui.hover_muted_color': colors.hover_muted_color,
    'gui.menu_color': colors.menu_color || colors.accent_color,  // Fallback if not present
    'gui.title_color': colors.title_color,
    'gui.selected_color': colors.selected_color,
    'gui.idle_color': colors.idle_color,
    'gui.idle_small_color': colors.idle_small_color,
    'gui.text_color': colors.text_color,
    'gui.interface_text_color': colors.interface_text_color,
    'gui.insensitive_color': colors.insensitive_color,
  };

  // Also handle derived colors that might use Color() expressions
  // Replace both simple defines and Color() expressions
  for (const [varName, newValue] of Object.entries(colorReplacements)) {
    // Match: define gui.XXX_color = "..." or Color(...)
    const regex = new RegExp(
      `(define\\s+${varName.replace('.', '\\.')}\\s*=\\s*)(?:"[^"]*"|'[^']*'|Color\\([^)]+\\))`,
      'g'
    );
    content = content.replace(regex, `$1"${newValue}"`);
  }

  // Special case: gui.hover_color might be defined as Color(gui.accent_color).tint(.6)
  // We replace it with the computed value
  if (colors.hover_color) {
    content = content.replace(
      /(define\s+gui\.hover_color\s*=\s*)Color\([^)]+\)\.tint\([^)]+\)/g,
      `$1"${colors.hover_color}"`
    );
  }

  // Update choice button text colors if they exist
  if (colors.choice_button_text_idle_color) {
    const choiceIdleRegex = /define\s+gui\.choice_button_text_idle_color\s*=\s*(?:"[^"]*"|'[^']*'|gui\.\w+)/g;
    content = content.replace(choiceIdleRegex, `define gui.choice_button_text_idle_color = "${colors.choice_button_text_idle_color}"`);
  }

  if (colors.choice_button_text_insensitive_color) {
    const choiceInsensitiveRegex = /define\s+gui\.choice_button_text_insensitive_color\s*=\s*(?:"[^"]*"|'[^']*'|gui\.\w+)/g;
    content = content.replace(choiceInsensitiveRegex, `define gui.choice_button_text_insensitive_color = "${colors.choice_button_text_insensitive_color}"`);
  }

  await fs.writeFile(filePath, content, 'utf-8');
  console.log('Updated gui.rpy');
}

/**
 * Update options.rpy with project name, save directory, and build name
 * @param {string} filePath - Path to options.rpy
 * @param {string} projectName - User-entered project name
 * @param {string} saveDir - Unique save directory name (slug + timestamp)
 */
async function updateOptionsRpy(filePath, projectName, saveDir) {
  let content = await fs.readFile(filePath, 'utf-8');

  // Update config.name - handle both _("...") and "..." formats
  // Pattern: define config.name = _("...") or define config.name = "..."
  content = content.replace(
    /(define\s+config\.name\s*=\s*)(?:_\()?["']([^"']*)["']\)?/,
    `$1_("${projectName}")`
  );

  // Update config.save_directory
  content = content.replace(
    /(define\s+config\.save_directory\s*=\s*)["']([^"']*)["']/,
    `$1"${saveDir}"`
  );

  // Update build.name
  const buildName = sanitizeBuildName(projectName);
  content = content.replace(
    /(define\s+build\.name\s*=\s*)["']([^"']*)["']/,
    `$1"${buildName}"`
  );

  await fs.writeFile(filePath, content, 'utf-8');
  console.log('Updated options.rpy');
}

/**
 * Generate a unique save directory name
 * Format: {slug}-{timestamp}
 */
function generateSaveDirectory(projectName) {
  const slug = slugify(projectName);
  const timestamp = Date.now();
  return `${slug}-${timestamp}`;
}

export {
  slugify,
  sanitizeBuildName,
  updateGuiRpy,
  updateOptionsRpy,
  generateSaveDirectory
};
