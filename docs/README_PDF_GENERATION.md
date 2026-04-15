# PDF Generation Instructions for Ren'IDE User Guide

This README provides step-by-step instructions for generating the final PDF user guide.

## Quick Start

If you already have screenshots and want to generate the PDF immediately:

```bash
cd /Users/hirparag/Development/private/bmf-vangard-renpy-ide/docs

/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc \
  TITLE_PAGE.md USER_GUIDE.md \
  -o Ren-IDE_User_Guide.pdf \
  --pdf-engine=xelatex \
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
  --variable toccolor=blue \
  --standalone \
  --verbose
```

---

## Prerequisites

### 1. Install LaTeX (if not already installed)

Pandoc requires a LaTeX distribution to generate PDFs.

**Check if LaTeX is installed:**
```bash
xelatex --version
```

If you see version information, you're good to go. If not, install LaTeX:

**macOS:**
```bash
# Option 1: Full TeX Live (recommended, ~4GB)
brew install --cask mactex

# Option 2: Minimal BasicTeX (~100MB)
brew install --cask basictex

# After installing BasicTeX, install additional packages:
sudo tlmgr update --self
sudo tlmgr install collection-fontsrecommended
sudo tlmgr install fancyhdr
```

**Windows:**
- Download and install MiKTeX from [miktex.org](https://miktex.org/)
- During installation, choose "Always install missing packages on-the-fly"

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get install texlive-xetex texlive-fonts-recommended texlive-latex-extra

# Fedora
sudo dnf install texlive-xetex texlive-collection-fontsrecommended

# Arch
sudo pacman -S texlive-core texlive-latexextra
```

### 2. Verify Pandoc Installation

```bash
/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc --version
```

Should show Pandoc version 3.9 or later.

---

## Step-by-Step PDF Generation Process

### Step 1: Prepare the Logo (Optional but Recommended)

The title page references `images/logo.png`. Create or place your logo:

```bash
# Create images directory if it doesn't exist
mkdir -p /Users/hirparag/Development/private/bmf-vangard-renpy-ide/docs/images

# Copy your logo (replace with actual logo file)
# The logo should be approximately 512x512px or larger
cp /path/to/your/logo.png /Users/hirparag/Development/private/bmf-vangard-renpy-ide/docs/images/logo.png
```

**If you don't have a logo yet:**
The PDF will generate with a placeholder. You can add the logo later and regenerate.

### Step 2: Add Screenshots

Follow the instructions in `SCREENSHOT_REQUIREMENTS.md`:

1. Create the screenshots using the provided checklist
2. Save them in the `docs/images/` directory following the structure:
   ```
   docs/images/
   ├── 01-intro/
   ├── 02-getting-started/
   ├── 03-interface/
   ├── 04-core-features/
   ├── 05-writers/
   ├── 06-artists/
   ├── 07-developers/
   ├── 08-reference/
   └── 09-appendices/
   ```

3. Insert screenshot references in `USER_GUIDE.md` where indicated

**Priority:** Start with the 10 priority screenshots listed in `SCREENSHOT_REQUIREMENTS.md`.

### Step 3: Test Basic PDF Generation

Generate a test PDF to ensure everything works:

```bash
cd /Users/hirparag/Development/private/bmf-vangard-renpy-ide/docs

/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc \
  USER_GUIDE.md \
  -o test.pdf \
  --toc \
  --number-sections
```

This creates a basic PDF without the title page or fancy formatting. Open `test.pdf` to verify:
- PDF opens correctly
- Table of contents is generated
- Sections are numbered
- Content flows properly

If this works, proceed to the full generation.

### Step 4: Generate the Full PDF

Now generate the final professional PDF with the title page:

```bash
cd /Users/hirparag/Development/private/bmf-vangard-renpy-ide/docs

/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc \
  TITLE_PAGE.md USER_GUIDE.md \
  -o Ren-IDE_User_Guide.pdf \
  --pdf-engine=xelatex \
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
  --variable toccolor=blue \
  --standalone \
  --verbose
```

**The `--verbose` flag shows progress** as Pandoc processes the document. This is helpful for large documents.

**Expected output:**
```
[INFO] Running xelatex on USER_GUIDE.tex ...
[INFO] Completed successfully
```

The PDF will be created at:
```
/Users/hirparag/Development/private/bmf-vangard-renpy-ide/docs/Ren-IDE_User_Guide.pdf
```

### Step 5: Review the PDF

Open the generated PDF and check:

- [ ] Title page looks good
- [ ] Table of contents is complete and links work
- [ ] All sections are numbered correctly
- [ ] Images appear (if you've added them)
- [ ] Code blocks are syntax highlighted
- [ ] Tables fit within margins
- [ ] Hyperlinks are clickable and blue
- [ ] Page numbers are correct
- [ ] No orphaned headings (heading at bottom of page with content on next)

### Step 6: Make Adjustments (if needed)

If something doesn't look right, refer to `PANDOC_OPTIONS.md` for customization options.

**Common adjustments:**

**Images too large or too small:**
Edit the Markdown image references to specify width:
```markdown
![Screenshot](images/example.png){width=80%}
```

**Tables overflowing:**
Simplify tables or rotate them (see `PANDOC_OPTIONS.md` for LaTeX table options).

**Fonts not to your liking:**
Change fonts in the Pandoc command (see `PANDOC_OPTIONS.md` for font options).

**Too much/little spacing:**
Adjust line spacing: `--variable linestretch=1.0` (tighter) or `1.5` (looser).

---

## Alternative: Generate Without Screenshots First

If you want to see the PDF structure before adding screenshots:

```bash
cd /Users/hirparag/Development/private/bmf-vangard-renpy-ide/docs

/Users/hirparag/Development/pandoc-3.9.0.2-arm64/bin/pandoc \
  TITLE_PAGE.md USER_GUIDE.md \
  -o Ren-IDE_User_Guide_DRAFT.pdf \
  --pdf-engine=xelatex \
  --toc \
  --toc-depth=3 \
  --number-sections \
  --highlight-style=tango \
  --variable geometry:margin=1in \
  --variable fontsize=11pt \
  --variable linestretch=1.2 \
  --variable documentclass=report \
  --standalone
```

This generates a draft PDF. You can review the layout, then add screenshots incrementally and regenerate.

---

## Using the Makefile (Optional but Recommended)

Create a `Makefile` in the `docs/` directory for easy regeneration.

**Create `Makefile`:**

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
  --variable toccolor=blue \
  --standalone \
  --verbose

.PHONY: all clean pdf draft

all: pdf

pdf:
	$(PANDOC) $(INPUT) -o $(OUTPUT) $(PANDOC_OPTIONS)

draft:
	$(PANDOC) USER_GUIDE.md -o Ren-IDE_User_Guide_DRAFT.pdf --toc --number-sections

clean:
	rm -f $(OUTPUT) Ren-IDE_User_Guide_DRAFT.pdf *.aux *.log *.out *.tex

help:
	@echo "Makefile targets:"
	@echo "  make pdf    - Generate final PDF with title page"
	@echo "  make draft  - Generate draft PDF (no title page, basic formatting)"
	@echo "  make clean  - Remove generated files"
	@echo "  make help   - Show this help message"
```

**Usage:**
```bash
cd /Users/hirparag/Development/private/bmf-vangard-renpy-ide/docs

# Generate final PDF
make pdf

# Generate draft PDF
make draft

# Clean up generated files
make clean

# Show help
make help
```

---

## Troubleshooting

### Problem: "xelatex: command not found"

**Solution:** LaTeX is not installed or not in your PATH. Install LaTeX (see Prerequisites above).

### Problem: "File `images/logo.png' not found"

**Solution:** Either:
1. Add the logo image to `docs/images/logo.png`
2. Or remove the logo reference from `TITLE_PAGE.md` (line 2)

### Problem: PDF generation is very slow

**Cause:** Large images or many images can slow down PDF generation.

**Solution:**
- Compress images before adding them (use ImageOptim, TinyPNG, or similar)
- Resize images to appropriate dimensions (max 1920px wide)

### Problem: Images appear but are very small or very large

**Solution:** Specify width in Markdown:
```markdown
![Screenshot](images/example.png){width=80%}
```

Or use absolute measurements:
```markdown
![Screenshot](images/example.png){width=5in}
```

### Problem: Code blocks are hard to read

**Solution:** Try a different syntax highlighting style:
```bash
--highlight-style=pygments
```

Or increase font size:
```bash
--variable fontsize=12pt
```

### Problem: "Undefined control sequence" error

**Cause:** LaTeX doesn't recognize a command in the Markdown.

**Solution:** Simplify the problematic section or check for special characters that need escaping (e.g., `_`, `#`, `$`).

---

## File Size Optimization

The final PDF may be large (20-50 MB) if it includes many high-resolution screenshots.

**To reduce file size:**

1. **Compress images before adding them:**
   ```bash
   # Using ImageMagick
   convert input.png -quality 85 -resize 1920x1080\> output.png
   ```

2. **Use PDF compression:**
   ```bash
   # Using Ghostscript (macOS/Linux)
   gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook \
      -dNOPAUSE -dQUIET -dBATCH \
      -sOutputFile=compressed.pdf input.pdf
   ```

3. **Or use online tools:**
   - [iLovePDF - Compress PDF](https://www.ilovepdf.com/compress_pdf)
   - [Smallpdf](https://smallpdf.com/compress-pdf)

Target file size: 5-15 MB (manageable for download and distribution)

---

## Next Steps After PDF Generation

1. **Review thoroughly** — Read the entire PDF, check formatting, verify links work
2. **Get feedback** — Have a colleague or beta tester review it
3. **Add to GitHub Releases** — Upload the PDF as an asset in a new release
4. **Update documentation** — Link to the PDF in the main README.md
5. **Announce** — Share the user guide with your community

---

## Summary of Files

Here's what you have in the `docs/` directory:

| File | Purpose |
|------|---------|
| `USER_GUIDE.md` | Main content (all 9 sections) |
| `TITLE_PAGE.md` | Title page, about section, quick start |
| `SCREENSHOT_REQUIREMENTS.md` | Checklist of needed screenshots |
| `PANDOC_OPTIONS.md` | Detailed Pandoc customization guide |
| `README_PDF_GENERATION.md` | This file - step-by-step PDF generation |
| `images/` | Directory for screenshots and logo |
| `Makefile` | (Optional) Automated build commands |

---

## Quick Command Reference

```bash
# Test basic PDF (no title page, no fancy formatting)
pandoc USER_GUIDE.md -o test.pdf --toc --number-sections

# Generate final professional PDF
pandoc TITLE_PAGE.md USER_GUIDE.md -o Ren-IDE_User_Guide.pdf \
  --pdf-engine=xelatex --toc --toc-depth=3 --number-sections \
  --highlight-style=tango --variable geometry:margin=1in \
  --variable fontsize=11pt --variable linestretch=1.2 \
  --variable documentclass=report --standalone --verbose

# Generate draft PDF (just content, basic formatting)
pandoc USER_GUIDE.md -o draft.pdf --toc --number-sections

# Using Makefile (if created)
make pdf       # Final PDF
make draft     # Draft PDF
make clean     # Remove generated files
```

---

**Need help?** Refer to `PANDOC_OPTIONS.md` for detailed customization options, or consult the [Pandoc Manual](https://pandoc.org/MANUAL.html).

**Ready to generate?** Run the command above and enjoy your professional user guide!
