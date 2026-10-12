# LOG - scout-ring

## 2026-10-12 - intake, story, look, storyboard
- Intake: pixel style, 16:9 only, ~28s, a tiny pilot in the canopy, a fictional planet, music composed in code, no voice.
- Story approved first time: F5 fixed-hero journey, 7 beats, the planet as the odd star that ends behind the ship.
- Look check, round 1 (self-review before showing): the far planet was invisible at small sizes (a backlit crescent too thin) -> FAR_LIFT brightens small planets; the purple nebula competed with the planet's colour -> nebula made cool (night + blue); the kit's pixHero does not scale to a face-sized close-up (floating ears, near-black eyes) -> a dedicated close-up face; the sun floated in space -> moved onto the planet's limb, backlit; the tiny pilot's eyes sat under the hull line -> pilot raised, canopy taller, PILOT_R 4.
- Look check, user: frames 1, 2, 4 up; 3 down: "Cat head too round, looks more like rubber ball than head". Fix: src/pilot.js, a squarish cat head (superellipse, flat top, cheek tufts, narrower chin), white muzzle, nose, whiskers, tabby stripes, brows, a flight suit with an orange "07" patch; the glass reflection drawn under the face (a reflection only shows over dark glass). Approved.
- Storyboard (13 panels), self-review before showing: the dive read as a second asteroid belt -> ring sheets above and below a corridor; the home planet shrank to a dot too early -> linear shrink to a star by 27.75; the ring gap widened (1.88-2.08 radii); the far-planet halo showed as a dotted box above r 6 -> limited to star size. Approved by the user on the first showing.
- Tooling notes: tools/tile.mjs draws 9:16 tiles (270x480), so 16:9 frames come out squashed in tiles; its determinism check still holds (deterministic: true across every cut). ffmpeg was installed during the session; the shell PATH did not have it yet, so export/review run with its bin folder prepended.

## 2026-10-12 - build, export, review
- Export: 672 frames in 10.8s (16-18 ms/frame), audio + stems, renders/final.mp4 and renders/share.mp4; 35s total.
- Review run 1: every picture check passed, but the loudest 100ms window was the 12.5s sub (the scale reveal), not the payoff, and the travel/journey median (-37 dB) sat below the opening hold (-21 dB). Fix: the 12.5s sub 0.5 -> 0.2, the riser down, the burst stab and sub up, a soft chord bed per bar under the groove, the hold pad thinner. Iterated with export --only-audio.
- Review run 2: cuts 15/15 on the grid (16ths 12.0-12.5); story arc 6/6; anchor 300/300 frames (max offset 36px of 40); text PASS; dead beats PASS; loudest window 19.0s (-7.8 dBFS) in the payoff, 2.0s at <= -40 dBFS before it; -14.7 LUFS integrated, true peak -1.0 dBFS, range 13.4 LU.
- Checked by eye beyond the sheets: frames 454-461 around the burst cut (full white on f456-457, then the dither thins over four frames).

| shot | t | what the sheet shows | result |
|---|---|---|---|
| 1 cruise | 0-6 | asleep pilot, odd pink star, "!" at 1.5, throttle at 2.0, streaks, the star swells, RANGE counts | PASS |
| 2 asteroids | 6-8 | belt drifts, the rock passes under the scout at 7.0 as it hops, near rock sweeps through | PASS (hop is subtle, 6 px) |
| 3 moon | 8-10 | cratered moon slides past below, outpost light blinks | PASS |
| 4 comet | 10-11 | comet crosses above, the pilot's eyes follow | PASS |
| 5-11 approach | 11-12.5 | the planet grows every cut, the scout pinned, HUD complete on every first frame | PASS |
| 12 wide | 12.5-14.5 | the planet fills the frame, the speck heads for the gap, ring glints, far moon | PASS (speck small by design) |
| 13 pilot | 14.5-16 | cat close-up, reflection on dark glass only, blink then gulp at 15.0 | PASS |
| 14 dive | 16-19 | corridor between ring sheets, ice drifting, the far end glows from 18.25 | PASS |
| 15 burst | 19-24 | white flash, sun over the limb, gold rings, cheer, roll at 21.0, glide | PASS |
| 16 home | 24-28 | the opening framing, the planet behind (day side) shrinking to the pink star, the log types on | PASS (the wave is too small to read) |

- Weakest shot: 16 home. The pilot's wave is a 3x3 paw on a 9-pixel pilot and does not read at viewing size; the beat leans on the log line. A fix would be a short cut to the close-up pilot waving, or a bigger gesture (the whole ship waggling its wings).
- Not verified: the score by ear (only measured), and the piece on a phone (16:9 only, so not a Shorts/Reels shape).

## 2026-10-12 - user review of the first cut, and the rework
- User: "No sounds" and "some transitions between scenes are non-existent, eg. meteors appear and after couple seconds just disapear in instant ... looks like multiple scenes just stiched up togeteher without good continunity."
- Sound: the files carried audio at a normal level (AAC-LC stereo, mean -17.8 dB); the user's default output device was at 0% and muted. Separately, the effects sat 15-25 dB under the music (sfx stem mean -37.8 dB vs music -17.8 dB), so even unmuted only the music would have read.
- Continuity: the cause was structural. F5's accelerating cuts gave each journey shot its own world (the belt fully on screen on its first frame, gone on the cut; the planet jumping in size every approach cut), but this story is one continuous flight through one space.
- Rework: the journey 0-12.5 is one shot on a world clock (distTable): every rock, the moon and the comet has a world position and enters and leaves the frame on its own; the planet grows geometrically through keys. The dive opens on the plunge (the sheets' leading edge sweeps in), the engine cuts at the hush for the silent glide. Sunlight and home are one shot: the planet shrinks back behind the scout (rising late so its rings pass under the scout), the sun sets behind it, the stars and nebula come back, the scout settles into its opening spot. Cuts 15 -> 4, all camera changes.
- Sound: an engine (saw hum + noise roar) follows the throttle through the piece; rock thuds driven by the same BELT data as the picture; effects about +10 dB; the comet and roll whooshes raised again after measuring.
- Review: cuts 4/4 on the grid; story arc 3/3 (no peak role: the busiest stretch has no cuts); anchor 300/300 (max 36 px of 40); text PASS; dead beats PASS; loudest window 19.0s (-8.1 dBFS) with 2.0s at <= -40 dBFS before it; -14.8 LUFS, true peak -1.0 dBFS; sfx stem mean -25.1 dB vs music -18.5 dB, effects peaking within about 1-8 dB of the music.
- Weakest moment now: the home wave (a 3x3 paw on a 9-pixel pilot) still does not read; around 24.0-24.5 the receding planet's ring passes just behind the scout's tail.

## 2026-10-12 - the scout-run game
- A separate page, game/index.html, plays the film and flows from its last frame into an endless belt dodger and
  shooter built from the film's own art (design and plan in docs/superpowers/).
- The art is reused, not copied: game/build.mjs joins the piece's src/ files with a vendored copy of the animate kit
  and the game's files. The film page and its export are untouched (same sha256 after a rebuild).
- Measured before building: the film's nebula costs 14 ms a frame and its CRT pass 3.7 ms, so the game caches both
  (a column-by-column nebula, a pre-drawn post overlay); the seam check confirms the game's first frame matches the
  film's last.
