# Ren'Py Template

This directory should contain a copy of the Ren'Py SDK's default project template.

## Setup Instructions

Copy the contents of `{renpy_sdk}/gui/game/` from a Ren'Py SDK installation into this directory.

The template should include:
- `gui.rpy` - GUI configuration
- `screens.rpy` - Screen definitions
- `options.rpy` - Project options
- `script.rpy` - Starter script
- `gui/` - GUI image assets directory
- Other template files

## Purpose

This bundled template serves as a fallback when the Ren'Py SDK path is not configured or when the SDK template cannot be found. This ensures the "New Project" wizard always works, even without an SDK installation.

The wizard will prefer the SDK's template if available (for the most up-to-date version), but will fall back to this bundled copy if needed.
