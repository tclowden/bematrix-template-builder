# beMatrix SEG Template Builder

Local/static tool for generating Illustrator-friendly SEG template artboards from real width and height segments.

## Current version
- SEG only
- width segments in mm
- height segments in mm
- 0.125" bleed default
- SVG export for Illustrator
- CMYK-targeted production notes

## Run locally

```bash
cd bematrix-template-builder
python3 -m http.server 8032
```

Open `http://127.0.0.1:8032`.

## Deployment
This app is a static site and can be deployed directly to Vercel.
