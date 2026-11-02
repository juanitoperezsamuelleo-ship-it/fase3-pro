"""Chispa en Blender (Cycles): robot blanco cerámico con visor térmico y patas de enchufe de vidrio.
Uso: python chispa.py --face ok --pose idle --yaw 0 --res 720 --samples 64 --out salida.png
Caras: ok, happy, worry, alert, think, sleep, talk, blink.  Poses: idle, wave, wave2, think, happy, worry, alert, point, sleep.
"""
import sys, math, argparse
import numpy as np
import bpy, bmesh
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument("--face", default="ok"); ap.add_argument("--pose", default="idle"); ap.add_argument("--yaw", type=float, default=0)
ap.add_argument("--res", type=int, default=720); ap.add_argument("--samples", type=int, default=64); ap.add_argument("--out", default="chispa.png")
ap.add_argument("--blend", default=""); ap.add_argument("--eyes", default="soft"); ap.add_argument("--bg", default="thermal")
A = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
col = sc.collection
R = math.radians

# ───────── materiales ─────────
def P(n):  # nodo Principled de un material nuevo
    m = bpy.data.materials.new(n); m.use_nodes = True
    return m, m.node_tree.nodes["Principled BSDF"], m.node_tree
def setin(node, name, val):
    if name in node.inputs: node.inputs[name].default_value = val
def mat(n, color, rough=0.3, metal=0.0, coat=0.0, coat_rough=0.05, trans=0.0, ior=1.45, emis=None, es=0.0, sss=0.0):
    m, b, _ = P(n)
    setin(b, "Base Color", (*color, 1)); setin(b, "Roughness", rough); setin(b, "Metallic", metal); setin(b, "IOR", ior)
    setin(b, "Coat Weight", coat); setin(b, "Coat Roughness", coat_rough); setin(b, "Transmission Weight", trans)
    setin(b, "Subsurface Weight", sss); setin(b, "Subsurface Radius", (0.2, 0.2, 0.2))
    if emis is not None: setin(b, "Emission Color", (*emis, 1)); setin(b, "Emission Strength", es)
    return m

FACE = A.face
HOT = (1.0, 0.36, 0.42) if FACE == "alert" else (1.0, 0.62, 0.22)       # acento neón principal (ámbar; rojo en alerta)
MAG = (0.95, 0.22, 0.62)
WHITE = mat("ceramica", (0.90, 0.91, 0.93), rough=0.22, coat=1.0, coat_rough=0.04, sss=0.04)
GRAPH = mat("grafito", (0.035, 0.038, 0.045), rough=0.32, metal=0.4, coat=0.5)
METAL = mat("metal", (0.82, 0.84, 0.87), rough=0.18, metal=1.0)
GLASS = mat("vidrio", (1, 1, 1), rough=0.02, trans=1.0, ior=1.45)
NEON = mat("neon", (0, 0, 0), emis=HOT, es=16.0)
NEON_M = mat("neon_magenta", (0, 0, 0), emis=MAG, es=12.0)
FIL = mat("filamento", (0, 0, 0), emis=(HOT[0], HOT[1] * 0.85, HOT[2] * 0.6), es=24.0 if FACE != "sleep" else 4.0)

# ───────── geometría ─────────
def smooth(o, sub=2):
    for p in o.data.polygons: p.use_smooth = True
    if sub:
        m = o.modifiers.new("sub", "SUBSURF"); m.levels = 1; m.render_levels = sub
    return o
def put(o, m): o.data.materials.append(m); return o
def sphere(r, loc, m, scale=(1, 1, 1), seg=64):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=r, location=loc)
    o = bpy.context.object; o.scale = scale; return put(smooth(o, 1), m)
def capsule(r, L, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=r, location=(0, 0, 0))
    o = bpy.context.object
    for v in o.data.vertices:
        if v.co.z > 1e-4: v.co.z += L / 2
        elif v.co.z < -1e-4: v.co.z -= L / 2
    o.location = loc; o.rotation_euler = rot
    return put(smooth(o, 1), m)
