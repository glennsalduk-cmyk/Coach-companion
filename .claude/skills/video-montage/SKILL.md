---
name: video-montage
description: Cut the user's raw day-in-the-life clips (cooking, shakers, getting dressed, going to the gym, lifting hard) into a dark, fast, cinematic montage of 2 minutes maximum, synced to the beat. Use when the user sends video clips or rushes and asks for a montage, an edit, a reel, "montage vidéo", "monte-moi ça", or invokes /video-montage.
---

# Video montage — dark, fast, cinematic

Turn a pile of raw phone clips into one edit: **120 s hard maximum**, dark grade, cuts on the beat,
building from a quiet morning to the heaviest lift. Everything runs through
`.claude/skills/video-montage/scripts/montage.py` (ffmpeg + Python stdlib, no installs).

Folders (all git-ignored): clips in `montage/input/`, optional music in `montage/music/`,
scratch in `montage/work/`, result in `montage/output/`.

## The user's standing brief (overrides the generic structure in step 4)

- **30 to 45 seconds.** Set `"max_duration": 45` in the EDL.
- **First 5 seconds = intro**: rapid motivational flashes of trophies, the gym, details, ½-beat cuts.
- **Then the drop: the session.** Hard hit on the first gym shot, then lifting only gets faster.
- **End on the physique** (posing / pump shot, the one place a shot may breathe for 2–4 beats).
  The user's dictated wording was ambiguous ("on quitte sans le physique"); confirm once if not yet settled.
- **Every clip is seen very briefly**: ½–1 beat per shot, use as many different clips as possible,
  never the same moment twice.
- **Dark and aggressive**: crush the image (`fx: dark` on anything bright), play with light
  (`pulse`, `strobe`, `glow`, `flash`), and put a transition on almost every cut. Editing intensity
  is the priority; restraint is not wanted here.
- **Big motivational text that slams in** ("mode push"): full-width words (`size` 3–6, `slam`) over
  the footage on the first beat of a bar, one or two words each, **in English**, and **never boastful**: the user does not want to show off (no "1ST", "EARNED", "THE RESULT"). Use keep-going wording — GET READY, PUSH, ONE MORE, KEEP PUSHING, DO IT AGAIN, KEEP GOING, KEEP DOING IT, NOT DONE YET — alternating white / red
  (`0xE01010`) and plain / `glitch` / `outline`; a slower `push` line over the physique.
- **Pace**: ½-beat cuts (0.2 s at 150 BPM) are the norm in the session, with ¼-beat (0.1 s) bursts
  of 8 shots at the end of every other bar. Use a small generator script in `montage/work/` to
  build EDLs of 100+ segments from a pool of moments rather than writing them by hand.
- The gym footage is backlit (dark clothes under white ceiling lights): `dark` on gym shots, never on
  the physique or detail shots, or the subject disappears.
- The user adds their own music afterwards: cut to a fixed grid (default 150 BPM synth score as a
  guide track), tell them the BPM used, and offer to re-cut to their track's tempo if they send it.

## 1. Gather

- Put every clip the user sent into `montage/input/`. If there are none yet, ask for them and stop.
- Music: a track the user supplies and has the rights to use goes in `montage/music/`. Never download
  commercial music. With no track, leave `"music"` out of the EDL and the script synthesises an
  original dark score (drone, then kick, then hats) at the EDL's `bpm`.
- Don't ask about style: the brief below is the default. Only ask if the format is truly ambiguous
  (mixed vertical and horizontal clips with no majority).

## 2. Watch the footage

```bash
python3 .claude/skills/video-montage/scripts/montage.py probe montage/input
```

This prints per-clip duration, orientation, fps, audio and HDR flags, and writes a contact sheet per
clip to `montage/work/sheets/`. **Read every sheet.** Each frame is stamped with its timestamp in
seconds, which is what you use for `in` points. For a long clip where the action is between frames,
re-run with `--step 0.5 --max-frames 60`.

Log each clip: category (`food`, `shaker`, `dress`, `transit`, `gym`), its best moments with
timestamps, and what makes them usable (movement, a face, hands, a detail, peak effort). Clips at
60 fps or more can go to `speed: 0.5` cleanly; 30 fps clips should not go below 0.7.

## 3. Get the beat grid

```bash
python3 .claude/skills/video-montage/scripts/montage.py beats montage/music/track.mp3
```

Returns `bpm`, `beat` (seconds per beat) and the beat times. Set `music_start` so the timeline's
t=0 lands on a beat (usually `first_beat`, or the start of the section you want). With the synth
score, beat *k* is at `k * 60 / bpm`, the kick enters at beat 8 and the hats at beat 16.

