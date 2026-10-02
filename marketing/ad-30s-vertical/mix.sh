#!/usr/bin/env bash
# Places each voice line at its start time, levels it for social video, and attaches it to the ad.
set -euo pipefail
cd "$(dirname "$0")"
F="${FFMPEG:-ffmpeg}"
voice="${1:-af_heart}"  # run voiceover.py with the same voice first
args=(); filters=""; mix=""; i=0
while IFS=$'\t' read -r file start; do
  ms=$(python3 -c "print(int(round($start*1000)))")
  args+=(-i "$file"); filters+="[$i:a]aresample=48000,adelay=${ms}|${ms}[a$i];"; mix+="[a$i]"; i=$((i+1))
done < <(python3 -c "import json;[print(r['file'],r['start'],sep='\t') for r in json.load(open('vo-$voice/plan.json'))]")
# A silent 30-second bed fixes the length, so nothing waits on an endless pad.
args+=(-f lavfi -t 30 -i "anullsrc=r=48000:cl=mono"); mix+="[$i:a]"; i=$((i+1))
timeout 120 "$F" -hide_banner -loglevel error -y "${args[@]}" -filter_complex \
  "${filters}${mix}amix=inputs=$i:normalize=0:duration=longest,highpass=f=80,acompressor=threshold=-18dB:ratio=2.5:attack=8:release=120,loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000,aformat=channel_layouts=stereo" \
  -t 30 "vo-$voice/voiceover.wav"
timeout 120 "$F" -hide_banner -loglevel error -y -i daywoven-ad-30s-9x16.mp4 -i "vo-$voice/voiceover.wav" \
  -map 0:v -map 1:a -c:v copy -c:a aac -profile:a aac_low -ar 44100 -ac 2 -b:a 160k -disposition:a default -t 30 -movflags +faststart "daywoven-ad-30s-9x16-vo-$voice.mp4"
echo "made daywoven-ad-30s-9x16-vo-$voice.mp4"
