"""DUST RUSH: compact authored world-asset library.

Run inside the connected Blender application, never by resetting the user's file.
All modelling coordinates use game metres (X across, Y up, Z forward).
Five physics props are centred on their existing physics origin; workshop objects
are ground-centred. The exporter writes ONLY explicitly selected asset roots.
No external textures, fonts, downloads or add-ons are required.

The source builds a fresh scene and refuses to replace an existing authored scene.
A separate review scene stages linked meshes with a camera and studio lights.
"""
from pathlib import Path
import math
import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SCENE_NAME = "DR_WorldAssets_v1"
REVIEW_NAME = "DR_WorldAssets_v1_Review"
if bpy.data.scenes.get(SCENE_NAME) or bpy.data.scenes.get(REVIEW_NAME):
    raise RuntimeError("World-asset scenes already exist: inspect them before rebuilding.")
scene = bpy.data.scenes.new(SCENE_NAME)
bpy.context.window.scene = scene
scene.unit_settings.system = "METRIC"
collection = bpy.data.collections.new("DRP_Export")
scene.collection.children.link(collection)
parts, assets = [], []


def xyz(p):
    return (p[0], -p[2], p[1])


def linear(s):
    return s / 12.92 if s < .04045 else ((s + .055) / 1.055) ** 2.4


def material(name, hex_color, metal=0, rough=.55, coat=0):
    mat = bpy.data.materials.new("DRP_" + name)
    mat.use_nodes = True
    rgba = tuple(linear(int(hex_color[i:i + 2], 16) / 255) for i in (1, 3, 5)) + (1,)
    mat.diffuse_color = rgba
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Coat Weight"].default_value = coat
    shader.inputs["Coat Roughness"].default_value = .28
    return mat


paint = material("CarPaint_Weathered_Turquoise", "#419b9a", .18, .48, .22)
machine_paint = material("Compressor_Turquoise", "#1699a7", .3, .34, .4)
orange = material("Safety_Orange", "#e9782c", .14, .45, .2)
rubber = material("Rubber", "#242a2c", 0, .88)
graphite = material("Graphite_Steel", "#39474a", .65, .48)
steel = material("Brushed_Steel", "#97a6a8", .8, .37)
cream = material("Ivory_Reflector", "#e9ddbc", .05, .48)
glass = material("Smoked_Glass", "#20363d", .22, .18, .6)
red = material("Tail_Lens", "#a9422e", .1, .36, .45)
rust = material("Oxidised_Edges", "#885333", .15, .95)
wood = [
    material("Honey_Wood", "#b78347", 0, .8),
    material("Light_Wood", "#c19359", 0, .78),
    material("Dark_Wood", "#986737", 0, .85),
]


