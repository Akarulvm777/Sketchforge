#!/usr/bin/env bash
# Builds the test files used by the browser tests into OUT (default: /tmp/sf-e2e).
# Needs: ffmpeg, ImageMagick (convert), python3 with Pillow and psd-tools (pip install psd-tools).
set -e
OUT=${1:-/tmp/sf-e2e}; HERE=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT/psd"; cd "$OUT"
python3 -I "$HERE/mkicon.py" red.png
ffmpeg -loglevel error -y -f lavfi -i "testsrc2=size=640x360:rate=24:duration=3" -f lavfi -i "sine=frequency=440:duration=3" -c:v libvpx -b:v 400k -c:a libopus -shortest clip.webm
cd psd
convert -size 120x80 xc:none -fill '#ff0000' -draw 'circle 60,40 60,5' red.png
convert -size 100x100 xc:none -fill '#0000ff' -draw 'rectangle 0,0 99,99' blue.png
convert -size 400x300 xc:white -fill '#ff0000' -draw 'circle 110,90 110,55' -fill '#0000ff' -draw 'rectangle 250,150 349,249' merged.png
for spec in "rgb8:" "rgb16:-depth 16" "gray:-colorspace Gray" "cmyk:-colorspace CMYK"; do name=${spec%%:*}; opts=${spec#*:}
  convert merged.png \( -size 400x300 xc:white -set label "Paper" \) \( red.png -set label "Red ball" -repage +50+50 \) \( blue.png -set label "Blue box" -repage +250+150 \) $opts -compress RLE test_$name.psd; done
convert merged.png \( -size 400x300 xc:white -set label "Paper" \) \( red.png -set label "Off canvas" -repage -40-20 \) -compress None test_raw.psd
convert merged.png \( -size 400x300 xc:white -set label "Paper" \) \( red.png -set label "Zip layer" -repage +50+50 \) -compress Zip test_zip.psd
python3 "$HERE/make_fixtures.py"
echo "fixtures in $OUT"