def cyl(r, d, loc, m, rot=(0, 0, 0), bevel=0.0, v=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=v, radius=r, depth=d, location=loc, rotation=rot)
    o = bpy.context.object
    for p in o.data.polygons: p.use_smooth = True
    if bevel:
        b = o.modifiers.new("bev", "BEVEL"); b.width = bevel; b.segments = 5; b.limit_method = "ANGLE"
    o.data.shade_smooth() if hasattr(o.data, "shade_smooth") else None
    return put(o, m)
def rbox(size, loc, m, bevel=0.05, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    b = o.modifiers.new("bev", "BEVEL"); b.width = bevel; b.segments = 6
    for p in o.data.polygons: p.use_smooth = True
    return put(o, m)
def torus(R_, r, loc, m, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R_, minor_radius=r, major_segments=96, minor_segments=16, location=loc, rotation=rot)
    o = bpy.context.object
    for p in o.data.polygons: p.use_smooth = True
    return put(o, m)

# ───────── cara del visor: imagen térmica con ojos y boca encima ─────────
TW, TH = 1024, 448
def blur(a, k):
    for _ in range(3):
        c = np.cumsum(np.pad(a, ((0, 0), (k, k), (0, 0)), mode="edge"), axis=1); a = (c[:, 2 * k:] - c[:, :-2 * k]) / (2 * k)
        c = np.cumsum(np.pad(a, ((k, k), (0, 0), (0, 0)), mode="edge"), axis=0); a = (c[2 * k:] - c[:-2 * k]) / (2 * k)
    return a
def iron(t):  # paleta "hierro" de cámara térmica
    stops = np.array([[0, .02, .01, .08], [.25, .25, .03, .45], [.45, .75, .08, .55], [.65, 1.0, .38, .1], [.85, 1.0, .78, .15], [1, 1.0, .97, .8]])
    out = np.zeros(t.shape + (3,))
    for ch in range(3): out[..., ch] = np.interp(t, stops[:, 0], stops[:, ch + 1])
    return out
def face_tex():
    rng = np.random.default_rng(7)
    y, x = np.mgrid[0:TH, 0:TW] / np.array([TH, TW])[:, None, None]
    t = 0.34 + 0.16 * (1 - y)
    hot = 0.9 if FACE == "alert" else 0.55 if FACE in ("worry",) else 0.42
    for _ in range(9):
        cx, cy, s = rng.uniform(.05, .95), rng.uniform(.1, .95), rng.uniform(.08, .2)
        t += rng.uniform(.2, hot + .2) * np.exp(-(((x - cx) * 1.4) ** 2 + ((y - cy) * 0.8) ** 2) / (2 * s * s))
    t = np.clip(t, 0, 1)
    img = iron(t) * (0.5 if FACE != "sleep" else 0.22)          # el fondo térmico va tenue, detrás de la cara
    if A.bg == "black":                                          # pantalla negra: casi sin luz propia, solo un leve degradado
        img = np.zeros((TH, TW, 3)) + (0.004 + 0.006 * (1 - y))[..., None] * np.array([0.6, 0.8, 1.0])
    mask = np.zeros((TH, TW))
    X, Y = np.mgrid[0:TW, 0:TH].T if False else np.meshgrid(np.arange(TW), np.arange(TH))
    def rrect(cx, cy, w, h, r):
        dx = np.maximum(np.abs(X - cx) - (w / 2 - r), 0); dy = np.maximum(np.abs(Y - cy) - (h / 2 - r), 0)
        return (np.hypot(dx, dy) <= r).astype(float)
    def arc(cx, cy, rx, ry, th, up=True):
        d = ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2
        ring = (np.abs(np.sqrt(d) - 1) * min(rx, ry) < th / 2)
        return (ring & ((Y < cy) if up else (Y > cy))).astype(float)
    def line(x1, y1, x2, y2, th):
        px, py = X - x1, Y - y1; vx, vy = x2 - x1, y2 - y1; L2 = vx * vx + vy * vy
        u = np.clip((px * vx + py * vy) / L2, 0, 1); return (np.hypot(px - u * vx, py - u * vy) <= th / 2).astype(float)
    ex, ey, gx, gy = 0, 0, 0, 0
    if FACE == "think": gx, gy = -40, -30
    L, Rx, Ey = 372 + gx, 652 + gx, 196 + gy
    disc = lambda cx, cy, r: (np.hypot(X - cx, Y - cy) <= r).astype(float)
    pupil = np.zeros((TH, TW))
    if FACE in ("ok", "worry", "alert", "think", "talk"):
        big = FACE == "alert"
        for cx in (L, Rx):
            if A.eyes == "round":      # ojos redondos de personaje: disco claro, pupila oscura y brillo
                mask += disc(cx, Ey, 84 if big else 78); pupil += disc(cx + gx * 0.3, Ey + 8 + gy * 0.3, 36 if big else 32)
                pupil -= disc(cx - 18, Ey - 20, 12) * 2
            elif A.eyes == "bar":      # barras horizontales tipo visor
                mask += rrect(cx, Ey + 8, 156 if big else 148, 50 if big else 44, 22)
            elif A.eyes == "ring":     # anillos tipo lente de cámara, con punto al centro
                rr = np.hypot(X - cx, Y - Ey); mask += ((np.abs(rr - (74 if big else 68)) < 11) | (rr < 20)).astype(float)
            else:
                w, h = (116, 156) if big else (104, 146); mask += rrect(cx, Ey, w, h, 42)
    elif FACE == "blink":
        mask += rrect(L, Ey + 20, 84, 16, 8) + rrect(Rx, Ey + 20, 84, 16, 8)
    elif FACE == "happy":
        mask += arc(L, Ey + 30, 58, 50, 24) + arc(Rx, Ey + 30, 58, 50, 24)
    elif FACE == "sleep":
        mask += arc(L, Ey + 10, 46, 20, 16, up=False) + arc(Rx, Ey + 10, 46, 20, 16, up=False)
        for i, (zx, zy, s) in enumerate([(820, 120, 28), (880, 70, 38)]):
            mask += line(zx - s, zy - s, zx + s, zy - s, 10) + line(zx + s, zy - s, zx - s, zy + s, 10) + line(zx - s, zy + s, zx + s, zy + s, 10)
    if FACE == "worry":
        mask += line(318, 112, 410, 92, 16) + line(706, 112, 614, 92, 16)
    if FACE == "alert":
        mask += line(312, 90, 420, 128, 18) + line(712, 90, 604, 128, 18)
    mx = 512 + gx // 2
    if FACE in ("ok", "blink"): mask += arc(mx, 300, 78, 44, 20, up=False)
    elif FACE == "happy":
        d = ((X - mx) / 80) ** 2 + ((Y - 300) / 60) ** 2; mask += ((d <= 1) & (Y > 300)).astype(float)
    elif FACE == "worry": mask += arc(mx, 350, 60, 28, 14, up=True)
    elif FACE in ("talk", "alert"):
        d = ((X - mx) / 46) ** 2 + ((Y - 330) / 34) ** 2; mask += (d <= 1).astype(float)
    elif FACE == "think":
        mask += rrect(mx, 330, 70, 14, 7)
        for i, (dx_, dy_) in enumerate([(760, 110), (812, 84), (866, 58)]): mask += rrect(dx_, dy_, 22, 22, 11)
    mask = np.clip(mask - np.clip(pupil, 0, 1), 0, 1)
    if A.eyes == "pix":                                          # matriz de puntos LED
        dots = np.clip(5.6 - np.hypot((X % 14) - 7, (Y % 14) - 7), 0, 1)
        mask = (blur(mask[..., None], 4)[..., 0] > 0.3).astype(float) * dots
        if A.bg == "black": img = img + dots[..., None] * np.array([1.0, 0.6, 0.25]) * 0.018   # LEDs apagados de fondo
    COLS = {"soft": (1.0, 0.96, 0.86), "pix": (1.0, 0.68, 0.24), "round": (0.86, 0.97, 1.0), "bar": (0.42, 0.9, 1.0), "ring": (0.3, 0.95, 0.8)}
    if A.eyes == "pix": COLS["pix"] = {"worry": (1.0, 0.48, 0.12), "sleep": (0.7, 0.42, 0.16), "happy": (1.0, 0.78, 0.32)}.get(FACE, (1.0, 0.66, 0.22))
    eyecol = np.array([1.0, 0.3, 0.38]) if FACE == "alert" else np.array([1.0, 0.7, 0.25]) if FACE == "worry" and A.eyes != "pix" else np.array(COLS.get(A.eyes, COLS["soft"]))
    glow = blur(mask[..., None] * eyecol, 6)
    img = img * (0.86 + 0.14 * ((Y % 4) < 2)[..., None])
    img = img * (1 - np.clip(blur(mask[..., None], 14), 0, 1) * 0.85) * (1 - mask[..., None]) + mask[..., None] * eyecol * 2.2 + glow * 0.35
    img = np.clip(img, 0, 4)
    rgba = np.concatenate([img, np.ones((TH, TW, 1))], axis=2)[::-1].astype(np.float32)
    im = bpy.data.images.new("cara", TW, TH, float_buffer=True); im.pixels.foreach_set(rgba.ravel()); return im

# ───────── modelo ─────────
def E(name, loc, parent=None):
    o = bpy.data.objects.new(name, None); o.location = loc; col.objects.link(o)
    if parent: o.parent = parent
    return o
root = E("root", (0, 0, 0))
torso_p = E("torso", (0, 0, -0.25), root)
head_p = E("cabeza", (0, 0, 0.62 + 0.25), torso_p)
bpy.context.view_layer.update()
def attach(objs, piv):
    bpy.context.view_layer.update()
    for o in objs:
        mw = o.matrix_world.copy(); o.parent = piv; o.matrix_parent_inverse = piv.matrix_world.inverted(); o.matrix_world = mw

HZ = 1.38  # centro de la cabeza
head = []
head.append(sphere(0.95, (0, 0, HZ), WHITE, scale=(1.0, 0.97, 0.94)))
# visor: casquete de esfera recortado con una caja redondeada
def shell(r, box_size, box_loc, m, name, th=0.02):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=r, location=(0, 0, HZ))
    s = bpy.context.object; s.name = name; s.scale = (1.0, 0.97, 0.94)
    for p in s.data.polygons: p.use_smooth = True
    cut = rbox(box_size, box_loc, m, bevel=0.16); cut.hide_render = True; cut.hide_viewport = True
    bo = s.modifiers.new("cut", "BOOLEAN"); bo.operation = "INTERSECT"; bo.object = cut; bo.solver = "EXACT"
    so = s.modifiers.new("solid", "SOLIDIFY"); so.thickness = th
    return put(s, m), cut
