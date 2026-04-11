#!/usr/bin/env python3
"""Parse a PDF file and extract text content as structured JSON.

Usage: python3 parse_pdf.py <path-to-pdf>

Output: JSON array of page objects with extracted text.
"""

import json
import sys
from pathlib import Path
from io import BytesIO

from pdfminer.high_level import extract_pages
from pdfminer.layout import (
    LAParams, LTTextBox, LTTextLine, LTFigure, LTImage, LTChar
)


def extract_page_content(page_layout):
    """Extract text lines and detect images from a page layout."""
    lines = []
    has_images = False
    font_sizes = {}  # line_text -> max_font_size

    for element in page_layout:
        if isinstance(element, LTTextBox):
            for line in element:
                if isinstance(line, LTTextLine):
                    text = line.get_text().strip()
                    if text:
                        lines.append(text)
                        # Track font size for title detection
                        max_size = 0
                        for char in line:
                            if isinstance(char, LTChar):
                                max_size = max(max_size, char.size)
                        if max_size > 0:
                            font_sizes[text] = max_size
        elif isinstance(element, LTFigure):
            # Figures may contain images or nested text
            has_images = True
            for child in element:
                if isinstance(child, LTTextBox):
                    for line in child:
                        if isinstance(line, LTTextLine):
                            text = line.get_text().strip()
                            if text:
                                lines.append(text)
                elif isinstance(child, LTImage):
                    has_images = True
        elif isinstance(element, LTImage):
            has_images = True

    return lines, has_images, font_sizes


def detect_title(lines, font_sizes):
    """Detect the title as the line with the largest font size."""
    if not lines:
        return None

    if not font_sizes:
        # No font info — use first non-trivial line
        for line in lines:
            if len(line) > 3 and len(line) < 200:
                return line
        return None

    # Find the line with the largest font
    max_size = 0
    title_line = None
    for text, size in font_sizes.items():
        if size > max_size and len(text) > 2:
            max_size = size
            title_line = text

    # Only treat as title if it's meaningfully larger than body text
    if title_line and font_sizes:
        sizes = sorted(font_sizes.values())
        median_size = sizes[len(sizes) // 2] if sizes else 0
        if max_size < median_size * 1.15:
            # Not significantly larger — use first line instead
            for line in lines:
                if len(line) > 3 and len(line) < 200:
                    return line
            return None

    return title_line


def parse_pdf(filepath):
    """Parse PDF and return structured page data."""
    laparams = LAParams(
        line_margin=0.5,
        word_margin=0.1,
        char_margin=2.0,
        boxes_flow=0.5,
    )

    pages_data = []

    for idx, page_layout in enumerate(extract_pages(filepath, laparams=laparams)):
        lines, has_images, font_sizes = extract_page_content(page_layout)

        # Full page text
        full_text = '\n'.join(lines)

        # Detect title
        title = detect_title(lines, font_sizes)

        # Body lines (everything except title)
        body_lines = [l for l in lines if l != title] if title else lines

        pages_data.append({
            'index': idx,
            'text': full_text,
            'title': title,
            'bodyLines': body_lines,
            'hasImages': has_images,
        })

    return pages_data


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({'error': 'Usage: parse_pdf.py <filepath>'}), file=sys.stderr)
        sys.exit(1)

    filepath = sys.argv[1]
    if not Path(filepath).exists():
        print(json.dumps({'error': f'File not found: {filepath}'}), file=sys.stderr)
        sys.exit(1)

    try:
        result = parse_pdf(filepath)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
