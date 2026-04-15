# Pandoc PDF Generation Options for Ren'IDE User Guide

This document provides detailed Pandoc commands and customization options for generating a professional PDF from the Markdown user guide.

## Basic Command

The simplest command to generate a PDF:

```bash
/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc USER_GUIDE.md \
  -o Ren-IDE_User_Guide.pdf \
  --toc \
  --number-sections
```

This creates a basic PDF with a table of contents and numbered sections.

---

## Recommended Command (Professional Output)

For a polished, professional PDF with optimal formatting:

```bash
/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc USER_GUIDE.md \
  -o Ren-IDE_User_Guide.pdf \
  --pdf-engine=xelatex \
  --toc \
  --toc-depth=3 \
  --number-sections \
  --highlight-style=tango \
  --variable geometry:margin=1in \
  --variable fontsize=11pt \
  --variable documentclass=report \
  --variable linkcolor=blue \
  --variable urlcolor=blue \
  --variable toccolor=blue \
  --standalone
```

**What this does:**
- Uses XeLaTeX (better Unicode and font support)
- Generates a table of contents with 3 levels of depth
- Numbers all sections (1, 1.1, 1.1.1, etc.)
- Syntax highlights code blocks with Tango style
- Sets 1-inch margins
- Uses 11pt font (readable but not too large)
- Uses "report" document class (good for long documents)
- Colors links in blue
- Creates a standalone document

---

## Advanced Customization Options

### 1. Custom Title Page

Create a separate `title.md` file:

```markdown
---
title: "Ren'IDE User Guide"
subtitle: "The Visual IDE for Ren'Py Development"
author: "Blue Moon Foundry"
date: "April 2026"
version: "0.7.1 Public Beta 4"
logo: "images/logo.png"
---
```

Then generate with:

```bash
/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc \
  title.md USER_GUIDE.md \
  -o Ren-IDE_User_Guide.pdf \
  --pdf-engine=xelatex \
  --toc \
  --toc-depth=3 \
  --number-sections \
  --highlight-style=tango \
  --variable geometry:margin=1in \
  --variable fontsize=11pt \
  --variable documentclass=report
```

### 2. Custom Fonts

Use custom fonts (requires installing fonts on your system):

```bash
--variable mainfont="Helvetica Neue" \
--variable sansfont="Arial" \
--variable monofont="Menlo"
```

Or for a professional look:

```bash
--variable mainfont="Georgia" \
--variable sansfont="Helvetica" \
--variable monofont="Courier New"
```

### 3. Headers and Footers

Add headers and footers with page numbers:

```bash
--variable header-includes="\usepackage{fancyhdr}\pagestyle{fancy}\fancyhead[L]{Ren'IDE User Guide}\fancyhead[R]{v0.7.1}\fancyfoot[C]{\thepage}"
```

This adds:
- "Ren'IDE User Guide" in the top-left
- "v0.7.1" in the top-right
- Page number centered at the bottom

### 4. Syntax Highlighting Styles

Choose from these styles for code blocks:

- `tango` (recommended, colorful but readable)
- `pygments` (classic Python highlighter)
- `kate` (KDE style)
- `monochrome` (black and white)
- `espresso` (dark background style)
- `zenburn` (dark theme)
- `breezedark` (dark with good contrast)

Change with: `--highlight-style=stylename`