def create(name, vertices, faces, mat, bevel=0, smooth=False, bevel_segments=2):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([xyz(v) for v in vertices], [], faces)
    mesh.materials.append(mat)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    ob = bpy.data.objects.new(name, mesh)
    collection.objects.link(ob)
    parts.append(ob)
    if smooth:
        for poly in mesh.polygons:
            poly.use_smooth = len(poly.vertices) == 4
    if bevel:
        modifier = ob.modifiers.new("Manufactured edge radius", "BEVEL")
        modifier.width = bevel
        modifier.segments = bevel_segments
        modifier.limit_method = "ANGLE"
        modifier.angle_limit = .45
        modifier.harden_normals = True
        normal = ob.modifiers.new("Weighted face normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
        normal.weight = 40
    return ob


def box(name, centre, size, mat, bevel=.018):
    vertices = [
        (centre[0] + x * size[0] / 2, centre[1] + y * size[1] / 2, centre[2] + z * size[2] / 2)
        for x, y, z in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                        (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
    ]
    return create(name, vertices, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                                   (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat, bevel)


def frame(axis):
    d = Vector(axis).normalized()
    ref = Vector((0, 1, 0)) if abs(d.y) < .9 else Vector((1, 0, 0))
    u = d.cross(ref).normalized()
    return d, u, d.cross(u).normalized()


def lathe(name, centre, axis, profile, mat, segments=32, closed=True, smooth=True):
    d, u, v = frame(axis)
    c = Vector(centre)
    vertices = [tuple(c + d * along + radius * (u * math.cos(i * math.tau / segments) + v * math.sin(i * math.tau / segments)))
                for along, radius in profile for i in range(segments)]
    faces = []
    for j in range(len(profile) - (0 if closed else 1)):
        k = (j + 1) % len(profile)
        for i in range(segments):
            ni = (i + 1) % segments
            faces.append((j * segments + i, j * segments + ni, k * segments + ni, k * segments + i))
    if not closed:
        faces += [tuple(reversed(range(segments))),
                  tuple((len(profile) - 1) * segments + i for i in range(segments))]
    return create(name, vertices, faces, mat, 0, smooth)


def rod(name, a, b, radius, mat, segments=16):
    a, b = Vector(a), Vector(b)
    return lathe(name, a, b - a, [(0, radius), ((b - a).length, radius)], mat, segments, False)


def torus(name, centre, axis, radius, thickness, mat, segments=32, sides=6):
    profile = [(math.sin(j * math.tau / sides) * thickness,
                radius + math.cos(j * math.tau / sides) * thickness) for j in range(sides)]
    return lathe(name, centre, axis, profile, mat, segments)


def pipe(name, points, radius, mat, segments=10):
    for a, b in zip(points, points[1:]):
        rod(name, a, b, radius, mat, segments)


def panel(name, points, thickness, mat, bevel=.008):
    a, b, c = map(Vector, points[:3])
    normal = (b - a).cross(c - a).normalized()
    vertices = [tuple(Vector(p) + normal * direction * thickness / 2) for direction in [-1, 1] for p in points]
    n = len(points)
    faces = [tuple(reversed(range(n))), tuple(n + i for i in range(n))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return create(name, vertices, faces, mat, bevel)


def beam(name, a, b, width, depth, mat, bevel=.012):
    a, b = Vector(a), Vector(b)
    d, u, v = frame(b - a)
    vertices = [tuple(p + u * width * su / 2 + v * depth * sv / 2)
                for p in [a, b] for su, sv in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
    return create(name, vertices, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                                   (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat, bevel)


def loft(name, sections, mat, corners=16, power=.43, bevel=.012):
    vertices = []
    for z, width, low, high in sections:
        for i in range(corners):
            a = i * math.tau / corners
            co, si = math.cos(a), math.sin(a)
            x = math.copysign(abs(co) ** power, co) * width / 2
            y = (high + low) / 2 + math.copysign(abs(si) ** power, si) * (high - low) / 2
            vertices.append((x, y, z))
    faces = [tuple(reversed(range(corners))),
             tuple((len(sections) - 1) * corners + i for i in range(corners))]
    for j in range(len(sections) - 1):
        for i in range(corners):
            ni = (i + 1) % corners
            faces.append((j * corners + i, j * corners + ni, (j + 1) * corners + ni, (j + 1) * corners + i))
    return create(name, vertices, faces, mat, bevel, True)


def finish(name, half_height=None):
    """Join only the current asset; geometry is baked into a zero-transform root."""
    global parts
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for ob in parts:
        baked = bpy.data.meshes.new_from_object(ob.evaluated_get(depsgraph))
        ob.modifiers.clear()
        ob.data = baked
    bpy.ops.object.select_all(action="DESELECT")
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    root = bpy.context.object
    root.name = "DRP_" + name
    root.data.name = root.name + "_Mesh"
    if half_height is not None:
        for vertex in root.data.vertices:
            vertex.co.z -= half_height
        root["physics_half_height"] = half_height
        root["origin"] = "physics-centred"
    else:
        root["origin"] = "ground-centred"
    root["authoring_axes"] = "X across / Y up / Z forward in exported glTF"
    assets.append(root)
    parts = []
    return root


# A recognisable compact four-door sedan, with genuine wheel-arch cut-outs.
def car():
    # Narrow central underbody leaves visible hollow wheel wells.
    box("Recessed floor pan", (0, .46, 0), (1.73, .21, 3.86), graphite, .06)
    box("Inner body core", (0, .70, 0), (1.64, .42, 3.90), paint, .09)
    # Continuous pressed side panels: upper contour and two circular wheel openings.
    top = [(-2.03, .71), (-1.88, .91), (-1.17, .96), (.83, .96), (1.91, .88), (2.04, .72)]
    profile = top + [(2.04, .40)]
    for centre in [1.27, -1.27]:
        profile += [(centre + .51 * math.cos(i * math.pi / 18),
                     .40 + .51 * math.sin(i * math.pi / 18)) for i in range(19)]
    profile += [(-2.03, .40)]
    for sign in [-1, 1]:
        vertices = [(sign * x, y, z) for x in [.89, 1.035] for z, y in profile]
        n = len(profile)
        faces = [tuple(reversed(range(n))), tuple(n + i for i in range(n))]
        faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
        create("Pressed quarter panels with wheel arches", vertices, faces, paint, .023)
        for axle_z in [-1.27, 1.27]:
            points = [(sign * 1.052, .40 + .521 * math.sin(i * math.pi / 20),
                       axle_z + .521 * math.cos(i * math.pi / 20)) for i in range(21)]
            pipe("Rolled wheel-arch lip", points, .020, paint, 8)
        box("Recessed rocker panel", (sign * 1.039, .49, 0), (.025, .085, 1.45), graphite, .018)
        # The four doors have a defined waist, seam, handles and restrained rubber trim.
        for z in [-.35, .71]:
            pipe("Pressed door seam", [(sign * 1.045, .55, z), (sign * 1.045, .89, z)], .008, graphite, 6)
        box("Side protection strip", (sign * 1.053, .64, 0), (.045, .055, 1.83), graphite, .018)
        for z in [-.65, .30]:
            box("Door handle recess", (sign * 1.061, .88, z), (.028, .064, .17), graphite, .019)
            box("Door pull", (sign * 1.082, .883, z), (.022, .025, .125), steel, .008)
    loft("Sloping bonnet", [(.78, 1.88, .85, .95), (1.36, 1.89, .84, .94),
                            (1.88, 1.84, .77, .87), (2.03, 1.76, .70, .79)], paint)
    loft("Short trunk deck", [(-2.03, 1.78, .70, .84), (-1.81, 1.9, .77, .94),
                              (-1.05, 1.9, .85, .98)], paint)
    # Window body deliberately slopes on all four sides.
    base_front, base_rear, roof_front, roof_rear = .83, -1.10, .33, -.66
    base_y, roof_y, width, roof_width = .94, 1.64, .95, .79
    vertices = [(-width, base_y, base_rear), (width, base_y, base_rear),
                (width, base_y, base_front), (-width, base_y, base_front),
                (-roof_width, roof_y, roof_rear), (roof_width, roof_y, roof_rear),
                (roof_width, roof_y, roof_front), (-roof_width, roof_y, roof_front)]
    create("Four-door greenhouse and pillars", vertices,
           [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2),
            (2, 6, 7, 3), (3, 7, 4, 0)], paint, .048)
    for front in [True, False]:
        low_z, high_z = (base_front, roof_front) if front else (base_rear, roof_rear)
        offset = .014 if front else -.014
        def screen(x, t):
            return (x, base_y + (roof_y - base_y) * t,
                    low_z + (high_z - low_z) * t + offset)
        panel("Windscreen rubber seal", [screen(-.85, .10), screen(.85, .10),
                                         screen(.745, .91), screen(-.745, .91)], .025, rubber, .026)
        panel("Windscreen", [screen(-.815, .15), screen(.815, .15),
                            screen(.710, .86), screen(-.710, .86)], .039, glass, .023)
    for sign in [-1, 1]:
        def side(z, t, offset=0):
            return (sign * (width + (roof_width - width) * t + .016 + offset),
                    base_y + (roof_y - base_y) * t, z)
        windows = [
            [side(-1.00, .14), side(-.32, .14), side(-.30, .88), side(-.65, .88)],
            [side(-.25, .14), side(.70, .14), side(.27, .88), side(-.25, .88)],
        ]
        for points in windows:
            panel("Inset side-window seal", points, .022, rubber, .022)
            centre = sum(map(Vector, points), Vector()) / 4
            inset = [tuple(centre + (Vector(p) - centre) * .88 + Vector((sign * .015, 0, 0))) for p in points]
            panel("Separate door glass", inset, .014, glass, .018)
        box("Mirror pedestal", (sign * .99, 1.04, .70), (.11, .052, .08), graphite, .019)
        box("Door mirror", (sign * 1.11, 1.065, .66), (.19, .105, .16), graphite, .045)
        box("Mirror glass", (sign * 1.115, 1.065, .573), (.14, .065, .010), steel, .017)
    box("Crowned roof", (0, 1.647, -.15), (1.65, .10, 1.04), paint, .075)
    # Fascias and softly radiused steel bumpers.
    for z, is_front in [(2.035, True), (-2.035, False)]:
        offset = 1 if is_front else -1
        box("Bumper", (0, .485, z + offset * .04), (2.16, .18, .18), graphite, .065)
        box("Bumper bright trim", (0, .55, z + offset * .136), (1.87, .027, .021), steel, .01)
        box("Number-plate recess", (0, .57, z + offset * .148), (.39, .13, .018), rubber, .012)
        for x in [-.78, .78]:
            box("Lamp housing", (x, .755, z + offset * .016), (.47, .26, .087), graphite, .04)
            box("Ribbed lamp lens", (x, .768, z + offset * .066), (.385, .175, .024), cream if is_front else red, .025)
            for dx in [-.12, 0, .12]:
                box("Lens moulding", (x + dx, .768, z + offset * .082), (.009, .133, .007), steel if is_front else orange, .002)
        if is_front:
            box("Inset radiator grille", (0, .755, 2.098), (.91, .245, .045), rubber, .025)
            for y in [.68, .73, .78, .83]:
                box("Grille slat", (0, y, 2.124), (.85, .021, .020), graphite, .006)
            for x in [-1.009, 1.009]:
                box("Amber side indicator", (x, .760, 1.912), (.054, .14, .20), orange, .027)
    for side in [-1, 1]:
        for z in [-1.27, 1.27]:
            x = side * 1.04
            lathe("Worn road tyre", (x, .40, z), (1, 0, 0),
                  [(-.13, .21), (-.15, .26), (-.125, .36), (-.08, .40),
                   (.08, .40), (.125, .36), (.15, .26), (.13, .21)], rubber, 28)
            face_x = x + side * .155
            rod("Pressed steel wheel", (face_x - side * .018, .40, z),
                (face_x + side * .014, .40, z), .223, graphite, 24)
            torus("Wheel rolled rim", (face_x + side * .02, .40, z), (1, 0, 0), .207, .019, steel, 24)
            rod("Wheel hub", (face_x, .40, z), (face_x + side * .033, .40, z), .077, steel, 16)
            for i in range(4):
                angle = i * math.tau / 4
                y, zz = .40 + math.sin(angle) * .13, z + math.cos(angle) * .13
                rod("Wheel ventilation recess", (face_x + side * .014, y, zz),
                    (face_x + side * .019, y, zz), .026, rubber, 8)
    # A few geometric paint chips, not noisy random speckles over every surface.
    for sign, y, z, length in [(-1, .57, .12, .31), (1, .85, -1.53, .24),
                              (1, .58, -.60, .20), (-1, .73, 1.77, .16)]:
        panel("Exposed primer at a small dent", [(sign * 1.058, y, z), (sign * 1.059, y + .028, z + length),
                                                (sign * 1.058, y + .015, z + length * 1.1),
                                                (sign * 1.059, y - .012, z + .05)], .005, rust, .002)
    return finish("Car", .85)


def barrel():
    # An actual rolled-steel drum, with recessed lid, pressed ribs and two bungs.
    lathe("Rolled drum shell", (0, 0, 0), (0, 1, 0),
          [(.03, .63), (.055, .69), (.12, .687), (.16, .662),
           (.42, .662), (.45, .69), (.49, .70), (.53, .662),
           (1.23, .662), (1.27, .70), (1.31, .69), (1.34, .662),
           (1.65, .662), (1.69, .688), (1.745, .689), (1.77, .64),
           (1.755, .62), (.045, .62)], orange, 40)
    for y, radius in [(.075, .691), (.481, .697), (1.287, .697), (1.739, .692)]:
        torus("Steel rolled drum bead", (0, y, 0), (0, 1, 0), radius, .023, steel, 40)
    rod("Recessed drum lid", (0, 1.734, 0), (0, 1.753, 0), .642, orange, 40)
    rod("Drum base", (0, .038, 0), (0, .050, 0), .630, graphite, 32)
    for x, z, radius in [(.29, .27, .087), (-.33, -.26, .045)]:
        torus("Threaded bung ring", (x, 1.774, z), (0, 1, 0), radius, .017, steel, 16)
        rod("Recessed bung plug", (x, 1.757, z), (x, 1.777, z), radius * .75, graphite, 12)
        box("Bung square socket", (x, 1.781, z), (.041, .009, .041), rubber, .003)
    # Seam weld and a worn, small light label keep it recognisable when knocked over.
    pipe("Longitudinal drum seam", [(-.61, .18, -.265), (-.61, 1.66, -.265)], .010, rust, 6)
    panel("Small paper label", [(-.22, .80, .625), (.22, .80, .625), (.22, 1.11, .625), (-.22, 1.11, .625)], .011, cream, .012)
    for x, y in [(-.39, .25), (.42, 1.50), (.17, .31)]:
        z = math.sqrt(.665 ** 2 - x ** 2)
        box("Scraped drum paint", (x, y, z), (.085, .026, .008), rust, .009)
    return finish("Barrel", .9)


def crate():
    # Separate recessed boards, corner posts and four diagonal braces.
    for i in range(5):
        x = -.64 + i * .32
        box("Top slatted lid", (x, 1.58, 0), (.309, .095, 1.57), wood[i % 3], .017)
        box("Bottom board", (x, .07, 0), (.309, .11, 1.57), wood[(i + 1) % 3], .017)
    for sign in [-1, 1]:
        for i in range(5):
            t = -.64 + i * .32
            box("Front and back plank", (t, .82, sign * .766), (.307, 1.42, .075), wood[i % 3], .018)
            box("Side plank", (sign * .766, .82, t), (.075, 1.42, .307), wood[(i + 1) % 3], .018)
        for y in [.16, 1.49]:
            box("Front batten", (0, y, sign * .827), (1.66, .19, .095), wood[1], .024)
            box("Side batten", (sign * .827, y, 0), (.095, .19, 1.66), wood[1], .024)
        beam("Diagonal front brace", (-.66, .31, sign * .847), (.66, 1.33, sign * .847),
             .14, .073, wood[1], .019)
        beam("Diagonal side brace", (sign * .847, .31, -.66), (sign * .847, 1.33, .66),
             .14, .073, wood[1], .019)
    for x in [-.725, .725]:
        for z in [-.725, .725]:
            box("Heavy corner post", (x, .83, z), (.16, 1.59, .16), wood[2], .023)
            for y in [.17, 1.47]:
                sx, sz = math.copysign(1, x), math.copysign(1, z)
                box("Steel corner angle face", (x, y, sz * .886), (.29, .29, .032), graphite, .015)
                box("Steel corner angle side", (sx * .886, y, z), (.032, .29, .29), graphite, .015)
                rod("Square-head corner bolt", (x, y, sz * .905), (x, y, sz * .925), .033, steel, 6)
                rod("Side corner bolt", (sx * .905, y, z), (sx * .925, y, z), .033, steel, 6)
    # Sparse shallow grain on the visible battens; deliberate variation between boards.
    for z in [-.78, -.49, -.13, .22, .55]:
        box("Lid wood grain", (.14, 1.631, z), (.81, .003, .008), wood[2], .001)
    return finish("Crate", .825)


def cone():
    box("Heavy rounded rubber base", (0, .078, 0), (1.04, .156, 1.04), rubber, .075)
    for x in [-.39, .39]:
        for z in [-.39, .39]:
            rod("Base moulding recess", (x, .154, z), (x, .158, z), .046, graphite, 12)
    # Thick hollow mouth; stripes share the exact tapered silhouette.
    def radius(y):
        return .433 + (.075 - .433) * (y - .14) / 1.13
    lathe("Lower cone", (0, 0, 0), (0, 1, 0), [(.14, radius(.14)), (.64, radius(.64))], orange, 32, False)
    lathe("Wide ivory safety stripe", (0, 0, 0), (0, 1, 0),
          [(.64, radius(.64)), (.88, radius(.88))], cream, 32, False)
    lathe("Upper hollow cone", (0, 0, 0), (0, 1, 0),
          [(.88, radius(.88)), (1.27, .075), (1.286, .069), (1.278, .046), (1.13, .046)], orange, 32)
    rod("Dark neck cavity", (0, 1.12, 0), (0, 1.127, 0), .045, rubber, 24)
    torus("Base moulded lip", (0, .158, 0), (0, 1, 0), .432, .022, orange, 32)
    return finish("Cone", .65)


def tyre_geometry(centre=(0, .8, 0), axis=(0, 0, 1), scale=1):
    d, u, v = frame(axis)
    c = Vector(centre)
    profile = [(-.245, .34), (-.28, .44), (-.255, .60), (-.17, .725), (-.09, .741),
               (.09, .741), (.17, .725), (.255, .60), (.28, .44), (.245, .34)]
    lathe("Tyre carcass with real opening", centre, axis,
          [(along * scale, radius * scale) for along, radius in profile], rubber, 40)
    for side in [-1, 1]:
        torus("Reinforced sidewall ring", tuple(c + d * side * .273 * scale), axis, .475 * scale, .012 * scale, graphite, 40)
        torus("Rubber bead", tuple(c + d * side * .247 * scale), axis, .349 * scale, .016 * scale, rubber, 32)
    for i in range(20):
        a = i * math.tau / 20
        for sign in [-1, 1]:
            vertices = []
            corners = [(sign * .008, a - .06), (sign * .239, a + .10),
                       (sign * .239, a + .22), (sign * .008, a + .06)]
            for r in [.717, .79]:
                for along, angle in corners:
                    curved_radius = r - .034 * (abs(along) / .239) ** 3
                    vertices.append(tuple(c + scale * (d * along + curved_radius * (u * math.cos(angle) + v * math.sin(angle)))))
            create("Chevron tread block", vertices, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                                                     (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], rubber, .014 * scale, bevel_segments=1)


def tyre():
    tyre_geometry()
    return finish("Tire", .8)


def tyre_stack():
    root = bpy.data.objects.new("DRP_TireStack", None)
    collection.objects.link(root)
    root["origin"] = "ground-centred"
    root["authoring_axes"] = "X across / Y up / Z forward in exported glTF"
    source = next(ob for ob in assets if ob.name == "DRP_Tire")
    for i in range(3):
        child = bpy.data.objects.new("Stack_tyre_%d" % i, source.data)
        collection.objects.link(child)
        child.parent = root
        child.location = xyz(((-1) ** i * .045, .28 + i * .55, 0))
        child.rotation_euler.x = -math.pi / 2
    assets.append(root)
    return root


def caster(x, y, z, radius=.115):
    rod("Caster wheel", (x - .057, y, z), (x + .057, y, z), radius, rubber, 16)
    for side in [-1, 1]:
        rod("Caster axle end", (x + side * .060, y, z), (x + side * .069, y, z), radius * .45, steel, 12)


def cabinet():
    for x in [-.42, .42]:
        for z in [-.29, .29]:
            caster(x, .13, z, .13)
            box("Caster bracket", (x, .25, z), (.13, .13, .13), graphite, .02)
    box("Folded cabinet carcass", (0, .84, 0), (1.07, 1.20, .75), orange, .048)
    box("Drawer recess", (0, .89, .393), (.954, 1.03, .036), graphite, .022)
    for i in range(6):
        y = .433 + i * .173
        box("Drawer face", (0, y, .429), (.91, .146, .045), orange, .021)
        box("Drawer inset pull", (0, y + .012, .455), (.76, .029, .018), graphite, .007)
        rod("Polished drawer handle", (-.345, y + .012, .474), (.345, y + .012, .474), .018, steel, 12)
    box("Cabinet rolled top rim", (0, 1.47, 0), (1.115, .12, .795), orange, .045)
    box("Nonslip top mat", (0, 1.535, 0), (1.018, .020, .697), rubber, .034)
    pipe("Cabinet side grab handle", [(-.535, 1.28, -.22), (-.635, 1.28, -.22),
                                    (-.635, 1.28, .22), (-.535, 1.28, .22)], .025, graphite)
    rod("Drawer lock", (.36, 1.48, .407), (.36, 1.48, .428), .025, steel, 16)
    return finish("Cabinet")


def wrench(x, y, z, length):
    beam("Wrench handle", (x, y - length / 2, z), (x, y + length / 2, z), .045, .022, steel, .008)
    torus("Wrench ring head", (x, y - length / 2, z), (0, 0, 1), .052, .017, steel, 12)
    # Open-end jaw: geometric U, not a keyhole icon.
    pipe("Open wrench jaw", [(x - .06, y + length / 2 + .05, z), (x - .044, y + length / 2 - .012, z),
                            (x + .044, y + length / 2 - .012, z), (x + .06, y + length / 2 + .05, z)], .020, steel, 8)


def workbench():
    for x in [-1.36, 1.36]:
        for z in [-.42, .42]:
            box("Workbench square steel leg", (x, .705, z), (.13, 1.37, .13), graphite, .024)
            box("Workbench rubber foot", (x, .043, z), (.21, .086, .21), rubber, .023)
            rod("Leg fixing bolt", (x, 1.24, z + .072), (x, 1.24, z + .086), .021, steel, 6)
    for z in [-.43, .43]:
        box("Bench apron", (0, 1.24, z), (2.79, .19, .10), graphite, .022)
    box("Low shelf", (0, .32, 0), (2.80, .085, .84), graphite, .02)
    for i in range(6):
        box("Solid beech bench top", (0, 1.405, -.46 + i * .185), (3.05, .145, .177), wood[i % 2], .020)
    # Rear uprights and a tool board are one grounded asset.
    for x in [-1.38, 1.38]:
        box("Tool board support", (x, 1.985, -.464), (.072, 1.18, .072), graphite, .011)
    box("Tool board panel", (0, 2.07, -.478), (2.82, 1.14, .055), graphite, .034)
    for i in range(5):
        wrench(-1.12 + i * .245, 2.12, -.421, .32 + i * .06)
    # A rack of screwdrivers and a pair of pliers.
    box("Screwdriver rack", (.78, 1.98, -.33), (.70, .047, .15), steel, .007)
    for i in range(4):
        x = .51 + i * .175
        rod("Screwdriver blade", (x, 1.80, -.34), (x, 2.20, -.34), .010, steel, 8)
        rod("Orange screwdriver grip", (x, 2.20, -.34), (x, 2.36, -.34), .036, orange, 12)
        torus("Screwdriver collar", (x, 2.20, -.34), (0, 1, 0), .036, .008, graphite, 12)
    for sign in [-1, 1]:
        pipe("Pliers jaws", [(sign * .07 + .14, 2.36, -.393), (.14, 2.20, -.393),
                            (sign * .065 + .14, 2.02, -.393)], .022, steel, 8)
        rod("Pliers orange grip", (sign * .062 + .14, 2.07, -.394),
            (sign * .09 + .14, 1.91, -.394), .030, orange, 12)
    # A small, proper bench vice with a screw handle.
    box("Vice swivel base", (-.89, 1.51, .14), (.45, .10, .38), graphite, .036)
    box("Vice body", (-.90, 1.64, .14), (.34, .22, .33), graphite, .055)
    for x in [-1.075, -.725]:
        box("Vice jaw", (x, 1.78, .14), (.070, .18, .39), graphite, .018)
        box("Vice jaw insert", (x + (.042 if x < -.9 else -.042), 1.81, .14), (.012, .075, .36), steel, .006)
    rod("Vice threaded screw", (-1.19, 1.63, .14), (-.57, 1.63, .14), .025, steel, 12)
    rod("Vice sliding handle", (-1.22, 1.45, .14), (-1.22, 1.81, .14), .015, steel, 10)
    # Stored steel boxes add a readable, useful workshop silhouette.
    for x, w, mat in [(-.82, .81, graphite), (.13, .52, orange), (.92, .63, steel)]:
        box("Shelf toolbox", (x, .55, 0), (w, .38, .52), mat, .046)
        box("Toolbox lid seam", (x, .70, 0), (w + .015, .038, .535), graphite, .011)
        pipe("Toolbox carry handle", [(x - .10, .754, 0), (x - .10, .804, 0),
                                      (x + .10, .804, 0), (x + .10, .754, 0)], .018, graphite)
        for dx in [-w * .28, w * .28]:
            box("Toolbox latch", (x + dx, .66, .277), (.055, .095, .018), steel, .011)
    return finish("Workbench")


def floor_jack():
    # Two pressed triangular side frames leave the hydraulic mechanism visible.
    profile = [(-.69, .20), (-.55, .40), (.46, .34), (.71, .19), (.69, .09), (-.65, .09)]
    for sign in [-1, 1]:
        vertices = [(sign * x, y, z) for x in [.20, .26] for z, y in profile]
        n = len(profile)
        create("Stamped jack side rail", vertices,
               [tuple(reversed(range(n))), tuple(n + i for i in range(n))] +
               [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)], orange, .023)
        for z, y in [(-.54, .15), (.55, .15)]:
            caster(sign * .29, y, z, .15)
    rod("Front axle", (-.37, .15, .55), (.37, .15, .55), .044, steel, 16)
    for sign in [-1, 1]:
        beam("Lifting arm", (sign * .13, .23, -.39), (sign * .13, .52, .40), .13, .085, orange, .027)
        rod("Arm pivot pin", (sign * .265, .28, -.40), (sign * .278, .28, -.40), .040, steel, 12)
    rod("Hydraulic cylinder", (0, .24, -.42), (0, .36, .12), .079, graphite, 20)
    rod("Polished hydraulic ram", (0, .36, .07), (0, .48, .36), .035, steel, 16)
    rod("Saddle support", (0, .43, .40), (0, .58, .40), .085, steel, 20)
    rod("Rubber lifting saddle", (0, .57, .40), (0, .63, .40), .205, rubber, 24)
    torus("Saddle rim", (0, .627, .40), (0, 1, 0), .186, .018, graphite, 24)
    rod("Handle socket", (0, .27, -.61), (0, .50, -.73), .076, orange, 16)
    rod("Long jack handle", (0, .47, -.71), (0, 1.72, -1.07), .031, graphite, 16)
    rod("Jack handle grip", (0, 1.43, -.987), (0, 1.76, -1.082), .047, rubber, 16)
    return finish("FloorJack")


def compressor():
    # Real horizontal receiver with domed ends, a finned pump and coiled air line.
    tank_profile = [(-.72, .04), (-.70, .18), (-.65, .29), (-.56, .35), (-.46, .37),
                    (.46, .37), (.56, .35), (.65, .29), (.70, .18), (.72, .04)]
    lathe("Domed air receiver", (0, .54, 0), (1, 0, 0), tank_profile, machine_paint, 32, False)
    for x in [-.48, .48]:
        torus("Receiver weld bead", (x, .54, 0), (1, 0, 0), .371, .009, steel, 32)
        caster(x, .165, -.01, .165)
        box("Wheel support", (x, .27, 0), (.12, .18, .14), graphite, .026)
    box("Pump mounting plate", (0, .938, 0), (.89, .07, .36), graphite, .024)
    rod("Electric drive motor", (.03, 1.08, 0), (.49, 1.08, 0), .174, graphite, 24)
    for x in [.14, .23, .32, .41]:
        torus("Motor cooling rib", (x, 1.08, 0), (1, 0, 0), .176, .013, graphite, 24)
    box("Motor capacitor box", (.25, 1.27, 0), (.27, .14, .19), graphite, .034)
    box("Compressor crankcase", (-.29, 1.07, 0), (.31, .27, .29), steel, .052)
    for y in [1.20, 1.245, 1.29, 1.335, 1.38]:
        box("Pump cylinder cooling fin", (-.29, y, 0), (.29, .022, .25), steel, .007)
    box("Pump cylinder head", (-.29, 1.42, 0), (.30, .06, .27), graphite, .027)
    pipe("Metal pressure pipe", [(-.26, 1.44, .13), (-.26, 1.49, .23),
                                 (.04, 1.45, .28), (.21, .89, .25)], .018, steel)
    pipe("Compressor carry handle", [(.46, .70, -.23), (.59, 1.44, -.23),
                                     (.59, 1.50, .23), (.46, .70, .23)], .029, machine_paint)
    rod("Handle rubber grip", (.59, 1.49, -.16), (.59, 1.49, .16), .042, rubber, 16)
    # Gauge is an actual inset disc with a readable needle and tick ring.
    rod("Pressure gauge body", (.35, 1.06, .18), (.35, 1.06, .255), .105, graphite, 24)
    rod("Gauge ivory face", (.35, 1.06, .258), (.35, 1.06, .265), .086, cream, 24)
    rod("Gauge needle", (.35, 1.06, .270), (.313, 1.116, .270), .005, red, 6)
    for i in range(7):
        a = math.radians(-40 + i * 43)
        rod("Gauge tick", (.35 + .068 * math.cos(a), 1.06 + .068 * math.sin(a), .272),
            (.35 + .078 * math.cos(a), 1.06 + .078 * math.sin(a), .272), .003, graphite, 6)
    rod("Pressure regulator", (.54, 1.015, .11), (.54, 1.085, .11), .061, graphite, 16)
    # Three hanging hose coils, with real thickness and a visible brass-coloured fitting.
    for i in range(3):
        torus("Air line coil", (.74 + i * .023, .80, .02), (1, 0, 0), .34 - i * .018, .018, orange, 32)
    pipe("Air line end", [(.77, .48, .08), (.84, .34, .08), (.90, .37, .08)], .018, orange)
    rod("Hose quick coupler", (.89, .37, .08), (.98, .37, .08), .035, steel, 12)
    return finish("Compressor")


for make in [car, barrel, crate, cone, tyre, tyre_stack, cabinet, workbench, floor_jack, compressor]:
    make()

# Export only the ten roots above; all authoring transforms are identity.
bpy.ops.object.select_all(action="DESELECT")
for asset in assets:
    asset.select_set(True)
    for child in asset.children_recursive:
        child.select_set(True)
bpy.context.view_layer.objects.active = assets[0]
bpy.context.view_layer.update()
glb_path = ROOT / "assets" / "world-assets-v1.glb"
bpy.ops.export_scene.gltf(
    filepath=str(glb_path), export_format="GLB", use_selection=True,
    use_active_scene=True, export_apply=True, export_yup=True,
    export_materials="EXPORT", export_extras=True,
)

# Save a recoverable editable source immediately after the successful export.
# Blender's library-write path is deliberately avoided for scene datablocks.
# copy=True does not replace the source document's active filepath.
blend_path = ROOT / "design" / "blender" / "world-assets-v1.blend"
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), copy=True)


def make_review_scene():
    """Create optional linked staging only after the core export/save succeeded."""
    if bpy.data.scenes.get(REVIEW_NAME):
        raise RuntimeError("Review scene already exists; inspect it instead of replacing it.")
    review = bpy.data.scenes.new(REVIEW_NAME)
    review.unit_settings.system = "METRIC"
    review.render.engine = "CYCLES"
    review.cycles.samples = 24
    review.render.resolution_x = 1600
    review.render.resolution_y = 1200
    review.render.resolution_percentage = 100
    review.world = bpy.data.worlds.new("DRP_Review_World")
    review.world.use_nodes = True
    review.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.18, .22, .23, 1)
    review.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .5
    review.view_settings.view_transform = "AgX"
    layout = [
        ("Car", (-4.0, .85, 2.3)),
        ("Barrel", (0, .9, 2.3)),
        ("Crate", (2.6, .825, 2.3)),
        ("Cone", (4.8, .65, 2.3)),
        ("Tire", (-3.6, .8, -.6)),
        ("TireStack", (-.9, 0, -.6)),
        ("Cabinet", (2.2, 0, -.6)),
        ("FloorJack", (4.8, 0, -.6)),
        ("Workbench", (-2.4, 0, -3.8)),
        ("Compressor", (2.2, 0, -3.8)),
    ]
    by_name = {ob.name: ob for ob in assets}
    for name, location in layout:
        source = by_name["DRP_" + name]
        copy = source.copy()
        copy.name = "Review_" + name
        copy.location = xyz(location)
        review.collection.objects.link(copy)
        for child in source.children:
            child_copy = child.copy()
            child_copy.parent = copy
            review.collection.objects.link(child_copy)

    floor_mesh = bpy.data.meshes.new("DRP_Review_Floor")
    floor_mesh.from_pydata([(-200, -200, -.025), (200, -200, -.025),
                           (200, 200, -.025), (-200, 200, -.025)], [], [(0, 1, 2, 3)])
    floor_mesh.materials.append(material("Review_Sand", "#c4bca8", 0, .95))
    floor = bpy.data.objects.new("Review floor — never exported", floor_mesh)
    review.collection.objects.link(floor)

    def point_at(ob, point):
        direction = Vector(point) - ob.location
        ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    camera_data = bpy.data.cameras.new("DRP_Review_Camera")
    camera = bpy.data.objects.new("DRP_Review_Camera", camera_data)
    review.collection.objects.link(camera)
    camera.location = xyz((11.5, 12.8, 18))
    point_at(camera, xyz((0, .6, -.5)))
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = 15.3
    review.camera = camera
    for name, point, energy, size, colour in [
        ("Large warm key", (-6, 11, 6), 2100, 7, (1, .89, .72)),
        ("Cool sky fill", (8, 6, 1), 1300, 6, (.70, .85, 1)),
        ("Soft rear rim", (-3, 9, -8), 2200, 5, (1, .95, .82)),
    ]:
        light_data = bpy.data.lights.new("DRP_" + name, "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light_data.color = colour
        light = bpy.data.objects.new("DRP_" + name, light_data)
        light.location = xyz(point)
        point_at(light, xyz((0, .5, 0)))
        review.collection.objects.link(light)
    return review


review = None
if globals().get("BUILD_REVIEW_SCENE", False):
    review = make_review_scene()
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), copy=True)


