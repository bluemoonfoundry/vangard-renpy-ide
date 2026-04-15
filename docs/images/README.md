# Images Directory for User Guide

This directory contains all images, screenshots, and diagrams for the Ren'IDE User Guide.

## Directory Structure

```
images/
├── logo.png                    # Ren'IDE logo for title page (512x512px or larger)
├── 01-intro/                   # Section 1: Introduction
├── 02-getting-started/         # Section 2: Getting Started
├── 03-interface/               # Section 3: Interface Overview
├── 04-core-features/           # Section 4: Core Features Tour
├── 05-writers/                 # Section 5: For Writers
├── 06-artists/                 # Section 6: For Artists
├── 07-developers/              # Section 7: For Developers
├── 08-reference/               # Section 8: Complete Feature Reference
└── 09-appendices/              # Section 9: Appendices
```

## Adding Screenshots

See `../SCREENSHOT_REQUIREMENTS.md` for a complete checklist of needed screenshots.

### Naming Convention

Use descriptive names that indicate what the screenshot shows:

- `feature-description.png` (lowercase with hyphens)
- Examples:
  - `story-canvas-basic.png`
  - `editor-intellisense-jump.png`
  - `settings-sdk-path.png`

### Image Requirements

- **Format:** PNG (lossless compression)
- **Resolution:** Minimum 1920×1080 for full interface shots
- **DPI:** 144 DPI or higher for print quality
- **Color Space:** RGB
- **Compression:** Optimize after capture (use ImageOptim, TinyPNG, or similar)

### Logo Requirements

The `logo.png` file should be:
- Square aspect ratio (e.g., 512×512, 1024×1024)
- PNG with transparency (if applicable)
- High resolution (for print quality)
- Centered content (with some padding around edges)

### Capturing Screenshots

**macOS:**
```bash
# Capture region
Cmd+Shift+4

# Capture window
Cmd+Shift+4, then press Space, then click window
```

**Windows:**
```bash
# Snipping Tool
Win+Shift+S
```

**Linux:**
```bash
# Using GNOME Screenshot
gnome-screenshot -a

# Using Spectacle (KDE)
spectacle -r
```

### Optimizing Images

After capturing screenshots, optimize them to reduce file size:

**Using ImageOptim (macOS):**
```bash
# Install
brew install --cask imageoptim

# Drag images onto ImageOptim app, or use CLI
imageoptim images/*.png
```

**Using ImageMagick (all platforms):**
```bash
# Resize and compress
convert input.png -quality 85 -resize 1920x1080\> output.png
```

**Using Online Tools:**
- [TinyPNG](https://tinypng.com/) - Web-based PNG compression
- [Squoosh](https://squoosh.app/) - Google's image optimizer

## Placeholder Images

If you don't have screenshots yet, you can create placeholder images:

```bash
# Create a placeholder image with ImageMagick
convert -size 1920x1080 xc:lightgray \
  -pointsize 48 -fill black \
  -gravity center -annotate +0+0 "Screenshot\nPlaceholder" \
  placeholder.png
```

Or use online placeholder generators:
- [Placeholder.com](https://placeholder.com/)
- [Lorem Picsum](https://picsum.photos/)

## Including Images in Markdown

In `USER_GUIDE.md`, reference images like this:

```markdown
![Description of image](images/01-intro/intro-story-canvas.png)

*Figure X: Caption describing what the image shows*
```

With width specification:

```markdown
![Description](images/01-intro/intro-story-canvas.png){width=80%}
```

## Current Status

- [ ] Logo added (`logo.png`)
- [ ] Section 1 screenshots (3-4 images)
- [ ] Section 2 screenshots (10-12 images)
- [ ] Section 3 screenshots (8-10 images)
- [ ] Section 4 screenshots (12-15 images)
- [ ] Section 5 screenshots (8-10 images)
- [ ] Section 6 screenshots (10-12 images)
- [ ] Section 7 screenshots (8-10 images)
- [ ] Section 8 screenshots (2-3 images)
- [ ] Section 9 screenshots (1-2 images)

**Total needed:** 60-70 screenshots

See `../SCREENSHOT_REQUIREMENTS.md` for detailed list.

## Tips for Consistency

1. **Use the same theme** throughout (recommend System Light or System Dark)
2. **Use the same test project** for all screenshots (creates continuity)
3. **Maintain consistent window sizes** (e.g., always 1920×1080)
4. **Clean up the UI** before capturing (close unnecessary tabs, panels)
5. **Annotate when helpful** (add arrows, highlights, labels to complex screenshots)

## Annotating Screenshots

Use tools to add callouts, arrows, and highlights:

**macOS:**
- Preview (built-in)
- Skitch
- CleanShot X

**Windows:**
- Snagit
- Greenshot
- Paint.NET

**Linux:**
- GIMP
- Krita
- Inkscape

**Online:**
- [Photopea](https://www.photopea.com/) - Free online Photoshop alternative
- [Canva](https://www.canva.com/) - Design tool with annotation features

---

**Questions?** Refer to `../SCREENSHOT_REQUIREMENTS.md` or `../README_PDF_GENERATION.md`.
