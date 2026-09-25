"""Validate source isolation and semantic round-trip export (inside Blender).

blender --background vehicle-library.blend --python-exit-code 1 \
  --python verify_vehicle_library.py -- --output-dir /absolute/qa-directory
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import sys

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from export_vehicle_library import ALL_NAMES, BUNDLES, OVERVIEW_SCENE, ROOT, export_library, validate


def glb_content(path):
    data = path.read_bytes()
    magic, version, length, json_size, chunk_type = struct.unpack_from("<5I", data)
    assert magic == 0x46546C67 and version == 2 and length == len(data)
    assert chunk_type == 0x4E4F534A
    document = json.loads(data[20:20 + json_size])
    bin_size, bin_type = struct.unpack_from("<2I", data, 20 + json_size)
    assert bin_type == 0x004E4942
    binary = data[28 + json_size:28 + json_size + bin_size]
    assert all(not item.get("uri") for item in document["buffers"])
    assert not document.get("images") and not document.get("extensionsRequired")

    def accessor(index):
        value = document["accessors"][index]
        view = document["bufferViews"][value["bufferView"]]
        components = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[value["type"]]
        size = {5121: 1, 5123: 2, 5125: 4, 5126: 4}[value["componentType"]] * components
        assert view.get("byteStride", size) == size, "Interleaved accessor needs explicit comparison."
        offset = view.get("byteOffset", 0) + value.get("byteOffset", 0)
        result = {key: item for key, item in value.items() if key not in ("bufferView", "byteOffset")}
        result["digest"] = hashlib.sha256(binary[offset:offset + value["count"] * size]).hexdigest()
        return result

    roots = document["scenes"][document.get("scene", 0)]["nodes"]
    result = {}
    for node_index in roots:
        node = document["nodes"][node_index]
        assert "mesh" in node and not node.get("children"), "Only the twenty asset mesh roots may be exported."
        record = {key: node[key] for key in ("translation", "rotation", "scale", "extras") if key in node}
        primitives = []
        for primitive in document["meshes"][node["mesh"]]["primitives"]:
            material = dict(document["materials"][primitive["material"]])
            # Appending the independent old libraries may add a numeric Blender
            # datablock suffix. The game's material matching uses semantic names.
            material["name"] = re.sub(r"\.\d{3}$", "", material["name"])
            primitives.append({
                "attributes": {key: accessor(value) for key, value in primitive["attributes"].items()},
                "indices": accessor(primitive["indices"]),
                "material": material,
                "mode": primitive.get("mode", 4),
            })
        record["primitives"] = sorted(primitives, key=lambda p: p["material"]["name"])
        result[node["name"]] = record
    return result


def verify(output_dir):
    output_dir = Path(output_dir).resolve()
    if output_dir == (ROOT / "assets").resolve():
        raise RuntimeError("Choose a separate QA directory; verification must not overwrite game assets.")
    source = validate()
    overview = bpy.data.scenes[OVERVIEW_SCENE]
    assert len(source.view_layers) == 20
    previews = [obj for obj in overview.objects if obj.instance_type == "COLLECTION"]
    assert len(previews) == 20
    assert {obj["edit_source"] for obj in previews} == set(ALL_NAMES)
    for preview in previews:
        assert list(preview.instance_collection.all_objects) == [source.objects[preview["edit_source"]]]
    window = bpy.context.window
    previous_scene, previous_layer = window.scene, window.view_layer
    try:
        window.scene = source
        for layer in source.view_layers:
            window.view_layer = layer
            layer.update()
            visible = [obj for obj in source.objects if obj.visible_get(view_layer=layer)]
            assert len(visible) == 1, (layer.name, [obj.name for obj in visible])
            assert visible[0] == layer.objects.active
    finally:
        window.scene, window.view_layer = previous_scene, previous_layer
    before = {obj.name: tuple(tuple(row) for row in obj.matrix_world) for obj in source.objects}
    exported = export_library(output_dir)
    assert window.scene == previous_scene and window.view_layer == previous_layer
    assert before == {obj.name: tuple(tuple(row) for row in obj.matrix_world) for obj in source.objects}
    assert not any(s.name.startswith("Temporary vehicle export") for s in bpy.data.scenes)
    for name, expected in BUNDLES.items():
        actual = glb_content(output_dir / (name + ".glb"))
        reference = glb_content(ROOT / "assets" / (name + ".glb"))
        assert set(actual) == set(expected)
        assert actual == reference, "Geometry/materials/mounting extras differ from game assets: " + name
        print("PASS semantic round-trip:", name, len(actual), "roots")
    print("PASS 20 source roots, linked previews and isolated editing layers; no transform changes.")
    return exported


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    verify(args.output_dir)
