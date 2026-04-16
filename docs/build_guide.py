#!/usr/bin/env python3
"""
Build script: convert USER_GUIDE.md -> Ren-IDE_User_Guide.html
using the medieval-tome Jinja2 template (template-medieval.html).

Requirements:
    pip install markdown jinja2
"""

import base64
import re
import sys
from pathlib import Path

try:
    import markdown as md_lib
    from jinja2 import Environment, FileSystemLoader, select_autoescape
except ImportError:
    sys.exit("Missing dependencies. Run:  pip install markdown jinja2")

# ---------------------------------------------------------------------------
# Paths and constants
# ---------------------------------------------------------------------------

DOCS_DIR    = Path(__file__).parent
GUIDE_MD    = DOCS_DIR / "USER_GUIDE.md"
TEMPLATE    = "template-medieval.html"
OUTPUT_HTML = DOCS_DIR / "Ren-IDE_User_Guide.html"

DOC_TITLE    = "Ren\u2019IDE User Guide"
DOC_SUBTITLE = "Being a complete guide to the mastery of the software."

ROMAN = [
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV",
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    """Produce a URL-safe anchor ID from heading text."""
    text = text.lower()
    text = re.sub(r"['\u2018\u2019`\u201c\u201d]", "", text)
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")


def downshift_headings(html: str) -> str:
    """
    Shift heading levels inside an html_content block so they don't
    clash with the template's own h2/h3 section/subsection titles:
        h3 -> h4,  h4 -> h5,  h5 -> h6
    Process from the bottom up to avoid double-shifting.
    """
    for n in (5, 4, 3):
        html = re.sub(
            rf"(</?h){n}([ >])",
            lambda m, _n=n: f"{m.group(1)}{_n + 1}{m.group(2)}",
            html,
        )
    return html


def convert(md_text: str, converter: md_lib.Markdown) -> str:
    """Reset the converter and turn a markdown snippet into HTML."""
    converter.reset()
    return converter.convert(md_text)


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def parse_sections(md_text: str) -> list[dict]:
    """
    Split USER_GUIDE.md into a list of section dicts matching the
    template schema:

        H1  -> section   (content rendered as <h2> by the template)
        H2  -> subsection (content rendered as <h3> by the template)
        H3+ -> part of html_content (downshifted to h4+)

    Any text before the first H1 heading is silently ignored.
    """
    converter = md_lib.Markdown(
        extensions=["extra", "sane_lists"],
        output_format="html",
    )

    h1_re = re.compile(r"^# (.+)$", re.MULTILINE)
    h2_re = re.compile(r"^## (.+)$", re.MULTILINE)

    h1_matches = list(h1_re.finditer(md_text))
    sections: list[dict] = []

    for sec_idx, h1 in enumerate(h1_matches):
        sec_title = h1.group(1).strip()
        sec_id    = slugify(sec_title)

        # Body of this section (up to the next H1 or end of file)
        body_start = h1.end()
        body_end   = (
            h1_matches[sec_idx + 1].start()
            if sec_idx + 1 < len(h1_matches)
            else len(md_text)
        )
        body = md_text[body_start:body_end].strip()

        h2_matches = list(h2_re.finditer(body))

        # Text that appears before the first H2 (section intro)
        pre_h2_end  = h2_matches[0].start() if h2_matches else len(body)
        pre_h2_md   = body[:pre_h2_end].strip()
        pre_h2_html = (
            downshift_headings(convert(pre_h2_md, converter))
            if pre_h2_md
            else ""
        )

        # Apply the drop-cap class to the first paragraph of the whole guide
        if sec_idx == 0 and pre_h2_html:
            pre_h2_html = pre_h2_html.replace("<p>", '<p class="drop-cap">', 1)

        # Parse subsections (H2 blocks)
        subsections: list[dict] = []
        for sub_idx, h2 in enumerate(h2_matches):
            sub_title = h2.group(1).strip()
            sub_id    = f"{sec_id}-{slugify(sub_title)}"

            sub_start = h2.end()
            sub_end   = (
                h2_matches[sub_idx + 1].start()
                if sub_idx + 1 < len(h2_matches)
                else len(body)
            )
            sub_md   = body[sub_start:sub_end].strip()
            sub_html = downshift_headings(convert(sub_md, converter))

            # Fallback drop-cap: first section had no pre-H2 intro text
            if sec_idx == 0 and sub_idx == 0 and not pre_h2_html:
                sub_html = sub_html.replace("<p>", '<p class="drop-cap">', 1)

            subsections.append({
                "id":            sub_id,
                "nav_title":     sub_title,
                "content_title": sub_title,
                "html_content":  sub_html,
            })

        # Add Roman numeral prefix to sidebar nav title only
        nav_title = (
            f"{ROMAN[sec_idx]}. {sec_title}"
            if sec_idx < len(ROMAN)
            else sec_title
        )

        sections.append({
            "id":            sec_id,
            "nav_title":     nav_title,
            "content_title": sec_title,
            "html_content":  pre_h2_html,
            "subsections":   subsections,
        })

    return sections


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Screenshot embedding
# ---------------------------------------------------------------------------

IMAGES_DIR = DOCS_DIR / "images"

def embed_images(html: str) -> str:
    """
    Replace <img src="images/FILENAME"> tags with inline base64 data URIs
    when the corresponding file exists in docs/images/.
    Images that haven't been captured yet are left as relative src paths
    so the HTML degrades gracefully.
    """
    def replace_src(m: re.Match) -> str:
        before, src, after = m.group(1), m.group(2), m.group(3)
        # Only process relative images/ paths
        if not src.startswith("images/"):
            return m.group(0)
        img_path = DOCS_DIR / src
        if not img_path.exists():
            return m.group(0)  # leave as-is; file not yet captured
        ext = img_path.suffix.lower().lstrip(".")
        mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "gif": "image/gif", "webp": "image/webp"}.get(ext, "image/png")
        b64 = base64.b64encode(img_path.read_bytes()).decode("ascii")
        return f'{before}data:{mime};base64,{b64}{after}'

    # Match src="..." or src='...' inside <img ...> tags
    return re.sub(
        r'(<img\s[^>]*src=")([^"]+)(")',
        replace_src,
        html,
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    md_text = GUIDE_MD.read_text(encoding="utf-8")

    env = Environment(
        loader=FileSystemLoader(str(DOCS_DIR)),
        autoescape=select_autoescape([]),   # no auto-escape; content uses | safe
    )
    template = env.get_template(TEMPLATE)

    sections = parse_sections(md_text)

    html_output = template.render(
        doc_title=DOC_TITLE,
        doc_subtitle=DOC_SUBTITLE,
        sections=sections,
    )

    html_output = embed_images(html_output)

    embedded = len(re.findall(r'src="data:image/', html_output))
    placeholders = len(re.findall(r'src="images/', html_output))

    OUTPUT_HTML.write_text(html_output, encoding="utf-8")
    print(f"HTML generated: {OUTPUT_HTML}")
    if embedded:
        print(f"  {embedded} screenshot(s) embedded inline as base64.")
    if placeholders:
        print(f"  {placeholders} screenshot placeholder(s) not yet captured (run 'make screenshots' first).")


if __name__ == "__main__":
    main()
