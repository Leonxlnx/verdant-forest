#!/usr/bin/env bash
set -euo pipefail
frames_dir="${1:-artifacts/browser-capture}"
output_file="${2:-artifacts/forest-cinematic-30s.mp4}"
fps="${3:-24}"
frame_count="${4:-$((fps * 30))}"
python - "$frames_dir" "$frame_count" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
missing=[i for i in range(int(sys.argv[2])) if not (p/f'frame-{i:04}.png').is_file()]
if missing:raise SystemExit(f'Missing {len(missing)} capture frames, first: {missing[:10]}')
PY
ffmpeg -y -framerate "$fps" -i "$frames_dir/frame-%04d.png" -frames:v "$frame_count" -an -vf 'scale=in_range=full:out_range=tv:out_color_matrix=bt709,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709' -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart "$output_file"
ffmpeg -v error -i "$output_file" -f null -
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=width,height,r_frame_rate,avg_frame_rate,nb_read_frames,duration,color_range,color_space,color_transfer,color_primaries -of json "$output_file"