rim, cut1 = shell(0.96, (1.53, 1.6, 0.73), (0, -0.85, HZ - 0.02), NEON_M, "borde", th=0.008)
# material del visor: imagen térmica emisiva bajo un vidrio brillante
vm = bpy.data.materials.new("visor"); vm.use_nodes = True; nt = vm.node_tree; bs = nt.nodes["Principled BSDF"]
setin(bs, "Base Color", (0.0, 0.0, 0.0, 1)); setin(bs, "Roughness", 0.32 if A.bg == "black" else 0.12); setin(bs, "Coat Weight", 0.0 if A.bg == "black" else 0.25); setin(bs, "Coat Roughness", 0.01); setin(bs, "Specular IOR Level", 0.12 if A.bg == "black" else 0.3)
tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); tx = nt.nodes.new("ShaderNodeTexImage"); tx.image = face_tex(); tx.extension = "EXTEND"
# proyección frontal: x → u, z → v (el visor mira hacia -y)
sx = nt.nodes.new("ShaderNodeSeparateXYZ"); cx = nt.nodes.new("ShaderNodeCombineXYZ")
nt.links.new(tc.outputs["Object"], sx.inputs[0]); nt.links.new(sx.outputs["X"], cx.inputs["X"]); nt.links.new(sx.outputs["Z"], cx.inputs["Y"])
nt.links.new(cx.outputs[0], mp.inputs["Vector"])
mp.inputs["Location"].default_value = (0.5, 0.5, 0); mp.inputs["Scale"].default_value = (1 / 1.40, 1 / 0.62, 1)
nt.links.new(mp.outputs["Vector"], tx.inputs["Vector"])
nt.links.new(tx.outputs["Color"], bs.inputs["Emission Color"]); setin(bs, "Emission Strength", 3.4 if A.eyes == "pix" else 2.6)
visor, cut2 = shell(0.977, (1.46, 1.6, 0.66), (0, -0.85, HZ - 0.02), vm, "visor", th=0.012)
# coordenadas de objeto del visor centradas en la cara
tc.object = E("cara_ref", (0, -0.9, HZ - 0.02))
head += [rim, cut1, visor, cut2]
# detalles de la cabeza: ranura en la frente, rejilla de barbilla, orejas, líneas neón, patas de enchufe
head.append(rbox((0.36, 0.08, 0.1), (0, -0.84, HZ + 0.5), NEON, bevel=0.035, rot=(R(-32), 0, 0)))
head.append(rbox((0.44, 0.12, 0.14), (0, -0.86, HZ - 0.56), GRAPH, bevel=0.05, rot=(R(28), 0, 0)))
head.append(rbox((0.3, 0.03, 0.014), (0, -0.925, HZ - 0.55), NEON, bevel=0.006, rot=(R(28), 0, 0)))
for s in (-1, 1):
    head.append(cyl(0.3, 0.16, (s * 0.92, 0, HZ), WHITE, rot=(0, R(90), 0), bevel=0.05))
    head.append(cyl(0.2, 0.18, (s * 0.94, 0, HZ), GRAPH, rot=(0, R(90), 0), bevel=0.03))
    head.append(torus(0.25, 0.022, (s * 1.01, 0, HZ), NEON_M if s < 0 else NEON, rot=(0, R(90), 0)))
