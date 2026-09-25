"""DUST RUSH sculpted vehicle library. Run inside Blender via the MCP connector.

Coordinates are game coordinates: X across, Y up, Z forward. The body origin,
wheel radius (.685) and named DR2_* roots are the public game asset contract.
This script creates a new scene, never clears the user's scene, and exports only
its finished assets. Set BUILD_SET="workshop" for the separate accessory library.
Old library roots must first be archived explicitly
after inspection so Blender cannot silently add numeric suffixes.
"""
import bpy
import bmesh
import math
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILD_SET = globals().get("BUILD_SET", "vehicles")
SCENE = "DR_WorkshopParts_v1" if BUILD_SET == "workshop" else "DR_AssetLibrary_v2_final_fit"
BODY_LENGTH_SCALE = 1.2
WHEELBASE_M = 2.49984
AXLE_HALF_LENGTH = WHEELBASE_M / 2
WHEEL_CENTER_Y = -.835
WHEELWELL_RADIUS = .88
BODY_TYPES = ("pickup", "buggy", "van", "hotrod")
WHEEL_TYPES = ("standard", "giant", "sand", "street")
ENGINE_TYPES = ("classic", "supercharged", "electric")
WING_TYPES = ("lip", "sport", "stunt", "delta")
LIGHT_TYPES = ("bar", "round", "pods", "rally")
EXPECTED_NAMES = (
    ["DR2_Body_" + key for key in BODY_TYPES]
    + ["DR2_Wheel_" + key for key in WHEEL_TYPES]
    + ["DR2_Engine_" + key for key in ENGINE_TYPES]
)
if BUILD_SET == "workshop":
    EXPECTED_NAMES = ["DR2_Engine_injected"] + ["DR2_Wing_" + k for k in WING_TYPES] + ["DR2_Lights_" + k for k in LIGHT_TYPES]
if bpy.data.scenes.get(SCENE):
    raise RuntimeError("Inspect the existing asset scene before rebuilding: " + SCENE)
collisions = [name for name in EXPECTED_NAMES if bpy.data.objects.get(name)]
if collisions:
    raise RuntimeError("Archive previously inspected library roots before running: " + ", ".join(collisions))

scene = bpy.data.scenes.new(SCENE)
bpy.context.window.scene = scene
scene.unit_settings.system = "METRIC"
collection = bpy.data.collections.new("DR_Sculpted_Export")
scene.collection.children.link(collection)
parts = []
assets = []
side_surface = None


def coord(point):
    return (point[0], -point[2], point[1])


def srgb(value):
    return value / 12.92 if value < .04045 else ((value + .055) / 1.055) ** 2.4


