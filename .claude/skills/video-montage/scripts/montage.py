#!/usr/bin/env python3
"""Dark cinematic montage toolkit (ffmpeg + Python stdlib only).

Commands:
  probe  <dir>            clip metadata + timestamped contact sheets to look at
  beats  <music>          tempo + beat grid of a music track
  render <edl.json>       render the edit decision list to an mp4 (hard cap 120 s)

See ../SKILL.md for the EDL format and the editing method.
"""
import argparse
import array
import json
import math
import os
import shutil
import subprocess
import sys

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm", ".mts", ".3gp"}
FORMATS = {"vertical": (1080, 1920), "horizontal": (1920, 1080), "square": (1080, 1080)}
HARD_CAP = 120.0
FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf",
    "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]
LOOKS = {
    # crushed blacks, desaturated, teal shadows / warm highlights
    "dark": "eq=contrast=1.22:brightness=-0.05:saturation=0.62:gamma=0.95,"
            "colorbalance=rs=-0.06:bs=0.07:rh=0.05:bh=-0.05,"
            "curves=all='0/0 0.12/0.05 0.5/0.47 1/0.97'",
    # deep green-teal, sodium-lamp gym at night
    "green": "eq=contrast=1.20:brightness=-0.06:saturation=0.55:gamma=0.95,"
             "colorbalance=rs=-0.08:gs=0.05:bs=0.01:rm=-0.04:gm=0.03:rh=0.04:bh=-0.06,"
             "curves=all='0/0 0.12/0.04 0.5/0.46 1/0.96'",
    # cold blue steel
    "steel": "eq=contrast=1.25:brightness=-0.06:saturation=0.45:gamma=0.94,"
             "colorbalance=rs=-0.10:bs=0.12:rm=-0.04:bm=0.05,"
             "curves=all='0/0 0.12/0.04 0.5/0.46 1/0.96'",
    # high-contrast black & white
    "noir": "hue=s=0,eq=contrast=1.35:brightness=-0.04:gamma=0.92,"
            "curves=all='0/0 0.15/0.05 0.5/0.48 1/1'",
    "none": "null",
}


def run(cmd, capture=False):
    res = subprocess.run(cmd, stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
                         stderr=subprocess.PIPE)
    if res.returncode != 0:
        tail = res.stderr.decode("utf-8", "replace")[-1500:]
        sys.exit("ffmpeg/ffprobe failed:\n  %s\n%s" % (" ".join(map(str, cmd)), tail))
    return res.stdout


def ffprobe(path):
    out = run(["ffprobe", "-v", "error", "-print_format", "json",
               "-show_format", "-show_streams", path], capture=True)
    data = json.loads(out)
    v = next((s for s in data["streams"] if s.get("codec_type") == "video"), None)
    if v is None:
        return None
    has_audio = any(s.get("codec_type") == "audio" for s in data["streams"])
    rot = 0
    for sd in v.get("side_data_list", []):
        if "rotation" in sd:
            rot = int(sd["rotation"])
    w, h = int(v["width"]), int(v["height"])
    if abs(rot) in (90, 270):
        w, h = h, w
    num, den = (v.get("avg_frame_rate") or "0/1").split("/")
    fps = float(num) / float(den) if float(den) else 0.0
    dur = float(data["format"].get("duration") or v.get("duration") or 0)
    return {
        "duration": round(dur, 3), "width": w, "height": h, "fps": round(fps, 2),
        "has_audio": has_audio,
        "hdr": v.get("color_transfer") in ("arib-std-b67", "smpte2084"),
    }


# ---------------------------------------------------------------- probe

