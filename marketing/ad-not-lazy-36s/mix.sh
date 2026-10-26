#!/usr/bin/env bash
# Lays the voice-over on the rendered "not lazy" ad (whose own audio is the sound effects), then
# masters the whole mix to -14 LUFS in two passes with peaks under -1.5 dBFS. There is no
# background bed by default; BED=1 adds the stream and breeze from bed.py underneath.
#
#   npm run render && python sfx.py && python voiceover.py && ./mix.sh
#   python bed.py && BED=1 ./mix.sh    # with the stream-and-breeze bed
#
# Needs an ffmpeg built with libsoxr (FFMPEG=/path overrides).
set -euo pipefail
cd "$(dirname "$0")"
F="${FFMPEG:-ffmpeg}"
LENGTH=44.95
video=renders/daywoven-lazy-36s-9x16.mp4
out=renders/daywoven-lazy-36s-9x16-vo.mp4

# 1. Voice bus: each line at its start, upsampled cleanly to 48 kHz, then shaped as one take:
#    low cut, a little less mud at 220 Hz, a little presence at 3.2 kHz, the synthetic voice's
#    bright "s" sounds softened, de-essing, and soft-knee compression.
args=(); place=""; lines=""; i=0
while IFS=$'\t' read -r file start; do
  ms=$(python3 -c "print(int(round($start*1000)))")
  args+=(-i "$file"); place+="[$i:a]aresample=48000:resampler=soxr:precision=28,adelay=${ms}:all=1[l$i];"; lines+="[l$i]"; i=$((i+1))
done < <(python3 -c "import json;[print(r['file'],r['start'],sep='\t') for r in json.load(open('vo/plan.json'))]")
args+=(-f lavfi -t "$LENGTH" -i "anullsrc=r=48000:cl=mono"); lines+="[$i:a]"; i=$((i+1))
timeout 120 "$F" -hide_banner -loglevel error -y "${args[@]}" -filter_complex \
  "${place}${lines}amix=inputs=$i:normalize=0:duration=longest,highpass=f=75:poles=2,equalizer=f=220:t=q:w=1.1:g=-1.5,equalizer=f=3200:t=q:w=1.2:g=2,highshelf=f=7500:g=-3,deesser=i=0.5:m=0.5:f=0.5,acompressor=threshold=-24dB:ratio=3:attack=10:release=200:knee=6:makeup=3dB,aformat=sample_fmts=fltp:channel_layouts=mono" \
  -t "$LENGTH" -c:a pcm_s24le vo/voice.wav

# The voice is brought to a set loudness first, so the effects always sit the same way under it,
# and a limiter with a slow, smooth release keeps its peaks clear of full scale.
voice_i=$(timeout 60 "$F" -hide_banner -i vo/voice.wav -af loudnorm=print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p' \
  | python3 -c "import json,sys;print(json.loads(sys.stdin.read())['input_i'])")
lift=$(python3 -c "print(round(-16 - float('$voice_i'), 2))")

# 2. Mix: the effects dip ~6 dB under the voice. With BED=1, the stream and breeze also sit well
#    below it and ease down a few dB more while it speaks.
voicechain="[1:a]volume=${lift}dB,alimiter=limit=0.6:attack=5:release=120:level=false"
effects="[0:a]aresample=48000:resampler=soxr,pan=mono|c0=0.5*c0+0.5*c1,volume=-4dB[sfx];\
[sfx][key]sidechaincompress=threshold=0.02:ratio=5:attack=4:release=220:makeup=1,aformat=channel_layouts=stereo[duck]"
if [ "${BED:-0}" = 1 ]; then
  inputs=(-i "$video" -i vo/voice.wav -i sfx/bed.wav)
  mixgraph="${voicechain},asplit=3[v][key][bedkey];${effects};\
[2:a]aresample=48000:resampler=soxr,volume=-4dB[bed];[bedkey]aformat=channel_layouts=stereo[bk];\
[bed][bk]sidechaincompress=threshold=0.03:ratio=4:attack=25:release=650:makeup=1[bedduck];\
[v]aformat=channel_layouts=stereo[vs];[vs][duck][bedduck]amix=inputs=3:normalize=0:duration=first"
else
  inputs=(-i "$video" -i vo/voice.wav)
  mixgraph="${voicechain},asplit=2[v][key];${effects};\
[v]aformat=channel_layouts=stereo[vs];[vs][duck]amix=inputs=2:normalize=0:duration=first"
fi
measure=$(timeout 120 "$F" -hide_banner -y "${inputs[@]}" -filter_complex \
  "${mixgraph},loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { python3 -c "import json,sys;print(json.loads(sys.stdin.read())['$1'])" <<<"$measure"; }

# 3. The second pass applies the measured loudness linearly; a last limiter at -1.5 dB is the
#    safety net. AAC-LC at 44.1 kHz plays almost everywhere.
timeout 180 "$F" -hide_banner -loglevel error -y "${inputs[@]}" -filter_complex \
  "${mixgraph},loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,alimiter=limit=0.84:attack=2:release=50:level=false,aresample=44100:resampler=soxr:precision=28[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -profile:a aac_low -b:a 192k -ac 2 -disposition:a default -t "$LENGTH" -movflags +faststart "$out"
echo "made $out"
