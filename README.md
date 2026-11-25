# Grammar Defenders

**Defend. Strategize. Master Grammar.**

An educational fantasy tower-defense game. Students deploy defenders, protect five battlefield lanes, and activate tactical powers by answering grammar challenges.

## Current playable build

The browser game currently includes:
- Five-lane battlefield with tile-based defender placement
- Three selectable defender classes: Grammar Sprout, Rune Archer, and Frost Mage
- Energy costs, automatic attacks, ranged projectiles, and enemy rewards
- Three enemy archetypes: Grunt, Runner, and Brute, each with different combat behavior
- Ten-wave survival structure with escalating enemy strength
- Gatekeeper boss encounters on waves 5 and 10, including multi-phase behavior
- Keep health, defeat/victory conditions, and restart flow
- Twenty-four categorized grammar questions across middle- and upper-secondary topics
- Correct-answer tactical power and optional synthesized battle sound effects
- Responsive HTML/CSS shell and Phaser 3 battlefield

## Controls

1. Select a defender in the Defender Deck.
2. Click or tap an empty battlefield tile to deploy it.
3. Defenders automatically attack enemies in their own lane.
4. Answer grammar challenges to trigger a battlefield power.
5. Protect the keep until the final wave is cleared.

## Run locally

This project uses Phaser 3 from a CDN and native JavaScript modules. Because ES modules require a local web server, open the project with VS Code Live Server or run:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

## Development roadmap

1. Complete and polish the core battle experience
2. Expand and balance defender/enemy abilities and progression
3. Add configurable question sets and teacher-controlled topics
4. Add individual and cooperative classroom sessions
5. Build teacher dashboard, QR/link joining, class rosters, reports, and progression
6. Connect Firebase Realtime Database and harden classroom data access

## Technology

- Phaser 3
- JavaScript ES modules
- HTML and CSS
- GitHub Pages deployment
- Firebase Realtime Database planned for classroom data and multiplayer

The current build is an active development milestone. Teacher tools, cloud saving, student joining, and multiplayer are not yet implemented.