def cmd_probe(args):
    files = sorted(
        os.path.join(args.dir, f) for f in os.listdir(args.dir)
        if os.path.splitext(f)[1].lower() in VIDEO_EXT)
    if not files:
        sys.exit("No video files in %s" % args.dir)
    sheets = os.path.join(args.work, "sheets")
    os.makedirs(sheets, exist_ok=True)
    clips = []
    for path in files:
        info = ffprobe(path)
        if info is None or info["duration"] <= 0:
            continue
        n = int(min(args.max_frames, max(6, round(info["duration"] / args.step))))
        step = info["duration"] / n
        cols = 6
        rows = math.ceil(n / cols)
        sheet = os.path.join(sheets, os.path.splitext(os.path.basename(path))[0] + ".jpg")
        vf = ("fps=1/%.4f:start_time=0,scale=-2:300,"
              "drawtext=text='%%{pts\\:flt}':x=6:y=6:fontsize=26:fontcolor=white:"
              "box=1:boxcolor=black@0.7%s,tile=%dx%d:padding=4" % (
                  step, font_opt(None), cols, rows))
        run(["ffmpeg", "-y", "-v", "error", "-i", path, "-vf", vf,
             "-frames:v", "1", "-q:v", "4", sheet])
        info.update({"file": path, "sheet": sheet, "sheet_step": round(step, 2),
                     "orientation": "vertical" if info["height"] > info["width"]
                     else "horizontal"})
        clips.append(info)
    result = {"clips": clips,
              "total_source_seconds": round(sum(c["duration"] for c in clips), 1)}
    with open(os.path.join(args.work, "probe.json"), "w") as f:
        json.dump(result, f, indent=2)
    print(json.dumps(result, indent=2))


# ---------------------------------------------------------------- beats

def detect_beats(path, limit=200):
    sr, hop = 11025, 64
    raw = run(["ffmpeg", "-v", "error", "-t", str(limit), "-i", path, "-vn", "-ac", "1",
               "-ar", str(sr), "-af", "lowpass=f=180", "-f", "s16le", "-"], capture=True)
    pcm = array.array("h")
    pcm.frombytes(raw[:len(raw) // 2 * 2])
    if sys.byteorder == "big":
        pcm.byteswap()
    n = len(pcm) // hop
    if n < 400:
        sys.exit("Music track too short to analyse")
    env = [math.log1p(sum(map(abs, pcm[i * hop:(i + 1) * hop]))) for i in range(n)]
    onset = [0.0] + [max(0.0, env[i] - env[i - 1]) for i in range(1, n)]
    rate = sr / hop  # envelope frames per second

    def acorr(lag):
        return sum(onset[i] * onset[i + lag] for i in range(0, n - lag))

    lo, hi = int(rate * 60 / 185), int(rate * 60 / 75)
    best_lag = max(range(lo, hi + 1),
                   key=lambda l: acorr(l) + 0.5 * (acorr(2 * l) if 2 * l < n else 0))

    def grid_score(period, phase):
        s, t = 0.0, phase
        while t < n - 1:
            i = int(t)
            fr = t - i
            s += onset[i] * (1 - fr) + onset[i + 1] * fr
            t += period
        return s

    best = (-1.0, float(best_lag), 0)
    p = best_lag - 1.0
    while p <= best_lag + 1.0:  # refine the period to avoid drift over two minutes
        for phase in range(0, int(p) + 1, 2):
            s = grid_score(p, phase)
            if s > best[0]:
                best = (s, p, phase)
        p += 0.02
    _, period, phase = best
    phase = max(range(max(0, phase - 2), phase + 3), key=lambda ph: grid_score(period, ph))
    beats, t = [], float(phase)
    while t < n:
        beats.append(round(t / rate, 3))
        t += period
    return {"bpm": round(60 * rate / period, 2), "beat": round(period / rate, 4),
            "first_beat": beats[0], "beats": beats}


def cmd_beats(args):
    print(json.dumps(detect_beats(args.music)))


# ---------------------------------------------------------------- synth score

def synth_score(path, bpm, duration):
    """Original dark score: sub drone, then kick on every beat, then hats. Beat k is at k*60/bpm."""
    b = 60.0 / bpm
    tb = "mod(t,%.6f)" % b
    drone = ("0.20*sin(2*PI*55*t)*(0.75+0.25*sin(2*PI*0.13*t))"
             "+0.10*sin(2*PI*82.6*t)+0.07*sin(2*PI*110.4*t)*(0.5+0.5*sin(2*PI*0.07*t))")
    kick = ("gte(t,%.4f)*0.85*sin(2*PI*(45*%s+(120/28)*(1-exp(-28*%s))))*exp(-7*%s)"
            % (8 * b, tb, tb, tb))
    hat = ("gte(t,%.4f)*0.07*(2*random(0)-1)*exp(-70*mod(t+%.6f,%.6f))"
           % (16 * b, b / 2, b))
    bass = ("gte(t,%.4f)*0.16*sin(2*PI*55*t)*(1-exp(-9*%s))" % (8 * b, tb))
    expr = "%s+%s+%s+%s" % (drone, kick, hat, bass)
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
         "aevalsrc='%s':s=48000:d=%.3f" % (expr, duration),
         "-af", "aecho=0.8:0.5:60:0.25,alimiter=limit=0.9", "-ac", "2", path])