for a, b in ((R(28), R(18)), (R(-28), R(-18))):
    head.append(torus(0.95, 0.012, (0, 0, HZ), NEON, rot=(R(70), b, a)))
head.append(torus(0.905, 0.007, (0, 0.28, HZ), GRAPH, rot=(R(90), 0, 0)))
for s in (-1, 1):
    x = s * 0.24
    head.append(cyl(0.11, 0.1, (x, 0, HZ + 0.86), METAL, bevel=0.02))
    head.append(cyl(0.085, 0.44, (x, 0, HZ + 1.12), GLASS))
    head.append(sphere(0.085, (x, 0, HZ + 1.34), GLASS, seg=32))
    head.append(cyl(0.026, 0.4, (x, 0, HZ + 1.12), FIL, v=24))
attach(head, head_p)

body = []
body.append(cyl(0.16, 0.22, (0, 0, 0.6), GRAPH, bevel=0.03))                        # cuello
body.append(sphere(0.58, (0, 0, 0.18), WHITE, scale=(1.0, 0.82, 0.92)))            # pecho
body.append(sphere(0.52, (0, 0, -0.12), GRAPH, scale=(0.95, 0.86, 0.5)))           # cintura
body.append(sphere(0.46, (0, 0, -0.3), WHITE, scale=(1.0, 0.85, 0.55)))            # cadera
body.append(rbox((0.42, 0.06, 0.05), (0, -0.47, -0.02), NEON, bevel=0.02))         # franja de la cintura
body.append(cyl(0.12, 0.05, (0, -0.47, 0.32), WHITE, rot=(R(90), 0, 0), bevel=0.015))  # insignia
body.append(torus(0.1, 0.012, (0, -0.5, 0.32), NEON, rot=(R(90), 0, 0)))
bz = bpy.data.curves.new("rayo", "CURVE"); bz.dimensions = "2D"; sp = bz.splines.new("POLY")
pts = [(-0.02, 0.07), (0.04, 0.0), (0.0, 0.0), (0.03, -0.07), (-0.04, 0.01), (0.0, 0.01)]
sp.points.add(len(pts) - 1)
for p_, (u, v) in zip(sp.points, pts): p_.co = (u, v, 0, 1)
sp.use_cyclic_u = True; bz.fill_mode = "BOTH"; bz.extrude = 0.006
bo_ = bpy.data.objects.new("rayo", bz); bo_.location = (0, -0.53, 0.32); bo_.rotation_euler = (R(90), 0, 0); col.objects.link(bo_); bo_.data.materials.append(NEON)
body.append(bo_)
body.append(torus(0.5, 0.006, (0, 0, 0.3), GRAPH, rot=(R(90), 0, 0)))
attach(body, torso_p)

