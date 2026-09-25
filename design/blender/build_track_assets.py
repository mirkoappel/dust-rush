"""DUST RUSH: reusable track assets, authored for Blender/MCP.

Run inside the connected Blender application, not in a shell Blender instance.
This script creates its own scene and never removes existing scenes or objects.
Geometry uses game coordinates: X across, Y up, Z forward. Export is Y-up GLB.

Stable roots:
  DRS_Ramp     bounds X [-1, 1], Y [0, 1], Z [-2, 2].
               The main driving surface is y = (z + 2) / 4.
               Tiny tread / guide details are visual, not separate colliders.
  DRS_Barrier  5.7 wide x 1.7 high x 1.4 deep, origin at ground center.
  DRS_Rock     2 x 2 x 2, origin at center.
  DRS_Cactus   4 high, origin at ground center.

Each asset is joined into one mesh with a small number of shared PBR material
groups. Color variation is baked to vertex colors, never external textures.
"""
import bpy
import bmesh
import math
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCENE_NAME = "DR_TrackAssets_v1"
ROOT_NAMES = ("DRS_Ramp", "DRS_Barrier", "DRS_Rock", "DRS_Cactus")
BLEND_PATH = ROOT / "design" / "blender" / "track-assets-v1.blend"
GLB_PATH = ROOT / "assets" / "track-assets-v1.glb"
COLOR_LAYER = "DRS_Surface"

# Stop before touching anything if this exact authored version already exists.
if bpy.data.scenes.get(SCENE_NAME):
    raise RuntimeError("Track asset scene already exists; inspect it before rebuilding.")
if any(bpy.data.objects.get(name) for name in ROOT_NAMES):
    raise RuntimeError("A stable DRS_ root already exists; do not overwrite it silently.")
if BLEND_PATH.exists() or GLB_PATH.exists():
    raise RuntimeError("Track asset output already exists; inspect it before replacing.")

scene = bpy.data.scenes.new(SCENE_NAME)
bpy.context.window.scene = scene
scene.unit_settings.system = "METRIC"
collection = bpy.data.collections.new("DR_TrackAssets_EXPORT")
scene.collection.children.link(collection)
parts = []
assets = []


def coord(p):
    return (p[0], -p[2], p[1])


def linear(channel):
    return channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4


def rgba(color):
    return tuple(linear(int(color[i:i + 2], 16) / 255) for i in (1, 3, 5)) + (1.0,)


def mix_color(a, b, factor):
    return tuple(a[i] * (1 - factor) + b[i] * factor for i in range(4))


def material(name, color, metal=0.0, rough=.65, vertex_colors=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = rgba(color)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = rgba(color)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = rough
    if vertex_colors:
        node = mat.node_tree.nodes.new("ShaderNodeVertexColor")
        node.layer_name = COLOR_LAYER
        mat.node_tree.links.new(node.outputs["Color"], shader.inputs["Base Color"])
    return mat


steel = material("DRS_Graphite_steel", "#303c41", .7, .46)
deck = material("DRS_Gripped_deck", "#475156", .48, .74)
orange = material("DRS_Safety_orange", "#e87331", .26, .38)
alloy = material("DRS_Worn_steel_edges", "#a5aca8", .75, .44)
concrete = material("DRS_Weathered_concrete", "#d8cbb0", .0, .94, True)
stone = material("DRS_Sandstone", "#ffffff", .0, .91, True)
plant = material("DRS_Cactus_surface", "#ffffff", .0, .77, True)


def create(name, verts, faces, mat, bevel=0.0, smooth=False, colors=None):
    data = bpy.data.meshes.new(name + "_Mesh")
    data.from_pydata([coord(v) for v in verts], [], faces)
    data.materials.append(mat)
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    data.update()
    if smooth:
        for polygon in data.polygons:
            polygon.use_smooth = True
    if colors is not None:
        layer = data.color_attributes.new(name=COLOR_LAYER, type="FLOAT_COLOR", domain="CORNER")
        for loop in data.loops:
            layer.data[loop.index].color = colors[loop.vertex_index]
    ob = bpy.data.objects.new(name, data)
    collection.objects.link(ob)
    parts.append(ob)
    if bevel:
        modifier = ob.modifiers.new("Soft manufactured edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = .38
        modifier.harden_normals = True
        weighted = ob.modifiers.new("Weighted edge highlights", "WEIGHTED_NORMAL")
        weighted.keep_sharp = True
        weighted.weight = 35
    return ob


CUBE_FACES = ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
              (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))
CORNERS = ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
           (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))


