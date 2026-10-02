#!/usr/bin/env bash
# Lays the voice-over on the rendered promo: voice cleaned and levelled, the clicks ducked
# under it, then the whole mix brought to -14 LUFS (two passes) with peaks under -1 dBTP.
#
#   npm run render && python voiceover.py af_heart && ./mix.sh af_heart
#
# Needs an ffmpeg built with libsoxr (FFMPEG=/path overrides).
set -euo pipefail
cd "$(dirname "$0")"
F="${FFMPEG:-ffmpeg}"
voice="${1:-af_heart}"
video=renders/daywoven-kinetic-30s-9x16.mp4
out="renders/daywoven-kinetic-30s-9x16-vo-$voice.mp4"

# 1. Voice bus: each line at its start, upsampled cleanly to 48 kHz, then shaped as one take.
#    Low cut, a little less mud at 220 Hz, a little more presence at 3.2 kHz, de-essing and
#    light compression, so the voice reads clearly on phone speakers.
args=(); place=""; lines=""; i=0
while IFS=$'\t' read -r file start; do
  ms=$(python3 -c "print(int(round($start*1000)))")
  args+=(-i "$file"); place+="[$i:a]aresample=48000:resampler=soxr:precision=28,adelay=${ms}:all=1[l$i];"; lines+="[l$i]"; i=$((i+1))
done < <(python3 -c "import json;[print(r['file'],r['start'],sep='\t') for r in json.load(open('vo-$voice/plan.json'))]")
args+=(-f lavfi -t 30 -i "anullsrc=r=48000:cl=mono"); lines+="[$i:a]"; i=$((i+1))
timeout 120 "$F" -hide_banner -loglevel error -y "${args[@]}" -filter_complex \
  "${place}${lines}amix=inputs=$i:normalize=0:duration=longest,highpass=f=75:poles=2,equalizer=f=220:t=q:w=1.1:g=-1.5,equalizer=f=3200:t=q:w=1.2:g=2,deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-21dB:ratio=3:attack=6:release=90:makeup=2dB,aformat=sample_fmts=fltp:channel_layouts=mono" \
  -t 30 -c:a pcm_s24le "vo-$voice/voice.wav"

# Every voice is brought to the same loudness first, so the clicks sit the same way under any voice.
voice_i=$(timeout 60 "$F" -hide_banner -i "vo-$voice/voice.wav" -af loudnorm=print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p' \
  | python3 -c "import json,sys;print(json.loads(sys.stdin.read())['input_i'])")
lift=$(python3 -c "print(round(-16 - float('$voice_i'), 2))")

# 2. Mix: the clicks sit under the voice and dip a further ~6 dB while it speaks.
mixgraph="[1:a]volume=${lift}dB,asplit=2[v][key];[0:a]aresample=48000:resampler=soxr,pan=mono|c0=0.5*c0+0.5*c1,volume=-4dB[sfx];\
[sfx][key]sidechaincompress=threshold=0.02:ratio=5:attack=4:release=220:makeup=1[duck];\
[v][duck]amix=inputs=2:normalize=0:duration=first,aformat=channel_layouts=stereo"
measure=$(timeout 120 "$F" -hide_banner -y -i "$video" -i "vo-$voice/voice.wav" -filter_complex \
  "${mixgraph},loudnorm=I=-14:TP=-1:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { python3 -c "import json,sys;print(json.loads(sys.stdin.read())['$1'])" <<<"$measure"; }

# 3. Second pass applies the measured loudness linearly, so the voice keeps its dynamics.
timeout 180 "$F" -hide_banner -loglevel error -y -i "$video" -i "vo-$voice/voice.wav" -filter_complex \
  "${mixgraph},loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=44100:resampler=soxr:precision=28[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -profile:a aac_low -b:a 192k -ac 2 -disposition:a default -t 30 -movflags +faststart "$out"
echo "made $out"
