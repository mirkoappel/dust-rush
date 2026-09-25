# DUST RUSH — Monstertrucks

Große Reifen. Große Sprünge. Und ordentlich Wumms. Ein kinderfreundliches 3D-Arcade-Spiel mit Rennen, Freestyle-Arena und einer Werkstatt für den eigenen Monstertruck.

**KI-Experiment:** Dieses Projekt ist zugleich ein spielerischer Praxistest des KI-Modells **Astra**. Im gemeinsamen Dialog werden Spielideen entwickelt, umgesetzt, ausprobiert und verbessert – von der 3D-Grafik über Fahrphysik und Handy-Steuerung bis zur Veröffentlichung. Es handelt sich nicht um einen standardisierten Benchmark.

## Jetzt spielen

**[▶ Spielbare Demo auf GitHub Pages](https://mirkoappel.github.io/dust-rush/)**

Beim ersten Öffnen erscheinen zunächst nur DUST RUSH und ein Ladebalken. Der Fortschritt folgt den tatsächlich abgeschlossenen Vorbereitungsschritten. Spielart-Auswahl, Play und Einstellungen werden erst eingeblendet, wenn alle Welten bereit sind. Der Ladebildschirm benötigt weder 3D-Grafik noch externe Bilder; bei einem Ladefehler erscheint ein Wiederholen-Knopf.

Kein Konto, keine Werbung. Die drei Bildkarten wählen Rennen, Rambazamba oder Werkstatt. Schon beim Auswählen wechselt die Vorschau-Szene; erst der große grüne Play-Knopf startet den gewählten Modus. Der grüne Zurück-Pfeil oben links führt aus jedem Modus ins Hauptmenü.

[![Dust Rush auf der Rennstrecke – Screenshot der bisherigen veröffentlichten Version](docs/gameplay.png)](https://mirkoappel.github.io/dust-rush/)

Die Screenshots in `docs/` zeigen noch einen früheren Gestaltungsstand des Spiels.

## Einfach einsteigen

**Ohne Lesen:** Die wichtigsten Bedienelemente sind Bildknöpfe. Zurück, Einstellungen und Kamera verwenden gleich große Icon-Buttons in einem gemeinsamen dunklen Toolbar-Stil. Der Zurück-Pfeil bleibt grün; bei Einstellungen bedeutet Grün tatsächlich aktiv – Vollbild beispielsweise nur im Vollbildmodus. Das Einstellungssymbol ist in allen Spielarten gleich: Antippen oder Anklicken erweitert seine Toolbar nach unten und pausiert die Fahrt. Die Leiste enthält Ton, Vollbild und am Handy die Neigelenkung. Derselbe Einstellungsknopf oder ein Tipp neben die Leiste schließt sie und setzt die Fahrt fort. Hover öffnet sie nicht. Runden, Platz und Punkte stehen oben mittig. In der Werkstatt sitzt dort am Desktop die Kameraleiste und bleibt auch bei geöffneten Einstellungen sichtbar. Auf Geräten mit primärer Touch-Bedienung ist sie ausgeblendet: Drehen und Zoomen funktionieren direkt am Truck.

**Am Handy:** Das Gerät quer und bequem wie ein Lenkrad halten, dann Play antippen. Die Neigelenkung ist standardmäßig an; falls der Browser fragt, den Bewegungssensor erlauben. Das Querformat-Handy im Einstellungsmenü schaltet sie aus oder wieder an. Grün bedeutet an, ein roter Strich bedeutet aus. Links und rechts bleiben als Bildschirmtasten immer verfügbar und haben beim Drücken Vorrang vor dem Neigen. Die 3D-Kamera rollt bei aktiver Neigelenkung sanft gegen die Handybewegung, damit der Horizont bei normalen Lenkbewegungen im Raum ruhiger bleibt; die Bedienelemente bleiben fest am Bildschirm. In beiden Spielarten gibst du selbst Gas: grünes Pedal halten; das rote Pedal bremst und fährt nach dem Stillstand rückwärts. Beim Starten und Fortsetzen wird die aktuelle Haltung als Geradeausstellung übernommen.

**Am Computer:** Mit ← und → lenken, mit der Leertaste Gas geben und mit der linken Umschalttaste bremsen. Die Bildschirmtasten sind bei Tastatur und Maus ausgeblendet. Pfeil hoch/runter und WASD funktionieren weiterhin. Es gibt weder automatische Lenkhilfe noch automatisches Gas und keinen Turbo.

| Taste | Funktion |
| --- | --- |
| ← / → oder A / D | Lenken |
| Leertaste, ↑ oder W | Gas geben |
| Linke Umschalttaste, ↓ oder S | Bremsen und rückwärts |
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
- Spoiler: flache Lippe, Sportspoiler oder Stunt-Spoiler.
- Lampen: LED-Leiste, runde Rallye-Scheinwerfer oder vier Dachlampen.
- Dekore: Rennstreifen, Blitz, Flammen oder Tribal, mit eigener Farbe.
- Drei Motoren: V8, Kompressor und elektrisch.

Die sieben Kategorien bieten jeweils eine Variantenauswahl. Bei Spoilern und Dachlampen baut ein erneuter Tipp auf die aktive Teilekarte das Teil ab; ein weiterer Tipp baut es wieder an. Es gibt keine zusätzliche „ohne“-Karte. Bei Karosserie, Reifen, Federung, Motor und Dekor bleibt dagegen immer genau eine Variante ausgewählt. Der Kategorieknopf klappt ausschließlich das Menü auf oder zu und baut nichts ab. Die dezenten Varianten stehen zuerst. Der Auspuff folgt automatisch dem Motor und hat keine eigene Auswahl. Alte eingeschaltete Spoiler und Lampen werden als Stunt-Spoiler und vier Dachlampen übernommen.

Die Bauteilauswahl kommt ohne sichtbaren Text aus; zugängliche Namen für Screenreader bleiben erhalten. Unten stehen ausschließlich Farbfelder. Sie färben das gerade gewählte Teil: Karosserie, Felgen, Federn, Motor oder einzelne Anbauteile. Die Auswahl ist grün hinterlegt, Änderungen erscheinen direkt am Truck.

Auch die Teilevorschauen übernehmen die gewählte Lackierung. Alle 24 Modelloptionen werden aus den echten Spielmodellen erzeugt, einschließlich vollständiger Federbeine und karosseriespezifischer Anbauteile. Reifen und Federhöhen behalten jeweils einen gemeinsamen Maßstab. Die Palette enthält acht Farben in dieser Reihenfolge: Lila, Türkis, Grün, Gelb, Orange, Rot, Cremeweiß und Anthrazit. Das zusätzliche Blau entfällt; Rot und Orange sind klar getrennt, Cremeweiß und Anthrazit stehen nebeneinander. Einen freien Farbwähler gibt es derzeit nicht. Gespeicherte individuelle Lackierungen bleiben erhalten.

Ein gemeinsames unsichtbares Vorschau-Studio zeichnet nur bei Änderungen. Ein begrenzter Sprite-Atlas hält bis zu 64 bereits erzeugte Kombinationen aus Teil, Karosserieform und Farbe im Arbeitsspeicher; unveränderte Bilder werden nicht erneut gerendert. Die HTML-Buttons zeigen jeweils eine flache Canvas-Kopie des passenden Ausschnitts, keine eigenen WebGL-Szenen. Der Atlas wird beim Neuladen neu aufgebaut, erzeugt keine Dateien und lädt keine Bilder nach. Nur fehlende Varianten werden ergänzt; zuletzt nicht mehr benutzte Varianten dürfen Platz für neue machen. Eine kleine Arbeitszeitgrenze verteilt umfangreichere Aktualisierungen auf mehrere Bilder.

Erneutes Antippen der aktiven Kategorie klappt die Teileauswahl und das zugehörige Farbband zu. Dabei fährt die Kamera weich zur Ausgangsansicht des ganzen Trucks zurück und blendet eine für die Motoransicht versteckte Karosserie wieder ein. Werkstatteintritt, Zuklappen und der Überblicksbutton verwenden dieselbe, näher ans Fahrzeug gerückte Übersicht. Das Öffnen einer Hauptkategorie verändert diesen Abstand nicht. Die Kategorienleiste bleibt sichtbar; ein weiterer Tipp öffnet die Optionen wieder. Im Handy-Hochformat sind die Teilekarten bewusst schmal, während alle sieben Kategorien in einer bei Platzmangel scrollbar gehaltenen Leiste erreichbar bleiben. Reifen stehen von oben nach unten nach tatsächlichem Durchmesser sortiert: All-Terrain, Gelände, Sand und Riesenreifen. Ihre Vorschaubilder verwenden einen gemeinsamen Maßstab und dieselbe orthografische Kamera statt einer individuellen Größenanpassung.

Die Werkstatt startet direkt mit einer frei drehbaren Truck-Ansicht. Ein Klick oder Tipp auf den Truck wechselt zwischen nah und weiter weg; Ziehen mit einem Finger oder der Maus dreht die Ansicht. Mausrad beziehungsweise Pinchen mit zwei Fingern verändert den Abstand. Karosserie, Reifen, Federung, Spoiler, Lampen und Dekore teilen dieselbe Gesamtansicht: Beim Wechsel bleiben Blickmittelpunkt, selbst gewählte Drehung und Zoom erhalten. Die Motoransicht fährt näher heran und blendet die verdeckende Karosserie aus; beim Wechsel zurück zur Gesamtansicht kehrt die Kamera weich zur vorherigen Gesamtansicht zurück und die Karosserie wird wieder sichtbar. Auch beim Anbauen oder Abnehmen von Spoilern und Lampen bleibt die Gesamtansicht erhalten. Nur der Motor hat eine eigene Nahansicht; deshalb steht er als letzte Kategorie in der Werkzeugleiste. Konfigurator und Farbband bleiben bedienbar; am Desktop erlauben zusätzliche Bildknöpfe Drehen, Zoomen und die Gesamtansicht ohne Geste. Am Handy entfällt diese Kameraleiste.

Die Konfiguration wird lokal im Browser gespeichert und in Rennen und Arena übernommen. Motoren unterscheiden sich beim Anfahren; das maximale Tempo bleibt begrenzt. Die Reifen verändern Profil und Abrollgröße, die Fahrwerkshöhe hebt separat den gefederten Aufbau.

## Gestaltung und Modelle

Die eigene Blender-Bibliothek enthält die vier Karosserien, vier Reifen und drei Motoren. Die Vorschaubilder im Konfigurator werden aus genau diesen Spielmodellen erzeugt. Der Radstand ist um 20 Prozent verlängert; Karosserien, Federn, Radkontakte und Kollisionskörper sind darauf abgestimmt. Reifenradius und Spurweite bleiben unabhängig davon. Die gemeinsamen Laufzeitmaße stehen in `src/vehicle-dimensions.mjs`. Die vier Dekore werden als gemeinsame farblose Masken auf die lackierten Karosserieflächen gelegt; ihre Farbe ist unabhängig vom Karosserielack. Die bisherigen fest eingebauten Grafiken werden nur in ihren bekannten Bereichen der aktuellen Bibliothek ausgeblendet, Blinker und Gurte bleiben unverändert. Neue Karosseriebibliotheken müssen diese Flächenzuordnung erneut prüfen.

Das sichtbare Fahrwerk wird in `src/models/running-gear.mjs` maßhaltig aufgebaut: Rohrrahmen, Federbeintürme, Achsen, Gelenkstreben, Federauflagen, Kolben und Antriebswellen haben gemeinsame Anschlusspunkte. Der Rahmen bleibt starr, während Achsen und Federbeine der Federung folgen. Die historischen zusammengefassten Rahmen-/Stoßfänger-Meshes sind ausgeblendet, damit keine doppelten Stoßfänger entstehen. Motorlager und Anbauteile richten sich nach den Montagepunkten der jeweiligen Blender-Karosserie; beim Elektroantrieb bleibt der Auspuff unsichtbar. Die Motorwahl steuert diese Sichtbarkeit automatisch.

Die Proportionen sind für das Arcade-Spiel verkleinert und stilisiert. Als Plausibilitätsvergleich dienen reale Monstertrucks mit sehr großen Reifen und einem separaten Rohrrahmen ([Monster Jam: technische Eckdaten](https://www.monsterjam.com/en-gb/monster-jam-101/)). Das Modell ist kein maßstäblicher Nachbau und keine technisch vollständige Fahrwerkskonstruktion.

Unter [design/concepts](design/concepts) liegen die erzeugten Konzeptbilder für Trucks, Teile, Streckenobjekte, Werkstattausstattung und die drei Spielwelten. `prompts.json` dokumentiert die Bildaufträge; der erste verworfene Teile-Entwurf ist entsprechend benannt. Die Bilder sind eine gestalterische Zielrichtung, keine Screenshots: Detailgrad und Lichtstimmung sind noch nicht vollständig in der Echtzeitgrafik erreicht.

[![Gestalterische Zielrichtung für Rennen, Arena und Werkstatt](design/concepts/spielwelten-rennen-arena-werkstatt-v1.png)](design/concepts/spielwelten-rennen-arena-werkstatt-v1.png)

Die editierbaren Blender-Dateien und ihre Erzeugungsskripte liegen unter `design/blender/`. Die Skripte werden in Blender ausgeführt, erstellen eigene Szenen und verändern das ursprüngliche Truck-Modell nicht. Sie exportieren nur die ausgewählten Spiel-Assets. Auch Schrottautos, bewegliche Hindernisse, Werkstattausstattung, Stahlrampen, Betonbarrieren, Felsen und Kakteen sind eigene Blender-Modelle. Wiederholte Streckenobjekte werden instanziert. Die befahrbaren Erdhügel und der Aufbau der Werkstatthalle bleiben aus wartbarem Code erzeugt, damit Gelände und Fahrphysik übereinstimmen.

## Als App installieren

Die Demo ist eine Progressive Web App. Einmal online öffnen und vollständig laden lassen; danach kann das Spiel auch ohne Netz starten. Die installierte App fordert auf unterstützten Geräten den Vollbildmodus im Querformat an. Die Darstellung der Android-Systemleiste kann je nach Browser und Gerät abweichen; ältere Installationen müssen möglicherweise neu installiert werden, damit die geänderte Startanzeige übernommen wird.

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

Rennstrecke, Arena und Werkstatt werden vor der Freigabe des Play-Knopfs vorbereitet. Die beiden Fahrwelten bleiben für die Lebensdauer der Seite im Speicher und teilen einen WebGL-Renderer, die Umgebungstextur und die eingelesenen GLB-Vorlagen. Ein Moduswechsel baut keine Welt neu auf und lädt keine Modelle nach; nur die aktive Welt wird simuliert und gerendert. Die Hauptmenü-Vorschau übernimmt Kameraposition, Zielpunkt und Drehphase relativ zum Truck, sodass auch beim Wechsel zur Arena nur die Umgebung wechselt.

Zum lokalen Testen steht unten links eine kleine FPS-Anzeige, während der Fahrt am Handy oberhalb der Lenktasten. Daneben stehen die durchschnittliche Bildzeit und mit ↑ die längste Bildzeit des letzten Halbsekundenfensters. Gemessen werden die tatsächlichen Bildabstände, unabhängig vom begrenzten Physik-Zeitschritt; die Anzeige erscheint erst nach dem Laden. So werden auch einzelne Ausreißer sichtbar, ohne daraus bereits auf eine bestimmte Ursache zu schließen.

Ein Klick oder Tipp auf die FPS-Anzeige öffnet eine kleine Textstatistik; ein weiterer schließt sie. Sie trennt CPU-Zeiten für Physik, Szenen-/Kamera-Updates, den Render-Aufruf und die übrige UI-/Audioarbeit. Zeichnungen und Dreiecke enthalten ausdrücklich den Schattenpass und weisen dessen Anteil separat aus. Dazu kommen Schattenauflösung, Bildpuffergröße, Pixelfaktor und der gesamte geladene Bestand an Geometrien, Texturen und Shader-Programmen. Diese Ressourcenanzahlen sind keine Speicherangabe in Megabyte. Die Statistik verändert weder Spieltempo noch Grafikqualität und pausiert das Spiel nicht.

GPU-Zeit wird nur gemessen, wenn der Browser die nötige Timer-Erweiterung bereitstellt; andernfalls steht dort „nicht verfügbar“. Abfragen werden asynchron, nur stichprobenartig und mit begrenzter Warteschlange ausgewertet. CPU- und GPU-Zeit sind verschiedene Messungen und dürfen wegen ihrer zeitlichen Überlappung nicht einfach addiert werden. Beim Zuklappen werden Detailmessung und Renderer-Hooks wieder entfernt.

Die Detailstatistik zeigt zusätzlich die letzte Aktualisierung der Teilebilder: Dauer der Render-/Kopieraufrufe, Zeit bis zum fertigen Vorschaubild sowie neue Bilder und Cache-Treffer. Diese separate Vorschauarbeit läuft nicht dauerhaft. Die Ressourcen- und GPU-Zähler der Spielwelt enthalten den eigenen Vorschau-Renderer nicht; die Bereitschaftszeit der Vorschau ist keine Messung des tatsächlichen Bildschirm-Präsentationszeitpunkts. Tests in einer Handy-Emulation ersetzen keinen Test auf einem echten Smartphone.

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
