"""One-time, lossless organization of the two legacy vehicle libraries.

Run in a fresh background Blender process. Existing output is NEVER overwritten.
Use --workshop-source to preserve a saved copy of an unsaved interactive session.
Editing the new library does not require rerunning this migration.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_vehicle_library import ALL_NAMES, BUNDLES, GROUPS, OVERVIEW_SCENE, ROOT, SOURCE_SCENE

LABELS = {
    "pickup": "Pickup", "buggy": "Buggy", "van": "Van", "hotrod": "Hotrod",
    "standard": "Gelände", "giant": "Riesenreifen", "sand": "Sand", "street": "All-Terrain",
    "classic": "V8", "injected": "Einspritz-V8", "supercharged": "Kompressor", "electric": "Elektro",
    "lip": "Lippe", "sport": "Sport", "stunt": "Stunt", "delta": "Delta",
    "bar": "LED-Leiste", "round": "Rund", "pods": "LED-Pods", "rally": "Rallye",
}


def arrange_overview(overview):
    """Only presentation instances move or scale; the originals never do."""
    display_scale = {"Body": 1, "Wheel": 1.35, "Engine": 2.3, "Wing": 1.6, "Lights": 2.1}
    for row, (_, prefix, keys) in enumerate(GROUPS):
        y = 12 if row == 0 else 4.5 - (row - 1) * 5.4
        label = GROUPS[row][0]
        overview.objects["Label · " + label].location = (0, y + 2.15, .02)
        for col, key in enumerate(keys):
            name = "DR2_" + prefix + "_" + key
            obj = overview.objects["Vorschau · " + name]
            obj.location = ((col - 1.5) * 6.1, y, 0)
            obj.rotation_euler = (0, 0, 0)
            obj.scale = (display_scale[prefix],) * 3
            overview.objects["Label · " + name].location = ((col - 1.5) * 6.1, y - (3.25 if row == 0 else 2.0), .02)
    overview.objects["Title"].location.y = 16.1
    overview.camera.location = (0, 0, 36)
    overview.camera.rotation_euler = (0, 0, 0)
    overview.camera.data.ortho_scale = 36
    overview["preview_scale_note"] = "Overview enlarged per category; source models and exports retain the original scale."


def fingerprint(obj):
    """Geometry, transforms and custom properties must survive organization."""
    mesh = obj.data
    payload = {
        "vertices": [list(v.co) for v in mesh.vertices],
        "faces": [list(p.vertices) for p in mesh.polygons],
        "material_indices": [p.material_index for p in mesh.polygons],
        "smooth": [p.use_smooth for p in mesh.polygons],
        "matrix": [list(row) for row in obj.matrix_world],
        "extras": {k: obj[k] for k in obj.keys()},
        "materials": [list(m.diffuse_color) if m else None for m in mesh.materials],
        "modifiers": [m.type for m in obj.modifiers],
    }
    def serializable(value):
        if hasattr(value, "to_dict"):
            return value.to_dict()
        if hasattr(value, "to_list"):
            return value.to_list()
        raise TypeError(type(value).__name__)
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=serializable).encode()).hexdigest()


def collection(name, parent):
    child = bpy.data.collections.new(name)
    parent.children.link(child)
    return child


def text_object(name, body, position, size, parent, material):
    curve = bpy.data.curves.new(name, "FONT")
    curve.body, curve.size, curve.align_x = body, size, "CENTER"
    curve.extrude = 0
    obj = bpy.data.objects.new(name, curve)
    parent.objects.link(obj)
    obj.location = position
    curve.materials.append(material)
    return obj


def organize(base_path, workshop_path, output):
    if output.exists():
        raise RuntimeError("Refusing to overwrite an existing organized library: " + str(output))
    if bpy.data.filepath or any(o.name.startswith("DR2_") for o in bpy.data.objects):
        raise RuntimeError("Use a fresh factory-startup Blender process; do not run over an open working file.")
    roots = {}
    for path, names in ((base_path, BUNDLES["truck-library-v2"]), (workshop_path, BUNDLES["workshop-parts-v1"])):
        if not path.is_file():
            raise FileNotFoundError(path)
        with bpy.data.libraries.load(str(path), link=False) as (available, loaded):
            missing = set(names) - set(available.objects)
            if missing:
                raise RuntimeError("Missing roots: " + ", ".join(sorted(missing)))
            loaded.objects = list(names)
        roots.update((obj.name, obj) for obj in loaded.objects)
    before = {name: fingerprint(obj) for name, obj in roots.items()}
    source = bpy.data.scenes.new(SOURCE_SCENE)
    source.unit_settings.system = "METRIC"
    source["dust_rush_vehicle_library"] = 1
    source["editing_help"] = "Choose an asset in the View Layer dropdown (top right). Edit mesh vertices, not object transforms."
    original_root = collection("Originale · Montageursprung beibehalten", source.collection)
    variants = {}
    for group_index, (label, prefix, keys) in enumerate(GROUPS, 1):
        category = collection(f"{group_index:02d} · {label}", original_root)
        for variant_index, key in enumerate(keys, 1):
            name = "DR2_" + prefix + "_" + key
            variant = collection(f"{prefix} · {variant_index:02d} · {LABELS[key]}", category)
            variant.objects.link(roots[name])
            variants[name] = variant
    bpy.context.window.scene = source
    for index, (name, variant) in enumerate(variants.items()):
        layer = source.view_layers[0] if index == 0 else source.view_layers.new(name)
        layer.name = name.removeprefix("DR2_").replace("_", " · ")
        bpy.context.window.view_layer = layer
        layer.update()
        branch = layer.layer_collection.children[original_root.name]
        for category in branch.children:
            for item in category.children:
                item.exclude = item.collection != variant
        layer.objects.active = roots[name]
        roots[name].select_set(True, view_layer=layer)
    overview = bpy.data.scenes.new(OVERVIEW_SCENE)
    overview.unit_settings.system = "METRIC"
    overview["dust_rush_vehicle_overview"] = 1
    overview["editing_help"] = "Linked previews, not duplicate meshes. Switch to the editing scene and choose the asset's View Layer."
    display = collection("Übersicht · verknüpfte Modelle", overview.collection)
    labels = collection("Beschriftung · kein Spielexport", overview.collection)
    studio = collection("Studio · kein Spielexport", overview.collection)
    label_mat = bpy.data.materials.new("Overview · Lettering")
    label_mat.diffuse_color = (.68, .79, .84, 1)
    for row, (label, prefix, keys) in enumerate(GROUPS):
        y = 10 - row * 5.4
        text_object("Label · " + label, label.upper(), (0, y + 2.15, .02), .52, labels, label_mat)
        for col, key in enumerate(keys):
            name = "DR2_" + prefix + "_" + key
            obj = bpy.data.objects.new("Vorschau · " + name, None)
            display.objects.link(obj)
            obj.instance_type, obj.instance_collection = "COLLECTION", variants[name]
            obj.location = ((col - 1.5) * 6.1, y, 0)
            # Preview-only placement and rotation; canonical objects stay untouched.
            obj.rotation_euler.z = 0
            obj.empty_display_type, obj.empty_display_size = "PLAIN_AXES", .15
            obj["edit_source"] = name
            text_object("Label · " + name, LABELS[key], ((col - 1.5) * 6.1, y - 2.0, .02), .37, labels, label_mat)
    text_object("Title", "DUST RUSH / FAHRZEUGBIBLIOTHEK", (0, 14, .02), .7, labels, label_mat)
    camera_data = bpy.data.cameras.new("Overview Camera")
    camera = bpy.data.objects.new("Overview Camera", camera_data)
    studio.objects.link(camera)
    camera.location = (0, -24, 36)
    rotation = (Vector((0, 0, 0)) - camera.location).to_track_quat("-Z", "Y")
    camera.rotation_euler = rotation.to_euler()
    camera_data.type, camera_data.ortho_scale = "ORTHO", 31
    overview.camera = camera
    overview.render.engine = "BLENDER_WORKBENCH"
    overview.render.resolution_x, overview.render.resolution_y = 1500, 1500
    overview.render.resolution_percentage = 100
    shading = overview.display.shading
    shading.light, shading.color_type = "STUDIO", "MATERIAL"
    shading.show_shadows, shading.show_cavity = True, True
    shading.cavity_type = "BOTH"
    shading.background_type, shading.background_color = "WORLD", (.035, .05, .065)
    overview.world = bpy.data.worlds.new("Overview World")
    overview.world.color = (.035, .05, .065)
    arrange_overview(overview)
    rotation = overview.camera.rotation_euler.to_quaternion()
    # The factory startup scene is known and disposable; no user scene is touched.
    for old in list(bpy.data.scenes):
        if old not in (source, overview):
            bpy.data.scenes.remove(old)
    for obj in list(bpy.data.objects):
        if obj.users == 0:
            bpy.data.objects.remove(obj)
    bpy.context.window.scene = overview
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                space = area.spaces.active
                space.shading.type, space.shading.color_type = "SOLID", "MATERIAL"
                space.overlay.show_floor = False
                space.overlay.show_axis_x = space.overlay.show_axis_y = False
                space.overlay.show_extras = False
                region = space.region_3d
                region.view_rotation = rotation
                region.view_location = (0, 0, 0)
                region.view_distance = 38
                region.view_perspective = "ORTHO"
    help_text = bpy.data.texts.new("START HIER · Bearbeiten und Export")
    help_text.write("DUST RUSH · Gemeinsame Fahrzeugbibliothek\n\n"
        "01 · Fahrzeugübersicht: verknüpfte Collection-Instanzen, keine Mesh-Kopien.\n"
        "Kleine Teile sind in der Übersicht je Kategorie vergrößert, nicht im Export.\n"
        "02 · Einzelteile bearbeiten: oben rechts im View-Layer-Menü das gewünschte Teil wählen.\n"
        "Jede Variante hat eine eigene Collection; nur die gewählte Variante ist sichtbar.\n"
        "Formen im Edit Mode bearbeiten, Objektursprünge und DR2-Namen beibehalten.\n"
        "Ansicht > Auswahl einrahmen zeigt das aktive Einzelteil aus der Nähe.\n"
        "Zurück zur Übersicht: Änderungen erscheinen sofort an der verknüpften Vorschau.\n\n"
        "Export: export_vehicle_library.py im selben Ordner im Text-Editor öffnen und ausführen.\n"
        "Exportiert nur die Originale in die zwei bestehenden GLB-Pakete.\n"
        "Vor Export .blend speichern; nach Export npm run build und npm test.\n"
        "Federn, Fahrwerk und dynamische Verbindungen bleiben im Spielcode.\n"
        "Historische Dateien bleiben als Rückfallebene erhalten; hier weiterarbeiten.\n")
    after = {name: fingerprint(roots[name]) for name in roots}
    if before != after:
        raise RuntimeError("Organization changed source geometry.")
    if set(roots) != set(ALL_NAMES):
        raise RuntimeError("Incomplete library.")
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    return {"path": str(output), "assets": len(roots), "source_fingerprints": after,
            "source_files": [str(base_path), str(workshop_path)], "overview_instances": len(display.objects)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-source", type=Path, default=ROOT / "design/blender/truck-library-v2.blend")
    parser.add_argument("--workshop-source", type=Path, default=ROOT / "design/blender/workshop-parts-v1.blend")
    parser.add_argument("--output", type=Path, default=ROOT / "design/blender/vehicle-library.blend")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    report = organize(args.base_source, args.workshop_source, args.output)
    if args.report:
        args.report.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
