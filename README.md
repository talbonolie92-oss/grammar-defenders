# Grammar Defenders

**Defend. Strategize. Master Grammar.**

A landscape-first fantasy lane-defense game where students deploy recognizable heroes, protect the keep, and answer grammar challenges to unleash tactical powers.

## Current playable milestone

- Five-lane, 16:9 landscape battlefield
- Selectable hero defenders with distinct silhouettes and weapons:
  - Grammar Sprout — balanced starter defender
  - Rune Archer — bow-wielding rapid ranged attacker
  - Frost Mage — crystal-staff caster who slows enemies
  - Aegis Guardian — armored shield hero who blocks and absorbs attacks in a lane
- Enemies with distinct Grunt, Runner, and Brute roles, illustrated bodies, and walking animation
- Energy-based deployment, automatic attacks, enemy health bars, and combat effects
- Ten-wave survival structure with escalating enemy strength
- Gatekeeper boss encounters on waves 5 and 10 with multiple phases
- Grammar questions appear periodically as a central battlefield overlay; combat pauses while students answer
- Twenty-four categorized grammar questions for middle- and upper-secondary learners
- Correct answers activate tactical powers; incorrect answers do not stop the battle
- Optional synthesized battle sound effects and responsive layout

## Controls

1. Choose a hero from the Defender Deck.
2. Click or tap an empty battlefield tile to deploy the hero.
3. Archers and mages automatically attack enemies in their lane.
4. Place Aegis Guardians to block enemies and protect a lane.
5. When a grammar challenge appears, choose an answer to resume the battle.

## Run locally

This project uses Phaser 3 from a CDN and native JavaScript modules. Because ES modules require a local web server, open the project with VS Code Live Server or run:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

## Roadmap

1. Refine character art, animation, battlefield readability, and combat balance
2. Expand the question engine and add teacher-controlled topic sets
3. Add individual and cooperative classroom sessions
4. Build the teacher dashboard, class rosters, QR/link joining, and reports
5. Connect Firebase Realtime Database for classroom data and multiplayer

## Technology

- Phaser 3
- JavaScript ES modules
- HTML and CSS
- GitHub Pages
- Firebase Realtime Database planned for classroom features

Teacher tools, student joining, cloud saving, and multiplayer are not implemented yet.
