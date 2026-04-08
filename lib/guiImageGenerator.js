/**
 * GUI Image Generator for Ren'Py projects
 * Generates essential GUI images using Sharp
 * Ports a subset of the image generation from Ren'Py SDK's gui7/images.py
 */

import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

/**
 * Create a solid color rectangle SVG
 */
function createSolidRectSVG(width, height, color) {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${color}"/>
</svg>`;
}

/**
 * Create a rounded rectangle SVG
 */
function createRoundedRectSVG(width, height, color, radius = 0, opacity = 1.0) {
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${color}" opacity="${opacity}"/>
</svg>`;
}

/**
 * Generate button backgrounds
 */
async function generateButtonBackgrounds(guiDir, colors) {
  const buttonDir = path.join(guiDir, 'button');
  await fs.mkdir(buttonDir, { recursive: true });

  // Idle button background (muted color)
  const idleSvg = createSolidRectSVG(120, 40, colors.muted_color);
  await sharp(Buffer.from(idleSvg))
    .png()
    .toFile(path.join(buttonDir, 'idle_background.png'));

  // Hover button background (hover_muted color)
  const hoverSvg = createSolidRectSVG(120, 40, colors.hover_muted_color);
  await sharp(Buffer.from(hoverSvg))
    .png()
    .toFile(path.join(buttonDir, 'hover_background.png'));

  console.log('Generated button backgrounds');
}

/**
 * Generate bar elements (progress bars, scrollbars)
 */
async function generateBarElements(guiDir, colors) {
  const barDir = path.join(guiDir, 'bar');
  await fs.mkdir(barDir, { recursive: true });

  // Left bar (filled portion - accent color)
  const leftSvg = createSolidRectSVG(8, 25, colors.accent_color);
  await sharp(Buffer.from(leftSvg))
    .png()
    .toFile(path.join(barDir, 'left.png'));

  // Right bar (unfilled portion - muted color)
  const rightSvg = createSolidRectSVG(8, 25, colors.muted_color);
  await sharp(Buffer.from(rightSvg))
    .png()
    .toFile(path.join(barDir, 'right.png'));

  // Top bar (filled - accent color)
  const topSvg = createSolidRectSVG(25, 8, colors.accent_color);
  await sharp(Buffer.from(topSvg))
    .png()
    .toFile(path.join(barDir, 'top.png'));

  // Bottom bar (unfilled - muted color)
  const bottomSvg = createSolidRectSVG(25, 8, colors.muted_color);
  await sharp(Buffer.from(bottomSvg))
    .png()
    .toFile(path.join(barDir, 'bottom.png'));

  console.log('Generated bar elements');
}

/**
 * Generate scrollbar elements
 */
async function generateScrollbarElements(guiDir, colors) {
  const scrollbarDir = path.join(guiDir, 'scrollbar');
  await fs.mkdir(scrollbarDir, { recursive: true });

  // Horizontal scrollbar thumb (accent color)
  const hThumbSvg = createRoundedRectSVG(30, 12, colors.accent_color, 6);
  await sharp(Buffer.from(hThumbSvg))
    .png()
    .toFile(path.join(scrollbarDir, 'horizontal_idle_thumb.png'));

  await sharp(Buffer.from(hThumbSvg))
    .png()
    .toFile(path.join(scrollbarDir, 'horizontal_hover_thumb.png'));

  // Vertical scrollbar thumb (accent color)
  const vThumbSvg = createRoundedRectSVG(12, 30, colors.accent_color, 6);
  await sharp(Buffer.from(vThumbSvg))
    .png()
    .toFile(path.join(scrollbarDir, 'vertical_idle_thumb.png'));

  await sharp(Buffer.from(vThumbSvg))
    .png()
    .toFile(path.join(scrollbarDir, 'vertical_hover_thumb.png'));

  // Horizontal scrollbar bar (muted color, semi-transparent)
  const hBarSvg = createRoundedRectSVG(30, 12, colors.muted_color, 6, 0.3);
  await sharp(Buffer.from(hBarSvg))
    .png()
    .toFile(path.join(scrollbarDir, 'horizontal_idle_bar.png'));

  await sharp(Buffer.from(hBarSvg))
    .png()
    .toFile(path.join(scrollbarDir, 'horizontal_hover_bar.png'));

  // Vertical scrollbar bar (muted color, semi-transparent)
  const vBarSvg = createRoundedRectSVG(12, 30, colors.muted_color, 6, 0.3);
  await sharp(Buffer.from(vBarSvg))
    .png()
    .toFile(path.join(scrollbarDir, 'vertical_idle_bar.png'));

  await sharp(Buffer.from(vBarSvg))
    .png()
    .toFile(path.join(scrollbarDir, 'vertical_hover_bar.png'));

  console.log('Generated scrollbar elements');
}

/**
 * Generate slider elements
 */
