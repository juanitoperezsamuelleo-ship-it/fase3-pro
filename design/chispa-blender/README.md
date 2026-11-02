# Chispa · modelo en Blender

Chispa renderizado con Blender (Cycles): casco cerámico blanco, visor negro con ojos de puntos LED ámbar y patas de enchufe de vidrio con filamento.

- `chispa.py`: arma el modelo, la luz y la cámara, y renderiza una pose sin fondo.
  `python chispa.py -- --face ok --pose idle --eyes pix --bg black --res 640 --samples 56 --out idle.png`
  Caras: ok, blink, talk, happy, worry, alert, think, sleep. Poses: idle, wave, wave2, think, happy, worry, alert, point, sleep. `--yaw` gira el cuerpo.
- `batch2.sh`: renderiza las 12 poses.
- `poses/`: las 12 imágenes WebP con transparencia (unos 238 KB en total).

Requiere el módulo `bpy` (Blender como paquete de Python, disponible en PyPI). Sin tarjeta gráfica, cada pose tarda cerca de un minuto.