def arm(s):
    sh = E("hombro", (s * 0.68, 0, 0.42 + 0.25), torso_p); el = E("codo", (0, 0, -0.42), sh); hd = E("mano", (0, 0, -0.36), el)
    bpy.context.view_layer.update()
    P0 = sh.matrix_world.translation
    up = [sphere(0.19, P0, WHITE), torus(0.16, 0.025, P0 + Vector((s * 0.06, 0, 0)), GRAPH, rot=(0, R(90), 0)),
          capsule(0.1, 0.22, P0 + Vector((0, 0, -0.22)), WHITE)]
    attach(up, sh); P1 = el.matrix_world.translation
    lo = [sphere(0.1, P1, GRAPH), capsule(0.105, 0.18, P1 + Vector((0, 0, -0.19)), WHITE),
          torus(0.105, 0.012, P1 + Vector((0, 0, -0.12)), NEON)]
    attach(lo, el); P2 = hd.matrix_world.translation
    hand = [sphere(0.1, P2, GRAPH, scale=(0.9, 0.8, 0.9))]
    for i, dy in enumerate((-0.06, -0.02, 0.02, 0.06)):
        f = capsule(0.026, 0.07, P2 + Vector((s * 0.01, dy, -0.12)), WHITE); hand.append(f)
        hand.append(sphere(0.02, P2 + Vector((s * 0.01, dy, -0.175)), NEON if i % 2 == 0 else NEON_M, seg=16))
    hand.append(capsule(0.03, 0.06, P2 + Vector((-s * 0.07, -0.05, -0.07)), WHITE, rot=(0, R(-s * 40), 0)))
    attach(hand, hd)
    return sh, el, hd
