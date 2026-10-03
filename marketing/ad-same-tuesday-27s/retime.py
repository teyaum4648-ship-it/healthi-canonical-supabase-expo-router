"""Keeps the picture and the effects on the voice when the voice is re-taken.

The animation in index.html and the cues in cues.py are written in "design" seconds: where the words
landed in the take they were first cut to. When the voice changes, this transcribes the new take,
matches it word for word against the design take, and writes warp.json, a map from design seconds to
new seconds. index.html applies it to every tween, this script moves the scene clips and the length,
and cues.py applies it to every effect. Nothing is re-timed by hand.

    python retime.py --record           # once, before re-voicing: remember the design take's words
    python voiceover.py                 # the new take
    python retime.py                    # map design time onto it; updates index.html, mix.sh, warp.json
    python cues.py

Transcription uses ../kinetic-promo-30s/listen.py (LISTEN overrides) and ffmpeg (FFMPEG overrides).
"""
import difflib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

here = Path(__file__).parent
ffmpeg = os.environ.get('FFMPEG', 'ffmpeg')
listen = os.environ.get('LISTEN', str(here.parent / 'kinetic-promo-30s' / 'listen.py'))


def voice_words():
    """Lays the voice takes at their starts, transcribes them, and returns [(second, word)]."""
    plan = json.loads((here / 'vo' / 'plan.json').read_text())
    args, chain, mix = [], '', ''
    for i, row in enumerate(plan):
        args += ['-i', row['file']]
        chain += f"[{i}:a]adelay={int(round(row['start'] * 1000))}:all=1[l{i}];"
        mix += f'[l{i}]'
    dry = here / 'vo' / 'dry.wav'
    subprocess.run([ffmpeg, '-v', 'error', '-y', *args, '-filter_complex', f'{chain}{mix}amix=inputs={len(plan)}:normalize=0', str(dry)], check=True)
    out = subprocess.run([sys.executable, listen, str(dry)], capture_output=True, text=True, check=True).stdout
    line = [l for l in out.splitlines() if '@' in l][-1]
    words = [(float(t), w) for w, t in (tok.rsplit('@', 1) for tok in line.split())]
    end = max(row['start'] + row['seconds'] for row in plan)
    return words, end


def norm(word):
    return re.sub(r'[^a-z0-9]', '', word.lower())


page = (here / 'index.html').read_text()
clip_tag = re.compile(r'(<div id="([\w-]+)" class="clip[^"]*" data-start=")([\d.]+)(" data-duration=")([\d.]+)(")')
root_tag = re.compile(r'(data-composition-id="main" data-start="0" data-duration=")([\d.]+)(")')
design_file = here / 'design.json'

if '--record' in sys.argv:
    words, end = voice_words()
    clips = {m.group(2): [float(m.group(3)), float(m.group(5))] for m in clip_tag.finditer(page)}
    total = float(root_tag.search(page).group(2))
    design_file.write_text(json.dumps({'words': words, 'voice_end': end, 'clips': clips, 'total': total}, indent=1))
    print(f'recorded {len(words)} words, {len(clips)} clips, {total}s')
    sys.exit()

design = json.loads(design_file.read_text())
words, end = voice_words()
old, new = design['words'], words
match = difflib.SequenceMatcher(a=[norm(w) for _, w in old], b=[norm(w) for _, w in new], autojunk=False)
anchors = [[0.0, 0.0]]
for block in match.get_matching_blocks():
    for k in range(block.size):
        a, b = old[block.a + k][0], new[block.b + k][0]
        if a > anchors[-1][0] + 0.05 and b > anchors[-1][1] + 0.05:
            anchors.append([round(a, 3), round(b, 3)])
shift = end - design['voice_end']
anchors.append([round(design['voice_end'], 3), round(end, 3)])
total = round(design['total'] + shift, 2)
anchors.append([design['total'], total])
matched = sum(b.size for b in match.get_matching_blocks())
print(f'matched {matched} of {len(old)} design words; voice ends {end:.2f}s (was {design["voice_end"]:.2f}s); length {total}s')


def warp(t):
    for (a0, b0), (a1, b1) in zip(anchors, anchors[1:]):
        if t <= a1:
            return b0 + (t - a0) * (b1 - b0) / (a1 - a0)
    return anchors[-1][1] + t - anchors[-1][0]


(here / 'warp.json').write_text(json.dumps({'total': total, 'anchors': anchors}))


def move_clip(m):
    start, length = design['clips'][m.group(2)]
    s, e = round(warp(start), 3), round(min(warp(start + length), total), 3)
    if abs(start + length - design['total']) < 1e-6:
        e = total
    return f'{m.group(1)}{s}{m.group(4)}{round(e - s, 3)}{m.group(6)}'


page = clip_tag.sub(move_clip, page)
page = root_tag.sub(lambda m: f'{m.group(1)}{total}{m.group(3)}', page)
page, n = re.subn(r'/\* warp:start \*/.*?/\* warp:end \*/', lambda m: f'/* warp:start */{json.dumps(anchors)}/* warp:end */', page, flags=re.S)
assert n == 1, 'index.html needs one /* warp:start */ … /* warp:end */ block'
(here / 'index.html').write_text(page)
mix = (here / 'mix.sh').read_text()
(here / 'mix.sh').write_text(re.sub(r'^LENGTH=[\d.]+$', f'LENGTH={total}', mix, flags=re.M))
for cid, (start, length) in design['clips'].items():
    print(f'  {cid}: {start:>6.2f}s → {warp(start):>6.2f}s')
