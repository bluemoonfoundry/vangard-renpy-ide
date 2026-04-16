#!/usr/bin/env node
/**
 * capture_screenshots.js
 *
 * Launches the Ren'IDE Electron app with a demo project via the --project flag
 * and uses Playwright to capture screenshots for the user guide.
 *
 * Usage:
 *   node docs/capture_screenshots.js [--project /path/to/project] [--out docs/images]
 *
 * Requirements:
 *   npm install --save-dev playwright
 *
 * The demo project defaults to ./DemoProject (relative to repo root).
 * Screenshots are saved to docs/images/ by default.
 */

import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const getArg = (flag) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
};

const PROJECT_PATH = getArg('--project') ?? path.join(ROOT, 'DemoProject');
const OUT_DIR = getArg('--out') ?? path.join(__dirname, 'images');

// ---------------------------------------------------------------------------
// Screenshot manifest
// Each entry describes one capture. `setup` receives (page, electronApp) and
// should navigate the UI into the desired state before the screenshot fires.
// `waitFor` is a selector that must be visible before the capture.
// ---------------------------------------------------------------------------

/** Click a toolbar canvas-tab button by its title attribute */
async function clickCanvasTab(page, title) {
    await page.click(`[data-tutorial="canvas-tabs"] button[title*="${title}"]`);
    await page.waitForTimeout(600);
}

/** Click a right-sidebar tab by its visible label text */
async function clickSidebarTab(page, label) {
    await page.click(`[data-tutorial="story-elements"] [role="tablist"] button:has-text("${label}")`);
    await page.waitForTimeout(400);
}

/** Open a toolbar button by tooltip text */
async function clickToolbarButton(page, title) {
    await page.click(`button[title*="${title}"]`);
    await page.waitForTimeout(500);
}

/** Wait for the project canvas to finish its initial render */
async function waitForCanvas(page) {
    await page.waitForSelector('[data-tutorial="story-canvas"]', { timeout: 30000 });
    await page.waitForTimeout(1500); // let layout settle
}

