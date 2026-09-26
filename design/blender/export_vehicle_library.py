"""Export the canonical vehicle library without moving or copying its meshes.

Run in Blender's Text Editor, or:
blender --background vehicle-library.blend --python export_vehicle_library.py
Optional command-line arguments after --: --output-dir DIRECTORY
"""
from pathlib import Path
import argparse
import sys

import bpy
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[2]
LIBRARY_NAME = "vehicle-library.blend"
SOURCE_SCENE = "02 · Einzelteile bearbeiten"
OVERVIEW_SCENE = "01 · Fahrzeugübersicht"
GROUPS = (
    ("Karosserien", "Body", ("pickup", "buggy", "van", "hotrod")),
    ("Räder", "Wheel", ("standard", "giant", "sand", "street", "suv")),
    ("Motoren", "Engine", ("classic", "injected", "supercharged", "electric")),
    ("Spoiler", "Wing", ("lip", "sport", "stunt", "delta")),
    ("Lampen", "Lights", ("bar", "round", "pods", "rally")),
)
ALL_NAMES = tuple("DR2_" + prefix + "_" + key for _, prefix, keys in GROUPS for key in keys)
BUNDLES = {
    "truck-library-v2": tuple(name for name in ALL_NAMES if name.startswith(("DR2_Body_", "DR2_Wheel_")) or name in (
        "DR2_Engine_classic", "DR2_Engine_supercharged", "DR2_Engine_electric")),
    "workshop-parts-v1": tuple(name for name in ALL_NAMES if name.startswith(("DR2_Wing_", "DR2_Lights_")) or name == "DR2_Engine_injected"),
}


def validate():
    source = bpy.data.scenes.get(SOURCE_SCENE)
    if source is None or not source.get("dust_rush_vehicle_library"):
        raise RuntimeError("Open the organized vehicle-library.blend before exporting.")
    if {o.name for o in source.objects} != set(ALL_NAMES):
        raise RuntimeError(f"The source scene must contain exactly the {len(ALL_NAMES)} named vehicle roots.")
    identity = Matrix.Identity(4)
    for name in ALL_NAMES:
        obj = source.objects[name]
        if obj.type != "MESH" or obj.parent is not None:
            raise RuntimeError("Expected an unparented mesh root: " + name)
        if any(abs(obj.matrix_world[row][col] - identity[row][col]) > 1e-7 for row in range(4) for col in range(4)):
            raise RuntimeError("Keep the mounting origin and object transform unchanged: " + name)
        if obj.hide_viewport or obj.hide_render:
            raise RuntimeError("Use view-layer isolation, not global object hiding: " + name)
    return source


def export_library(output_dir=None):
    source = validate()
    output = Path(output_dir) if output_dir else ROOT / "assets"
    output.mkdir(parents=True, exist_ok=True)
    window = bpy.context.window
    previous_scene, previous_layer = window.scene, window.view_layer
    # A temporary scene references the ORIGINAL objects; no mesh copies, no shifts,
    # no intermediate .blend file. The overview and its labels cannot leak out.
    export_scene = bpy.data.scenes.new("Temporary vehicle export")
    exported = []
    try:
        window.scene = export_scene
        for bundle, names in BUNDLES.items():
            for obj in list(export_scene.collection.objects):
                export_scene.collection.objects.unlink(obj)
            for name in names:
                obj = source.objects[name]
                export_scene.collection.objects.link(obj)
            window.view_layer.update()
            for obj in export_scene.objects:
                obj.hide_set(False)
                obj.select_set(True)
            window.view_layer.objects.active = source.objects[names[0]]
            path = output / (bundle + ".glb")
            bpy.ops.export_scene.gltf(
                filepath=str(path), export_format="GLB", use_selection=True,
                use_active_scene=True, export_apply=True, export_yup=True,
                export_materials="EXPORT", export_extras=True)
            exported.append(str(path))
    finally:
        window.scene = previous_scene
        window.view_layer = previous_layer
        bpy.data.scenes.remove(export_scene)
    return exported


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    for path in export_library(args.output_dir):
        print("Exported:", path)