def box(name, center, size, mat, bevel=.014):
    vertices = [tuple(center[i] + p[i] * size[i] / 2 for i in range(3)) for p in CORNERS]
    return create(name, vertices, CUBE_FACES, mat, bevel)


def beam(name, start, end, width, depth, mat, bevel=.007):
    a, b = Vector(start), Vector(end)
    axis = (b - a).normalized()
    reference = Vector((0, 1, 0)) if abs(axis.y) < .94 else Vector((1, 0, 0))
    u = axis.cross(reference).normalized()
    v = axis.cross(u).normalized()
    vertices = []
    for center in (a, b):
        for p, q in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            vertices.append(tuple(center + u * p * width / 2 + v * q * depth / 2))
    return create(name, vertices, CUBE_FACES, mat, bevel)


def rod(name, start, end, radius, mat, sides=10, colors=None):
    a, b = Vector(start), Vector(end)
    axis = (b - a).normalized()
    reference = Vector((0, 1, 0)) if abs(axis.y) < .94 else Vector((1, 0, 0))
    u = axis.cross(reference).normalized()
    v = axis.cross(u).normalized()
    vertices = [tuple(center + radius * (u * math.cos(i * math.tau / sides) +
                                         v * math.sin(i * math.tau / sides)))
                for center in (a, b) for i in range(sides)]
    faces = [tuple(reversed(range(sides))), tuple(sides + i for i in range(sides))]
    faces += [(i, (i + 1) % sides, sides + (i + 1) % sides, sides + i) for i in range(sides)]
    color_values = [colors] * len(vertices) if colors else None
    return create(name, vertices, faces, mat, smooth=True, colors=color_values)


