# Grammar Defenders

**Defend. Strategize. Master Grammar.**

A landscape-first fantasy lane-defense classroom game. Students deploy ten distinct defenders across five lanes, fight ten enemy types, and answer grammar challenges to activate battle powers.

## Game

- Landscape-first five-lane battlefield.
- Compact, horizontally scrolling defender deck above the battlefield.
- Ten defender characters with distinct battlefield silhouettes, palettes, costs, and roles.
- Ten enemy types with different colors, shapes, health, and combat behaviors.
- Endless Survival and Fixed Waves modes.
- Teacher-selected duration, difficulty, and grammar-question interval.
- Regular grammar questions and harder boss challenges.
- Original synthesized background music and separate sound effects controls.

## Teacher dashboard

Open **[Teacher Dashboard](./teacher-dashboard.html)**.

The dashboard is designed for authenticated teachers and includes:

- Email/password teacher sign-in.
- Create, list, search, rename, edit, start, end, and delete your own sessions.
- Session settings: title, grade, class/section, topic, game mode, time limit, question interval, and difficulty.
- Session-specific student QR code and shareable joining link.
- Live student roster.
- Fix a student's name or class/section; remove a student from a session.
- Basic and detailed performance reports, topic accuracy, commonly missed questions, and CSV export.
- Ended sessions remain in session history until the teacher deletes them.

## Student joining

1. Teacher creates a session in the dashboard.
2. Students scan the session QR code or open its link.
3. Students enter their name and class/section. They do not need an email or password.
4. Students wait in the lobby until the teacher starts the session.
5. Game settings are loaded from the session. Late joining follows the teacher's setting.
6. The game saves question attempts and each student's final performance to the session report.

## Firebase setup required

The teacher dashboard, student lobby, live roster, and saved reports use Firebase Authentication and Realtime Database. The UI and integration code are in the repository, but a Firebase project has not yet been connected.

1. Create a Firebase project for Grammar Defenders.
2. In **Authentication → Sign-in method**, enable **Email/Password** and **Anonymous**.
3. In **Authentication → Users**, add the teacher account email and password. Do not put the teacher password in this repository.
4. Create a **Realtime Database**.
5. Register a Firebase **Web app** in Project settings and copy its web configuration into `src/firebase-config.js`.
6. Use the exact `databaseURL` shown for your Realtime Database (it may include a regional hostname).
7. In Realtime Database → Rules, paste and publish the rules from `database.rules.json`.
8. Open `teacher-dashboard.html` and sign in with the teacher account.

The Firebase web configuration is intended to be included in a browser app. Never put a Firebase service-account private key or Admin SDK credentials in this repository.

## Database layout

```
teacherSessions/{teacherUid}/{sessionId}
sessions/{sessionId}/public
sessions/{sessionId}/players/{studentUid}
sessions/{sessionId}/attempts/{attemptId}
sessions/{sessionId}/results/{studentUid}
```

Rules keep teacher session indexes and private rosters/results scoped to the authenticated teacher. Students use anonymous authentication and can write only their own player/result records. Session settings are readable by the joining game so it can load the teacher's configuration.

## Local development

Run a local web server because the project uses native JavaScript modules:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Validation

```bash
node scripts/validate-data.mjs
```

GitHub Actions also checks JavaScript syntax and question-bank data on pushes to `main`.

## Technology

- Phaser 3
- JavaScript ES modules
- Firebase Authentication
- Firebase Realtime Database
- GitHub Pages
