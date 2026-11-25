# Grammar Defenders

**Defend. Strategize. Master Grammar.**

An educational fantasy tower-defense game. Students deploy defenders, protect five battlefield lanes, and activate tactical powers by answering grammar challenges.

## Current milestone

The first browser prototype includes:
- Five-lane battlefield
- Defender selection and tile deployment
- Energy generation and deployment cost
- Automatically attacking defenders
- Enemies that advance toward the keep
- Base health and defeat condition
- Timed grammar challenges with tactical rewards
- Responsive layout for desktop and mobile

## Run locally

This project uses Phaser 3 from a CDN and native JavaScript modules. Because ES modules require a local web server, open the project with VS Code Live Server or run:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

## Controls

1. Select Grammar Sprout in the Defender Deck.
2. Click or tap an empty battlefield tile to deploy it (50 energy).
3. Defenders automatically attack enemies in their lane.
4. Answer grammar challenges correctly to trigger a battlefield power.
5. Keep enemies away from the keep.

## Planned development

1. Core battle prototype and visual polish
2. Defender and enemy roster, abilities, balancing
3. Question bank and teacher-controlled topics
4. Individual and cooperative classroom sessions
5. Teacher dashboard, QR/link joining, reports and progression

## Technology

- Phaser 3
- JavaScript ES modules
- HTML and CSS
- GitHub Pages hosting (planned)
- Firebase Realtime Database (planned for classroom features)

This is an early prototype. Classroom accounts, multiplayer, teacher tools, saving, and full audio are not implemented yet.
