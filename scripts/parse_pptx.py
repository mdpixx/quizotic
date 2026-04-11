#!/usr/bin/env python3
"""Parse a PPTX file: render slides as images + extract text for AI context.

Usage: python3 parse_pptx.py <path-to-pptx> <output-dir>

1. Converts PPTX -> PDF -> PNG images using LibreOffice + pdftoppm
2. Extracts text per slide using python-pptx
3. Outputs JSON to stdout with image paths + text metadata
"""

import json
import os
import subprocess
import sys
from pathlib import Path

from pptx import Presentation
from pptx.util import Pt
from pptx.enum.shapes import MSO_SHAPE_TYPE, PP_PLACEHOLDER


def render_slides_as_images(pptx_path, output_dir):
    """Convert PPTX -> PDF -> PNG images. Returns list of image paths in order."""
    pdf_path = os.path.join(output_dir, 'slides.pdf')

    # Step 1: PPTX -> PDF via LibreOffice
    result = subprocess.run([
        'libreoffice', '--headless', '--norestore', '--convert-to', 'pdf',
        '--outdir', output_dir, pptx_path
    ], capture_output=True, text=True, timeout=60)

    if result.returncode != 0:
        print(f'LibreOffice error (rc={result.returncode}): {result.stderr}', file=sys.stderr)

    # LibreOffice names the output based on input filename
    input_name = Path(pptx_path).stem
    lo_pdf = os.path.join(output_dir, f'{input_name}.pdf')
    if os.path.exists(lo_pdf) and lo_pdf != pdf_path:
        os.rename(lo_pdf, pdf_path)

    if not os.path.exists(pdf_path):
        print(f'PDF not created. LibreOffice stdout: {result.stdout}, stderr: {result.stderr}', file=sys.stderr)
        return []

    # Step 2: PDF -> PNG images via pdftoppm
    pdf_result = subprocess.run([
        'pdftoppm', '-png', '-r', '200', pdf_path,
        os.path.join(output_dir, 'slide')
    ], capture_output=True, text=True, timeout=60)

    if pdf_result.returncode != 0:
        print(f'pdftoppm error (rc={pdf_result.returncode}): {pdf_result.stderr}', file=sys.stderr)

    # Collect generated images in order
    images = sorted(
        [f for f in os.listdir(output_dir) if f.startswith('slide-') and f.endswith('.png')],
        key=lambda f: int(f.replace('slide-', '').replace('.png', ''))
    )

    return [os.path.join(output_dir, img) for img in images]


def extract_text(pptx_path):
    """Extract text per slide using python-pptx. Returns list of slide metadata."""
    prs = Presentation(pptx_path)
    slides_text = []

    for idx, slide in enumerate(prs.slides):
        layout_name = slide.slide_layout.name if slide.slide_layout else 'Unknown'
        shapes = list(slide.shapes)
        placeholders = list(slide.placeholders)

        title = None
        subtitle = None
        body_lines = []

        for ph in placeholders:
            if not ph.has_text_frame:
                continue
            ph_type = ph.placeholder_format.type if ph.placeholder_format else None
            ph_idx = ph.placeholder_format.idx if ph.placeholder_format else None

            if ph_type in (PP_PLACEHOLDER.TITLE, PP_PLACEHOLDER.CENTER_TITLE) or ph_idx == 0:
                text = ph.text_frame.text.strip()
                if text:
                    title = text
            elif ph_type == PP_PLACEHOLDER.SUBTITLE or ph_idx == 1:
                text = ph.text_frame.text.strip()
                if text:
                    if 'title' in layout_name.lower() or 'section' in layout_name.lower():
                        subtitle = text
                    else:
                        body_lines.append(text)
            elif ph_type in (PP_PLACEHOLDER.BODY, PP_PLACEHOLDER.OBJECT) or (ph_idx is not None and ph_idx >= 2):
                for para in ph.text_frame.paragraphs:
                    text = para.text.strip()
                    if text:
                        indent = '  ' * (para.level or 0)
                        body_lines.append(f'{indent}{text}')

        # Non-placeholder shapes
        for shape in shapes:
            if shape in placeholders:
                continue
            if shape.has_text_frame:
                text = shape.text_frame.text.strip()
                if text and len(text) > 5:
                    body_lines.append(text)

        # Tables
        for shape in shapes:
            if shape.has_table:
                table = shape.table
                for row in table.rows:
                    cells = [cell.text.strip() for cell in row.cells]
                    body_lines.append(' | '.join(cells))

        # Speaker notes
        notes = None
        if slide.has_notes_slide:
            notes_text = slide.notes_slide.notes_text_frame.text.strip()
            if notes_text and len(notes_text) > 2:
                import re
                if not re.match(r'^\d+$', notes_text) and not re.match(r'^slide\s*\d*$', notes_text, re.IGNORECASE):
                    notes = notes_text

        # If no title, use first body line
        if not title and body_lines:
            title = body_lines[0]
            body_lines = body_lines[1:]

        # Build full text for AI context
        parts = []
        if title:
            parts.append(title)
        if subtitle:
            parts.append(subtitle)
        parts.extend(body_lines)
        if notes:
            parts.append(f'[Notes: {notes}]')

        slides_text.append({
            'index': idx,
            'title': title,
            'subtitle': subtitle,
            'bodyText': '\n'.join(body_lines),
            'speakerNotes': notes,
            'fullText': '\n'.join(parts),
            'layoutName': layout_name,
        })

    return slides_text


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({'error': 'Usage: parse_pptx.py <filepath> <output_dir>'}), file=sys.stderr)
        sys.exit(1)

    filepath = sys.argv[1]
    output_dir = sys.argv[2]

    if not Path(filepath).exists():
        print(json.dumps({'error': f'File not found: {filepath}'}), file=sys.stderr)
        sys.exit(1)

    os.makedirs(output_dir, exist_ok=True)

    try:
        # Extract text
        text_data = extract_text(filepath)

        # Render images
        image_paths = render_slides_as_images(filepath, output_dir)

        # Combine: pair each slide's text with its image path
        result = []
        for i, text_info in enumerate(text_data):
            result.append({
                **text_info,
                'imagePath': image_paths[i] if i < len(image_paths) else None,
            })

        print(json.dumps(result, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        sys.exit(1)
