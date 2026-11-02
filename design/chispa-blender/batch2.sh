#!/bin/bash
cd "$(dirname "$0")"
while read face pose yaw name; do
  ../blendenv/bin/python chispa.py -- --face $face --pose $pose --yaw $yaw --eyes pix --bg black --res 640 --samples 56 --out $PWD/out2/$name.png >/dev/null 2>&1 && echo "ok $name"
done <<LIST
ok idle 0 idle
blink idle 0 blink
talk idle 0 talk
ok idle 25 der
ok idle -25 izq
ok wave 0 wave
ok wave2 0 wave2
think think 0 think
happy happy 0 happy
worry worry 0 worry
alert alert 0 alert
sleep sleep 0 sleep
LIST
echo FIN