**Distrust the reported BPM.** The detector can lock onto a 4:3 or 2:1 alias (it reported 144 for a
108 BPM track). Fold the onsets over the candidate beat: if they pile up at three evenly spaced
points per beat, the real grid is finer — find the smallest tick every onset lands on (the sixteenth
note) and cut in multiples of that tick. After rendering, re-measure the output's audio against the
tick and confirm onsets sit within one frame of the cut grid.

If the user's track is shorter than the film (TikTok rips often are, and end with the app's jingle:
trim it off), loop it by whole 4- or 8-bar phrases with a ~12 ms crossfade and say where the splice is.

**Every segment `dur` must be a multiple of the beat** (½, 1, 2, 4 beats). That is what makes the
edit feel tight, so compute durations from `beat`, never by eye.

## 4. Build the edit

Structure, as shares of the total runtime (aim for 60–110 s; shorter beats padded):

| Part | Share | Content | Cut length |
|---|---|---|---|
| Cold open | 3–5 % | The single hardest gym frame, flash-cut, then black with a time or title | ½–1 beat |
| Wake / fuel | 20 % | Cooking: hands, knife, pan, steam, plating. Details over wide shots | 2–4 beats |
| Shaker | 10 % | Scoop, pour, shake, drink. A motion match from shake to the next shot | 1–2 beats |
| Suit up | 10 % | Clothes, shoes, bag, door | 1–2 beats |
| Transit | 5–10 % | Street, car, gym door. Sped up 2–4× | 1 beat |
| Gym build | 25 % | Warm-up, loading plates, chalk, first sets | 1 beat |
| Climax | 20 % | Heaviest lifts. Alternate slow-motion peak effort with ½-beat bursts | ½–2 beats |
| Outro | 3 % | Black card, 2–3 words | 2–3 s |

Rules that make it work:

- Pace only ever accelerates until the climax; never return to long cuts after short ones.
- Cut on movement, start each shot after the action has begun, leave before it ends.
- Never use the same moment twice. Never hold a static shot longer than 4 beats.
- Slow motion is for the hardest rep only; use it two or three times in the whole film.
- `flash` on drops and on the first cut of a new part; `shake` on impacts (bar hitting the floor,
  lockout); `punch` on calm detail shots; at most one effect per shot, and most shots get none.
- Text is rare: an opening time stamp, at most three one-word titles (uppercase), the outro card.
- Keep real sound (`"audio": 0.4–0.8`) on shots where it hits: sizzle, shaker rattle, plates, a grunt.
  Everything else stays silent under the music.

### Style references

The user shared three TikTok edits as the target feel. Pick one direction per film (or ask which,
if they have not said) and borrow the grammar, never the footage, wording or lyrics:

| Direction | What defines it | How to get it |
|---|---|---|
| **Night green** (vertical) | Deep green-teal grade, hoodie silhouette, slow confident cuts of 2 beats at ~90 BPM, shots framed through foreground objects, establishing shots (street lamp, gym sign), hand and weight-pin details, one small tagline held all film | `look: green`, `tagline`, few effects, `punch` on details |
| **Countdown** (horizontal) | Near-black gym shots alternating with huge one-word cards on black, ½–1 beat each at ~160 BPM, light flicker, colour-fringed text, cards growing as it builds, ending on a hero shot under one hard light | black cards with `text_style: glitch` and rising `text_size`, `strobe`, `rgb`, `look: dark` or `noir` |
| **Blue lyric** (horizontal) | Cold blue grade, low wide-angle shots, long slow-motion takes with very few cuts, words landing one by one on the beat in white with occasional dark red | `look: steel`, `speed: 0.5`, top-level `titles` timed on beats, `color: 0x8B0000` for accents |

For the user's day-in-the-life film, the morning parts suit Night green pacing and the gym climax
suits Countdown pacing; keep a single look across the whole film.

Transition recipes (pair the out-effect of one shot with the in-effect of the next):

- **Zoom-through**: `snapout` → `snapin`. The default cut inside the session.
- **White hit**: `flashout` → `flash`. For drops and the intro → session switch.
- **Black hit**: `blackout` → `dip`, or a ½-beat black card in between.
- **Speed ramp**: split one moment in two segments, `speed: 3` for ½ beat then `speed: 0.5` for
  2 beats starting where the first ended (60 fps source only for the slow half).
- **Impact**: `neg` + `shake` on lockouts and plates hitting the floor.
- Vary them; never use the same transition three cuts in a row.

