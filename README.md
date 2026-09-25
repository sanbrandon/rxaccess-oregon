# RxAccess Oregon

An interactive Oregon pharmacy-access research website with pharmacy-desert tracts, population-density and vulnerability views, and separate layers for regular pharmacies, prescription lockers, prescription kiosks, and remote-dispensing sites.

## Website

This is a static HTML, CSS, and JavaScript site. GitHub Pages serves the repository root from the `main` branch; no build step is required. `.nojekyll` keeps the static files unchanged.

## Scope and limitations

The site preserves the September 2026 research baseline. Population source-year provenance remains unresolved, and pharmacy and locker coordinates are approximate and require validation. The map is not a verified live pharmacy directory or a patient-specific access recommendation.

On-page Data & Methods explains the source periods, classification rules, limitations, and planned upgrades. Alternative access-point display layers do not recalculate desert classifications.

## Repository contents

Only the website and the JSON/GeoJSON needed to render its interactive map are included. Original research files, baseline CSV exports, the source manifest, credentials, and previous development history are excluded.

The website has no standalone file-download controls. This is a public repository and the browser receives the map data, so its contents remain accessible and copyable.
