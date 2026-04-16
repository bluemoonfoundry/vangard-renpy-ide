PANDOC?=~/Development/pandoc-3.9.0.2-arm64/bin/pandoc
INPUT=TITLE_PAGE.md USER_GUIDE.md
OUTPUT=Ren-IDE_User_Guide.pdf
HTML_OUTPUT=Ren-IDE_User_Guide.html

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

HTML_OPTIONS=--toc \
  --toc-depth=3 \
  --number-sections \
  --syntax-highlighting=tango \
  --embed-resources \
  --standalone \
  --metadata title="Ren'IDE User Guide" \
  --css=user-guide.css \
  --template=template.html

.PHONY: all clean pdf draft test html screenshots full help

all: pdf html

pdf:
	@echo "Generating final PDF with title page..."
	$(PANDOC) $(INPUT) -o $(OUTPUT) $(PANDOC_OPTIONS)
	@echo "✓ PDF generated: $(OUTPUT)"

html:
	@echo "Generating HTML user guide..."
	python build_guide.py

screenshots:
	@echo "Capturing screenshots via Playwright..."
	node capture_screenshots.js
	@echo "Screenshots saved to images/"

full: screenshots html

draft:
	@echo "Generating draft PDF (no title page)..."
	$(PANDOC) USER_GUIDE.md -o Ren-IDE_User_Guide_DRAFT.pdf --toc --number-sections
	@echo "✓ Draft PDF generated: Ren-IDE_User_Guide_DRAFT.pdf"

test:
	@echo "Generating test PDF (minimal options)..."
	$(PANDOC) USER_GUIDE.md -o test.pdf --toc
	@echo "✓ Test PDF generated: test.pdf"

clean:
	@echo "Cleaning generated files..."
	rm -f $(OUTPUT) $(HTML_OUTPUT) Ren-IDE_User_Guide_DRAFT.pdf test.pdf
	rm -f *.aux *.log *.out *.tex *.toc
	@echo "Clean complete"

clean-screenshots:
	@echo "Removing captured screenshots..."
	rm -rf images/
	@echo "Done"

help:
	@echo "Ren'IDE User Guide - Makefile targets:"
	@echo ""
	@echo "  make all          - Generate PDF and HTML (default)"
	@echo "  make html         - Generate HTML (embeds any captured screenshots)"
	@echo "  make screenshots  - Capture screenshots via Playwright + Electron"
	@echo "  make full         - Capture screenshots then build HTML"
	@echo "  make pdf          - Generate final PDF with title page"
	@echo "  make draft        - Generate draft PDF (no title page)"
	@echo "  make test         - Generate test PDF (minimal options)"
	@echo "  make clean        - Remove generated HTML/PDF files"
	@echo "  make clean-screenshots - Remove captured screenshot images"
	@echo "  make help         - Show this help"
	@echo ""
	@echo "Generated files:"
	@echo "  HTML: $(HTML_OUTPUT)"
	@echo "  PDF:  $(OUTPUT)"
	@echo "  Screenshots: images/*.png"
