#!/usr/bin/env bash
# Replaces the default Android launcher icons with Inkvessa's icon (needs ImageMagick 6 "convert" or 7 "magick").
set -e
IM=convert; command -v convert >/dev/null || IM=magick
RES=android/app/src/main/res
for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  n=${d%%:*}; s=${d#*:}; f=$((s*108/48))
  mkdir -p $RES/mipmap-$n
  $IM icon-512.png -resize ${s}x${s} $RES/mipmap-$n/ic_launcher.png
  $IM icon-512.png -resize ${s}x${s} $RES/mipmap-$n/ic_launcher_round.png
  $IM icon-512.png -resize ${s}x${s} -gravity center -background '#0d0d16' -extent ${f}x${f} $RES/mipmap-$n/ic_launcher_foreground.png
done
rm -rf $RES/mipmap-anydpi-v26