Write the EDL to `montage/work/edl.json` (paths are relative to the EDL file or absolute):

```json
{
  "format": "vertical",
  "look": "dark",
  "music": "../music/track.mp3",
  "music_start": 12.4,
  "music_volume": 1.0,
  "segments": [
    {"src": "../input/IMG_0412.mov", "in": 14.2, "dur": 0.4, "fx": ["flash", "shake"]},
    {"black": true, "dur": 0.8, "text": "05:12"},
    {"src": "../input/IMG_0398.mov", "in": 3.0, "dur": 1.6, "fx": ["punch"], "audio": 0.6},
    {"src": "../input/IMG_0412.mov", "in": 20.0, "dur": 1.6, "speed": 0.5, "text": "PUSH", "text_pos": "bottom"}
  ],
  "outro": {"text": "EVERY\nDAY", "dur": 2.4}
}
```

| Field | Meaning |
|---|---|
| `format` | `vertical` 1080×1920 (default), `horizontal` 1920×1080, `square`. Clips are centre-cropped to fill |
| `look` | `dark` (default, teal shadows), `green` (night green-teal), `steel` (cold blue), `noir` (black and white), `none` |
| `music`, `music_start`, `music_volume` | Track, offset into it in seconds, gain. Omit `music` and set `bpm` (default 150) for the synth score |
| `grain`, `vignette`, `letterbox` | Grain strength (default 10, 0 = off), vignette (default on), black bars (default on for horizontal only) |
| `fade_in`, `fade_out` | Seconds, default 0 and 0.8 |
| segment `in`, `dur`, `speed` | Source start, **timeline** duration, playback speed. Source used = `dur × speed` |
| segment `fx` | Cut in: `flash` (white), `dip` (from black), `neg` (2-frame negative), `snapin` (hard zoom settling). Cut out: `flashout`, `blackout`, `snapout` (hard zoom into next shot). `glitch` (colour tear on the cut). Light: `pulse` (surge on each beat), `strobe`, `glow` (bloom), `dark` (crush a bright shot). Motion: `punch`, `pull`, `shake`, `zoompulse` (zoom bump on each beat), `trail` (ghosting). Colour: `bw`, `red` (blood-red mono), `rgb` (colour split). Shots of 0.1 s only take colour effects |
| `beat` | Seconds per beat, used by `pulse`; defaults to `60 / bpm` |
| segment `audio` | Volume of the clip's own sound, default 0 (muted) |
| segment `text`, `text_pos`, `text_size`, `text_color`, `text_style` | Overlay for that segment; `center` / `top` / `bottom`; size multiplier; colour; style words combine: `slam` (lands from huge), `push` (keeps growing), `outline` (heavy stroke), `glitch` (red/cyan fringes). Text is auto-shrunk to fit the frame width, so sizes of 3–6 mean "full width" |
| `score` | Sections of the built-in score: `{"build": s, "drop": s, "break": s}` — sparse intro, riser from `build`, full drums/808/cowbell from `drop`, half-time from `break`. Align them with the film's parts |
| `titles` | Free overlays not tied to a cut: `[{"text", "at", "dur", "pos", "size", "color", "style"}]`, `at` in timeline seconds |
| `tagline`, `tagline_from` | Small centred line held over the whole film (outro excluded), and when it appears |
| `{"black": true, "dur": …}` | Black card, usually with `text` |

## 5. Render, check, deliver

```bash
S=.claude/skills/video-montage/scripts/montage.py
python3 $S render montage/work/edl.json --preview -o montage/output/preview.mp4   # fast, half-res
python3 $S render montage/work/edl.json -o montage/output/montage.mp4             # final
```

The render refuses any timeline over 120 s; trim the weakest shots rather than shortening good ones.

After the preview, check it before the final render:

```bash
ffmpeg -y -v error -i montage/output/preview.mp4 -vf "fps=2,scale=-2:320,tile=12x10" -frames:v 1 montage/work/check.jpg
```

Read `check.jpg` and fix what you see: wrong moment, a shot that is too dark to read after grading
(pick another shot, or switch that film to `look: steel`), text over a face, a repeated shot, a slow
stretch late in the film. Then render the final and send it with SendUserFile, with a short note: the
duration, the track or synth score used, and the structure you chose. You cannot hear the result, so
say that beat sync is computed, not listened to, and ask the user to confirm it lands.

Revisions are edits to `edl.json` followed by a re-render; keep the EDL so "faster", "more gym" or
"change the ending" are small changes.
