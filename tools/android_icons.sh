#!/usr/bin/env bash
# Replaces the default Android launcher icons with Sketchforge's icon (needs ImageMagick).
set -e
RES=android/app/src/main/res
for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  n=${d%%:*}; s=${d#*:}
  mkdir -p $RES/mipmap-$n
  convert icon-512.png -resize ${s}x${s} $RES/mipmap-$n/ic_launcher.png
  convert icon-512.png -resize ${s}x${s} $RES/mipmap-$n/ic_launcher_round.png
  convert icon-512.png -resize $((s*108/48))x$((s*108/48)) -gravity center -background '#2b2b2b' -extent $((s*108/48))x$((s*108/48)) $RES/mipmap-$n/ic_launcher_foreground.png
done
rm -rf $RES/mipmap-anydpi-v26
