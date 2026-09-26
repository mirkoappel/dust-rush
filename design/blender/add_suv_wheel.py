"""Add the SUV wheel without rebuilding existing assets.
Run once with vehicle-library.blend open. A named backup and geometry
fingerprints protect existing work. Source wheels use a shared .685 m radius;
the game scales this variant to .40 m radius, approximately .30 m wide.
"""
import math
from pathlib import Path
import shutil
import sys
import bmesh
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_vehicle_library import ALL_NAMES, SOURCE_SCENE, OVERVIEW_SCENE, validate
from organize_vehicle_library import fingerprint, text_object


def create_suv_mesh(source):
    vertices, faces, face_mats, smooth_faces = [], [], [], []
    existing_materials = list(source.objects["DR2_Wheel_street"].data.materials)
    materials = [next(m for m in existing_materials if m.name.startswith(prefix))
                 for prefix in ("DR_Rubber", "DR_Tread", "DR_Graphite", "DR_BrushedSteel", "DR_Orange_paint")]

    def mesh(points, polygons, material, smooth=False):
        offset, factor = len(vertices), .685 / .4
        # Real SUV dimensions -> normalized library, game XYZ -> Blender XZY.
        vertices.extend((x * factor, -z * factor, y * factor) for x, y, z in points)
        faces.extend(tuple(offset + i for i in p) for p in polygons)
        face_mats.extend([material] * len(polygons))
        smooth_faces.extend([smooth] * len(polygons))

    def lathe(profile, material, segments=32):
        points = [(x, r * math.cos(i * math.tau / segments), r * math.sin(i * math.tau / segments))
                  for x, r in profile for i in range(segments)]
        polygons = [(j * segments + i, j * segments + (i + 1) % segments,
                     ((j + 1) % len(profile)) * segments + (i + 1) % segments,
                     ((j + 1) % len(profile)) * segments + i)
                    for j in range(len(profile)) for i in range(segments)]
        mesh(points, polygons, material, True)

    def prism(points, depth, material):
        n = len(points)
        mesh(points + [(x + depth, y, z) for x, y, z in points],
             [tuple(reversed(range(n))), tuple(range(n, n * 2))] +
             [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)], material)

    lathe([(-.139, .226), (-.151, .26), (-.148, .305), (-.13, .356),
           (-.106, .379), (-.075, .39), (0, .393), (.075, .39), (.106, .379),
           (.13, .356), (.148, .305), (.151, .26), (.139, .226)], 0)
    # Connected tire, three staggered rows of low all-terrain blocks.
    for row, center in enumerate((-.092, 0, .092)):
        for block in range(24):
            angle = block * math.tau / 24 + (row % 2) * .11
            lo, hi = center - .04, center + .04
            corners = [(lo, angle), (hi, angle + .045), (hi, angle + .226), (lo, angle + .181)]
            points = [(x, (r - .021 * (abs(x) / .132) ** 2) * math.cos(a),
                       (r - .021 * (abs(x) / .132) ** 2) * math.sin(a))
                      for r in (.382, .40) for x, a in corners]
            mesh(points, [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
                          (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], 1)
    for side in (-1, 1):
        lathe([(side * .147, .29), (side * .15, .294), (side * .149, .301), (side * .145, .304)], 0)
        lathe([(side * .14, .226), (side * .145, .213), (side * .105, .199),
               (side * .084, .077), (side * .079, .077), (side * .092, .226)], 2)
        lathe([(side * .144, .214), (side * .151, .216), (side * .153, .224),
               (side * .147, .23), (side * .139, .228)], 4)
        # Five split alloy spokes instead of the existing six-spoke street wheel.
        for spoke in range(5):
            for branch in (-1, 1):
                a = spoke * math.tau / 5
                points = [(side * x, r * math.cos(a + da), r * math.sin(a + da))
                          for r, da, x in ((.062, -.10, .114), (.062, .10, .114),
                                           (.21, branch * .14 + .043, .139),
                                           (.21, branch * .14 - .043, .139))]
                prism(points, side * .009, 3)
            a = spoke * math.tau / 5
            points = [(side * .127, .069 * math.cos(a) + .007 * math.cos(j * math.tau / 6),
                       .069 * math.sin(a) + .007 * math.sin(j * math.tau / 6)) for j in range(6)]
            prism(points, side * .01, 3)
        lathe([(side * .10, .047), (side * .133, .047), (side * .137, .039),
               (side * .137, .002), (side * .10, .002)], 2, 24)
        lathe([(side * .137, .025), (side * .139, .025), (side * .139, .002), (side * .137, .002)], 4, 24)
    data = bpy.data.meshes.new("Wheel_suv_Mesh")
    data.from_pydata(vertices, [], faces)
    for material in materials:
        data.materials.append(material)
    for polygon, index, smooth in zip(data.polygons, face_mats, smooth_faces):
        polygon.material_index, polygon.use_smooth = index, smooth
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    # Exact shared radius, including the outermost tread vertex.
    outer = max(math.hypot(v.co.y, v.co.z) for v in data.vertices)
    for v in data.vertices:
        v.co.y *= .685 / outer
        v.co.z *= .685 / outer
    data.update()
    return data


def add_suv_wheel():
    path = Path(bpy.data.filepath)
    if path.name != "vehicle-library.blend":
        raise RuntimeError("Open vehicle-library.blend first.")
    if bpy.data.objects.get("DR2_Wheel_suv"):
        raise RuntimeError("SUV already exists; edit normally rather than replacing it.")
    source = bpy.data.scenes[SOURCE_SCENE]
    if set(source.objects.keys()) != set(ALL_NAMES) - {"DR2_Wheel_suv"}:
        raise RuntimeError("Unexpected original asset set; inspect before adding.")
    before = {obj.name: fingerprint(obj) for obj in source.objects}
    backup = path.with_name("vehicle-library.before-suv.blend")
    if backup.exists():
        raise RuntimeError("Backup already exists; inspect it before retrying.")
    shutil.copy2(path, backup)
    if bpy.data.is_dirty:
        bpy.ops.wm.save_as_mainfile(filepath=str(backup), copy=True)
    original_root = source.collection.children["Originale · Montageursprung beibehalten"]
    category = original_root.children["02 · Räder"]
    variant = bpy.data.collections.new("Wheel · 05 · SUV-All-Terrain")
    category.children.link(variant)
    data = create_suv_mesh(source)
    wheel = bpy.data.objects.new("DR2_Wheel_suv", data)
    variant.objects.link(wheel)
    wheel["wheel_radius_m"] = .4
    wheel["source_radius_m"] = .685
    wheel["description"] = "SUV All-Terrain, 0.80 m diameter, split-spoke alloy"
    for layer in source.view_layers:
        branch = layer.layer_collection.children[original_root.name].children[category.name]
        branch.children[variant.name].exclude = True
    layer = source.view_layers.new("Wheel · suv")
    bpy.context.window.scene = source
    bpy.context.window.view_layer = layer
    for group in layer.layer_collection.children[original_root.name].children:
        for item in group.children:
            item.exclude = item.collection != variant
    layer.objects.active = wheel
    wheel.select_set(True, view_layer=layer)
    overview = bpy.data.scenes[OVERVIEW_SCENE]
    display = overview.collection.children["Übersicht · verknüpfte Modelle"]
    labels = overview.collection.children["Beschriftung · kein Spielexport"]
    preview = bpy.data.objects.new("Vorschau · DR2_Wheel_suv", None)
    display.objects.link(preview)
    preview.instance_type, preview.instance_collection = "COLLECTION", variant
    preview["edit_source"] = wheel.name
    preview.scale = (1.35 * .4 / .685,) * 3
    text_object("Label · DR2_Wheel_suv", "SUV-All-Terrain", (0, 0, .02), .37, labels,
                bpy.data.materials["Overview · Lettering"])
    for index, key in enumerate(("suv", "street", "standard", "sand", "giant")):
        name = "DR2_Wheel_" + key
        x = (index - 2) * 5.4
        overview.objects["Vorschau · " + name].location = (x, 4.5, 0)
        overview.objects["Label · " + name].location = (x, 2.5, .02)
    assert before == {name: fingerprint(source.objects[name]) for name in before}, "Existing asset changed"
    validate()
    bpy.context.window.scene = overview
    bpy.ops.wm.save_as_mainfile(filepath=str(path))
    print("SUV added; all 20 original meshes/materials/transforms preserved; backup:", backup)


if __name__ == "__main__":
    add_suv_wheel()
