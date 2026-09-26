# Fahrzeugmodelle in Blender

Die aktuelle bearbeitbare Quelle ist [vehicle-library.blend](vehicle-library.blend). Sie enthält vier Karosserien, fünf Räder, vier Motoren, vier Spoiler und vier Lampensets. Werkstattmöbel und Streckenobjekte bleiben in ihren eigenen Bibliotheken. Federn, Fahrwerk, veränderliche Verbindungen und die unabhängig einfärbbaren Dekormasken entstehen weiterhin im Spielcode.

## Übersicht und Bearbeitung

Beim Öffnen erscheint die Szene **01 · Fahrzeugübersicht**: fünf beschriftete Reihen, davon vier mit je vier Varianten und die Radreihe mit fünf. Alle Teile sind achsenparallel ohne zusätzliche Drehung angeordnet und werden von oben betrachtet. Die Ansicht bleibt frei dreh- und zoombar. Die Vorschauen sind verknüpfte Collection-Instanzen, keine zusätzlichen Mesh-Kopien. Kleine Teile sind dort je Kategorie vergrößert; diese Darstellung verändert weder die Originalgröße noch den Export.

Zum Bearbeiten:

1. Oben im Szenenmenü **02 · Einzelteile bearbeiten** wählen.
2. Im View-Layer-Menü oben rechts die gewünschte Variante wählen, etwa **Body · pickup** oder **Lights · rally**. Jede Ansicht blendet die anderen zwanzig Varianten aus.
3. Über **Ansicht → Auswahl einrahmen** das aktive Teil heranholen. Seine Geometrie im Edit Mode bearbeiten; Objektursprung, Objekttransform und den Namen mit **DR2_** unverändert lassen.
4. Zur Übersichtsszene zurückwechseln. Die verknüpfte Vorschau zeigt die Änderung automatisch.
5. Die gemeinsame Blender-Datei speichern.

Im Outliner sind die Originale nach Kategorie und Variante gegliedert. Die Montagepunkte stecken in den ursprünglichen Geometriedaten und benutzerdefinierten Eigenschaften. Die Übersicht verschiebt ausschließlich ihre Instanzen. Wer mehrere Teile zusammen betrachten möchte, kann zusätzliche Varianten im View Layer einblenden; der Export hängt nicht von dieser Sichtauswahl ab.

## SUV-Räder als fünfte Variante

Das SUV-All-Terrain-Rad hat im Spiel 0,40 Meter Radius, 0,80 Meter Durchmesser und rund 0,30 Meter Breite. Das eigene Modell besitzt ein flacheres All-Terrain-Profil und fünf geteilte Felgenspeichen. Die vier bisherigen Varianten bleiben unverändert erhalten; die Auswahl im Spiel ist von klein nach groß sortiert.

Alle Radquellen verwenden weiterhin den gemeinsamen Normradius 0,685 Meter. Die SUV-Skalierung in `src/customization.mjs` beträgt deshalb `0.4 / VEHICLE_DIMENSIONS.wheelRadius`. Dieselbe Einstellung steuert sichtbare Größe, Bodenhöhe und den Radius für Drehzahl, Radkraft und mechanische Geschwindigkeitsgrenze. Die Metadaten `wheel_radius_m` und `source_radius_m` dokumentieren beide Maße. Eine Änderung des Radmodells ersetzt nicht die Abstimmung von Fahrwerk, Übersetzung und Widerständen.

[add_suv_wheel.py](add_suv_wheel.py) dokumentiert die einmalige additive Ergänzung. Es verweigert einen erneuten Lauf über eine vorhandene SUV-Variante und prüft die bisherigen Originale auf unveränderte Geometrie, Materialien und Montageursprünge. Die Sicherung `vehicle-library.before-suv.blend` enthält den Stand vor der Ergänzung. Normale weitere Änderungen erfolgen direkt in der gemeinsamen Bibliothek; die historischen Generatoren nicht darüber laufen lassen.

## Export ins Spiel

[export_vehicle_library.py](export_vehicle_library.py) im Blender-Texteditor öffnen und ausführen. Alternativ im Projektordner:

```sh
blender --background design/blender/vehicle-library.blend --python-exit-code 1 --python design/blender/export_vehicle_library.py
npm run build
npm test
```

Falls Blender nicht im Suchpfad liegt, den vollständigen Pfad zur Anwendung verwenden.

Der Export prüft die einundzwanzig Wurzeln und ihre Montageursprünge. Eine temporäre Szene referenziert nur die Originalobjekte; es werden keine Mesh-Kopien erzeugt, keine Modelle verschoben und keine zusätzliche Blender-Datei geschrieben. Danach werden Szene und Ansicht wiederhergestellt. Beschriftungen, Kameras und Vorschauinstanzen landen nicht im Spiel.

Die vorhandenen beiden Laufzeitpakete bleiben zur Kompatibilität bestehen:

| Export | Inhalt |
| --- | --- |
| `assets/truck-library-v2.glb` | Vier Karosserien, fünf Räder, V8, Kompressor und Elektromotor |
| `assets/workshop-parts-v1.glb` | Einspritz-V8, vier Spoiler und vier Lampensets |

Beide Exporte stammen künftig aus derselben bearbeitbaren Datei. Nach einem Modell-Export den Spiel-Build und die Tests ausführen; diese prüfen unter anderem Montagepunkte, Abmessungen, Offline-Einbettung und Modellbudgets. Eine Veröffentlichung bleibt ein eigener Schritt.

Für einen Probeexport ohne Überschreiben der Spielmodelle kann nach dem Skript `-- --output-dir /absoluter/pruefordner` angegeben werden.

## Prüfung der Bibliothek

[verify_vehicle_library.py](verify_vehicle_library.py) prüft die Originale, einundzwanzig verknüpfte Vorschauen, isolierte Bearbeitungsansichten und den Export. Es vergleicht die exportierte Geometrie und Materialien mit den vorhandenen Spielpaketen. Eine absichtliche Modelländerung muss deshalb zuerst geprüft und in die Spielpakete exportiert werden, bevor dieser Vergleich wieder übereinstimmt.

```sh
blender --background design/blender/vehicle-library.blend --python-exit-code 1 --python design/blender/verify_vehicle_library.py -- --output-dir /absoluter/pruefordner
```

## Historische Quellen und Rekonstruktion

Die bisherigen Dateien [truck-library-v2.blend](truck-library-v2.blend) und [workshop-parts-v1.blend](workshop-parts-v1.blend) bleiben unverändert als historische Rückfallebene erhalten. Neue manuelle Anpassungen gehören ausschließlich in die gemeinsame Fahrzeugdatei.

[organize_vehicle_library.py](organize_vehicle_library.py) dokumentiert die einmalige Zusammenführung. Es läuft nur in einem frischen Blender-Prozess und überschreibt keine vorhandene gemeinsame Bibliothek. Alternative Quelldateien lassen sich über `--base-source` und `--workshop-source` übergeben. Die Zusammenführung prüft, dass Geometrie, Objekttransformationen, Materialzuordnungen und Montage-Eigenschaften unverändert bleiben.

[build_asset_library.py](build_asset_library.py) bleibt der historische Geometrie-Generator. Er erzeugt die beiden alten Pakete neu und übernimmt keine nachträglichen manuellen Änderungen aus der gemeinsamen Datei. Für den normalen Bearbeitungs- und Exportweg deshalb nicht erneut ausführen.