const SCREENSHOTS = [
    // -----------------------------------------------------------------------
    // Section 2: Getting Started
    // -----------------------------------------------------------------------
    {
        filename: 'welcome-screen.png',
        description: 'Welcome screen before any project is open',
        /** This one runs BEFORE the project loads, so we skip the --project flag
         *  by launching a second instance without it (handled specially below). */
        welcomeOnly: true,
    },
    {
        filename: 'project-opened.png',
        description: 'Main UI immediately after opening a project',
        setup: async (page) => {
            await waitForCanvas(page);
        },
        waitFor: '[data-tutorial="story-canvas"]',
    },

    // -----------------------------------------------------------------------
    // Section 3: Interface Overview
    // -----------------------------------------------------------------------
    {
        filename: 'toolbar-closeup.png',
        description: 'Close-up of the main toolbar',
        setup: async (page) => {
            await waitForCanvas(page);
        },
        clip: async (page) => {
            const toolbar = await page.locator('[data-tutorial="canvas-tabs"]').first();
            // Capture the full toolbar row — walk up to the toolbar container
            const toolbarRow = await page.locator('header, [class*="toolbar"], [class*="Toolbar"]').first();
            return toolbarRow.boundingBox();
        },
    },
    {
        filename: 'story-elements-characters.png',
        description: 'Right sidebar — Characters tab',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickSidebarTab(page, 'Characters');
        },
        waitFor: '[data-tutorial="story-elements"]',
    },
    {
        filename: 'story-elements-images.png',
        description: 'Right sidebar — Images tab',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickSidebarTab(page, 'Images');
        },
        waitFor: '[data-tutorial="story-elements"]',
    },

    // -----------------------------------------------------------------------
    // Section 4: Core Features Tour
    // -----------------------------------------------------------------------
    {
        filename: 'story-canvas-basic.png',
        description: 'Story Canvas showing project file blocks',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickCanvasTab(page, 'Story Canvas');
        },
        waitFor: '[data-tutorial="story-canvas"]',
    },
    {
        filename: 'route-canvas-basic.png',
        description: 'Route Canvas — label-level control flow graph',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickCanvasTab(page, 'Route Canvas');
            await page.waitForTimeout(1000);
        },
    },
    {
        filename: 'choice-canvas-basic.png',
        description: 'Choice Canvas — player-visible choice tree',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickCanvasTab(page, 'Choice Canvas');
            await page.waitForTimeout(1000);
        },
    },
    {
        filename: 'diagnostics-panel-full.png',
        description: 'Diagnostics panel with issues listed',
        setup: async (page) => {
            await waitForCanvas(page);
            // Diagnostics tab is in the canvas tab bar
            await page.click('button[title*="Diagnostics"]');
            await page.waitForTimeout(800);
        },
    },
    {
        filename: 'search-panel.png',
        description: 'Global search panel open',
        setup: async (page) => {
            await waitForCanvas(page);
            await page.keyboard.press('Control+Shift+F');
            await page.waitForTimeout(600);
        },
    },

    // -----------------------------------------------------------------------
    // Section 5: For Writers
    // -----------------------------------------------------------------------
    {
        filename: 'writer-sticky-notes.png',
        description: 'Canvas with sticky notes attached to blocks',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickCanvasTab(page, 'Story Canvas');
        },
        waitFor: '[data-tutorial="story-canvas"]',
    },
    {
        filename: 'writer-character-manager.png',
        description: 'Characters tab with characters listed',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickSidebarTab(page, 'Characters');
        },
    },
    {
        filename: 'writer-menu-builder.png',
        description: 'Menu Builder / Menus tab',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickSidebarTab(page, 'Menus');
        },
    },

    // -----------------------------------------------------------------------
    // Section 6: For Artists
    // -----------------------------------------------------------------------
    {
        filename: 'artist-images-tab.png',
        description: 'Image Asset Manager — Images tab',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickSidebarTab(page, 'Images');
        },
    },
    {
        filename: 'artist-audio-tab.png',
        description: 'Audio Asset Manager — Audio tab',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickSidebarTab(page, 'Audio');
        },
    },
    {
        filename: 'artist-scene-composer-basic.png',
        description: 'Composers tab',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickSidebarTab(page, 'Composers');
        },
    },

    // -----------------------------------------------------------------------
    // Section 7: For Developers
    // -----------------------------------------------------------------------
    {
        filename: 'dev-snippets-tab.png',
        description: 'Snippets tab',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickSidebarTab(page, 'Snippets');
        },
    },
    {
        filename: 'dev-screen-composer-widgets.png',
        description: 'Screens tab',
        setup: async (page) => {
            await waitForCanvas(page);
            await clickSidebarTab(page, 'Screens');
        },
    },
    {
        filename: 'stats-panel.png',
        description: 'Project statistics panel',
        setup: async (page) => {
            await waitForCanvas(page);
            await page.click('button[title*="Stats"], button[title*="Statistics"]').catch(() => {
                // Try via the View menu if toolbar button not present
            });
            await page.waitForTimeout(1000);
        },
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function launchApp(extraArgs = []) {
    const electronApp = await electron.launch({
        args: [path.join(ROOT, 'electron.js'), ...extraArgs],
        cwd: ROOT,
        env: {
            ...process.env,
            // Suppress auto-update checks during screenshot capture
            ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
        },
    });
    return electronApp;
}

async function getMainPage(electronApp) {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ width: 1400, height: 900 });
    // Wait for the renderer to signal it's ready (title changes from blank)
    await page.waitForFunction(() => document.title.length > 0, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    return page;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    if (!existsSync(PROJECT_PATH)) {
        console.error(`Project not found: ${PROJECT_PATH}`);
        console.error('Pass --project /path/to/renpyproject or ensure DemoProject exists.');
        process.exit(1);
    }

    await ensureDir(OUT_DIR);
    console.log(`Saving screenshots to: ${OUT_DIR}`);
    console.log(`Using project:         ${PROJECT_PATH}`);

    // --- Capture welcome screen (no project arg so we see the splash) ---
    const welcomeEntry = SCREENSHOTS.find(s => s.welcomeOnly);
    if (welcomeEntry) {
        console.log(`  Capturing ${welcomeEntry.filename} (welcome screen)...`);
        const appNoProject = await launchApp([]);
        const page = await getMainPage(appNoProject);
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(OUT_DIR, welcomeEntry.filename) });
        await appNoProject.close();
        console.log(`    Saved.`);
    }

    // --- Launch with demo project for all other captures ---
    const electronApp = await launchApp(['--project', PROJECT_PATH]);
    const page = await getMainPage(electronApp);

    let captured = 0;
    let failed = 0;

    for (const entry of SCREENSHOTS) {
        if (entry.welcomeOnly) continue;

        process.stdout.write(`  Capturing ${entry.filename}...`);
        try {
            if (entry.setup) await entry.setup(page);
            if (entry.waitFor) await page.waitForSelector(entry.waitFor, { timeout: 10000 });

            const outPath = path.join(OUT_DIR, entry.filename);

            if (entry.clip) {
                const box = await entry.clip(page);
                if (box) {
                    await page.screenshot({ path: outPath, clip: box });
                } else {
                    await page.screenshot({ path: outPath });
                }
            } else {
                await page.screenshot({ path: outPath });
            }

            captured++;
            console.log(' done.');
        } catch (err) {
            failed++;
            console.log(` FAILED: ${err.message}`);
        }
    }

    await electronApp.close();

    console.log(`\nDone. ${captured} captured, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
