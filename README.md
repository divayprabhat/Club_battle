# The Nth Move (Flappy Bird x verification puzzle)

1. **Research**: read the research passage (it changes every run) and enter the number of items in the verification round.
2. **Verify**: label that many random samples (text, news, audio, images) as human-made or AI-made.
3. **Fly**: every correct answer is one **attempt**. Each attempt is an endless full-screen Flappy-Bird run with unlimited flaps. A crash ends the attempt; after your last attempt, your **highest** score counts.

Score: 100 per gate, 50 per coin, multiplied by your watch level. Coins collected in one attempt power up the watch: 8 coins = level 2 (second form, x2), 18 = level 3 (third form, x3), 30 = level 4 (fourth form, x4). Gaps shrink and bars sit higher and lower as you progress.

- `src/game/sim.js`: pure game logic (endless gate generator, scoring). `npm run verify` searches 100 seeds to prove each street can be survived for 40 gates.
- `src/game/world.js`: Three.js scene (voxel city, pipes, coins built as the street streams in).
- `src/data.js`: question pool and research passages. `public/art`, `public/audio`: your media.
- The game screen fills the browser; the ⛶ button (or the first tap) enters browser full screen.

## v3.1 UI changes
- Menu background is now an animated pixel chase scene (runner with a glowing wrist-dial escaping alien creatures under saucers). `src/components/Backdrop.jsx`
- The Play button is a wrist-dial watch; tapping it (or SPACE) triggers a full-screen green warp transition into the Research page. `src/components/Watch.jsx`, `Warp` in `src/App.jsx`
- The Research page shows a research paragraph that contains the verification-set size.
- Optional: drop your own artwork at `public/art/background.jpg` and `public/art/watch.png`; they override the drawn versions automatically.

## v3.2 character update
- `public/art/ben.png`, `omnitrix.png`, `xlr8.png` are your supplied images (checkerboard backgrounds removed). Replace any file to restyle.
- Menu: the hero runs from the aliens in the background; the Play button is the watch image and still triggers the warp transition.
- Game: the flappy "bird" is the hero sprite (a crisp DOM sprite that follows the 3D physics body). Hearts are now spinning gold coins; each coin flies to the watch in the top-right HUD and charges it (green fill + n/N counter, pulses when full).
- Win: the hero transforms (flash + pop) into the alien form and dashes off with speed trails; the results screen shows the alien animated on a win.

## v3.3 content update
- Menu background is the supplied city image (`public/art/city.jpg`) with the hero and aliens running in front.
- `src/data.js`: `POOL` holds every question (7 news briefs from article_ACM.docx, 10 text passages from Futuristic_Tech_Arena.docx, AI audio clips, 2 placeholder images). `PASSAGES` holds five research passages that each state a count (4 to 8).
- Each run picks a random passage; that count is the number of questions, drawn at random from `POOL` and spread across media types. Levels with 2 to 8 flaps are verified winnable (`npm run verify`).
- Audio is played from `public/audio/` with a normal player. `clip-0023` and `clip-0024` are held out (`AUDIO_HOLD`) until their labels are confirmed.
- To add items: append to `POOL` (answer `'real'` = human-made, `'ai'` = AI-made).
- Fixed: audio questions crashed the quiz (missing useState import in Samples.jsx); added an error boundary in App.jsx.

- Forms: `public/art/ben.png`, `xlr8.png`, `alien3.png`, `alien4.png` (order and thresholds in `FORMS` / `TIERS` in `src/game/sim.js`).