def material(name, color, metal=0, rough=.4, coat=0, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    rgb = tuple(srgb(int(color[i:i + 2], 16) / 255) for i in (1, 3, 5)) + (1,)
    mat.diffuse_color = rgb
    node = mat.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = rgb
    node.inputs["Metallic"].default_value = metal
    node.inputs["Roughness"].default_value = rough
    node.inputs["Coat Weight"].default_value = coat
    node.inputs["Coat Roughness"].default_value = .18
    if emission:
        node.inputs["Emission Color"].default_value = rgb
        node.inputs["Emission Strength"].default_value = emission
    return mat


paint = material("DR_Turquoise_paint", "#12b4c9", .25, .30, .45)
orange = material("DR_Orange_paint", "#ef742a", .16, .30, .45)
rubber = material("DR_Rubber", "#24292c", 0, .85)
tread = material("DR_Tread", "#30373a", 0, .84)
dark = material("DR_Graphite", "#23343c", .6, .39)
chrome = material("DR_Chrome", "#aab6b8", .85, .25)
steel = material("DR_BrushedSteel", "#6a7a81", .7, .38)
glass = material("DR_Glass", "#10222e", .25, .14, .8)
lamp = material("DR_Lamp", "#ffe4ae", .15, .24, 0, .7)
tail = material("DR_Tail", "#d43b28", .1, .26, 0, .25)


def create(name, verts, faces, mat, bevel=0, smooth=False, segments=2):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([coord(v) for v in verts], [], faces)
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
        mod = ob.modifiers.new("Manufactured edge radius", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = .42
        mod.harden_normals = True
        normals = ob.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
        normals.weight = 40
    return ob


def box(name, pos, size, mat, bevel=.03, angle=0):
    # angle rotates in the game XY plane: useful for V-engine cylinder banks.
    ca, sa = math.cos(angle), math.sin(angle)
    verts = []
    for x, y, z in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
                    (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]:
        xx, yy = x * size[0] / 2, y * size[1] / 2
        verts.append((pos[0] + ca * xx - sa * yy, pos[1] + sa * xx + ca * yy, pos[2] + z * size[2] / 2))
    return create(name, verts, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                               (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], mat, bevel, segments=2)


def pipe(name, points, radius, mat, n=10, rounded=.09):
    """One swept mesh with real elbow bends, not dozens of overlapping cylinders."""
    control = [Vector(p) for p in points]
    path = [control[0]]
    for i in range(1, len(control) - 1):
        prev, at, following = control[i - 1:i + 2]
        distance = min(rounded, (at - prev).length * .3, (following - at).length * .3)
        if distance < 1e-8:
            path.append(at)
            continue
        before = at + (prev - at).normalized() * distance
        after = at + (following - at).normalized() * distance
        path.append(before)
        for step in range(1, 4):
            t = step / 3
            path.append((1 - t) ** 2 * before + 2 * t * (1 - t) * at + t * t * after)
    path.append(control[-1])
    verts = []
    previous_u = None
    for i, point in enumerate(path):
        tangent = path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]
        tangent.normalize()
        if previous_u is None:
            ref = Vector((0, 1, 0)) if abs(tangent.y) < .9 else Vector((1, 0, 0))
            u = tangent.cross(ref).normalized()
        else:
            u = previous_u - tangent * previous_u.dot(tangent)
            u.normalize()
        v = tangent.cross(u).normalized()
        previous_u = u
        for j in range(n):
            a = math.tau * j / n
            verts.append(tuple(point + radius * (u * math.cos(a) + v * math.sin(a))))
    faces = [tuple(reversed(range(n))), tuple((len(path) - 1) * n + j for j in range(n))]
    for i in range(len(path) - 1):
        for j in range(n):
            k = (j + 1) % n
            faces.append((i * n + j, i * n + k, (i + 1) * n + k, (i + 1) * n + j))
    return create(name, verts, faces, mat, smooth=True)


def rod(name, a, b, radius, mat, n=16):
    return pipe(name, [a, b], radius, mat, n, 0)


def patch(name, points, mat, thickness=.012, bevel=.02):
    a, b, c = map(Vector, points[:3])
    normal = (b - a).cross(c - a).normalized()
    verts = [tuple(Vector(p) + normal * t) for t in [-thickness / 2, thickness / 2] for p in points]
    count = len(points)
    faces = [tuple(reversed(range(count))), tuple(count + i for i in range(count))]
    faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
    return create(name, verts, faces, mat, bevel, segments=2)


def loft(name, sections, mat, exponent=.48, bevel=.022):
    # Cross-sections are rounded rectangles. Short intermediate sections sculpt
    # the nose, roof and haunches without subdivision-surface runtime overhead.
    count = 32
    verts = []
    for section in sections:
        z, width, low, high = section[:4]
        offset_x = section[4] if len(section) > 4 else 0
        for i in range(count):
            a = math.tau * i / count
            co, si = math.cos(a), math.sin(a)
            x = math.copysign(abs(co) ** exponent, co) * width / 2
            y = (low + high) / 2 + math.copysign(abs(si) ** exponent, si) * (high - low) / 2
            verts.append((x + offset_x, y, z))
    faces = [tuple(reversed(range(count))), tuple((len(sections) - 1) * count + i for i in range(count))]
    for j in range(len(sections) - 1):
        for i in range(count):
            faces.append((j * count + i, j * count + (i + 1) % count,
                          (j + 1) * count + (i + 1) % count, (j + 1) * count + i))
    return create(name, verts, faces, mat, bevel, True)


def curved_glazing(name, point_at, mat, thickness=.01):
    """A lightly curved, closed windshield skin, not a black flat sticker."""
    columns, rows = 12, 5
    stride = columns + 1
    layer = stride * (rows + 1)
    verts = []
    for depth in (-thickness, 0):
        for row in range(rows + 1):
            for column in range(columns + 1):
                x, y, z = point_at(column / columns, row / rows)
                verts.append((x, y, z + depth))
    faces = []
    for row in range(rows):
        for column in range(columns):
            a = row * stride + column
            faces.extend([(a, a + stride, a + stride + 1, a + 1),
                          (layer + a, layer + a + 1, layer + a + stride + 1, layer + a + stride)])
    edge = list(range(stride))
    edge += [row * stride + columns for row in range(1, rows + 1)]
    edge += [rows * stride + column for column in range(columns - 1, -1, -1)]
    edge += [row * stride for row in range(rows - 1, 0, -1)]
    for i, a in enumerate(edge):
        b = edge[(i + 1) % len(edge)]
        faces.append((a, b, b + layer, a + layer))
    return create(name, verts, faces, mat, smooth=True)


def cabin(name, width, bottom, top, front, rear, roof_front, roof_rear, cargo=False, edge=.065):
    """Swept rounded cabin with a pressed roof crown and curved A-pillars."""
    w, rw = width / 2, width * .448
    levels = []
    for t in (0, .07, .30, .60, .82):
        levels.append((t, w + (rw - w) * t, front + (roof_front - front) * t,
                       rear + (roof_rear - rear) * t, .135 + edge * .25, .115 + edge * .2))
    levels.extend([(.94, rw + .014, roof_front + .035, roof_rear - .035, .151, .13),
                   (.985, rw - .029, roof_front - .035, roof_rear + .035, .14, .12),
                   (1, rw - .065, roof_front - .085, roof_rear + .085, .125, .10)])
    def section_at(t):
        for a, b in zip(levels[:-1], levels[1:]):
            if a[0] <= t <= b[0]:
                blend = (t - a[0]) / (b[0] - a[0])
                return tuple(a[j] + (b[j] - a[j]) * blend for j in range(1, 6))
        return levels[-1][1:]
    verts = []
    per_corner = 6
    ring = 4 * per_corner
    for t, half_width, nose, back, rx, rz in levels:
        height = bottom + (top - bottom) * t
        centers = [(half_width - rx, nose - rz), (-half_width + rx, nose - rz),
                   (-half_width + rx, back + rz), (half_width - rx, back + rz)]
        for corner, (cx, cz) in enumerate(centers):
            for i in range(per_corner):
                angle = (corner + i / per_corner) * math.pi / 2
                verts.append((cx + rx * math.cos(angle), height, cz + rz * math.sin(angle)))
    faces = [tuple(reversed(range(ring))), tuple((len(levels) - 1) * ring + i for i in range(ring))]
    for row in range(len(levels) - 1):
        for i in range(ring):
            j = (i + 1) % ring
            faces.append((row * ring + i, row * ring + j, (row + 1) * ring + j, (row + 1) * ring + i))
    create(name, verts, faces, paint, smooth=True)

    def frontpoint(x, t, push=.018):
        half_width, nose, back, rx, rz = section_at(t)
        corner = max(0, min(1, (abs(x) - (half_width - rx)) / rx))
        wrap = rz * (1 - math.sqrt(max(0, 1 - corner * corner)))
        return (x, bottom + (top - bottom) * t, nose - wrap + push)
    def windshield(low, high, low_width, high_width, push):
        def point(u, v):
            t = low + (high - low) * v
            x = (2 * u - 1) * (low_width + (high_width - low_width) * v)
            return frontpoint(x, t, push + .012 * (1 - (2 * u - 1) ** 2))
        return point
    curved_glazing("Formed windscreen gasket", windshield(.13, .84, w * .89, rw * .86, .018), rubber, .014)
    curved_glazing("Curved inset windshield", windshield(.20, .79, w * .835, rw * .80, .027), glass, .009)
    for side in (-1, 1):
        def sidepoint(z, t, offset=0):
            half_width, nose, back, rx, rz = section_at(t)
            corner = max(0, (z - (nose - rz)) / rz, ((back + rz) - z) / rz)
            corner = min(1, corner)
            wrap = rx * (1 - math.sqrt(max(0, 1 - corner * corner)))
            return (side * (half_width - wrap + .014 + offset), bottom + (top - bottom) * t, z)
        back = .10 if cargo else rear + .105
        roof_back = .055 if cargo else roof_rear + .07
        outer = [sidepoint(back, .13), sidepoint(front - .14, .13),
                 sidepoint(roof_front - .06, .80), sidepoint(roof_back, .80)]
        inner = [sidepoint(back + .055, .21, .009), sidepoint(front - .205, .21, .009),
                 sidepoint(roof_front - .115, .73, .009), sidepoint(roof_back + .055, .73, .009)]
        patch("Side window rubber surround", outer, rubber, .016, .022)
        patch("Inset dark side glass", inner, glass, .013, .018)
        handle_z = back + .13
        handle_y = bottom - .035
        handle_x = side_surface(handle_y, handle_z) + .014 if side_surface else w + .016
        box("Door handle recess", (side * handle_x, handle_y, handle_z), (.028, .052, .19), rubber, .015)
        box("Metal door handle", (side * (handle_x + .019), handle_y + .013, handle_z), (.031, .019, .14), steel, .006)
        mirror_z = front - .10
        pipe("Mirror stem", [(side * (w - .02), bottom + .20, mirror_z),
                            (side * (w + .14), bottom + .26, mirror_z)], .019, steel)
        box("Sculpted mirror housing", (side * (w + .17), bottom + .285, mirror_z), (.19, .14, .16), dark, .045)
        box("Mirror glass", (side * (w + .17), bottom + .285, mirror_z - .081), (.135, .092, .010), chrome, .020)
    if not cargo:
        patch("Rear cab glass", [(-w * .65, bottom + .22, rear - .009), (w * .65, bottom + .22, rear - .009),
                                (rw * .67, top - .17, roof_rear - .021), (-rw * .67, top - .17, roof_rear - .021)], glass, .016, .032)
    for side in (-1, 1):
        a = frontpoint(side * .17, .21, .048)
        b = frontpoint(side * .49, .29, .047)
        pipe("Windscreen wiper", [a, b], .0085, rubber, 6)


def shell_sides(name, profile, half_width=.83, bottom=-.44, hood_from=None):
    """Pressed sides, optionally joined to one continuous non-overlapping hood."""
    global side_surface
    from mathutils.bvhtree import BVHTree
    def top_at(z):
        for (za, ya), (zb, yb) in zip(profile[:-1], profile[1:]):
            if za <= z <= zb:
                t = (z - za) / (zb - za)
                return ya * (1 - t) + yb * t
        return profile[0][1] if z < profile[0][0] else profile[-1][1]
    def profile_at(z):
        low = bottom
        for axle in (-AXLE_HALF_LENGTH, AXLE_HALF_LENGTH):
            dz = z * BODY_LENGTH_SCALE - axle
            if abs(dz) < WHEELWELL_RADIUS:
                low = max(low, WHEEL_CENTER_Y + math.sqrt(WHEELWELL_RADIUS ** 2 - dz * dz))
        high = top_at(z)
        arch = math.exp(-((abs(z * BODY_LENGTH_SCALE) - AXLE_HALF_LENGTH) / .56) ** 2)
        taper = .08 * max(0, (abs(z) - 1.24) / .31)
        shift = half_width - .83 - taper
        return low, high, [(0, .755 + .035 * arch + shift), (.20, .845 + .050 * arch + shift),
                           (.60, .865 + .057 * arch + shift), (.84, .805 + .040 * arch + shift),
                           (1, .665 + .015 * arch + shift)]
    def analytical_surface(y, z):
        low, high, knots = profile_at(z)
        t = max(0, min(1, (y - low) / (high - low)))
        for (ta, xa), (tb, xb) in zip(knots[:-1], knots[1:]):
            if ta <= t <= tb:
                return xa + (xb - xa) * (t - ta) / (tb - ta)
        return knots[-1][1]
    stride = 7
    z_min, z_max = profile[0][0], profile[-1][0]
    stations = [z_min + (z_max - z_min) * i / 60 for i in range(61)]
    if hood_from is not None:
        stations = sorted(set(stations + [hood_from]))
    samples = len(stations)
    verts, faces = [], []
    bases = {}
    for side in (-1, 1):
        base = len(verts)
        bases[side] = base
        for z in stations:
            low, high, knots = profile_at(z)
            section = [(x, low + (high - low) * t) for t, x in knots]
            section.extend([(knots[-1][1] - .07, high - .045), (knots[0][1] - .07, low + .015)])
            verts.extend((side * x, y, z) for x, y in section)
        faces.extend([tuple(base + j for j in reversed(range(stride))),
                      tuple(base + (samples - 1) * stride + j for j in range(stride))])
        for row in range(samples - 1):
            for i in range(stride):
                # The deck and its underside replace this internal closing face.
                # The hood shares the exact shoulder vertices, not an intersecting
                # second loft: one manifold sheet with continuous shading normals.
                if i == 4 and hood_from is not None and stations[row] >= hood_from:
                    continue
                j = (i + 1) % stride
                faces.append((base + row * stride + i, base + row * stride + j,
                              base + (row + 1) * stride + j, base + (row + 1) * stride + i))
    if hood_from is not None:
        deck_rows = []
        for row, z in enumerate(stations):
            if z < hood_from:
                continue
            low, high, knots = profile_at(z)
            width = knots[-1][1]
            t = (z - hood_from) / (z_max - hood_from)
            crown = .030 + .013 * math.sin(t * math.pi)
            deck = [bases[-1] + row * stride + 4]
            for step in range(1, 8):
                across = -1 + step / 4
                deck.append(len(verts))
                verts.append((across * width, high + crown * (1 - across * across), z))
            deck.append(bases[1] + row * stride + 4)
            deck_rows.append((row, deck))
        for (ra, a), (rb, b) in zip(deck_rows[:-1], deck_rows[1:]):
            faces.extend((a[i], a[i + 1], b[i + 1], b[i]) for i in range(8))
            faces.append((bases[-1] + ra * stride + 5, bases[-1] + rb * stride + 5,
                          bases[1] + rb * stride + 5, bases[1] + ra * stride + 5))
        for row, deck in (deck_rows[0], deck_rows[-1]):
            faces.append(tuple(deck + [bases[1] + row * stride + 5, bases[-1] + row * stride + 5]))
    ob = create(name, verts, faces, paint, smooth=True)
    # Sample the *exported facet surface* for paint and seams, rather than an
    # analytic curve that can fall behind this deliberately economical mesh.
    ob.data.calc_loop_triangles()
    actual_verts = [Vector((v.co.x, v.co.z, -v.co.y)) for v in ob.data.vertices]
    tree = BVHTree.FromPolygons(actual_verts, [tuple(t.vertices) for t in ob.data.loop_triangles],
                               all_triangles=True)
    def surface(y, z):
        hit = tree.ray_cast(Vector((2, y, z)), Vector((-1, 0, 0)), 4)[0]
        return hit.x if hit is not None else analytical_surface(y, z)
    def height(x, z):
        hit = tree.ray_cast(Vector((x, 2, z)), Vector((0, -1, 0)), 4)[0]
        return hit.y if hit is not None else top_at(z)
    side_surface = surface
    return {"height": height}


def on_body_side(side, points, lift=.008):
    """Project seams into the formed sheet rather than leaving them in mid-air."""
    return [(side * (side_surface(y, z) + lift), y, z) for y, z in points]


def fenders(kind):
    # Wide compound-curved arches blend into the quarter panels instead of
    # appearing as loose square tubing suspended around the wheels.
    is_hotrod = kind == "hotrod"
    for side in (-1, 1):
        for axle in (-AXLE_HALF_LENGTH, AXLE_HALF_LENGTH):
            outer = 1.00 if is_hotrod else 1.025
            section = [(.705, .895), (.79, .955), (.89, 1.012), (outer - .025, .986), (outer, .905)]
            steps = 24
            verts = []
            for x, radius in section:
                for i in range(steps + 1):
                    angle = math.radians(19 + 142 * i / steps)
                    verts.append((side * x, WHEEL_CENTER_Y + radius * math.sin(angle), axle + radius * math.cos(angle)))
            faces = []
            stride = steps + 1
            for j in range(len(section) - 1):
                for i in range(steps):
                    faces.append((j * stride + i, j * stride + i + 1, (j + 1) * stride + i + 1, (j + 1) * stride + i))
            # Close the underside so low-angle inspection is complete.
            for i in range(steps):
                faces.append((i, (len(section) - 1) * stride + i, (len(section) - 1) * stride + i + 1, i + 1))
            faces += [tuple(j * stride for j in reversed(range(len(section)))),
                      tuple(j * stride + steps for j in range(len(section)))]
            create("Flowing sculpted wheel arch", verts, faces, paint, .012, True)
            lip = []
            for i in range(steps + 1):
                angle = math.radians(19 + 142 * i / steps)
                lip.append((side * (outer + .006), WHEEL_CENTER_Y + .905 * math.sin(angle), axle + .905 * math.cos(angle)))
            pipe("Arch black edge bead", lip, .017, rubber, 8, 0)
            # A few visible fasteners communicate a bolt-on monstertruck flare.
            for angle in (43, 90, 137):
                a = math.radians(angle)
                point = (side * (outer + .009), WHEEL_CENTER_Y + .953 * math.sin(a), axle + .953 * math.cos(a))
                rod("Fender fastener", point, (point[0] + side * .014, point[1], point[2]), .010, steel, 6)
            if is_hotrod:
                # Open hotrod fenders are carried by real frame-mounted stays.
                # This runs after the body stretch, so coordinates are final metres.
                for dz in (-.22, .22):
                    root = (side * .40, -.44, axle + dz)
                    tip = (side * .73, .025, axle + dz * 1.24)
                    box("Hotrod fender rail clamp", root, (.07, .065, .10), steel, .010)
                    rod("Hotrod fender support stay", root, tip, .022, steel, 10)
                    box("Hotrod fender underside mounting shoe", tip, (.095, .035, .105), dark, .008)


def skid_plate(front):
    # Three genuine through-holes in a bent aluminium guard, not black dots.
    for center in (-.29, 0, .29):
        count = 20
        verts = []
        for depth in (0, .025):
            for inner in (False, True):
                for i in range(count):
                    a = math.tau * i / count
                    co, si = math.cos(a), math.sin(a)
                    r = .066 if inner else min(.146 / max(abs(co), .001), .16 / max(abs(si), .001))
                    yy = -.205 + si * r
                    verts.append((center + co * r, yy, front + .18 + (yy + .205) * .42 + depth))
        faces = []
        for i in range(count):
            j = (i + 1) % count
            faces += [(i, j, count + j, count + i), (2 * count + i, 3 * count + i, 3 * count + j, 2 * count + j),
                      (count + i, count + j, 3 * count + j, 3 * count + i),
                      (i, 2 * count + i, 2 * count + j, j)]
        create("Perforated aluminium skid guard", verts, faces, steel, .008)
    for side in (-1, 1):
        rod("Skid guard bolt", (side * .40, -.105, front + .245), (side * .40, -.105, front + .266), .015, chrome, 6)


def lamps(front=1.46, y=.21, style="pickup"):
    width = .59 if style != "buggy" else .54
    box("Grille frame", (0, y, front - .018), (.92, .32, .095), dark, .035)
    box("Recessed grille", (0, y, front + .035), (.81, .25, .05), rubber, .025)
    for row in range(4):
        box("Horizontal grille blade", (0, y - .095 + row * .063, front + .065), (.73, .017, .021), dark, .007)
    for side in (-1, 1):
        if style == "pickup":
            # A round projector sits inside a shaped, flush dark housing, as in the
            # reference; the integrated surround matters more than angular lamps.
            patch("Pickup headlight body surround", [(side * .435, y - .13, front - .018),
                  (side * .823, y - .10, front - .035), (side * .803, y + .145, front - .035),
                  (side * .443, y + .12, front - .018)], paint, .085, .025)
            patch("Recessed angular headlight housing", [(side * .46, y - .094, front + .032),
                  (side * .794, y - .073, front + .014), (side * .777, y + .112, front + .014),
                  (side * .467, y + .092, front + .032)], dark, .018, .019)
            rod("Recessed projector surround", (side * .625, y + .005, front + .022),
                (side * .625, y + .005, front + .043), .086, steel, 28)
            rod("Inset round projector lens", (side * .625, y + .005, front + .044),
                (side * .625, y + .005, front + .055), .065, lamp, 28)
            pipe("Contained headlight running strip", [(side * .480, y + .078, front + .052),
                 (side * .754, y + .097, front + .036)], .008, lamp, 6)
            box("Inset amber indicator", (side * .782, y + .007, front + .028), (.020, .12, .013), orange, .005)
        elif style == "van":
            box("Integrated utility-van headlight recess", (side * width, y, front + .010), (.36, .205, .062), dark, .022)
            box("Flush rectangular van headlight", (side * width, y + .010, front + .045), (.267, .115, .017), lamp, .012)
            box("Van vertical indicator", (side * .786, y + .006, front + .016), (.026, .153, .021), orange, .006)
        else:
            box("Armored buggy light pocket", (side * width, y, front + .009), (.35, .175, .065), dark, .018)
            box("Recessed buggy LED light bar", (side * width, y + .012, front + .048), (.269, .067, .015), lamp, .009)
            box("Buggy amber marker", (side * .749, y - .009, front + .012), (.032, .069, .021), orange, .006)
    box("Front impact beam", (0, -.19, front + .035), (1.65, .15, .16), dark, .045)
    pipe("Bent tubular bull bar", [(-.77, -.19, front + .13), (-.59, -.12, front + .19), (-.47, .09, front + .20),
                                 (.47, .09, front + .20), (.59, -.12, front + .19), (.77, -.19, front + .13)], .035, steel, 12, .06)
    skid_plate(front)


def rear_details(front=-1.48, width=.66):
    box("Rear impact beam", (0, -.23, front), (1.49, .14, .15), dark, .045)
    for side in (-1, 1):
        box("Rear lamp surround", (side * width, .13, front - .025), (.15, .24, .07), dark, .035)
        box("Rear brake lamp", (side * width, .16, front - .066), (.108, .11, .025), tail, .02)
        box("Rear amber indicator", (side * width, .055, front - .066), (.108, .045, .025), orange, .012)
    box("Rear recess", (0, -.08, front - .035), (.36, .12, .028), rubber, .023)


def side_stripe(side, x, points):
    if side_surface is None:
        patch("Orange sculpted side graphic", [(side * x, y, z) for z, y in points], orange, .006, .009)
        return
    # Tessellated paint follows the pressed body instead of crossing curved
    # shoulders as a floating, flat orange plate.
    from mathutils.geometry import tessellate_polygon
    polygon = [Vector((z, y, 0)) for z, y in points]
    # Blender 5.2 returns vertex indices; earlier versions return Vectors.
    triangles = [tuple(polygon[p] if isinstance(p, int) else p for p in tri)
                 for tri in tessellate_polygon([polygon])]
    def split(triangle, count):
        if count == 0:
            return [triangle]
        a, b, c = triangle
        ab, bc, ca = (a + b) / 2, (b + c) / 2, (c + a) / 2
        result = []
        for child in ((a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)):
            result.extend(split(child, count - 1))
        return result
    verts, faces, lookup = [], [], {}
    for triangle in triangles:
        for child in split(triangle, 4):
            indices = []
            for point in child:
                z, y = point.x, point.y
                key = (round(z, 7), round(y, 7))
                if key not in lookup:
                    lookup[key] = len(verts)
                    verts.append((side * (side_surface(y, z) + .008), y, z))
                indices.append(lookup[key])
            faces.append(tuple(indices))
    ob = create("Paint graphic following sculpted body", verts, faces, orange)
    for poly in ob.data.polygons:
        poly.use_smooth = True


def buggy_front():
    # Rear-engined desert buggy: tapered prow and exposed lamp bridge, no truck grille.
    pipe("Buggy front crash hoop", [(-.67, -.17, 1.43), (-.49, .035, 1.57),
         (.49, .035, 1.57), (.67, -.17, 1.43)], .036, steel, 12, .065)
    box("Buggy rally lamp bridge", (0, .115, 1.475), (.88, .16, .075), dark, .029)
    for x in (-.28, 0, .28):
        rod("Buggy recessed rally housing", (x, .14, 1.461), (x, .14, 1.51), .116, dark, 24)
        rod("Buggy rally lamp rim", (x, .14, 1.508), (x, .14, 1.53), .099, steel, 24)
        rod("Buggy warm rally lens", (x, .14, 1.531), (x, .14, 1.541), .081, lamp, 24)
    skid_plate(1.40)


def body(kind):
    global parts, side_surface
    parts = []
    side_surface = None
    if kind == "pickup":
        skin = shell_sides("Continuous pickup hood and quarter panels",
                    [(-1.62, .30), (-1.32, .37), (-.96, .37), (.31, .40), (.94, .455), (1.64, .275)],
                    hood_from=.26)
        # The hood is the upper bridge of the same mesh as both shoulders; no
        # closed loft lies across the curved side skins and no sliver faces fight.
        cabin("Low raked pickup cab", 1.43, .31, .98, .44, -.99, -.10, -.92, edge=.058)
        # Tuck the floor inside the Giant tire's inboard shoulder at normal ride height.
        box("Closed pickup cab floor", (0, -.365, -.34), (1.24, .08, 1.24), dark, .018)
        box("Bed inner liner", (0, .135, -1.305), (1.33, .105, .60), rubber, .018)
        for x in (-.46, -.23, 0, .23, .46):
            box("Bed pressed floor rib", (x, .194, -1.305), (.028, .022, .51), dark, .007)
        for side in (-1, 1):
            loft("Cargo bed rail", [(-1.60, .15, .24, .35), (-1.46, .18, .23, .39),
                 (-1.07, .18, .23, .39), (-.98, .13, .23, .34)], paint, .37, .015)
            # The rail loft is authored at the origin; shift only its own vertices.
            for vertex in parts[-1].data.vertices:
                vertex.co.x += side * .727
            side_stripe(side, .851, [(-1.25, .26), (-.89, .32), (.46, -.22), (.32, -.36), (-.4, .07)])
            pipe("Door pressed seam", on_body_side(side, [(.335, -.965), (-.34, -.91),
                 (-.38, .37), (.31, .425)]), .005, dark, 6, .025)
            pipe("Side step", [(side * .91, -.46, -.65), (side * 1.02, -.47, -.57),
                 (side * 1.02, -.47, .38), (side * .91, -.46, .44)], .031, steel)
        box("Pressed pickup tailgate", (0, .27, -1.60), (1.47, .265, .105), paint, .029)
        box("Tailgate handle", (0, .32, -1.658), (.19, .039, .023), dark, .010)
        loft("Sculpted low hood intake", [(.68, .43, .449, .466), (.84, .46, .450, .54),
             (1.15, .49, .409, .545), (1.28, .49, .388, .512)], paint, .47, .012)
        box("Scoop recessed mouth", (0, .471, 1.286), (.38, .060, .015), rubber, .012)
        for x in (-.27, .27):
            # Thin continuous paint, projected onto the same real deck facets.
            ribbon_verts = []
            for row in range(23):
                z = .49 + (1.35 - .49) * row / 22
                for offset in (-.045, 0, .045):
                    xx = x + offset
                    ribbon_verts.append((xx, skin["height"](xx, z) + .005, z))
            ribbon_faces = [(row * 3 + col, row * 3 + col + 1, (row + 1) * 3 + col + 1,
                             (row + 1) * 3 + col) for row in range(22) for col in range(2)]
            create("Continuous fitted hood paint ribbon", ribbon_verts, ribbon_faces, orange, smooth=True)
        lamps(1.63, .155, "pickup")
        rear_details(-1.62)
    elif kind == "van":
        shell_sides("Cab-over van lower sides", [(-1.48, .52), (-1.20, .62), (.86, .62), (1.44, .48)])
        loft("Rounded van nose", [(.98, 1.59, -.12, .63), (1.20, 1.55, -.11, .61),
             (1.40, 1.43, -.08, .48), (1.47, 1.34, -.04, .36)], paint, .55)
        cabin("Raked cab-over cargo van", 1.55, .44, 1.27, 1.23, -1.42, .84, -1.30, cargo=True, edge=.064)
        for side in (-1, 1):
            side_stripe(side, .846, [(-1.23, .25), (-.83, .25), (-.28, .49), (-.06, .49),
                                   (-.68, .135), (-1.23, .135)])
            pipe("Cargo panel pressed seam", [(side * .762, .66, -1.17), (side * .721, 1.14, -1.13),
                 (side * .721, 1.14, -.10), (side * .762, .66, -.045)], .006, dark, 6, .028)
            pipe("Front van door seam", on_body_side(side, [(.48, .07), (-.35, .09), (-.35, .56)]), .005, dark, 6, .025)
        pipe("Rear cargo door split", [(0, .46, -1.438), (0, 1.15, -1.330)], .007, dark, 6)
        box("Rear door handle", (.11, .72, -1.42), (.025, .14, .035), steel, .01)
        lamps(1.45, .25, "van")
        rear_details(-1.48, .62)
    elif kind == "buggy":
        loft("Tapered dune buggy prow", [(.25, .91, -.03, .22), (.58, .99, -.015, .34),
             (.91, .90, -.02, .33), (1.20, .70, -.07, .20), (1.49, .43, -.115, .075),
             (1.59, .28, -.12, .035)], paint, .62, .010)
        for side in (-1, 1):
            loft("Buggy flowing front shoulder", [(.39, .29, .025, .24, side * .47),
                 (.70, .45, .010, .30, side * .59), (1.08, .56, -.055, .27, side * .68),
                 (1.37, .36, -.11, .155, side * .56), (1.56, .17, -.12, .07, side * .34)], paint, .64, .010)
            # Separate rear shoulder shells leave a real open engine bay.
            loft("Open engine bay side shoulder", [(-1.52, .19, -.06, .14, side * .56),
                 (-1.39, .23, -.07, .25, side * .575), (-1.07, .26, -.08, .28, side * .60),
                 (-.76, .22, -.08, .21, side * .59)], paint, .57, .011)
            box("Buggy wing mounting pad", (side * .56, .231, -1.40), (.15, .038, .15), dark, .009)
        box("Open engine bay rear crossmember", (0, -.035, -1.525), (1.18, .095, .12), dark, .020)
        for side in (-1, 1):
            pipe("Continuous roll-cage side hoop", [(side * .68, -.15, .75), (side * .60, .81, .11),
                 (side * .54, .935, -.055), (side * .55, .935, -.66), (side * .68, -.14, -1.40)], .043, dark, 12, .09)
            pipe("Cage side impact rail", [(side * .69, -.14, .70), (side * .74, .22, .08),
                 (side * .71, .35, -.66), (side * .68, -.14, -1.17)], .039, dark, 10, .07)
            pipe("Rear diagonal cage brace", [(side * .55, .90, -.67), (-side * .62, -.10, -1.32)], .034, dark)
            patch("Curved buggy side panel", [(side * .68, -.24, -.74), (side * .68, -.25, .56),
                 (side * .70, .13, .31), (side * .70, .34, -.63)], paint, .06, .06)
            side_stripe(side, .741, [(-.60, .29), (-.38, .22), (.35, -.18), (.15, -.21), (-.67, .16)])
            box("Bolstered bucket seat cushion", (side * .29, .06, -.25), (.42, .16, .51), rubber, .077)
            box("Tall bucket seat back", (side * .29, .34, -.48), (.40, .62, .17), rubber, .075)
            box("Seat headrest", (side * .29, .70, -.49), (.28, .17, .13), rubber, .055)
            for offset in (-.15, .15):
                box("Seat side bolster", (side * .29 + offset, .29, -.37), (.075, .39, .16), dark, .034)
            for offset in (-.07, .07):
                pipe("Orange harness", [(side * .29 + offset, .55, -.365), (side * .29 + offset, .09, -.20)], .014, orange, 6)
        for z in (-.035, -.65):
            pipe("Bent cage roof crossbar", [(-.56, .916, z), (0, .95, z), (.56, .916, z)], .043, dark, 12)
        box("Compact buggy dashboard", (0, .31, .41), (1.02, .16, .25), dark, .05)
        rod("Steering column", (.29, .24, .39), (.29, .47, .24), .019, steel)
        circle = [(.29 + .12 * math.cos(i * math.tau / 24), .47 + .12 * math.sin(i * math.tau / 24), .24) for i in range(25)]
        pipe("Visible steering wheel", circle, .016, rubber, 8, 0)
        patch("Raked buggy windscreen", [(-.49, .37, .48), (.49, .37, .48),
              (.48, .59, .29), (-.48, .59, .29)], glass, .018, .019)
        buggy_front()
        rear_details(-1.46, .55)
    else:
        loft("Rounded hotrod rear haunch", [(-1.50, .89, -.16, .20), (-1.41, 1.12, -.20, .34),
             (-1.19, 1.40, -.18, .45), (-.81, 1.43, -.17, .48), (-.48, 1.31, -.15, .41), (-.23, 1.02, -.12, .28)], paint, .63)
        cabin("Low chopped hotrod coupe", 1.19, .29, .87, -.10, -1.24, -.45, -1.10, edge=.058)
        # Open engine bay: no full hood hiding the configured engine.
        for side in (-1, 1):
            pipe("Exposed hotrod frame shoulder", [(side * .37, -.19, -.28), (side * .39, -.19, 1.38)], .045, dark)
            loft("Long hotrod rocker", [(-.54, .18, -.25, -.08), (.08, .19, -.24, -.07),
                 (.94, .16, -.22, -.04), (1.20, .12, -.20, -.04)], paint)
            for vertex in parts[-1].data.vertices:
                vertex.co.x += side * .54
            side_stripe(side, .683, [(-1.03, .32), (-.62, .30), (-.30, .15), (-.58, .20), (-.45, .06), (-.84, .19)])
            # Exhaust belongs to the selected runtime accessory, never the shell.
            box("Hotrod rear wing mounting pad", (side * .40, .318, -1.67 / BODY_LENGTH_SCALE),
                (.13, .024, .14), dark, .008)
        loft("Tall hotrod radiator surround", [(1.36, .70, -.17, .62), (1.45, .72, -.18, .64),
             (1.50, .66, -.15, .60)], chrome, .65)
        box("Hotrod deep grille", (0, .22, 1.511), (.52, .61, .031), rubber, .12)
        for x in (-.20, -.15, -.10, -.05, 0, .05, .10, .15, .20):
            rod("Vertical polished grille fin", (x, -.025, 1.538), (x, .465, 1.538), .007, steel, 6)
        for side in (-1, 1):
            pipe("Hotrod lamp stalk", [(side * .32, .17, 1.40), (side * .57, .25, 1.42)], .025, steel)
            rod("Hotrod headlamp housing", (side * .57, .30, 1.32), (side * .57, .30, 1.47), .138, chrome, 24)
            rod("Hotrod warm headlamp", (side * .57, .30, 1.474), (side * .57, .30, 1.491), .108, lamp, 24)
        pipe("Hotrod front bumper", [(-.81, -.25, 1.52), (0, -.27, 1.58), (.81, -.25, 1.52)], .035, steel)
        rear_details(-1.50, .47)
    # Stretch the authored body sheet, cab and trim before generating fenders.
    # Blender fore/aft is -Y. Wheels and engines never pass through this step.
    # shell_sides() has already compensated its cut-out radius for this stretch.
    for ob in parts:
        for vertex in ob.data.vertices:
            vertex.co.y *= BODY_LENGTH_SCALE
        ob.data.update()
    fenders(kind)
    # Explicit accessory contract, in final body-local GAME metres. These values
    # are not authored coordinates and must never be stretched a second time.
    mounts = {
        "pickup": {"mount_engine": [0, -.12, 1.10], "mount_engine_scale": .78,
                   "mount_roof": [0, .98, -.42], "mount_wing": [0, .39, -1.68],
                   "mount_wing_width": .727, "mount_exhaust": [.98, -.35, -.35]},
        "buggy": {"mount_engine": [0, -.15, -1.32], "mount_engine_scale": .78,
                  "mount_roof": [0, .99, -.042], "mount_wing": [0, .25, -1.68],
                  "mount_wing_width": .56, "mount_exhaust": [.48, -.29, -1.36]},
        "van": {"mount_engine": [0, -.19, .74], "mount_engine_scale": .70,
                "mount_roof": [0, 1.27, .60], "mount_wing": [0, 1.27, -1.26],
                "mount_wing_width": .52, "mount_exhaust": [.98, -.35, -.40]},
        "hotrod": {"mount_engine": [0, -.095, .76], "mount_engine_scale": .92,
                   "mount_roof": [0, .87, -.88], "mount_wing": [0, .33, -1.67],
                   "mount_wing_width": .40, "mount_exhaust": [.72, -.25, .16]},
    }[kind]
    if kind == "buggy":
        # Measured crown of the actual swept cage mesh, including its tube radius.
        mounts["mount_roof"][1] = max(v.co.z for p in parts if p.name.startswith("Bent cage roof crossbar")
                                      for v in p.data.vertices)
    ob = finish("Body_" + kind)
    ob["wheelbase_m"] = WHEELBASE_M
    ob["wheelwell_radius"] = WHEELWELL_RADIUS
    ob["mount_schema"] = "body-local-game-metres-v1"
    ob["mount_wing_width_semantics"] = "half-spacing"
    for key, value in mounts.items():
        ob[key] = value
    return ob


def lathe_x(name, profile, mat, count=48):
    verts = [(x, math.cos(i * math.tau / count) * radius, math.sin(i * math.tau / count) * radius)
             for x, radius in profile for i in range(count)]
    faces = []
    for j in range(len(profile)):
        following = (j + 1) % len(profile)
        for i in range(count):
            k = (i + 1) % count
            faces.append((j * count + i, j * count + k, following * count + k, following * count + i))
    return create(name, verts, faces, mat, smooth=True)


def wheel(kind):
    global parts
    parts = []
    profile = [(-.31, .30), (-.353, .34), (-.372, .415), (-.356, .50), (-.301, .565),
               (-.21, .607), (-.08, .626), (.08, .626), (.21, .607), (.301, .565),
               (.356, .50), (.372, .415), (.353, .34), (.31, .30)]
    lathe_x("Rounded tire carcass", profile, rubber, 40)
    def lug(points, low=.596, high=.685, edge=.016):
        verts = []
        for radial in (low, high):
            for x, a in points:
                curved = radial - .065 * (abs(x) / .33) ** 2.6
                verts.append((x, math.cos(a) * curved, math.sin(a) * curved))
        return create("Sculpted tread block", verts, [(0, 3, 2, 1), (4, 5, 6, 7),
                      (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], tread, edge, segments=1)
    if kind == "standard":
        for i in range(18):
            a = i * math.tau / 18
            for side in (-1, 1):
                lug([(side * .014, a - .07), (side * .335, a + .13),
                     (side * .335, a + .258), (side * .014, a + .058)])
    elif kind == "giant":
        # Broad staggered mud blocks read differently from the normal chevrons.
        for i in range(14):
            a = i * math.tau / 14
            for side in (-1, 1):
                shift = .045 if side == 1 else 0
                lug([(side * .025, a - .10 + shift), (side * .329, a - .04 + shift),
                     (side * .329, a + .22 + shift), (side * .025, a + .16 + shift)])
    elif kind == "sand":
        for i in range(12):
            a = i * math.tau / 12
            for side in (-1, 1):
                lug([(0, a - .05), (side * .333, a + .02), (side * .333, a + .15), (0, a + .08)])
    else:
        # A connected all-terrain carcass with shallow staggered tread blocks:
        # three longitudinal channels and alternating diagonal drainage grooves.
        # No separate doughnut-like rings and no tall floating tread islands.
        lathe_x("Connected all-terrain crown", [(-.34, .595), (-.30, .621), (-.17, .645),
                (0, .654), (.17, .645), (.30, .621), (.34, .595), (.34, .575), (-.34, .575)], rubber, 48)
        for row, center in enumerate((-.255, -.085, .085, .255)):
            lo, hi = center - .073, center + .073
            for step in range(20):
                a = step * math.tau / 20 + (row % 2) * .085
                alo, ahi = a + .35 * abs(lo), a + .35 * abs(hi)
                lug([(lo, alo), (hi, ahi), (hi, ahi + .260), (lo, alo + .260)],
                    low=.636, high=.685, edge=.0045)
    for side in (-1, 1):
        lathe_x("Subtle raised sidewall band", [(side * .357, .461), (side * .364, .465),
                (side * .360, .474), (side * .352, .478)], rubber, 32)
        if kind == "street":
            # Restrained deep six-spoke alloy, with a narrow paintable rim lip.
            lathe_x("Deep all-terrain rim barrel", [(side * .366, .308), (side * .366, .272),
                    (side * .279, .235), (side * .255, .11), (side * .245, .11), (side * .245, .308)], dark, 40)
            lathe_x("Orange narrow rim lip", [(side * .369, .291), (side * .381, .291),
                    (side * .386, .303), (side * .377, .313), (side * .361, .311)], orange, 32)
            for spoke in range(6):
                a = spoke * math.tau / 6
                points = []
                for radius, half_angle, xx in ((.09, .14, .302), (.271, .085, .351)):
                    for sign in (-1, 1):
                        points.append((side * xx, math.cos(a + sign * half_angle) * radius,
                                       math.sin(a + sign * half_angle) * radius))
                patch("Deep flat alloy spoke", [points[0], points[2], points[3], points[1]], steel, .027, .006)
                rod("Recessed wheel stud", (side * .32, math.cos(a) * .115, math.sin(a) * .115),
                    (side * .337, math.cos(a) * .115, math.sin(a) * .115), .012, dark, 6)
            rod("Flush all-terrain hub", (side * .272, 0, 0), (side * .328, 0, 0), .086, dark, 20)
            continue
        # Recessed cup and open-looking spokes give the orange beadlock real depth.
        lathe_x("Deep dished wheel", [(side * .354, .300), (side * .349, .245), (side * .296, .182),
                (side * .290, .104), (side * .265, .104), (side * .265, .305)], dark, 32)
        lathe_x("Orange machined beadlock", [(side * .36, .266), (side * .377, .266),
                (side * .387, .277), (side * .384, .301), (side * .372, .312), (side * .355, .305)], orange, 32)
        rod("Dark hub center", (side * .278, 0, 0), (side * .392, 0, 0), .088, dark, 20)
        for i in range(6):
            a = i * math.tau / 6
            rod("Rim structural spoke", (side * .31, math.cos(a) * .10, math.sin(a) * .10),
                (side * .348, math.cos(a) * .247, math.sin(a) * .247), .026, steel, 8)
            rod("Hub stud", (side * .38, math.cos(a) * .116, math.sin(a) * .116),
                (side * .398, math.cos(a) * .116, math.sin(a) * .116), .013, steel, 6)
        for i in range(12):
            a = i * math.tau / 12
            rod("Beadlock bolt", (side * .388, math.cos(a) * .287, math.sin(a) * .287),
                (side * .402, math.cos(a) * .287, math.sin(a) * .287), .0105, dark, 6)
    if kind == "sand":
        for ob in parts:
            for vertex in ob.data.vertices:
                vertex.co.x *= 1.22
    return finish("Wheel_" + kind)


def engine(kind):
    global parts
    parts = []
    if kind == "electric":
        rod("Electric drive casing", (0, .22, -.30), (0, .22, .28), .26, dark, 32)
        for z in (-.24, -.16, -.08, 0, .08, .16, .24):
            box("Painted electric cooling fin", (0, .23, z), (.46, .38, .028), orange, .018)
        box("Electric end plate", (0, .22, .314), (.57, .52, .055), steel, .09)
        box("Electric inverter", (0, .53, -.04), (.44, .20, .36), dark, .044)
        for x in (-.12, .12):
            pipe("High voltage cable", [(x, .61, .015), (x, .69, .08), (x, .68, .29), (x, .40, .40)], .026, orange, 10, .065)
            box("Insulated motor connector", (x, .40, .395), (.105, .11, .073), rubber, .015)
        for x in (-.20, .20):
            for y in (.05, .39):
                rod("Electric cover bolt", (x, y, .344), (x, y, .359), .018, dark, 6)
        rod("Electric output shaft", (0, .22, .343), (0, .22, .42), .092, dark, 24)
    else:
        box("V8 crankcase", (0, .08, 0), (.40, .30, .65), dark, .045)
        box("V8 sump", (0, -.10, -.015), (.32, .15, .49), steel, .037)
        for side in (-1, 1):
            box("Angled V8 cylinder bank", (side * .175, .27, 0), (.24, .37, .66), steel, .044, -side * .37)
            box("Painted V8 valve cover", (side * .255, .385, 0), (.245, .115, .70), orange, .044, -side * .37)
            for z in (-.255, -.085, .085, .255):
                pipe("Smooth swept exhaust header", [(side * .30, .265, z), (side * .423, .16, z),
                     (side * .44, -.08, z - .075), (side * .40, -.115, z - .15)], .030, chrome, 10, .055)
                rod("Valve cover bolt", (side * .292, .441, z), (side * .292, .457, z), .013, dark, 6)
            pipe("Ignition wiring loom", [(side * .20, .46, -.26), (side * .20, .46, .25)], .012, rubber, 6)
        # Visible crank and accessory drive, including a continuous rubber belt.
        for x, y, radius in ((0, .02, .10), (-.20, .24, .066), (.18, .27, .059)):
            rod("Belt pulley", (x, y, .334), (x, y, .38), radius, dark, 24)
            rod("Pulley center", (x, y, .381), (x, y, .389), radius * .46, steel, 16)
        pipe("Accessory belt", [(-.09, -.02, .376), (-.27, .21, .376), (-.23, .305, .376),
             (.21, .328, .376), (.243, .25, .376), (.075, -.06, .376), (-.09, -.02, .376)], .014, rubber, 8, .025)
        if kind == "supercharged":
            box("Roots supercharger housing", (0, .54, -.005), (.39, .27, .52), chrome, .078)
            for z in (-.20, -.10, 0, .10, .20):
                box("Cast blower rib", (0, .54, z), (.415, .23, .018), steel, .007)
            box("Rounded triple scoop", (0, .76, .035), (.60, .22, .29), steel, .075)
            for x in (-.185, 0, .185):
                rod("Scoop polished lip", (x, .76, .167), (x, .76, .195), .082, chrome, 24)
                rod("Scoop deep inlet", (x, .76, .196), (x, .76, .201), .064, rubber, 24)
            rod("Blower belt pulley", (0, .57, .276), (0, .57, .39), .087, dark, 24)
            pipe("Supercharger drive belt", [(-.079, .01, .405), (-.076, .58, .405), (-.04, .647, .405),
                 (.055, .636, .405), (.080, .568, .405), (.091, .018, .405), (-.079, .01, .405)], .015, rubber, 8, .035)
        elif kind == "injected":
            box("Eight-stack intake manifold", (0, .445, 0), (.35, .12, .60), steel, .035)
            for x in (-.11, .11):
                for z in (-.225, -.075, .075, .225):
                    height = .67 + .05 * (1 - abs(z) / .225)
                    rod("Polished injection trumpet", (x, .49, z), (x, height, z), .045, chrome, 20)
                    rod("Trumpet flared rim", (x, height-.018, z), (x, height+.012, z), .061, chrome, 24)
                    rod("Recessed black intake", (x, height+.013, z), (x, height+.015, z), .044, rubber, 24)
            for x in (-.23, .23):
                rod("Anodized fuel rail", (x, .49, -.27), (x, .49, .27), .025, orange, 12)
                for z in (-.225, -.075, .075, .225):
                    rod("Fuel injector", (x, .49, z), (x*.5, .50, z), .014, steel, 8)
        else:
            rod("Air cleaner base", (0, .405, 0), (0, .435, 0), .248, dark, 32)
            rod("Painted cylindrical air filter", (0, .435, 0), (0, .555, 0), .224, orange, 32)
            for i in range(32):
                a = i * math.tau / 32
                rod("Air cleaner pleat", (.225 * math.cos(a), .443, .225 * math.sin(a)),
                    (.225 * math.cos(a), .549, .225 * math.sin(a)), .0065, dark, 6)
            rod("Polished air cleaner lid", (0, .555, 0), (0, .577, 0), .248, steel, 32)
            rod("Air cleaner center nut", (0, .578, 0), (0, .60, 0), .02, chrome, 6)
    return finish("Engine_" + kind)


def finish(name):
    # Bake only newly authored pieces, preserving other scenes and source assets.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for ob in list(parts):
        evaluated = ob.evaluated_get(depsgraph)
        baked = bpy.data.meshes.new_from_object(evaluated)
        ob.modifiers.clear()
        ob.data = baked
    bpy.ops.object.select_all(action="DESELECT")
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = "DR2_" + name
    ob.data.name = name + "_Mesh"
    assets.append(ob)
    return ob


def wing_blade(kind, height=0, depth_scale=1, back=0):
    # Cambered section with rounded tips; delta has a pointed swept centre.
    profile = [(-.25,-.005),(-.247,.016),(-.19,.037),(-.04,.05),
               (.12,.03),(.23,.008),(.232,-.005),(.12,-.017),
               (-.04,-.023),(-.19,-.02)]
    xs = [-.9,-.87,-.82,-.5,-.25,0,.25,.5,.82,.87,.9]
    vertices = []
    for x in xs:
        tip = .65 if abs(x) > .88 else .92 if abs(x) > .85 else 1
        sweep = -.30*(1-abs(x)/.9) if kind == "delta" else .025*(abs(x)/.9)**2
        for z,y in profile:
            vertices.append((x,height+y*tip,back+sweep+z*depth_scale*tip))
    n = len(profile)
    faces = [tuple(reversed(range(n))),tuple((len(xs)-1)*n+j for j in range(n))]
    for i in range(len(xs)-1):
        for j in range(n):
            k=(j+1)%n
            faces.append((i*n+j,i*n+k,(i+1)*n+k,(i+1)*n+j))
    create("Sculpted aerofoil",vertices,faces,orange,.005,True)


def wing(kind):
    global parts
    parts=[]
    wing_blade(kind,depth_scale=.5 if kind=="lip" else 1)
    if kind!="lip":
        for side in (-1,1):
            x=side*.896
            patch("Sculpted end plate",[(x,-.052,.25),(x,.115,.19),
                  (x,.17,-.12),(x,.02,-.27),(x,-.07,-.22)],orange,.024,.012)
            for z in (-.17,.17):
                rod("Flush end plate fastener",(x-side*.015,0,z),(x+side*.019,0,z),.013,chrome,8)
    if kind=="stunt":
        wing_blade("sport",height=.14,depth_scale=.47,back=-.17)
        for x in (-.64,.64):
            box("Second-element bracket",(x,.085,-.17),(.027,.10,.06),dark,.01)
    # Mounting inserts are generated with the body-specific pylons in the game.
    ob=finish("Wing_"+kind)
    ob["reference_span"]=1.8
    return ob


def round_lamp(x,y,radius):
    rod("Die-cast lamp housing",(x,y,-.05),(x,y,.045),radius,orange,32)
    rod("Machined reflector bezel",(x,y,.046),(x,y,.068),radius*.91,chrome,32)
    rod("Recessed reflector cavity",(x,y,.069),(x,y,.073),radius*.77,dark,32)
    rod("Optical reflector",(x,y,.074),(x,y,.080),radius*.65,steel,24)
    rod("Warm projector lens",(x,y,.081),(x,y,.091),radius*.43,lamp,24)
    for a in (0,math.pi/2,math.pi,math.pi*1.5):
        dx,dy=math.cos(a)*radius*.85,math.sin(a)*radius*.85
        rod("Bezel screw",(x+dx,y+dy,.068),(x+dx,y+dy,.077),.009,dark,6)
    for dy in (-.055,.055):
        box("Rear cooling rib",(x,y+dy,-.057),(radius*1.4,.016,.035),dark,.006)


def lights(kind):
    global parts
    parts=[]
    box("Light mounting rail",(0,0,0),(1.30,.055,.11),dark,.018)
    if kind=="bar":
        box("Rounded LED extrusion",(0,.089,.02),(1.22,.14,.16),orange,.039)
        box("Recessed lens gasket",(0,.09,.104),(1.12,.097,.012),rubber,.027)
        for i in range(12):
            x=(i-5.5)*.087
            rod("Individual LED reflector",(x,.09,.111),(x,.09,.117),.035,chrome,12)
            rod("Warm LED lens",(x,.09,.118),(x,.09,.124),.025,lamp,12)
        for y in (.055,.09,.125):
            box("Extruded heatsink fin",(0,y,-.075),(1.13,.015,.036),dark,.005)
    elif kind in ("round","rally"):
        count=2 if kind=="round" else 4
        pitch=.68 if count==2 else .30
        radius=.16 if count==2 else .125
        for i in range(count):
            x=(i-(count-1)/2)*pitch
            rod("Adjustable lamp stem",(x,.02,0),(x,.06,0),.030,steel,10)
            round_lamp(x,radius+.035,radius)
    else:
        for x in (-.465,-.155,.155,.465):
            box("Rounded projector pod",(x,.105,.016),(.254,.20,.155),orange,.047)
            box("Pod bezel",(x,.105,.096),(.216,.162,.018),dark,.036)
            for dx in (-.048,.048):
                for dy in (-.035,.035):
                    rod("Pod reflector",(x+dx,.105+dy,.107),(x+dx,.105+dy,.116),.035,chrome,16)
                    rod("Pod LED lens",(x+dx,.105+dy,.117),(x+dx,.105+dy,.124),.025,lamp,16)
            box("Pod cooling sink",(x,.10,-.078),(.19,.13,.035),dark,.018)
    ob=finish("Lights_"+kind)
    ob["reference_span"]=1.3
    return ob


if BUILD_SET=="workshop":
    engine("injected")
    for key in WING_TYPES:
        wing(key)
    for key in LIGHT_TYPES:
        lights(key)
else:
    for key in BODY_TYPES:
        body(key)
    for key in WHEEL_TYPES:
        wheel(key)
    for key in ENGINE_TYPES:
        engine(key)

actual_names = sorted(ob.name for ob in assets)
if actual_names != sorted(EXPECTED_NAMES):
    raise RuntimeError("Asset-name contract was not met: " + repr(actual_names))

bpy.ops.object.select_all(action="DESELECT")
for ob in assets:
    ob.select_set(True)
bpy.context.view_layer.objects.active = assets[0]
bpy.context.view_layer.update()
filename = "workshop-parts-v1" if BUILD_SET=="workshop" else "truck-library-v2"
output = ROOT / "assets" / (filename + ".glb")
bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True,
                         use_active_scene=True, export_apply=True, export_yup=True, export_materials="EXPORT",
                         export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / "design" / "blender" / (filename + ".blend")))
stats = []
for ob in assets:
    ob.data.calc_loop_triangles()
    stats.append({"name": ob.name, "vertices": len(ob.data.vertices),
                  "triangles": len(ob.data.loop_triangles), "dimensions": [round(v, 4) for v in ob.dimensions]})
result = {"scene": scene.name, "file": str(output), "objects": stats,
          "triangles": sum(item["triangles"] for item in stats)}