def closed_patch(name, points, normal, thickness, mat, color=None):
    n = len(points)
    normal = Vector(normal).normalized()
    vertices = [tuple(Vector(p) + normal * offset) for offset in (0, thickness) for p in points]
    faces = [tuple(reversed(range(n))), tuple(n + i for i in range(n))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    colors = [color] * len(vertices) if color else None
    return create(name, vertices, faces, mat, colors=colors)


def finish(name):
    global parts
    for obj in parts:
        bpy.context.view_layer.objects.active = obj
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name + "_Mesh"
    obj["asset_space"] = "X across / Y up / Z forward (glTF)"
    obj["collision"] = "Use the existing simple game collider, not the detail mesh"
    assets.append(obj)
    parts = []
    return obj


def normalize_mesh(obj, target_size, floor=False):
    # Used only for natural set-dressing, never to distort the ramp's ride profile.
    points = [Vector((v.co.x, v.co.z, -v.co.y)) for v in obj.data.vertices]
    low = Vector(tuple(min(v[i] for v in points) for i in range(3)))
    high = Vector(tuple(max(v[i] for v in points) for i in range(3)))
    center = (low + high) / 2
    scale = Vector(tuple(target_size[i] / (high[i] - low[i]) for i in range(3)))
    for vertex, p in zip(obj.data.vertices, points):
        result = Vector(tuple((p[i] - center[i]) * scale[i] for i in range(3)))
        if floor:
            result.y += target_size[1] / 2
        vertex.co = coord(result)
    obj.data.update()


def make_ramp():
    # True sheet-metal wedge. Its top matches the simple linear physics ramp.
    zs = [-2.0, -1.84, -.65, .68, 2.0]
    vertices = [(-.875, 0, -2), (.875, 0, -2)]
    for z in zs[1:]:
        top = (z + 2) / 4
        bottom = max(0, top - .045)
        vertices += [(-.875, bottom, z), (.875, bottom, z),
                     (.875, top, z), (-.875, top, z)]
    # The leading nose shares vertices instead of generating zero-area faces.
    faces = [(0, 1, 3, 2), (0, 5, 4, 1), (0, 2, 5), (1, 4, 3),
             tuple(2 + (len(zs) - 2) * 4 + i for i in range(4))]
    for j in range(len(zs) - 2):
        for i in range(4):
            faces.append((2 + j * 4 + i, 2 + j * 4 + (i + 1) % 4,
                          2 + (j + 1) * 4 + (i + 1) % 4, 2 + (j + 1) * 4 + i))
    create("Welded driving deck", vertices, faces, deck)

    # Flat ground runners, diagonal bracing and rear legs make a believable frame.
    for side in (-1, 1):
        x = side * .94
        box("Ground runner", (x, .04, .03), (.12, .08, 3.86), steel, .012)
        beam("Rising side box rail", (x, .053, -1.80), (x, .890, 1.76),
             .11, .085, steel)
        beam("Rear vertical leg", (x, .08, 1.78), (x, .90, 1.78),
             .105, .105, steel)
        beam("Middle vertical leg", (x, .08, .25), (x, .49, .25),
             .085, .085, steel)
        beam("Rear diagonal brace", (x, .095, .33), (x, .85, 1.69),
             .070, .060, steel)
        beam("Front diagonal brace", (x, .09, -1.31), (x, .46, .15),
             .065, .055, steel)
        # Orange wheel guides have a rounded outer edge and stay inside the bounds.
        for za, zb in ((-1.93, -.65), (-.64, .67), (.68, 1.88)):
            ya, yb = (za + 2) / 4, (zb + 2) / 4
            beam("Orange edge guide", (side * .929, ya + .020, za),
                 (side * .929, yb + .020, zb), .14, .026, orange, .008)
        for z in (-1.77, -.66, .68, 1.77):
            y = (z + 2) / 4 + .036
            normal = Vector((0, 4, -1)).normalized()
            center = Vector((side * .930, y, z))
            rod("Hex guide fastener", center, center + normal * .011, .017, alloy, 6)

    for z in (-.75, .27, 1.78):
        y = max(.10, (z + 2) / 4 - .075)
        beam("Transverse deck joist", (-.92, y, z), (.92, y, z),
             .095, .070, steel)
    beam("Rear lower cross brace", (-.85, .15, 1.80), (.85, .83, 1.80),
         .060, .050, steel)
    beam("Rear crossing brace", (.85, .15, 1.80), (-.85, .83, 1.80),
         .060, .050, steel)
    box("Top landing edge", (0, .970, 1.978), (2, .060, .044), steel, .008)

    # Small pressed lozenges catch the sun along two tire paths.
    normal = Vector((0, 4, -1)).normalized()
    for row in range(15):
        z = -1.78 + row * .238
        for track in (-1, 1):
            for column in (-1, 1):
                x = track * .49 + column * .11
                zz = z + (.046 if column == 1 else 0)
                points = [(x - .075, (zz + 2) / 4 + .002, zz),
                          (x, (zz + .052 + 2) / 4 + .002, zz + .052),
                          (x + .075, (zz + 2) / 4 + .002, zz),
                          (x, (zz - .052 + 2) / 4 + .002, zz - .052)]
                closed_patch("Pressed anti-slip lozenge", points, normal, .0045,
                             alloy if row % 4 == 0 else deck)
    for z in (-.65, .68):
        y = (z + 2) / 4 + .002
        beam("Deck panel seam", (-.868, y, z), (.868, y, z), .009, .006, steel, 0)
    obj = finish("DRS_Ramp")
    obj["ride_height"] = "y = (z + 2) / 4; -2 <= z <= 2"
    obj["ride_width"] = 1.75


def make_barrier():
    # Cross-section follows a Jersey barrier, with a broad foot and narrow top.
    section = [(.0, -.70), (.20, -.70), (.65, -.34), (1.58, -.255),
               (1.70, -.20), (1.70, .20), (1.58, .255), (.65, .34),
               (.20, .70), (.0, .70)]
    xs = [-2.85, -1.92, -1.83, -1.43, -1.34, 1.34, 1.43, 1.83, 1.92, 2.85]
    notch = [0, 0, .165, .165, 0, 0, .165, .165, 0, 0]
    verts, colors = [], []
    cream, dust = rgba("#dbcfb7"), rgba("#b8a585")
    for j, x in enumerate(xs):
        for y, z in section:
            yy = max(y, notch[j]) if y < .20 else y
            verts.append((x, yy, z))
            colors.append(mix_color(dust, cream, min(1, .24 + yy / 1.4)))
    n = len(section)
    faces = [tuple(reversed(range(n))), tuple((len(xs) - 1) * n + i for i in range(n))]
    for j in range(len(xs) - 1):
        for i in range(n):
            faces.append((j * n + i, j * n + (i + 1) % n,
                          (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    create("Cast concrete with forklift recesses", verts, faces, concrete, .035, colors=colors)

    def face_z(y):
        if y <= .65:
            return .70 - (y - .20) / .45 * .36
        if y <= 1.58:
            return .34 - (y - .65) / .93 * .085
        return .255 - (y - 1.58) / .12 * .055

    # Colored bands are split at the changes in slope instead of floating rectangles.
    levels = [.215, .65, 1.58, 1.685]
    turquoise = rgba("#369ba4")
    for center in (-1.90, 0, 1.90):
        for side in (-1, 1):
            for level in range(len(levels) - 1):
                ya, yb = levels[level:level + 2]
                wobble_a = .018 * math.sin(center * 4 + ya * 11)
                wobble_b = .018 * math.sin(center * 4 + yb * 11)
                points = [(center - .435 + wobble_a, ya, side * (face_z(ya) + .003)),
                          (center + .435 + wobble_a, ya, side * (face_z(ya) + .003)),
                          (center + .435 + wobble_b, yb, side * (face_z(yb) + .003)),
                          (center - .435 + wobble_b, yb, side * (face_z(yb) + .003))]
                tint = mix_color(turquoise, dust, .11 if level == 0 else .035)
                closed_patch("Worn turquoise stripe", points, (0, .12, side), .002,
                             concrete, tint)
            # Restrained small chipped paint islands read as wear, not visual noise.
            for i in range(3):
                x = center - .39 + i * .38
                y = .36 + ((i * .31 + center * .17) % 1.05)
                z = side * (face_z(y) + .008)
                points = [(x - .047, y - .018, z), (x + .025, y - .014, z),
                          (x + .059, y + .013, z), (x - .021, y + .027, z)]
                closed_patch("Paint edge chip", points, (0, 0, side), .001,
                             concrete, cream)
    # Lifting sockets are dark, inset-looking oval details on the upper face.
    for side in (-1, 1):
        for x in (-2.40, 2.40):
            points = []
            for i in range(10):
                a = math.tau * i / 10
                y = 1.28 + .061 * math.sin(a)
                points.append((x + .048 * math.cos(a), y, side * (face_z(y) + .004)))
            closed_patch("Cast lifting socket", points, (0, 0, side), .001,
                         concrete, rgba("#8b806d"))
    finish("DRS_Barrier")


def make_rock():
    # Geologic ledges are part of one connected, smoothly weathered shell.
    # Unequal angular frequencies avoid the tell-tale regular radial-primitive look.
    rings = [(-1, .70), (-.96, .84), (-.86, .94), (-.68, .99),
             (-.62, 1.0), (-.58, .95), (-.54, .87), (-.44, .91),
             (-.24, .96), (-.195, .96), (-.158, .86), (-.10, .88),
             (.13, .96), (.195, .96), (.238, .89), (.37, .87),
             (.55, .82), (.59, .82), (.635, .75), (.75, .74),
             (.87, .61), (.965, .37), (1.0, .055)]
    n = 40
    vertices, colors = [], []
    warm = [rgba(c) for c in ("#98613c", "#ba7949", "#cb8a57", "#dfa875", "#c98a59")]
    for j, (y, radius) in enumerate(rings):
        for i in range(n):
            angle = i * math.tau / n
            erosion = (1 + .065 * math.sin(angle * 3 + .34) +
                       .028 * math.sin(angle * 7 - y * .5) +
                       .018 * math.sin(angle * 11 + .4))
            radial = radius * erosion
            x = radial * math.cos(angle) + .08 * math.sin(y * 1.7)
            z = radial * math.sin(angle) * .88 + .055 * math.cos(y * 2.3)
            ripple = .018 * math.sin(angle * 4 + y * 2)
            yy = y + ripple * min(1, (1 - abs(y)) * 5)
            vertices.append((x, yy, z))
            band = 0 if y < -.56 else 1 if y < -.17 else 2 if y < .23 else 3 if y < .63 else 4
            shade = .91 + .09 * math.sin(angle * 3 + y * 5)
            tint = warm[band]
            # Narrow recessed bands are warm shadows, not painted black rings.
            if j in (6, 10, 14, 18):
                shade *= .91
            colors.append(tuple(tint[k] * shade if k < 3 else 1 for k in range(4)))
    faces = [tuple(reversed(range(n))), tuple((len(rings) - 1) * n + i for i in range(n))]
    for j in range(len(rings) - 1):
        for i in range(n):
            faces.append((j * n + i, j * n + (i + 1) % n,
                          (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    create("Weathered layered sandstone", vertices, faces, stone, smooth=True, colors=colors)
    obj = finish("DRS_Rock")
    normalize_mesh(obj, (2, 2, 2))


def cactus_tube(name, path, ribs=11):
    n = 44
    vertices, colors = [], []
    ridge, valley = rgba("#889452"), rgba("#576b34")
    for j, (center, radius) in enumerate(path):
        p = Vector(center)
        prev = Vector(path[max(0, j - 1)][0])
        following = Vector(path[min(len(path) - 1, j + 1)][0])
        tangent = (following - prev).normalized()
        u = Vector((0, 0, 1)).cross(tangent).normalized()
        v = tangent.cross(u).normalized()
        for i in range(n):
            angle = i * math.tau / n
            crest = (math.cos(angle * ribs) + 1) / 2
            r = radius * (.94 + .075 * crest)
            point = p + r * (u * math.cos(angle) + v * math.sin(angle))
            vertices.append(tuple(point))
            tint = mix_color(valley, ridge, .18 + .82 * crest)
            shade = .95 + .05 * math.sin(angle + .9)
            colors.append(tuple(tint[k] * shade if k < 3 else 1 for k in range(4)))
    faces = [tuple(reversed(range(n))), tuple((len(path) - 1) * n + i for i in range(n))]
    for j in range(len(path) - 1):
        for i in range(n):
            faces.append((j * n + i, j * n + (i + 1) % n,
                          (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    create(name, vertices, faces, plant, smooth=True, colors=colors)


def make_cactus():
    main_path = []
    for y, radius in [(0, .260), (.16, .276), (.42, .285), (.85, .297),
                      (1.35, .304), (1.85, .297), (2.35, .282), (2.85, .260),
                      (3.25, .245), (3.58, .233), (3.75, .203),
                      (3.89, .141), (3.97, .070), (4, .006)]:
        main_path.append(((.035 * math.sin(y * .8), y, .028 * math.sin(y * 1.3)), radius))
    cactus_tube("Tall ribbed main stem", main_path)
    cactus_tube("Left curved arm", [
        ((-.13, 1.43, .018), .205), ((-.34, 1.44, .018), .202),
        ((-.53, 1.48, .021), .194), ((-.69, 1.58, .026), .187),
        ((-.79, 1.73, .031), .184), ((-.83, 1.93, .040), .178),
        ((-.83, 2.22, .049), .175), ((-.81, 2.56, .059), .167),
        ((-.80, 2.78, .065), .151), ((-.795, 2.90, .069), .112),
        ((-.793, 2.97, .071), .058), ((-.791, 2.99, .072), .006)])
    cactus_tube("Right curved arm", [
        ((.15, 2.05, -.035), .178), ((.33, 2.04, -.038), .177),
        ((.48, 2.09, -.041), .173), ((.59, 2.20, -.044), .170),
        ((.64, 2.36, -.049), .165), ((.65, 2.58, -.055), .158),
        ((.64, 2.89, -.061), .148), ((.63, 3.11, -.066), .132),
        ((.625, 3.21, -.068), .098), ((.623, 3.265, -.069), .054),
        ((.622, 3.28, -.070), .006)])
    # Small three-spine areoles: fine enough to read up close, restrained at speed.
    thorn_color = rgba("#c1b68b")
    for level in range(8):
        y = .45 + level * .385
        stem_r = .293 if y < 2 else .272 if y < 2.7 else .25
        for i in (1, 4, 7, 10):
            angle = (i + .5) * math.tau / 11
            radial = Vector((math.cos(angle), 0, math.sin(angle)))
            tangent = Vector((-math.sin(angle), 0, math.cos(angle)))
            center = Vector((.035 * math.sin(y * .8), y, .028 * math.sin(y * 1.3))) + radial * stem_r
            for tilt in (-1, 0, 1):
                tip = center + radial * .038 + Vector((0, .024 if tilt == 0 else -.012, 0)) + tangent * tilt * .012
                vertices = [tuple(center - tangent * .004), tuple(center + tangent * .004), tuple(tip)]
                create("Subtle cactus spine", vertices, [(0, 1, 2)], plant,
                       colors=[thorn_color] * 3)
    obj = finish("DRS_Cactus")
    # Smooth caps can slightly overhang the end tangent. Freeze the actual height.
    verts = [Vector((v.co.x, v.co.z, -v.co.y)) for v in obj.data.vertices]
    ymin, ymax = min(p.y for p in verts), max(p.y for p in verts)
    for vertex, p in zip(obj.data.vertices, verts):
        p.y = (p.y - ymin) * 4 / (ymax - ymin)
        vertex.co = coord(p)
    obj.data.update()


make_ramp()
make_barrier()
make_rock()
make_cactus()

# Bounds and triangle counts are returned to the MCP caller for integration QA.
def asset_report(obj):
    points = [Vector((v.co.x, v.co.z, -v.co.y)) for v in obj.data.vertices]
    low = [min(v[i] for v in points) for i in range(3)]
    high = [max(v[i] for v in points) for i in range(3)]
    obj.data.calc_loop_triangles()
    return {
        "name": obj.name,
        "min": [round(v, 5) for v in low],
        "max": [round(v, 5) for v in high],
        "size": [round(high[i] - low[i], 5) for i in range(3)],
        "vertices": len(obj.data.vertices),
        "triangles": len(obj.data.loop_triangles),
        "material_groups": len(obj.data.materials),
    }

reports = [asset_report(asset) for asset in assets]
triangle_count = sum(report["triangles"] for report in reports)
if triangle_count > 30000:
    raise RuntimeError(f"Track library exceeds its 30000 triangle budget: {triangle_count}")

bpy.ops.object.select_all(action="DESELECT")
for asset in assets:
    asset.select_set(True)
bpy.context.view_layer.objects.active = assets[0]
bpy.context.view_layer.update()
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    use_selection=True,
    use_active_scene=True,
    export_apply=True,
    export_yup=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
result = {
    "scene": scene.name,
    "glb": str(GLB_PATH),
    "blend": str(BLEND_PATH),
    "assets": reports,
    "triangles": triangle_count,
    "bytes": GLB_PATH.stat().st_size,
    "size_target_met": GLB_PATH.stat().st_size <= 1050000,
    "untextured": True,
    "notes": "Four stable roots; no default cube, camera or lights exported. "
             "Ramp driving surface stays linear. Natural assets use vertex colors.",
}