# ---------------------------------------------------------------- render

def font_opt(font):
    path = font or next((f for f in FONT_CANDIDATES if os.path.exists(f)), None)
    return ":fontfile='%s'" % path if path else ""


def atempo_chain(speed):
    parts = []
    while speed < 0.5:
        parts.append("atempo=0.5")
        speed /= 0.5
    while speed > 2.0:
        parts.append("atempo=2.0")
        speed /= 2.0
    parts.append("atempo=%.5f" % speed)
    return ",".join(parts)


TONEMAP = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,"
           "zscale=t=bt709:m=bt709:r=tv,format=yuv420p")


def render_segment(seg, idx, out, W, H, fps, cache):
    dur = float(seg["dur"])
    nframes = max(1, round(dur * fps))
    if seg.get("black"):
        run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
             "color=c=black:s=%dx%d:r=%d" % (W, H, fps), "-f", "lavfi", "-i",
             "anullsrc=r=48000:cl=stereo", "-frames:v", str(nframes), "-t", "%.4f" % dur,
             "-pix_fmt", "yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "14",
             "-c:a", "pcm_s16le", out])
        return
    src = seg["src"]
    info = cache.get(src) or ffprobe(src)
    if info is None:
        sys.exit("Segment %d: %s has no video stream" % (idx, src))
    cache[src] = info
    speed = float(seg.get("speed", 1.0))
    start = float(seg.get("in", 0.0))
    need = dur * speed
    if start + need > info["duration"] + 0.05:
        sys.exit("Segment %d: in=%.2f + dur*speed=%.2f exceeds %s (%.2fs)"
                 % (idx, start, need, os.path.basename(src), info["duration"]))
    fx = seg.get("fx", [])
    chain = []
    if info["hdr"]:
        chain.append(TONEMAP)
    chain += ["setpts=(PTS-STARTPTS)/%.5f" % speed, "fps=%d" % fps,
              "scale=%d:%d:force_original_aspect_ratio=increase" % (W, H),
              "crop=%d:%d" % (W, H)]
    if "punch" in fx:   # slow push-in
        chain.append("scale=%d:%d,zoompan=z='1+0.12*on/%d':x='iw/2-(iw/zoom/2)':"
                     "y='ih/2-(ih/zoom/2)':d=1:s=%dx%d:fps=%d"
                     % (W * 2, H * 2, nframes, W, H, fps))
    if "pull" in fx:    # slow pull-out
        chain.append("scale=%d:%d,zoompan=z='1.12-0.12*on/%d':x='iw/2-(iw/zoom/2)':"
                     "y='ih/2-(ih/zoom/2)':d=1:s=%dx%d:fps=%d"
                     % (W * 2, H * 2, nframes, W, H, fps))
    if "shake" in fx:   # handheld impact shake
        chain.append("scale=%d:%d,crop=%d:%d:x='(iw-ow)/2+(iw-ow)/2*sin(t*47)':"
                     "y='(ih-oh)/2+(ih-oh)/2*sin(t*61+1)'"
                     % (int(W * 1.05) // 2 * 2, int(H * 1.05) // 2 * 2, W, H))
    if "bw" in fx:
        chain.append("hue=s=0")
    if "rgb" in fx:     # chromatic split
        off = max(2, W // 180)
        chain.append("format=gbrp,rgbashift=rh=-%d:bh=%d" % (off, off))
    if "strobe" in fx:  # light flicker
        chain.append("eq=brightness='-0.4*gt(sin(t*55),0.2)':eval=frame")
    if "flash" in fx:   # white flash on the cut
        chain.append("fade=t=in:st=0:d=0.14:color=white")
    if "dip" in fx:     # dip from black on the cut
        chain.append("fade=t=in:st=0:d=0.25")
    chain += ["setsar=1", "format=yuv420p"]
    vol = float(seg.get("audio", 0.0))
    cmd = ["ffmpeg", "-y", "-v", "error", "-ss", "%.4f" % start, "-t", "%.4f" % (need + 0.5),
           "-i", src]
    if vol > 0 and info["has_audio"]:
        graph = "[0:v]%s[v];[0:a]%s,volume=%.3f,aresample=48000,apad[a]" % (
            ",".join(chain), atempo_chain(speed), vol)
    else:
        cmd += ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"]
        graph = "[0:v]%s[v];[1:a]anull[a]" % ",".join(chain)
    cmd += ["-filter_complex", graph, "-map", "[v]", "-map", "[a]",
            "-frames:v", str(nframes), "-t", "%.4f" % dur, "-ac", "2", "-ar", "48000",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-c:a", "pcm_s16le", out]
    run(cmd)


def cmd_render(args):
    with open(args.edl) as f:
        edl = json.load(f)
    base = os.path.dirname(os.path.abspath(args.edl))
    fmt = edl.get("format", "vertical")
    if fmt not in FORMATS:
        sys.exit("format must be one of %s" % ", ".join(FORMATS))
    W, H = FORMATS[fmt]
    if args.preview:
        W, H = W // 2, H // 2
    fps = int(edl.get("fps", 30))
    look = edl.get("look", "dark")
    if look not in LOOKS:
        sys.exit("look must be one of %s" % ", ".join(LOOKS))
    segs = list(edl["segments"])
    outro = edl.get("outro")
    if outro:
        segs.append({"black": True, "dur": float(outro.get("dur", 2.5)),
                     "text": outro.get("text"), "text_size": outro.get("text_size", 1.0)})
    # snap every duration to whole frames so the timeline stays on the beat grid
    t, timeline = 0.0, []
    for s in segs:
        end = round((t + float(s["dur"])) * fps) / fps
        s["dur"] = end - round(t * fps) / fps
        timeline.append(round(t * fps) / fps)
        t = end
    total = t
    cap = min(HARD_CAP, float(edl.get("max_duration", HARD_CAP)))
    if total > cap + 1e-6:
        sys.exit("Timeline is %.2fs, over the %.0fs cap. Trim the EDL." % (total, cap))

    work = os.path.join(args.work, "render")
    shutil.rmtree(work, ignore_errors=True)
    os.makedirs(work)
    cache, parts = {}, []
    for i, s in enumerate(segs):
        if not s.get("black"):
            s["src"] = s["src"] if os.path.isabs(s["src"]) else os.path.join(base, s["src"])
        part = os.path.join(work, "seg_%03d.mkv" % i)
        render_segment(s, i, part, W, H, fps, cache)
        parts.append(part)
        print("  segment %d/%d" % (i + 1, len(segs)), file=sys.stderr)
    listfile = os.path.join(work, "list.txt")
    with open(listfile, "w") as f:
        f.writelines("file '%s'\n" % os.path.abspath(p) for p in parts)

    music = edl.get("music")
    if music:
        music = music if os.path.isabs(music) else os.path.join(base, music)
    else:
        music = os.path.join(work, "score.wav")
        synth_score(music, float(edl.get("bpm", 150)), total + 1)

    # final pass: grade, text, vignette, grain, letterbox, fades, music
    vf = [LOOKS[look]]
    font = font_opt(edl.get("font"))
    texts = []
    for i, s in enumerate(segs):
        if s.get("text"):
            texts.append({"text": s["text"], "at": timeline[i], "dur": s["dur"],
                          "pos": s.get("text_pos", "center"), "size": s.get("text_size", 1.0),
                          "color": s.get("text_color", "white"),
                          "style": s.get("text_style")})
    texts += edl.get("titles", [])
    if edl.get("tagline"):  # small line held over the whole film, outro excluded
        end = timeline[-1] if outro else total
        texts.append({"text": edl["tagline"], "at": float(edl.get("tagline_from", 0.0)),
                      "dur": end - float(edl.get("tagline_from", 0.0)), "size": 0.32,
                      "color": "white@0.75"})
    for i, tx in enumerate(texts):
        tf = os.path.join(work, "text_%03d.txt" % i)
        with open(tf, "w") as f:
            f.write(tx["text"])
        a = float(tx["at"])
        b = min(total, a + float(tx["dur"]))
        size = int(W * 0.085 * float(tx.get("size", 1.0)))
        ypos = {"top": "h*0.16", "bottom": "h*0.80-text_h"}.get(
            tx.get("pos", "center"), "(h-text_h)/2")
        layers = [(0, tx.get("color", "white"), True)]
        if tx.get("style") == "glitch":  # red / cyan fringes behind the main text
            off = max(2, size // 22)
            layers = [(-off, "red@0.8", False), (off, "cyan@0.8", False)] + layers
        for dx, color, shadow in layers:
            vf.append("drawtext=textfile='%s'%s:fontsize=%d:fontcolor=%s:line_spacing=%d:"
                      "x=(w-text_w)/2+%d:y=%s%s:alpha='min(1,(t-%.3f)/0.10)':"
                      "enable='between(t,%.3f,%.3f)'"
                      % (tf, font, size, color, size // 5, dx, ypos,
                         ":shadowcolor=black@0.8:shadowx=3:shadowy=3" if shadow else "",
                         a, a, b - 0.001))
    if edl.get("vignette", True):
        vf.append("vignette=angle=PI/4.2")
    grain = int(edl.get("grain", 10))
    if grain:
        vf.append("noise=alls=%d:allf=t" % grain)
    if edl.get("letterbox", fmt == "horizontal"):
        bar = int((H - W / 2.39) / 2) if fmt == "horizontal" else int(H * 0.07)
        vf.append("drawbox=x=0:y=0:w=iw:h=%d:color=black:t=fill,"
                  "drawbox=x=0:y=ih-%d:w=iw:h=%d:color=black:t=fill" % (bar, bar, bar))
    fi = float(edl.get("fade_in", 0.0))
    fo = float(edl.get("fade_out", 0.8))
    if fi:
        vf.append("fade=t=in:st=0:d=%.2f" % fi)
    if fo:
        vf.append("fade=t=out:st=%.3f:d=%.2f" % (total - fo, fo))
    vf.append("format=yuv420p")
    mvol = float(edl.get("music_volume", 1.0))
    af = ("[1:a]volume=%.3f,aresample=48000,afade=t=out:st=%.3f:d=1.5[m];"
          "[0:a][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]"
          % (mvol, max(0.0, total - 1.5)))
    out = args.output
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listfile,
         "-ss", "%.3f" % float(edl.get("music_start", 0.0)), "-i", music,
         "-filter_complex", "[0:v]%s[v];%s" % (",".join(vf), af),
         "-map", "[v]", "-map", "[a]", "-t", "%.4f" % total,
         "-c:v", "libx264", "-preset", "veryfast" if args.preview else "slow",
         "-crf", "26" if args.preview else "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out])
    final = ffprobe(out)
    print(json.dumps({"output": out, "duration": final["duration"],
                      "resolution": "%dx%d" % (final["width"], final["height"]),
                      "segments": len(segs),
                      "size_mb": round(os.path.getsize(out) / 1e6, 1)}))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--work", default="montage/work", help="scratch directory")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("probe")
    p.add_argument("dir")
    p.add_argument("--step", type=float, default=1.0, help="target seconds between frames")
    p.add_argument("--max-frames", type=int, default=36)
    p.set_defaults(fn=cmd_probe)
    p = sub.add_parser("beats")
    p.add_argument("music")
    p.set_defaults(fn=cmd_beats)
    p = sub.add_parser("render")
    p.add_argument("edl")
    p.add_argument("-o", "--output", default="montage/output/montage.mp4")
    p.add_argument("--preview", action="store_true", help="half resolution, fast encode")
    p.set_defaults(fn=cmd_render)
    args = ap.parse_args()
    os.makedirs(args.work, exist_ok=True)
    args.fn(args)


if __name__ == "__main__":
    main()
