# DUST RUSH — Monstertrucks

Große Reifen. Große Sprünge. Und ordentlich Wumms. Ein kinderfreundliches 3D-Arcade-Spiel mit Rennen, Freestyle-Arena und einer Werkstatt für den eigenen Monstertruck.

**KI-Experiment:** Dieses Projekt ist zugleich ein spielerischer Praxistest des KI-Modells **Astra**. Im gemeinsamen Dialog werden Spielideen entwickelt, umgesetzt, ausprobiert und verbessert – von der 3D-Grafik über Fahrphysik und Handy-Steuerung bis zur Veröffentlichung. Es handelt sich nicht um einen standardisierten Benchmark.

## Jetzt spielen

**[▶ Spielbare Demo auf GitHub Pages](https://mirkoappel.github.io/dust-rush/)**

Kein Konto, keine Werbung. Die drei Bildkarten wählen Rennen, Rambazamba oder Werkstatt. Schon beim Auswählen wechselt die Vorschau-Szene; erst der große grüne Play-Knopf startet den gewählten Modus. Das Haus oben links führt aus jedem Modus zurück.

[![Dust Rush auf der Rennstrecke – Screenshot der bisherigen veröffentlichten Version](docs/gameplay.png)](https://mirkoappel.github.io/dust-rush/)

**Entwicklungsstand:** Die neue Modellbibliothek und der überarbeitete Konfigurator werden derzeit lokal getestet. Die öffentliche Demo und die Screenshots in `docs/` zeigen noch den vorherigen Veröffentlichungsstand.

## Einfach einsteigen

**Ohne Lesen:** Die wichtigsten Bedienelemente sind große Bildknöpfe. Grün zeigt eine aktive Auswahl. Das Pause-/Einstellungsmenü enthält Ton, Vollbild und Handy-Lenkung; darunter führt Play zurück. Ein Tipp auf den Hintergrund schließt das Menü ebenfalls. Es gibt dort keinen zusätzlichen Schließen- oder Neustart-Knopf, kein Text-Untermenü und keine Diagnoseoptionen.

**Am Handy:** Das Gerät quer und bequem wie ein Lenkrad halten, dann Play antippen. Falls der Browser fragt, den Bewegungssensor erlauben. Lenken erfolgt durch Drehen. In beiden Spielarten gibst du selbst Gas: grünes Pedal halten; das rote Pedal bremst und fährt nach dem Stillstand rückwärts. Mit aktiver Handy-Lenkung liegen die Pedale unter dem linken und rechten Daumen. Ohne Sensorsignal stehen die Lenktasten links und die Pedale rechts bereit. Beim Starten und Fortsetzen wird die aktuelle Haltung als Geradeausstellung übernommen.

**Am Computer:** Mit Pfeiltasten oder WASD fahren. Es gibt weder automatische Lenkhilfe noch automatisches Gas und keinen Turbo.

| Taste | Funktion |
| --- | --- |
| ← / → oder A / D | Lenken |
| ↑ oder W | Gas geben |
| ↓ oder S | Bremsen und rückwärts |
| R | Zurück auf die Strecke |
| Esc oder P | Pause / weiter |
| M | Ton an / aus |
| F | Vollbild, falls unterstützt |

## Rennen und Rambazamba

Das Rennen führt mit sechs Trucks über drei Runden durch eine Wüstenstrecke. Kontrollpunkte verhindern Abkürzungen; am Ziel wird ein Band durchbrochen.

Rambazamba ist eine freie Monstertruck-Show mit zwölf Sprunghügeln, sechzehn überfahrbaren Schrottautos, fünf Stunt-Ringen, gestapelten Kisten, Fässern und weiteren Trucks. Es gibt weder Zeitlimit noch Rundenzwang. Ein durchfahrener Ring bringt Punkte, ist aber keine Pflichtaufgabe. Zurück ins Hauptmenü und erneut Play starten die Arena frisch.

![Arena – Screenshot der bisherigen veröffentlichten Version](docs/arena.png)

- Vier Radkontakte, sichtbare Schraubenfedern und gedämpfte Landungen.
- Schwerkraft, Trägheit und Reifengrip; Rampen, kleine Hügel und Rüttelwellen.
- Gegenseitige Stoßimpulse zwischen Trucks und gedämpfte Wandkontakte.
- Pylonen, Fässer, Kisten und lose Reifen, die weggestoßen werden.
- Neun Schrottautos auf der Rennstrecke und sechzehn in der Arena, die sich plattdrücken lassen.
- Einstürzende Kistenstapel, Staub, Crash-Effekte und lokal synthetisierter Motorsound.

Die Physik ist bewusst verzeihend, keine technisch genaue Fahrzeugsimulation. Das normale Tempo liegt auf ebenem Boden ungefähr bei 55 km/h im Rennen und 40 km/h in der Arena. Gefälle und Stöße können es kurzzeitig verändern. Die Physik läuft in festen 120-Hz-Schritten; die Darstellung glättet Zwischenstände. Die sichtbare Raddrehung ist gegen stroboskopisches Rückwärtslaufen begrenzt, ohne die physikalische Abrollberechnung zu ändern.

## Den Traumtruck bauen

Die Werkstatt ist eine eigene 3D-Halle mit Werkbank, Werkzeugwand, Ersatzreifen und Wagenheber. Eine vertikale Leiste mit weißen Symbolen öffnet die jeweiligen Bildoptionen:

- Vier Karosserien: Pickup, Buggy, Van und Hotrod.
- Vier Reifen: Gelände, Riesenreifen, breite Sandreifen und feinere All-Terrain-Reifen.
- Drei davon unabhängige Fahrwerkshöhen: normal, hoch und extra hoch.
- Drei Motoren: V8, Kompressor und elektrisch.
- Anbauteile: Spoiler, Dachscheinwerfer und Show-Auspuff.

Die Bauteilauswahl kommt ohne sichtbaren Text aus; zugängliche Namen für Screenreader bleiben erhalten. Unten stehen ausschließlich Farbfelder. Sie färben das gerade gewählte Teil: Karosserie, Felgen, Federn, Motor oder einzelne Anbauteile. Die Auswahl ist grün hinterlegt, Änderungen erscheinen direkt am Truck.

Die Werkstatt startet direkt mit einer frei drehbaren Truck-Ansicht. Ein Klick oder Tipp auf den Truck wechselt zwischen nah und weiter weg; Drehen bleibt jederzeit möglich. Mausrad beziehungsweise Zwei-Finger-Geste verändert den Abstand. Beim Wählen einer Teilekategorie fährt die Kamera zum passenden Bereich. In der Motoransicht wird die verdeckende Karosserie ausgeblendet und beim Wechsel zurück wieder sichtbar. Konfigurator und Farbband bleiben bedienbar; zusätzliche Bildknöpfe erlauben Drehen, Zoomen und die Gesamtansicht ohne Geste.

Die Konfiguration wird lokal im Browser gespeichert und in Rennen und Arena übernommen. Motoren unterscheiden sich beim Anfahren; das maximale Tempo bleibt begrenzt. Die Reifen verändern Profil und Abrollgröße, die Fahrwerkshöhe hebt separat den gefederten Aufbau.

## Gestaltung und Modelle

Die eigene Blender-Bibliothek enthält die vier Karosserien, vier Reifen und drei Motoren. Die Vorschaubilder im Konfigurator werden aus genau diesen Spielmodellen erzeugt. Der Radstand ist um 20 Prozent verlängert; Karosserien, Federn, Radkontakte und Kollisionskörper sind darauf abgestimmt. Reifenradius und Spurweite bleiben unabhängig davon. Die gemeinsamen Laufzeitmaße stehen in `src/vehicle-dimensions.mjs`.

Das sichtbare Fahrwerk wird in `src/models/running-gear.mjs` maßhaltig aufgebaut: Rohrrahmen, Federbeintürme, Achsen, Gelenkstreben, Federauflagen, Kolben und Antriebswellen haben gemeinsame Anschlusspunkte. Der Rahmen bleibt starr, während Achsen und Federbeine der Federung folgen. Die historischen zusammengefassten Rahmen-/Stoßfänger-Meshes sind ausgeblendet, damit keine doppelten Stoßfänger entstehen. Motorlager und Anbauteile richten sich nach den Montagepunkten der jeweiligen Blender-Karosserie; beim Elektroantrieb bleibt der Auspuff unsichtbar, ohne die gespeicherte Auswahl zu löschen.

Die Proportionen sind für das Arcade-Spiel verkleinert und stilisiert. Als Plausibilitätsvergleich dienen reale Monstertrucks mit sehr großen Reifen und einem separaten Rohrrahmen ([Monster Jam: technische Eckdaten](https://www.monsterjam.com/en-gb/monster-jam-101/)). Das Modell ist kein maßstäblicher Nachbau und keine technisch vollständige Fahrwerkskonstruktion.

Unter [design/concepts](design/concepts) liegen die erzeugten Konzeptbilder für Trucks, Teile, Streckenobjekte, Werkstattausstattung und die drei Spielwelten. `prompts.json` dokumentiert die Bildaufträge; der erste verworfene Teile-Entwurf ist entsprechend benannt. Die Bilder sind eine gestalterische Zielrichtung, keine Screenshots: Detailgrad und Lichtstimmung sind noch nicht vollständig in der Echtzeitgrafik erreicht.

[![Gestalterische Zielrichtung für Rennen, Arena und Werkstatt](design/concepts/spielwelten-rennen-arena-werkstatt-v1.png)](design/concepts/spielwelten-rennen-arena-werkstatt-v1.png)

Die editierbaren Blender-Dateien und ihre Erzeugungsskripte liegen unter `design/blender/`. Die Skripte werden in Blender ausgeführt, erstellen eigene Szenen und verändern das ursprüngliche Truck-Modell nicht. Sie exportieren nur die ausgewählten Spiel-Assets. Auch Schrottautos, bewegliche Hindernisse, Werkstattausstattung, Stahlrampen, Betonbarrieren, Felsen und Kakteen sind eigene Blender-Modelle. Wiederholte Streckenobjekte werden instanziert. Die befahrbaren Erdhügel und der Aufbau der Werkstatthalle bleiben aus wartbarem Code erzeugt, damit Gelände und Fahrphysik übereinstimmen.

## Als App installieren

Die Demo ist eine Progressive Web App. Einmal online öffnen und vollständig laden lassen; danach kann das Spiel auch ohne Netz starten.

- Android / unterstützte Browser: im Browsermenü „App installieren“ oder „Zum Startbildschirm hinzufügen“ wählen.
- iPhone / iPad: in Safari „Teilen“ → „Zum Home-Bildschirm“ wählen.

Installation und Sensorzugriff hängen vom Browser und Gerät ab. GitHub Pages liefert HTTPS. Ein wartendes Spielupdate wird erst im Hauptmenü übernommen, nicht während eines Rennens, einer Rennpause oder einer Werkstattsitzung. Es gibt keine Analyse-Skripte oder Telemetrie; Konfiguration und Bestzeiten bleiben im Browser.

## Ohne Server spielen

Die fertige `index.html` enthält Spielcode, Styles, Symbole und alle vier 3D-Modellbibliotheken. Zum Spielen sind weder Node.js noch Entwicklungsserver nötig. Auf dem Mac öffnet auch `Spiel starten.command` die lokale HTML-Datei.

Direkter Dateistart und installierbare Web-App sind verschiedene Wege: PWA-Installation und zuverlässiger Sensorzugriff nutzen die HTTPS-Demo. Lokal stehen Tastatur und Touch-Tasten bereit, soweit das Betriebssystem lokale HTML-Dateien im Browser ausführt.

## Entwickeln

Node.js wird nur zum Bauen und Testen benötigt, nicht zum Spielen. Im Projektordner:

```sh
npm ci
npm run build
npm test
npm start
```

Die optionale Vorschau läuft auf [localhost:4177](http://127.0.0.1:4177/). Nach Quellcodeänderungen erneut bauen und den Browser neu laden. Lokal wird kein Service Worker registriert, damit alte Offline-Caches die Vorschau nicht überdecken. Esbuild bündelt das Spiel; Sharp erzeugt die App-Symbole.

| Pfad | Aufgabe |
| --- | --- |
| `src/page.html`, `style.css` | Oberfläche und responsive Gestaltung |
| `src/game.mjs` | Eingaben, Konfiguration und Spielablauf |
| `src/ui/` | Lokale Icons, Teile-Vorschaubilder und Nahansicht |
| `src/customization.mjs` | Validierte Teile, Farben und Geometrieparameter |
| `src/vehicle-dimensions.mjs` | Gemeinsame Maße für Modelle, Aufhängung und Fahrphysik |
| `src/models/`, `src/truck-addons.mjs` | Fahrzeugvarianten, Anbauteile und Weltobjekte |
| `src/tilt.mjs` | Kalibrierte Handy-Lenkung |
| `src/simulation.mjs`, `src/physics.mjs` | Rennen, Gegner, Radkontakte und Impulse |
| `src/suspension.mjs`, `src/wheel-motion.mjs` | Federung und Radanimation |
| `src/obstacles.mjs`, `src/arena.mjs` | Hindernisse und Freestyle-Arena |
| `src/world.mjs`, `src/environment.mjs` | 3D-Szene, Licht, Darstellung und Kamera |
| `src/workshop.mjs` | Werkstatthalle |
| `src/audio.mjs` | Synthetisierter Motorsound und Effekte |
| `src/pwa.mjs`, `manifest.webmanifest` | Installation und Offline-Integration |
| `src/service-worker.template.js` | Vorlage für den versionierten Offline-Cache |
| `assets/monstertruck.glb` | Erhaltener Quell-Truck und Knoten für Rad-/Lenkbewegungen |
| `assets/truck-library-v2.glb` | Karosserien, Reifen und Motoren |
| `assets/world-assets-v1.glb` | Bewegliche Hindernisse und Werkstattausstattung |
| `assets/track-assets-v1.glb` | Rampen, Barrieren, Felsen und Kakteen |
| `design/blender/`, `design/concepts/` | Editierbare Modelle und gestalterische Referenzen |
| `tests/` | Automatische Tests |

GitHub Pages veröffentlicht `main` aus dem Root-Verzeichnis. `.nojekyll` sorgt für statische Auslieferung; relative URLs unterstützen den Unterpfad `/dust-rush/`.

## Prüfungen und Grenzen

Die Tests prüfen unter anderem vollständige Drei-Runden-Rennen, manuelle Steuerung, Ruhe im Stand, Sprünge, Federwege, Landungsdämpfung, Rampenkollisionen, Truck-Stoßimpulse, Hindernisse, Stunt-Ringe, Kistenstapel, unabhängige Reifen/Fahrwerkshöhen, gespeicherte Farben und Motoren, Tap-/Ziehgesten, Menüs sowie PWA und Offline-Datei. Alle vollständigen GLBs müssen in der einzelnen HTML-Datei enthalten sein; externe Skripte oder Styles dürfen nicht nötig sein. Zusätzlich werden Modellbudgets und die zum Physikkörper passenden Ursprünge und Maße geprüft.

Die Oberfläche wird in der Desktop-Vorschau und mit Handy-Hoch-/Querformat geprüft. Ein Test der Bewegungssensoren auf einem echten Smartphone steht noch aus. Der automatisierte Testbrowser erlaubt keinen direkten `file://`-Aufruf; dieser Startweg ist strukturell geprüft, nicht dort tatsächlich ausgeführt.

## Technik und Lizenzen

Three.js, GLTFLoader und BufferGeometryUtils sind lokal in Revision 167 enthalten; ihre MIT-Lizenz steht in [vendor/THREE-LICENSE.txt](vendor/THREE-LICENSE.txt). Die Oberfläche verwendet einen lokalen SVG-Ausschnitt aus [Lucide](https://lucide.dev/) 1.47.0, ergänzt um eigene spezifische Piktogramme. Die ISC-/Feather-MIT-Hinweise stehen in [vendor/LUCIDE-LICENSE.txt](vendor/LUCIDE-LICENSE.txt). Beide Lizenztexte sind auch in die Offline-Datei eingebettet.

Die Truck-Modelle wurden für dieses Spiel in Blender gebaut. Das Repository erteilt derzeit keine zusätzliche allgemeine Lizenz für den übrigen Spielcode, die Modelle oder Konzeptbilder.