def leg(s):
    hp = E("cadera", (s * 0.25, 0, -0.42 + 0.25), torso_p); kn = E("rodilla", (0, 0, -0.38), hp)
    bpy.context.view_layer.update(); P0 = hp.matrix_world.translation
    up = [sphere(0.14, P0, GRAPH), capsule(0.145, 0.12, P0 + Vector((0, 0, -0.2)), WHITE)]
    attach(up, hp); P1 = kn.matrix_world.translation
    lo = [sphere(0.12, P1, GRAPH), torus(0.12, 0.016, P1, NEON_M if s < 0 else NEON, rot=(R(90), 0, 0)),
          capsule(0.19, 0.12, P1 + Vector((0, 0, -0.24)), WHITE),
          rbox((0.4, 0.6, 0.2), P1 + Vector((0, -0.08, -0.47)), WHITE, bevel=0.08),
          rbox((0.36, 0.56, 0.045), P1 + Vector((0, -0.08, -0.575)), NEON, bevel=0.015)]
    attach(lo, kn)
    return hp, kn
shR, elR, hdR = arm(-1); shL, elL, hdL = arm(1)
hpR, knR = leg(-1); hpL, knL = leg(1)

# ───────── poses ─────────
D = lambda *a: tuple(R(x) for x in a)
POSES = {
 "idle":  dict(shR=D(0, 10, 0), shL=D(0, -10, 0), elR=D(-12, 0, 0), elL=D(-12, 0, 0)),
 "wave":  dict(shR=D(-10, 98, 0), elR=D(0, 62, 0), shL=D(0, -12, 0), elL=D(-15, 0, 0), head=D(0, -6, 0), torso=D(0, -3, 0)),
 "wave2": dict(shR=D(-10, 98, 0), elR=D(0, 92, 0), shL=D(0, -12, 0), elL=D(-15, 0, 0), head=D(0, -6, 0), torso=D(0, -3, 0)),
 "think": dict(shR=D(-62, -18, 0), elR=D(-118, 0, 0), shL=D(-25, -20, 0), elL=D(-70, 0, 0), head=D(6, 8, 0)),
 "happy": dict(shR=D(0, 112, 0), elR=D(0, 40, 0), shL=D(0, -112, 0), elL=D(0, -40, 0), head=D(-6, 0, 0)),
 "worry": dict(shR=D(-40, -25, 0), elR=D(-80, 0, 0), shL=D(-40, 25, 0), elL=D(-80, 0, 0), head=D(10, 0, 0)),
 "alert": dict(shR=D(-85, 8, 0), elR=D(-6, 0, 0), shL=D(0, -40, 0), elL=D(-50, 0, 0), torso=D(-4, 0, 0)),
 "point": dict(shR=D(-85, 8, 0), elR=D(-6, 0, 0), shL=D(0, -14, 0), elL=D(-15, 0, 0)),
 "sleep": dict(shR=D(0, 4, 0), shL=D(0, -4, 0), elR=D(-5, 0, 0), elL=D(-5, 0, 0), head=D(12, 0, 14), torso=D(4, 0, 4)),
}
p = POSES.get(A.pose, POSES["idle"])
for key, ob in (("shR", shR), ("shL", shL), ("elR", elR), ("elL", elL), ("head", head_p), ("torso", torso_p)):
    if key in p: ob.rotation_euler = p[key]