async function generateSliderElements(guiDir, colors) {
  const sliderDir = path.join(guiDir, 'slider');
  await fs.mkdir(sliderDir, { recursive: true });

  // Horizontal slider thumb (accent color, circular)
  const hThumbSvg = `<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg">
  <circle cx="9" cy="9" r="9" fill="${colors.accent_color}"/>
</svg>`;
  await sharp(Buffer.from(hThumbSvg))
    .png()
    .toFile(path.join(sliderDir, 'horizontal_idle_thumb.png'));

  await sharp(Buffer.from(hThumbSvg))
    .png()
    .toFile(path.join(sliderDir, 'horizontal_hover_thumb.png'));

  // Vertical slider thumb (accent color, circular)
  const vThumbSvg = `<svg width="18" height="18" xmlns="http://www.w3.org/2000/svg">
  <circle cx="9" cy="9" r="9" fill="${colors.accent_color}"/>
</svg>`;
  await sharp(Buffer.from(vThumbSvg))
    .png()
    .toFile(path.join(sliderDir, 'vertical_idle_thumb.png'));

  await sharp(Buffer.from(vThumbSvg))
    .png()
    .toFile(path.join(sliderDir, 'vertical_hover_thumb.png'));

  // Horizontal slider bar (thin line, muted color)
  const hBarSvg = createSolidRectSVG(400, 4, colors.muted_color);
  await sharp(Buffer.from(hBarSvg))
    .png()
    .toFile(path.join(sliderDir, 'horizontal_idle_bar.png'));

  await sharp(Buffer.from(hBarSvg))
    .png()
    .toFile(path.join(sliderDir, 'horizontal_hover_bar.png'));

  // Vertical slider bar (thin line, muted color)
  const vBarSvg = createSolidRectSVG(4, 400, colors.muted_color);
  await sharp(Buffer.from(vBarSvg))
    .png()
    .toFile(path.join(sliderDir, 'vertical_idle_bar.png'));

  await sharp(Buffer.from(vBarSvg))
    .png()
    .toFile(path.join(sliderDir, 'vertical_hover_bar.png'));

  console.log('Generated slider elements');
}

/**
 * Generate textbox background
 * The textbox is a semi-transparent overlay at the bottom of the screen
 */
async function generateTextbox(guiDir, colors, width = 1920, height = 720) {
  // Textbox is a semi-transparent dark overlay
  // Default is 1920x185, but we scale based on resolution
  const textboxHeight = Math.round(185 * (height / 720));
  const textboxWidth = width;

  // Use menu_color with higher opacity for textbox background
  const textboxSvg = createRoundedRectSVG(
    textboxWidth,
    textboxHeight,
    colors.menu_color,
    0,
    0.85
  );

  await sharp(Buffer.from(textboxSvg))
    .png()
    .toFile(path.join(guiDir, 'textbox.png'));

  console.log('Generated textbox');
}

/**
 * Generate name box background
 * The name box displays the speaking character's name
 */
async function generateNamebox(guiDir, colors) {
  // Name box is a small rounded rect with menu color
  const nameboxSvg = createRoundedRectSVG(200, 45, colors.menu_color, 5, 0.9);

  await sharp(Buffer.from(nameboxSvg))
    .png()
    .toFile(path.join(guiDir, 'namebox.png'));

  console.log('Generated namebox');
}

/**
 * Generate overlay images (game menu, main menu overlays)
 */
async function generateOverlays(guiDir, colors, width = 1920, height = 1080) {
  const overlayDir = path.join(guiDir, 'overlay');
  await fs.mkdir(overlayDir, { recursive: true });

  // Main menu overlay (semi-transparent menu color over entire screen)
  const mainMenuSvg = createSolidRectSVG(width, height, colors.menu_color);
  await sharp(Buffer.from(mainMenuSvg))
    .png()
    .toFile(path.join(overlayDir, 'main_menu.png'));

  // Game menu overlay (darker, more opaque)
  const gameMenuSvg = createRoundedRectSVG(width, height, colors.menu_color, 0, 0.95);
  await sharp(Buffer.from(gameMenuSvg))
    .png()
    .toFile(path.join(overlayDir, 'game_menu.png'));

  // Confirm overlay (for confirm prompts)
  const confirmSvg = createSolidRectSVG(width, height, '#000000');
  await sharp(Buffer.from(confirmSvg))
    .modulate({ brightness: 0.5 })
    .png()
    .toFile(path.join(overlayDir, 'confirm.png'));

  console.log('Generated overlays');
}

/**
 * Main function to generate all GUI images
 * @param {string} projectDir - Root project directory
 * @param {Object} colors - Derived GUI colors object
 * @param {number} width - Game resolution width
 * @param {number} height - Game resolution height
 */
async function generateGuiImages(projectDir, colors, width, height) {
  const guiDir = path.join(projectDir, 'game', 'gui');

  // Ensure gui directory exists
  await fs.mkdir(guiDir, { recursive: true });

  // Generate all image sets
  await generateButtonBackgrounds(guiDir, colors);
  await generateBarElements(guiDir, colors);
  await generateScrollbarElements(guiDir, colors);
  await generateSliderElements(guiDir, colors);
  await generateTextbox(guiDir, colors, width, height);
  await generateNamebox(guiDir, colors);
  await generateOverlays(guiDir, colors, width, height);

  console.log('All GUI images generated successfully');
}

export {
  generateGuiImages
};
