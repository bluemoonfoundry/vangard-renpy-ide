# Ren'IDE User Guide Documentation

This directory contains the complete user guide for Ren'IDE (Vangard Ren'Py IDE), including all source files, instructions, and tools needed to generate a professional PDF.

## Quick Start

Generate the PDF user guide:

```bash
cd /Users/hirparag/Development/private/bmf-vangard-renpy-ide/docs
make pdf
```

The PDF will be created at `Ren-IDE_User_Guide.pdf`.

---

## What's Included

| File | Description |
|------|-------------|
| `USER_GUIDE.md` | Main user guide content (9 sections, ~34,100 words) |
| `TITLE_PAGE.md` | Professional title page and front matter |
| `SCREENSHOT_REQUIREMENTS.md` | Checklist of 60-70 needed screenshots |
| `PANDOC_OPTIONS.md` | Detailed Pandoc customization guide |
| `README_PDF_GENERATION.md` | Step-by-step PDF generation instructions |
| `Makefile` | Automated build commands |
| `00_PROJECT_SUMMARY.md` | Project overview and completion summary |
| `images/` | Directory for screenshots and logo |

---

## User Guide Contents

The user guide covers:

1. **Introduction** - Purpose, audience, benefits, system requirements
2. **Getting Started** - Installation, first launch, project setup, SDK configuration
3. **Interface Overview** - Complete UI tour, toolbar, panels, shortcuts
4. **Core Features Tour** - Three canvas system, code editor, diagnostics, statistics
5. **For Writers** - Narrative visualization, character management, story flow
6. **For Artists** - Asset management, visual composers, artwork workflows
7. **For Developers** - Advanced editor, screen builder, SDK integration
8. **Complete Feature Reference** - Quick-reference tables for all features
9. **Appendices** - Shortcuts, troubleshooting, FAQ, glossary, resources

**Total:** ~100-110 pages (120-140 with screenshots)

---

## Prerequisites

### Required: LaTeX

Pandoc requires a LaTeX distribution to generate PDFs.

**macOS:**
```bash
brew install --cask mactex
# or for minimal install:
brew install --cask basictex
```

**Windows:**
- Download MiKTeX from [miktex.org](https://miktex.org/)

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install texlive-xetex texlive-fonts-recommended

# Fedora
sudo dnf install texlive-xetex

# Arch
sudo pacman -S texlive-core texlive-latexextra
```

### Verify Installation

```bash
xelatex --version
```

---

## Build Commands

### Using Makefile (Recommended)

```bash
# Generate final PDF with title page
make pdf

# Generate draft PDF (no title page, basic formatting)
make draft

# Generate test PDF (minimal options for quick testing)
make test

# Clean generated files
make clean

# Show help
make help
```

### Manual Pandoc Command

```bash
/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc \
  TITLE_PAGE.md USER_GUIDE.md \
  -o Ren-IDE_User_Guide.pdf \
  --pdf-engine=xelatex \
  --toc --toc-depth=3 --number-sections \
  --highlight-style=tango \
  --variable geometry:margin=1in \
  --variable fontsize=11pt --variable linestretch=1.2 \
  --variable documentclass=report \
  --standalone --verbose
```

---

## Adding Screenshots

1. **Capture screenshots** following the guidelines in `SCREENSHOT_REQUIREMENTS.md`
2. **Save them** in the appropriate subdirectory of `images/`
3. **Optimize** images to reduce file size (see `images/README.md`)
4. **Insert references** in `USER_GUIDE.md` using:
   ```markdown
   ![Description](images/section/filename.png)
   ```
5. **Regenerate PDF** with `make pdf`

**Priority:** Start with the 10 essential screenshots listed in `SCREENSHOT_REQUIREMENTS.md`.

---

## Customization

All formatting options are documented in `PANDOC_OPTIONS.md`, including:

- Custom fonts (Georgia, Helvetica, Menlo, or any system font)
- Margins, line spacing, font sizes
- Syntax highlighting styles (Tango, Pygments, Kate, etc.)
- Headers and footers
- Page layout options

---

## Project Structure

```
docs/
├── README.md                      # This file
├── 00_PROJECT_SUMMARY.md          # Project completion summary
├── USER_GUIDE.md                  # Main content (34,100 words)
├── TITLE_PAGE.md                  # Title page & front matter
├── SCREENSHOT_REQUIREMENTS.md     # Screenshot checklist (60-70 images)
├── PANDOC_OPTIONS.md              # Pandoc customization guide
├── README_PDF_GENERATION.md       # Detailed PDF generation instructions
├── Makefile                       # Build automation
├── images/                        # Screenshots directory
│   ├── README.md                  # Images guide
│   ├── logo.png                   # Logo (to be added)
│   └── [01-09]-*/                 # Section subdirectories
└── Ren-IDE_User_Guide.pdf         # Generated PDF (after build)
```

---

## Troubleshooting

### "xelatex: command not found"
- Install LaTeX (see Prerequisites above)

### "File 'images/logo.png' not found"
- Add logo to `images/logo.png`, or remove logo reference from `TITLE_PAGE.md`

### PDF generation is slow
- Compress images before adding them (see `images/README.md`)

### Images too small/large in PDF
- Specify width in Markdown: `![Alt](path){width=80%}`

**More troubleshooting:** See `README_PDF_GENERATION.md`

---

## Output Formats

Pandoc can generate multiple formats from the same Markdown:

```bash
# PDF (default)
make pdf

# HTML
pandoc USER_GUIDE.md -o USER_GUIDE.html --standalone --toc

# EPUB (e-book)
pandoc USER_GUIDE.md -o USER_GUIDE.epub --toc

# DOCX (Microsoft Word)
pandoc USER_GUIDE.md -o USER_GUIDE.docx --toc
```

---

## Contributing

To contribute improvements to this documentation:

1. Fork the repository
2. Make your changes to the Markdown files
3. Test PDF generation: `make pdf`
4. Submit a pull request

**Guidelines:**
- Keep Markdown formatting consistent
- Add screenshots when documenting new features
- Update the table of contents if adding new sections
- Test PDF generation before submitting

---

## License

This documentation is released under the same license as Ren'IDE.

Copyright © 2026 Blue Moon Foundry. All rights reserved.

---

## Questions or Issues?

- **Documentation Issues:** [Open an issue](https://github.com/bluemoonfoundry/vangard-renpy-ide/issues)
- **PDF Generation Help:** See `README_PDF_GENERATION.md`
- **Pandoc Options:** See `PANDOC_OPTIONS.md`
- **Screenshots:** See `SCREENSHOT_REQUIREMENTS.md`

---

**Ready to build?**

```bash
make pdf
```

**Generated PDF will be saved as:** `Ren-IDE_User_Guide.pdf`
