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
| segment `fx` | `flash`, `dip`, `punch`, `pull`, `shake`, `bw`, `strobe` (light flicker), `rgb` (colour split) |
| segment `audio` | Volume of the clip's own sound, default 0 (muted) |
| segment `text`, `text_pos`, `text_size`, `text_color`, `text_style` | Overlay for that segment; `center` / `top` / `bottom`; size multiplier; colour; `glitch` for red/cyan fringes |
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
