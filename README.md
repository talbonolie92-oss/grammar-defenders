# Grammar Defenders

**Defend. Strategize. Master Grammar.**

A mobile-friendly, landscape-first fantasy lane-defense game where students deploy heroes, defend five lanes, and answer grammar challenges to unleash tactical powers.

## Current playable milestone

- Landscape-first 16:9 battlefield with a compact horizontal defender deck at the bottom on mobile
- Teacher setup screen for game mode, time limit, question interval, and difficulty
- Teacher-generated student links that launch directly with the selected settings
- Endless Survival and Fixed Waves modes
- Ten defender tiers with increasing energy costs and different roles:
  - Grammar Sprout — balanced starter defender
  - Rune Archer — rapid ranged attacks
  - Aegis Guardian — lane blocker
  - Frost Mage — slows enemies
  - Ember Mage — splash damage
  - Volt Beast — chain shock
  - Thorn Dragon — heavy single-target damage
  - Iron Knight — heavy lane blocker
  - Solar Phoenix — area damage
  - Ancient Titan — ultimate fortress
- Ten enemy tiers with increasingly dangerous silhouettes and combat profiles:
  - Grunt, Runner, Brute, Shadow Stalker, Bone Warrior
  - Venom Beast, Dark Caster, War Crusher, Dread Beast, Dark Overlord
- Enemy roster cycles during Endless Survival, with increasing health and speed
- Boss encounters trigger a separate advanced grammar question
- Correct boss answers activate stronger powers such as freeze, critical strike, guardian shield, energy surge, and dragon fury
- Regular grammar challenges default to every 45 seconds; teachers can choose 30, 45, 60, or 90 seconds
- Twenty-four regular questions and ten advanced boss questions
- Original synthesized looping fantasy background music plus separately controlled sound effects
- Energy-based deployment, automatic attacks, enemy health bars, and combat effects

## Teacher setup and student links

1. Open the game.
2. Choose Endless Survival or Fixed Waves.
3. Select the time limit, grammar interval, and difficulty.
4. Select **Copy Student Link** and share the generated link with students.
5. Students opening that link go straight into the game with the teacher's selected settings.

The student link locks the selected game settings in its URL. The current build does not yet authenticate teachers, record student identities, save results to Firebase, or provide a QR-code dashboard. Those classroom-management features remain future work.

## Controls

1. Choose a hero from the Defender Deck.
2. Tap an empty battlefield tile to deploy the hero.
3. Defenders attack automatically; special heroes have different combat abilities.
4. When a grammar challenge appears, choose an answer to resume the battle.
5. Correct boss answers provide stronger battle boosts.

## Run locally

This project uses Phaser 3 from a CDN and native JavaScript modules. Because ES modules require a local web server, open the project with VS Code Live Server or run:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000.

## Validate question data

Run:

```bash
node scripts/validate-data.mjs
```

## Technology

- Phaser 3
- JavaScript ES modules
- HTML and CSS
- GitHub Pages
- Firebase Realtime Database planned for future teacher accounts, classroom sessions, and reports
