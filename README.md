# Suborbital

The Suborbital game, a gravity-based game of orbital mechanics.

## Run locally

This project is a browser game built with Phaser 3.

1. Install dependencies:
   - `npm install`
2. From the repository root, run a static server (example):
   - `python3 -m http.server 4173`
3. Open `http://localhost:4173` in a browser.

## Gameplay

- A central sun pulls orbiting wireframe shapes inward.
- Click/tap to place a single gravity orb and alter trajectories.
- Save shapes by flinging them out of orbit before they fall into the sun.
- You lose after 3 shapes are consumed by the sun.
- New rounds add one extra shape (starting from 3).
- Total saved shapes unlock additional orb types in the orb selection menu.
