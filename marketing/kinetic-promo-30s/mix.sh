#!/usr/bin/env bash
# Lays the voice-over on the rendered promo: voice cleaned and levelled, the clicks ducked
# under it, then the whole mix brought to -14 LUFS (two passes) with peaks under -1 dBTP.
#
#   npm run render && python bed.py && python voiceover.py calm && ./mix.sh calm-af_heart
#
# Needs an ffmpeg built with libsoxr (FFMPEG=/path overrides).
set -euo pipefail
cd "$(dirname "$0")"
F="${FFMPEG:-ffmpeg}"
take="${1:-calm-af_heart}"  # the vo-<script>-<voice> folder voiceover.py wrote
video=renders/daywoven-kinetic-30s-9x16.mp4
out="renders/daywoven-kinetic-30s-9x16-vo-$take.mp4"

# 1. Voice bus: each line at its start, upsampled cleanly to 48 kHz, then shaped as one take.
#    Low cut, a little less mud at 220 Hz, a little more presence at 3.2 kHz, the synthetic
#    voice's bright 8-12 kHz hiss on "s" sounds softened, de-essing and light compression, so it
#    reads clearly on phone speakers and nothing harsh trips the AAC encoder into overshoot.
args=(); place=""; lines=""; i=0
while IFS=$'\t' read -r file start; do
  ms=$(python3 -c "print(int(round($start*1000)))")
  args+=(-i "$file"); place+="[$i:a]aresample=48000:resampler=soxr:precision=28,adelay=${ms}:all=1[l$i];"; lines+="[l$i]"; i=$((i+1))
done < <(python3 -c "import json;[print(r['file'],r['start'],sep='\t') for r in json.load(open('vo-$take/plan.json'))]")
args+=(-f lavfi -t 30 -i "anullsrc=r=48000:cl=mono"); lines+="[$i:a]"; i=$((i+1))
timeout 120 "$F" -hide_banner -loglevel error -y "${args[@]}" -filter_complex \
  "${place}${lines}amix=inputs=$i:normalize=0:duration=longest,highpass=f=75:poles=2,equalizer=f=220:t=q:w=1.1:g=-1.5,equalizer=f=3200:t=q:w=1.2:g=2,highshelf=f=7500:g=-3,deesser=i=0.5:m=0.5:f=0.5,acompressor=threshold=-24dB:ratio=3:attack=10:release=200:knee=6:makeup=3dB,aformat=sample_fmts=fltp:channel_layouts=mono" \
  -t 30 -c:a pcm_s24le "vo-$take/voice.wav"

# Every voice is brought to the same loudness first, so the clicks sit the same way under any voice,
# and a gentle limiter keeps its peaks well clear of full scale before the final loudness pass.
voice_i=$(timeout 60 "$F" -hide_banner -i "vo-$take/voice.wav" -af loudnorm=print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p' \
  | python3 -c "import json,sys;print(json.loads(sys.stdin.read())['input_i'])")
lift=$(python3 -c "print(round(-16 - float('$voice_i'), 2))")

# 2. Mix: the clicks dip ~6 dB under the voice. The nature bed (sfx/bed.wav, from bed.py: a
#    stream and soft breezes) sits well below it and eases down a few dB more while the voice
#    speaks, so the space between lines is carried rather than empty.
mixgraph="[1:a]volume=${lift}dB,alimiter=limit=0.6:attack=4:release=80:level=false,asplit=3[v][key][bedkey];\
[0:a]aresample=48000:resampler=soxr,pan=mono|c0=0.5*c0+0.5*c1,volume=-4dB[sfx];\
[sfx][key]sidechaincompress=threshold=0.02:ratio=5:attack=4:release=220:makeup=1,aformat=channel_layouts=stereo[duck];\
[2:a]aresample=48000:resampler=soxr,volume=-8dB[bed];[bedkey]aformat=channel_layouts=stereo[bk];\
[bed][bk]sidechaincompress=threshold=0.03:ratio=4:attack=25:release=650:makeup=1[bedduck];\
[v]aformat=channel_layouts=stereo[vs];[vs][duck][bedduck]amix=inputs=3:normalize=0:duration=first"
measure=$(timeout 120 "$F" -hide_banner -y -i "$video" -i "vo-$take/voice.wav" -i sfx/bed.wav -filter_complex \
  "${mixgraph},loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { python3 -c "import json,sys;print(json.loads(sys.stdin.read())['$1'])" <<<"$measure"; }

# 3. Second pass applies the measured loudness linearly, so the voice keeps its dynamics; a
#    last limiter at -1.5 dB is the safety net.
timeout 180 "$F" -hide_banner -loglevel error -y -i "$video" -i "vo-$take/voice.wav" -i sfx/bed.wav -filter_complex \
  "${mixgraph},loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,alimiter=limit=0.84:attack=2:release=50:level=false,aresample=44100:resampler=soxr:precision=28[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -profile:a aac_low -b:a 192k -ac 2 -disposition:a default -t 30 -movflags +faststart "$out"
echo "made $out"
