# TurboWarp: Site Maker (unofficial)

A standalone experimental .sb3 packager that exports Scratch projects as normal HTML DOM/SVG instead of a canvas/WebGL stage.

## Goal
- No <canvas> in exported projects
- No WebGL renderer
- SVG costumes become inline SVG
- Bitmap costumes become normal <img> elements
- Sprites are real DOM elements
- Stage coordinates remain 480×360 by default
- Generated HTML is inspectable/editable with browser developer tools
- The packager UI is inspired by the TurboWarp Packager layout, but this project is independent

## Current status
The first milestone is an SB3 reader and canvas-free DOM/SVG exporter. Scratch script execution is a later layer so the renderer can be tested independently.

## Run
Serve this directory locally, then open index.html. The app uses JSZip from jsDelivr to read SB3 ZIP files.

    python3 -m http.server 8000

Then open http://localhost:8000/.

This is unofficial and is not affiliated with TurboWarp or the Scratch Foundation.