Preview styles: [Pandoc Syntax Highlighting](https://pandoc.org/MANUAL.html#syntax-highlighting)

### 5. Line Spacing

Adjust line spacing for readability:

```bash
--variable linestretch=1.2
```

Values:
- `1.0` = single spacing (default)
- `1.2` = slightly more spacious (recommended for guides)
- `1.5` = 1.5 spacing
- `2.0` = double spacing

### 6. Page Breaks

To force a page break before each main section, use:

```bash
--variable pagestyle=empty
```

Or manually insert page breaks in Markdown:

```markdown
\newpage
```

### 7. Two-Column Layout

For a magazine-style layout (not recommended for user guides, but available):

```bash
--variable classoption=twocolumn
```

### 8. Custom LaTeX Preamble

For advanced customization, create a `preamble.tex` file:

```latex
\usepackage{fancyhdr}
\pagestyle{fancy}
\fancyhead[L]{Ren'IDE User Guide}
\fancyhead[R]{v0.7.1}
\fancyfoot[C]{\thepage}

\usepackage{graphicx}
\usepackage{hyperref}
\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    urlcolor=blue,
    citecolor=blue
}

\usepackage{listings}
\lstset{
    basicstyle=\ttfamily\small,
    breaklines=true,
    frame=single
}
```

Then use:

```bash
--include-in-header=preamble.tex
```

---

## Complete Professional Command

Combining the best options for a polished user guide:

```bash
/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc \
  TITLE_PAGE.md USER_GUIDE.md \
  -o Ren-IDE_User_Guide.pdf \
  --pdf-engine=xelatex \
  --toc \
  --toc-depth=3 \
  --number-sections \
  --highlight-style=tango \
  --variable geometry:margin=1in \
  --variable geometry:top=1.25in \
  --variable geometry:bottom=1.25in \
  --variable fontsize=11pt \
  --variable linestretch=1.2 \
  --variable documentclass=report \
  --variable linkcolor=blue \
  --variable urlcolor=blue \
  --variable toccolor=blue \
  --variable mainfont="Georgia" \
  --variable sansfont="Helvetica" \
  --variable monofont="Menlo" \
  --variable header-includes="\usepackage{fancyhdr}\pagestyle{fancy}\fancyhead[L]{Ren'IDE User Guide}\fancyhead[R]{v0.7.1}\fancyfoot[C]{\thepage}" \
  --standalone \
  --verbose
```

**This command:**
- Uses custom title page
- XeLaTeX for better fonts
- TOC with 3 levels
- Numbered sections
- Tango syntax highlighting
- 1-inch side margins, 1.25-inch top/bottom margins
- 11pt Georgia font for body, Helvetica for headings, Menlo for code
- 1.2 line spacing
- Headers and footers with page numbers
- Blue hyperlinks
- Verbose output (shows progress)

---

## Troubleshooting Common Issues

### Issue: "xelatex not found"

**Solution:** Install LaTeX:
- **macOS:** `brew install --cask mactex` (large, ~4GB) or `brew install basictex` (minimal)
- **Windows:** Install MiKTeX from [miktex.org](https://miktex.org/)
- **Linux:** `sudo apt-get install texlive-xetex` (Ubuntu/Debian)

After installing, restart your terminal.

### Issue: "Font not found"

**Solution:** Use system fonts or install missing fonts:
- Check available fonts: `fc-list` (Linux/macOS) or Font Book (macOS)
- Use default fonts by removing `--variable mainfont/sansfont/monofont`

### Issue: Images not appearing

**Solution:**
- Ensure image paths in Markdown are correct (relative to the .md file)
- Use forward slashes in paths: `images/screenshot.png`
- Check that images exist in the `docs/images/` directory

### Issue: PDF is too large (file size)

**Solution:** Compress images before adding them to the guide:
- Use ImageOptim (macOS), TinyPNG (web), or `convert` (ImageMagick)
- Example: `convert input.png -quality 85 -resize 1920x1080\> output.png`

### Issue: Code blocks are wrapping poorly

**Solution:** Use a smaller monospace font:

```bash
--variable monofont="Courier New" \
--variable fontsize=10pt
```

Or adjust listings settings in a custom preamble.

### Issue: Table of contents too long

**Solution:** Reduce TOC depth:

```bash
--toc-depth=2
```

This shows only sections and subsections (1, 1.1), not sub-subsections (1.1.1).

---

## Alternative PDF Engines

### pdflatex (Default)

```bash
--pdf-engine=pdflatex
```

**Pros:** Widely available, fast
**Cons:** Limited Unicode support, fewer font options

### xelatex (Recommended)

```bash
--pdf-engine=xelatex
```

**Pros:** Excellent Unicode support, system fonts, handles complex scripts
**Cons:** Slightly slower

### lualatex

```bash
--pdf-engine=lualatex
```

**Pros:** Modern, extensible, good Unicode support
**Cons:** Less tested than xelatex

### wkhtmltopdf (HTML-based)

```bash
--pdf-engine=wkhtmltopdf
```

**Pros:** Uses HTML/CSS rendering (familiar for web developers)
**Cons:** Less professional typography, larger file sizes

---

## Output Formats Beyond PDF

Pandoc can generate other formats from the same Markdown:

### HTML (Web Version)

```bash
pandoc USER_GUIDE.md -o USER_GUIDE.html --standalone --toc --css=style.css
```

### EPUB (E-book)

```bash
pandoc USER_GUIDE.md -o USER_GUIDE.epub --toc --epub-cover-image=cover.png
```

### DOCX (Microsoft Word)

```bash
pandoc USER_GUIDE.md -o USER_GUIDE.docx --toc
```

### LaTeX (for further customization)

```bash
pandoc USER_GUIDE.md -o USER_GUIDE.tex --toc --number-sections
```

Then compile with: `xelatex USER_GUIDE.tex`

---

## Makefile for Automated Building

Create a `Makefile` in the `docs/` directory:

```makefile
PANDOC=/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc
INPUT=TITLE_PAGE.md USER_GUIDE.md
OUTPUT=Ren-IDE_User_Guide.pdf

PANDOC_OPTIONS=--pdf-engine=xelatex \
  --toc \
  --toc-depth=3 \
  --number-sections \
  --highlight-style=tango \
  --variable geometry:margin=1in \
  --variable fontsize=11pt \
  --variable linestretch=1.2 \
  --variable documentclass=report \
  --variable linkcolor=blue \
  --variable urlcolor=blue \
  --variable mainfont="Georgia" \
  --variable sansfont="Helvetica" \
  --variable monofont="Menlo" \
  --standalone

.PHONY: all clean pdf html epub

all: pdf

pdf:
	$(PANDOC) $(INPUT) -o $(OUTPUT) $(PANDOC_OPTIONS)

html:
	$(PANDOC) USER_GUIDE.md -o USER_GUIDE.html --standalone --toc --css=style.css

epub:
	$(PANDOC) USER_GUIDE.md -o USER_GUIDE.epub --toc --epub-cover-image=images/cover.png

clean:
	rm -f $(OUTPUT) USER_GUIDE.html USER_GUIDE.epub
```

**Usage:**
- `make` or `make pdf` — Generate PDF
- `make html` — Generate HTML
- `make epub` — Generate EPUB
- `make clean` — Remove generated files

---

## Recommended Workflow

1. **Draft Phase:**
   - Generate PDF frequently with the basic command to check formatting
   - Don't worry about perfection yet

2. **Screenshot Phase:**
   - Add screenshots to `docs/images/` following the structure in SCREENSHOT_REQUIREMENTS.md
   - Insert image references in Markdown
   - Regenerate PDF to verify images appear correctly

3. **Polish Phase:**
   - Use the complete professional command
   - Adjust margins, fonts, and line spacing to taste
   - Add custom title page
   - Add headers/footers

4. **Final Review:**
   - Print a test copy or review on tablet/e-reader
   - Check for:
     - Images rendering correctly
     - Page breaks in logical places
     - Tables not overflowing
     - Code blocks readable
     - TOC links working
   - Make final adjustments

5. **Distribution:**
   - Generate final PDF
   - Compress if needed (use PDF compression tools)
   - Upload to GitHub Releases or distribute to users

---

## Testing the PDF

Before distributing, test the PDF:

1. **Open in multiple viewers:**
   - Adobe Acrobat Reader
   - Preview (macOS)
   - Evince (Linux)
   - Web browser PDF viewer
   - Mobile PDF reader (iOS/Android)

2. **Check these elements:**
   - [ ] All images appear correctly
   - [ ] Table of contents links work
   - [ ] Hyperlinks (URLs) work
   - [ ] Code syntax highlighting is readable
   - [ ] Tables fit within page margins
   - [ ] Page numbers are correct
   - [ ] Headers/footers appear on all pages
   - [ ] No orphaned headings (heading at bottom of page with content on next page)

3. **Print test:**
   - Print 2-3 pages to verify formatting looks good on paper

---

## Resources

- **Pandoc Manual:** [https://pandoc.org/MANUAL.html](https://pandoc.org/MANUAL.html)
- **Pandoc LaTeX Variables:** [https://pandoc.org/MANUAL.html#variables-for-latex](https://pandoc.org/MANUAL.html#variables-for-latex)
- **LaTeX Font Catalogue:** [https://tug.org/FontCatalogue/](https://tug.org/FontCatalogue/)
- **Pandoc Discussions:** [https://github.com/jgm/pandoc/discussions](https://github.com/jgm/pandoc/discussions)

---

**Quick Command Reference:**

```bash
# Basic PDF
pandoc USER_GUIDE.md -o output.pdf

# With TOC and sections
pandoc USER_GUIDE.md -o output.pdf --toc --number-sections

# Professional PDF (full options)
pandoc TITLE_PAGE.md USER_GUIDE.md -o output.pdf --pdf-engine=xelatex --toc --toc-depth=3 --number-sections --highlight-style=tango --variable geometry:margin=1in --variable fontsize=11pt --variable linestretch=1.2 --standalone
```