knR.rotation_euler = D(4, 0, 0); knL.rotation_euler = D(4, 0, 0)
root.rotation_euler = (0, 0, R(A.yaw))

# ───────── luz, cámara y render ─────────
w = bpy.data.worlds.new("mundo"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.03, 0.035, 0.05, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.8
def area(name, loc, power, color, size, target=(0, 0, 0.6)):
    L = bpy.data.lights.new(name, "AREA"); L.energy = power; L.color = color; L.size = size; L.shape = "DISK"
    o = bpy.data.objects.new(name, L); o.location = loc; col.objects.link(o)
    d = Vector(target) - Vector(loc); o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler(); return o
area("clave", (-3.2, -4.5, 4.2), 1600, (1.0, 0.97, 0.93), 2.6)
area("techo", (0.5, -1.5, 5.5), 300, (1.0, 1.0, 1.0), 4.0)
area("relleno", (4.0, -3.5, 1.2), 220, (0.85, 0.92, 1.0), 3.5)
area("contraluz_cian", (2.8, 3.2, 2.6), 900, (0.45, 0.85, 1.0), 1.6)
area("contraluz_magenta", (-3.0, 2.8, 1.8), 700, (1.0, 0.35, 0.75), 1.6)
area("piso", (0, -2.0, -2.6), 160, (1.0, 0.75, 0.5), 3.0, target=(0, 0, 0.4))
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -1.29)); fl = bpy.context.object; fl.is_shadow_catcher = True
camd = bpy.data.cameras.new("cam"); camd.lens = 85
cam = bpy.data.objects.new("cam", camd); cam.location = (0, -11.5, 1.45); col.objects.link(cam); sc.camera = cam
cam.rotation_euler = (Vector((0, 0, 0.62)) - cam.location).to_track_quat("-Z", "Y").to_euler()
camd.dof.use_dof = True; camd.dof.focus_distance = 11.0; camd.dof.aperture_fstop = 5.6
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = A.samples; sc.cycles.use_denoising = True
try: sc.cycles.denoiser = "OPENIMAGEDENOISE"
except Exception: pass
sc.cycles.max_bounces = 8; sc.cycles.transmission_bounces = 8; sc.cycles.glossy_bounces = 4
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = A.res; sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
try:
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Punchy"
except Exception:
    try: sc.view_settings.look = "Medium High Contrast"
    except Exception: pass
sc.render.filepath = A.out
if A.blend: bpy.ops.wm.save_as_mainfile(filepath=A.blend)
bpy.ops.render.render(write_still=True)
print("LISTO", A.out)