def bounds(ob):
    points = []
    for mesh in [ob] + list(ob.children_recursive):
        if mesh.type == "MESH":
            transform = ob.matrix_world.inverted() @ mesh.matrix_world
            points += [transform @ v.co for v in mesh.data.vertices]
    # Convert baked Blender axes back to exported game axes.
    game = [(p.x, p.z, -p.y) for p in points]
    low = [min(p[i] for p in game) for i in range(3)]
    high = [max(p[i] for p in game) for i in range(3)]
    return {"min": [round(v, 4) for v in low],
            "max": [round(v, 4) for v in high],
            "size": [round(high[i] - low[i], 4) for i in range(3)]}

unique_meshes = {ob.data for asset in assets for ob in [asset] + list(asset.children_recursive) if ob.type == "MESH"}
result = {
    "scene": scene.name,
    "review_scene": review.name if review else None,
    "glb": str(glb_path),
    "blend": str(blend_path),
    "bytes": glb_path.stat().st_size,
    "vertices": sum(len(mesh.vertices) for mesh in unique_meshes),
    "polygons": sum(len(mesh.polygons) for mesh in unique_meshes),
    "assets": [{
        "name": a.name, "bounds": bounds(a),
        "materials": sorted({m.name for ob in [a] + list(a.children_recursive)
                             if ob.type == "MESH" for m in ob.data.materials if m}),
        "origin": a["origin"],
    } for a in assets],
}
