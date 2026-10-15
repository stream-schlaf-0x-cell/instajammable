# instajammable

Ein Instrument im Browser für generative **Ambient- und Lo-Fi-Jams**. Starte eine Szene, improvisiere darüber und sichere einen guten Moment mit **Capture**. Piano Roll, musikalische Rollen und Clip-Editor gehören zur selben Oberfläche.

Version 2.0.0 entwickelt das bisherige ECHO-GARDEN-Projekt weiter. Der neue Jam-Motor verwendet gemeinsame Harmonik, wiederkehrende Motive und voneinander unabhängige Zufallsströme. Die internen Klänge sind eine sofort spielbare Vorschau; externe AU-/VST-Instrumente laufen weiterhin in Ableton.

## Lokal starten

Voraussetzung: Node.js ab Version 20. Die Entwicklungsumgebung verwendet Node 24.13.0. Keine Cloud-Anmeldung und kein kostenpflichtiger Dienst sind für den Betrieb erforderlich.

```bash
npm ci
npm run dev
```

Öffne die im Terminal angezeigte lokale Adresse, üblicherweise [localhost:5173](http://localhost:5173). Browser-Audio startet erst nach einer bewussten Bedienaktion.

```bash
npm run typecheck
npm test
npm run build
```

`npm test` führt die aktuellen Regressionstests für Audio-/MIDI-Verhalten, musikalische Regeln, Capture/Import/Export, Sessionzustand und Speicherung aus. Die frühere Assertions-Sammlung bleibt getrennt unter `npm run test:legacy` erhalten; ihre grüne Ausgabe ist keine vollständige Funktionsabnahme.

## Sofort jammen

1. Wähle eine Szene, kontrolliere Tonart und Tempo und starte den Jam.
2. Spiele deine Keys dazu. Die Piano Roll zeigt erzeugte Noten, ihre Länge und den harmonischen Zusammenhang.
3. Nutze **Bewegung**, **Dichte**, **Wärme** und **Raum** für indirekte Eingriffe. Die Detailansicht erschließt die einzelnen Layer.
4. Drücke **Capture**, wenn die letzte Phrase interessant war. Der Ausschnitt öffnet sich im MIDI-Editor und kann gespeichert oder exportiert werden.

Die Oberfläche gliedert sich in **Jam**, **Sammlung** und **Details**. Die Hauptansicht konzentriert sich auf musikalisches Spielen; Import, gespeicherte Clips und präzise Bearbeitung sind bei Bedarf erreichbar.

### Startszenen

| Szene | Richtung | Charakter | Ausgangstempo |
|---|---|---|---|
| Dorian Dawn | Ambient | Warme offene Akkorde, ruhige Motive, Platz für Keys | 78 BPM |
| Tidal Glass | Ambient | Schwebende Harmonik, Luft im Hintergrund, glockenartige Fragmente | 72 BPM |
| Night Orbit | Ambient | Tiefe Drones und langsame Bewegung; Drums zunächst stumm | 66 BPM |
| Moss Pulse | Groove | Organischer wiederkehrender Groove unter bewegten Pads, mit sanften Übergängen | 92 BPM |
| Ultimae Drift | Ultimae | Breite, tiefe Flächen über einem langsamen Half-Time-Puls, Glocken obenauf | 84 BPM |
| Still Water | Calm | Keine Drums. Ein gehaltener Grundton, langsame Akkorde, lange Pausen | 56 BPM |
| Rain Window | Calm | Weiche Moll-Harmonik unter gleichmäßigem Regen | 62 BPM |
| Deep Dub | Deep Techno | Sub-Kick, Akkord-Stabs auf dem Off-Beat, lange Tape-Echos | 116 BPM |
| Night Rumble | Deep Techno | Schwer, hypnotisch, sparsam: phrygischer Bass unter dunklem Wash | 108 BPM |
| Dusty Keys | Lo-Fi | Septakkorde, weicher Bass und zurückhaltender Backbeat, Vinyl-Knistern | 82 BPM |
| Late Train | Lo-Fi | Mollharmonik und ein leicht geswingter Groove | 74 BPM |
| Blue Hour | Lo-Fi · Flow | Atmosphärisches Lo-Fi, das mit dem Kick atmet und sich alle acht Takte sanft verschiebt | 78 BPM |
| Streamlight | Lo-Fi · Flow | Verregnetes Lo-Fi für lange Improvisations-Sessions mit ruhigen Übergängen | 70 BPM |

Alle Szenen haben acht Rollen: **Texture, Chords, Bass, Melody, Kick, Snare / Rim, Hi-hat und Percussion**. Harmonik, Register, Velocity und Phrasenlängen begrenzen das Material. Der Grundton, die Skala und das Tempo verändern sich beim automatischen Evolve nicht. Der Start ist **Moss Pulse**; eine gespeicherte Session hat Vorrang.

### Akkordbühne, Tonart und Tempo

- **Akkordbühne** über der Piano Roll: großer Grundton (anklickbar, spielt ihn an), Akkordsymbol, die Akkordtöne, der **nächste Akkord** und ein Countdown bis zum Wechsel. Die Piano Roll tönt die Zeilen des Grundtons bernsteinfarben und die übrigen Akkordtöne zart grün.
- Akkordsymbole werden aus den tatsächlich gespielten Tönen berechnet (zum Beispiel `Dm9`, `Fmaj7`, `A7sus4`, `Bdim`). Ambient und Techno nutzen Septakkorde, Nonen-Shells, offene Nonen und Sus-Klänge; je höher **Bewegung**, desto häufiger die reicheren Voicings.
- **Grundton und Skala** lassen sich direkt im Transport wählen. Lagen der Layer wandern mit.
- **Tempo** ist tippbar (40 bis 180), mit `−`/`+`, Pfeiltasten (Shift = ±5) und **Tap**. Eine gültige Zahl wirkt sofort, Enter oder Verlassen bestätigt. Der Takt wird im nächsten 16tel neu getaktet; die vier Punkte neben dem Feld zeigen den aktuellen Schlag des Taktes, daran siehst du ein neues Tempo sofort. Das Delay folgt dem Tempo mit einem weichen Gleiten wie ein Tonband.

### Evolve, Variation, Lock und Freeze

- **Evolve-Button** ist die Mutation. Er ordnet neu: **Akkordfolge und Voicing, Melodie (Charakter, Rhythmus, Kontur), Groove und Klangfarben** von Chords und Melody (innerhalb einer Palette je Stil, zum Beispiel Wash, Glass, Luft, Orgel). Layerdichten bewegen sich innerhalb deiner Grenzen. Grundton, Skala und Tempo bleiben erhalten.
  - **Während des Spielens** setzt die Änderung mit dem nächsten 16tel ein, nicht mitten in einem Ton: Chords, Bass und Melody, die noch klingen, blenden in ca. 0,3 s aus, und die neu geordneten Stimmen steigen im selben Moment mit kurzem Attack ein (höchstens 0,4 s). Es wird nichts hart abgeschnitten. MIDI-Noten dieser Layer werden dabei beendet und neu gesetzt.
  - Der **Drone** bleibt als Anker liegen. Drums wechseln ohne Übergang, da sie keine Liegetöne haben.
  - **Gesperrte** (Lock) und **eingefrorene** (Freeze) Layer, stumme Layer und Layer unter einem Clip-Loop werden nicht angefasst. Ist die **Chords-Spur** gesperrt oder eingefroren, bleibt auch die Akkordfolge die ursprüngliche (Bass und Melody folgen ihr dann).
  - Eine Klangfarbe, die du selbst außerhalb der Palette gewählt hast, bleibt stehen. Jeder Evolve-Schritt lässt sich mit Undo zurücknehmen und erscheint unter Details → „Zuletzt im Jam“, inklusive der geänderten Klangfarben.
- **Langsame Entwicklung** unter Details lässt Motive und Grooves etwa alle acht Takte variieren. Hinzu kommt langsame Klangbewegung; Phrasen dürfen mehrfach wiederkehren.
- **Lock** schützt den Layer vor Mutation und automatischer Veränderung seiner wiederkehrenden Muster. Globale Harmonik und manuelle Änderungen bleiben eigene Eingriffe.
- **Freeze** wiederholt eine eingefangene Phrase des Layers, standardmäßig aus den letzten vier gespielten Takten. Liegt noch kein gespieltes Material vor, wird ausdrücklich eine Vorschauphrase verwendet.
- **Mute / Solo** steuern, welche Rollen erklingen. **Panic** stoppt den Jam, verwirft geplante MIDI-Ausgaben, beendet Stimmen und räumt Effektnachklänge ab.

In den Layerdetails stehen neben dem komponierten Groove auch Euclidean, Probabilistic, Polymetric, Markov und Density Burst für die Drumrollen zur Verfügung. Einstellbare Unter- und Obergrenzen begrenzen die Dichte bei manueller Änderung, Makros und Mutation. Ein Register ohne passenden Skalenton erzeugt keine chromatische Ausweichnote.

Akkorde klingen nicht mehr starr: Pad-Akkorde werden leicht **gerollt** (tiefe Töne zuerst), nach der Hälfte der Phrase antworten manchmal die oberen Töne neu verteilt, Dub-Stabs wechseln ihre Off-Beat-Muster und spielen manchmal nur die oberen drei Töne. Die Melodie wählt pro Phrase einen von sechs Charakteren: **Walk** (Schrittbewegung), **Call** (Antwort spiegelt den Ruf), **Arp** (Akkordtöne), **Pedal** (Haltton mit Nebentönen), **Sparse** (wenige lange Töne), **Run** (Lauf zum Phrasenende); Techno und Lo-Fi nutzen eine passende Auswahl. Evolve würfelt den Charakter neu.

Ambient hält Akkorde normalerweise vier Takte, Lo-Fi zwei. Melodie und Bass beziehen sich auf dieselbe Harmonik. Variation arbeitet innerhalb des musikalischen Zusammenhangs; sie garantiert kein bestimmtes ästhetisches Ergebnis mit beliebigen externen Plugin-Presets.

## Klanglabor und eigene Regler

Unter **Details → Klanglabor** kannst du die internen Stimmen vollständig bearbeiten. Die Bereiche bleiben zunächst eingeklappt:

- Für Texture, Chords, Bass und Melody: drei Oszillator-Wellenformen, Verstimmung, Sub-Level, Filter und Resonanz, Filterhüllkurve, ADSR, LFO, Drift, Stereobreite und Synth-Pegel.
- Für die vier Drumstimmen: Tonhöhe, Decay, Klanghelligkeit, Drive, Pegel, Panorama und MIDI-Notennummer. Wertebereiche passen zur jeweiligen Stimme.
- Effekte: Delay-Zeit, Feedback, Mix und Flutter; Reverb-Größe, Decay und Mix; Master Drive.
- Texture: lange Harmonic-Drone-Liegetöne oder eine echte generative **Notenwolke**. Die Bezeichnung Granular Drift stammt aus dem Vorgänger; dieser Modus verteilt MIDI-/Synthesizerereignisse und ist kein Audio-Grain-Renderer.
- Modulation: bis zu 16 echte Verbindungen zwischen Drumdichte, Rhythmusakzenten, Klanghelligkeit bzw. Bewegung und Cutoff, Delay-Feedback, Reverb-Mix, Drumwahrscheinlichkeit oder Akzentstärke.

Ein eigener Klangwert ersetzt den zugehörigen Makro-Basiswert. Modulationsrouten können ihn weiterhin bewegen. Mit Zurücksetzen übernimmt wieder die Szene bzw. das Makro. Wellenformen, Filter, Sub-Oszillator, LFO und Pegel aktualisieren auch laufende Stimmen. Hüllkurven bestimmen den Verlauf neuer Noten.

Der **Pin** holt einzelne Parameter direkt auf die Jam-Seite. Bis zu 64 angeheftete Klangregler werden mit der Session gespeichert; unbekannte Parameter-IDs erzeugen keine Bedienelemente. Die vier musikalischen Makros lassen sich unabhängig davon ein- und ausblenden.

Klangparameter betreffen die internen Synthesizer und Effekte. Für AIR-Instrumente und Valhalla in Live bearbeitest du die jeweiligen Plugins. Die Drum-MIDI-Notennummer verändert dagegen auch die externe Drumzuordnung.

## Atmosphäre, Kick-Atmung und Fluss

Diese Regler sitzen auf der Jam-Seite unter den Makros und sind echte Engine-Funktionen:

- **Atmosphäre**: Tape-Rauschen, Luft/Wind, Vinyl-Knistern, Regen oder **dein eigenes Sample** als Loop. Die Texturen werden im Browser erzeugt; es wird nichts heruntergeladen. Sie laufen nur, während der Jam läuft, gehen durch Hall und Delay und sind in der WAV-Aufnahme enthalten. Das eigene Sample wird lokal dekodiert (WAV, MP3, OGG, M4A; 0,5 s bis 10 min; bis 60 MB) und **nicht gespeichert**: nach dem Neuladen musst du es erneut wählen.
- **Kick-Atmung**: Pads und Atmosphäre geben bei jedem Kick kurz nach und schwellen wieder an (Sidechain-Gefühl, weich ein- und ausgeblendet, nie ein harter Gate). Dezent bei 10 bis 30 %.
- **Fluss**: alle 4, 8, 16 oder 32 Takte eine ruhige Veränderung. Mögliche Züge: der Raum öffnet sich, der Klang dunkelt ab oder öffnet sich, das Ensemble atmet, die Drums treten zurück (Snare und Percussion fallen zuerst weg) und kehren im nächsten Abschnitt wieder, oder es kommen neue Motive über derselben Harmonie. Änderungen erreichen ihr Ziel über mehrere Takte. Fluss **addiert** auf deine Reglerwerte, überschreibt sie also nicht, und gibt sie beim Ausschalten wieder zurück. Tonart und Tempo bleiben stehen. Jeder Übergang erscheint unter Details → „Zuletzt im Jam“.

**Zu automatisch gesammelten Samples:** Die App lädt bewusst keine Klänge aus dem Netz und scrapt nichts. Rechte, Lizenzen und Nutzungsbedingungen sind dabei nicht automatisch geklärt, und ein Stream mit fremdem Material kann Probleme bereiten. Stattdessen lädst du Material, das du selbst nutzen darfst, per Dateiauswahl. Ein späteres Modul für eine Quelle mit klarer Lizenz (zum Beispiel CC0-Filter mit eigenem API-Schlüssel) passt in `AtmosphereBed`; siehe [docs/EXTENDING.md](docs/EXTENDING.md).

### Klang ohne Knacken

Knacken beim Bewegen von Reglern hatte mehrere Ursachen, die jetzt behoben sind: die Hallgröße änderte in Echtzeit die Länge der Hallverzögerungen, ein unveränderter Wellenform-Typ wurde bei jedem Update neu gesetzt, Pad-Stimmen mit langem Release wurden hart abgeschnitten, der Limiter arbeitete mit hartem Knie und 1 ms Attack, und der AudioContext lief mit der knappen Latenz-Einstellung `interactive`. Jetzt skaliert **Raumgröße** nur noch die Nachhallzeit, Tempo-Änderungen gleiten beim Delay wie bei einem Tonband, überzählige Stimmen werden in 60 ms ausgeblendet und der AudioContext nutzt `playback`-Puffer. Das Hintergrundbild der Szene (Vorschau) wird nur noch vor dem ersten Ton berechnet, damit Regler den Haupt-Thread nicht blockieren.

Eine Offline-Messung mit echtem Rendern (`npm run audio:check`, siehe [docs/EXTENDING.md](docs/EXTENDING.md)) zeigt für einen Reglerschwenk bei gehaltenem Akkord eine mehr als hundertfach kleinere größte Unstetigkeit als der vorherige Hall. Das ersetzt keinen Hörtest in Firefox auf deinem Rechner.

## Capture und MIDI-Editor

Der rollende Verlauf hält bis zu **128 Takte**. Capture übernimmt bereits gespielte Ereignisse einschließlich Swing, Microtiming, Velocity und Notendauer. Künftige Lookahead-Ereignisse gehören nicht zum Mitschnitt. Liegen weniger Takte vor als ausgewählt, enthält der Clip den verfügbaren Ausschnitt.

Noten, die vor dem Ausschnitt begonnen haben, werden am Clipanfang übernommen und passend gekürzt. Am Ausschnittende werden Noten geschlossen. Tempoänderungen bleiben Teil des Clips. Vorhören verwendet eigene Stimmen und schreibt keine Vorschauereignisse in den Capture-Verlauf.

Der Editor bietet:

- Keys- und Drumansicht, Spurwahl, Raster und Taktzoom;
- Noten hinzufügen, löschen, bewegen und verlängern;
- Tonhöhe, Beginn, Länge, Velocity und Kanal als Zahlenwerte;
- Auswahl duplizieren, alle Noten auswählen und Quantisieren;
- Undo/Redo, interne Vorschau, Speichern und MIDI-Export;
- **Als Loop jammen** für die ausdrückliche Übernahme am nächsten Taktanfang.

Doppelklick fügt eine Note hinzu. Pfeiltasten ändern die ausgewählte Note; `Cmd/Ctrl+A` wählt alle, `Cmd/Ctrl+Z` macht Änderungen rückgängig. Präzise Zahlenfelder ergänzen Drag-and-drop. Manuelle Noten werden nicht automatisch zur Skala korrigiert.

### Dateiformate und Grenzen

- Import: Standard-MIDI-Dateien **Typ 0 und 1**, mit PPQ-Zeitbasis. SMPTE-Dateien und beschädigte/trunkierte Dateien werden abgewiesen.
- Die Oberfläche nimmt MIDI-Dateien bis 10 MB an. Der MIDI-Parser begrenzt Eingaben zusätzlich auf 32 MB und eine Million Ereignisse. Clips werden vor der Bearbeitung und Speicherung validiert; die Bibliothek begrenzt Noten und zusätzliche Ereignisse auf jeweils 100.000 und prüft Form sowie Wertebereiche.
- Export: SMF Typ 1 mit **960 PPQ**; Timing wird auf 1/960 Beat gerundet. Alle Spuren und Einzelstems behalten denselben Zeitursprung und dieselbe Cliplänge.
- Tempo, MIDI-Kanäle und weitere importierte MIDI-Ereignisse bleiben für den Export erhalten. Solche zusätzlichen Ereignisse werden im Noteneditor nicht grafisch bearbeitet.
- SysEx wird für den Datei-Export erhalten, während der Browser-Vorschau nicht gesendet. Die interne Vorschau reproduziert weder ein externes Plugin-Preset noch dessen komplette Controllerreaktion.
- MIDI-Ausgabe verwendet ganzzahlige Noten. Eine frühere mikrotonale ECHO-GARDEN-Auswahl wird beim sicheren musikalischen Betrieb als dorische Tonmenge behandelt; Pitch-Bend-/MPE-Mikrotonalität ist nicht implementiert.

## Session und Sammlung speichern

Sessions verwenden das versionierte Format **instajammable v2**; Clips das Format **v1**. Sessiondaten enthalten Szene, Parameter, Layer, Routing und Generatorlaufzeit. Der rollende Capture-Verlauf ist kein Bestandteil der gespeicherten Session; sichere wertvolle Ausschnitte als Clips.

Die Bibliothek speichert bis zu **128 Clips** im lokalen Browserspeicher. Beschädigte Einträge werden isoliert. Wenn der Speicher voll oder gesperrt ist, liefert die App eine Fehlermeldung; exportiere dann eine Datei. Browserdaten können durch Löschen der Website-Daten, Privatmodus oder einen anderen Browser verloren gehen. JSON-/MIDI-Export eignet sich für dauerhafte Sicherungen.

Erkannte ECHO-GARDEN-Projektdateien können migriert werden: Grundton, Skala, Tempo, Seed und passende Layerdaten werden übernommen. Alte algorithmusspezifische Einstellungen werden nicht exakt als identischer Klang oder als identisches Muster wiederhergestellt.

## Ableton Live 12 Standard und MIDI

Die App benötigt weder Suite noch Max for Live. Browser können die installierten AIR-/Valhalla-Plugins nicht direkt hosten. Lade sie in Ableton und sende die erzeugten Noten dorthin.

### IAC auf macOS

1. Öffne **Audio-MIDI-Setup → MIDI-Studio**.
2. Öffne den **IAC-Treiber** und aktiviere **Gerät ist online**. Lege einen Bus an, falls noch keiner vorhanden ist.
3. Erlaube MIDI in der Webapp und wähle den IAC-Ausgang. MIDI-Berechtigung und verfügbare Ports werden getrennt vom internen Audio behandelt.
4. Aktiviere in Live für den IAC-Eingang **Track**. **Remote** ist nur für zusätzlich eingerichtete MIDI-Mappings erforderlich. **Sync** bleibt für diesen Workflow aus.
5. Stelle auf der Zielspur **MIDI From** auf den IAC-Bus und den passenden Kanal. Zum Mithören: **Monitor In**, oder **Monitor Auto plus Arm**.

| Rolle | Standardkanal | Mögliche Zielspur |
|---|---|---|
| Texture / Chords | 1 | AIR Hype oder ein Pad-/Keys-Instrument |
| Melody | 2 | Xpand!2 oder AIR Essential Keyboards |
| Bass | 3 | Bassinstrument |
| Alle Drums | 10 | Ableton Drum Rack oder passend belegtes Kit |

Drumnoten: Kick 36, Snare/Rim 38, Hi-hat 42, Percussion 37. Stimme das Rack darauf ab. Die Layerkanäle und Ausgänge lassen sich verändern. Vermeide eine Rückleitung derselben MIDI-Daten aus Live zurück in den IAC-Eingang.

**Tempo und Transport laufen derzeit eigenständig.** Gleiche BPM verbinden keine Start-/Stop-Steuerung. MIDI Clock und Ableton Link sind nicht implementiert. Für synchronisierte Arrangements exportiere den Clip und lege ihn auf Lives Zeitleiste oder zeichne die eingehenden Noten in Live auf.

### Firefox und externe Geräte

Die App prüft Web-MIDI-Verfügbarkeit und fordert MIDI erst auf ausdrückliche Bedienung an. Wenn der Ausgang `MIDIOutput.clear()` unterstützt, können zukünftige zeitgestempelte Nachrichten verworfen werden. Fehlt diese Funktion, hält die App zukünftige Nachrichten in abbrechbaren Browser-Timern und zeigt eine Timing-Warnung; UI-Verzögerungen und Hintergrundtab-Drosselung können diesen Ausweichpfad beeinflussen. Verwende localhost oder einen sicheren Kontext. Bei verweigerter Berechtigung oder fehlendem Port kannst du auf „Audio intern“ wechseln. MIDI- und kombinierte Starts melden ein Problem klar, statt an einen anderen Port auszuweichen. Die reale Firefox-/macOS-MIDI-Verbindung bleibt auf dem Zielrechner zu prüfen.

Der DeepMind kann für MIDI direkt per USB verbunden werden. Wähle seinen Ausgang und den passenden Empfangskanal. Seine Audioausgänge müssen separat aufgenommen werden; die App-Aufnahme erfasst sie nicht. Ein Scarlett 2i2 besitzt keine DIN-MIDI-Anschlüsse.

Die optionale DeepMind-Automation verwendet begrenzte Filter-Controller **CC 29 (Cutoff)** und **CC 30 (Resonanz)**. Das Gerät muss passend auf CC-Empfang eingestellt sein. Diese Funktion ersetzt keine Hardwareabnahme und keine automatische Prüfung des ausgewählten Synthesizers.

## WAV-Aufnahme

Die interne Aufnahme erfasst das Stereo-Master der Webapp als **16-Bit-PCM-WAV** bei der nativen Abtastrate des AudioContext. Der PCM-Pfad verwendet AudioWorklet; ein ScriptProcessor-Ausweichpfad steht bei fehlender Worklet-Unterstützung zur Verfügung. Die Aufnahme ist auf **fünf Minuten** begrenzt, um unkontrollierten Speicherverbrauch zu vermeiden.

AIR-Instrumente und Supermassive in Live sowie DeepMind-Audio werden dadurch nicht aufgenommen. Zeichne diese Signale in Live auf. Der komprimierte MediaRecorder-Ausweichpfad ist kein Ersatz für eine nachweislich erzeugte PCM-Aufnahme.

## Prüfstand und verbleibende Grenzen

Die Regressionstests prüfen konkrete Daten- und Laufzeitabläufe mit deterministischen Generatoren, unabhängiger MIDI-Dateianalyse und gezielten Audio-/MIDI-Mocks. Dazu gehören 1.000 tatsächlich geplante Clock-Schritte und eine Simulation über 2.000 Takte mit begrenztem Capture-Verlauf. Offline-Hörproben von Dorian Dawn und Dusty Keys wurden mit dem tatsächlichen Projektgenerator und den nativen Synthese-/Effektklassen gerendert: 44,1 kHz, Stereo, 16-Bit-PCM, endliche und nachweislich nicht stumme Samples. Diese Offline-Prüfung verwendet eine separate Web-Audio-Implementierung für Node; sie bestätigt keine erfolgreiche Live-Aufnahme im Browser. Ein bestandener Mocktest belegt keine tatsächliche Gerätelatenz, Klangqualität oder Browser-Audioaufnahme.

**Noch nicht am Zielsystem abgenommen:** 2014er Intel-Mac unter Ventura, Firefox mit IAC, Ableton Live 12 Standard, AIR-/Valhalla-Plugins und DeepMind 6. Eine lokale Browserprüfung in einer anderen Umgebung ist davon getrennt auszuweisen. Die Installation von Ventura auf einzelnen 2014er Modellen kann eine gepatchte Installation sein; das Projekt behauptet keine offizielle Apple-Unterstützung dieses Setups.

Kurze praktische Abnahme auf dem Musikrechner:

1. Starte Dorian Dawn intern; prüfe Piano Roll, Audio und Regler.
2. Lasse Evolve mindestens 16 Takte laufen; prüfe wiedererkennbare Motive und hörbare Entwicklung.
3. Capture acht Takte, ändere eine Note, exportiere MIDI und importiere es in Live.
4. Prüfe alle vier Standardkanäle über IAC; betätige Panic auch direkt nach Start.
5. Nimm eine kurze WAV auf und prüfe Inhalt, Länge und Abtastrate in Live.
6. Teste DeepMind getrennt, anschließend einen längeren Jam mit reduziertem Visualmodus.

Die Oberfläche berücksichtigt reduzierte Bewegung und bietet einen sparsamen Modus. Die tatsächliche Leistungsfähigkeit des alten Macs muss gemessen werden; es gibt kein pauschales Versprechen von niedriger CPU-Last oder jitterfreier Hintergrundtab-Wiedergabe.

### Stand der Abnahme — 14. Oktober 2026 (Klang-, Szenen- und Flow-Ausbau)

**89 Regressionstests** bestehen, dazu die 44 Altprüfungen (`npm run test:legacy`). Neu geprüft (Evolve-Runde): Tempowechsel greift im nächsten Schritt; Evolve überblendet nur Chords, Bass und Melody zum nächsten 16tel und lässt Drone, Drums, gesperrte, eingefrorene, stumme und Clip-Layer unberührt; Undo bricht einen anstehenden Übergang ab; ausgeblendete Stimmen zählen nicht ins Stimmenbudget; Akkordfolgen, Voicings, Melodien und Klangfarben ändern sich mit Evolve und bleiben in Skala und Register. Davor geprüft: kein Delay-Eingriff bei Hallgröße, Rückkopplung bleibt stabil, Atmosphäre startet nur mit dem Jam und wechselt mit Fade, Sample-Fehlerfälle, Deep-Techno-Groove (Kick auf jedem Viertel, Hats und Bass auf dem Off-Beat), Flow (addiert auf Nutzerwerte, kehrt zurück, mutiert keine gecachten Noten), Kick-Atmung auf der Audio-Uhr, Akkordbühnen-Daten, Akkordsymbole zu den tatsächlichen Tönen, Validierung aller Szenen und sanftes Ausblenden gestohlener Pad-Stimmen. `npm run audio:check` rendert alle 13 Szenen und einen Reglerschwenk offline mit einer echten Web-Audio-Implementierung und fand dabei einen Instabilitätsfehler in der ersten Fassung des neuen Halls (Filter-Resonanz in der Rückkopplung), der behoben und dauerhaft durch `FLAT_Q` abgesichert ist. **Nicht abgenommen:** Hörqualität, Knacken und CPU-Last in Firefox auf dem 2014er Mac, und die neuen Regler im echten Browser. Das Tempofeld wurde nur per Typprüfung und Build geprüft, nicht in einem Browser.

### Stand der Abnahme — 13. Oktober 2026

Der abschließende automatische Lauf umfasst **64 bestandene Tests**. Das aktuelle Klanglabor-Markup wurde zusätzlich mit der Projekt-React-Konfiguration auf tatsächliche Parameterwerte, Nullwerte, Grenzen und gültige Pins geprüft. Die Simulation prüft den tatsächlich verwendeten Clock-Scheduler über 1.000 Schritte und begrenzte Capture-/Generatorzustände über 2.000 Takte. Der Produktionsbuild und die Typprüfung sind Teil des Abschlusslaufs.

Im Codex-Prüfbrowser wurden die neue Oberfläche, interne Wiedergabe, Capture, das Öffnen des Editors, Noten hinzufügen, Tonhöhe/Velocity ändern, Duplizieren, Undo/Redo, Speichern und Wiederfinden des gespeicherten Clips in der Sammlung beobachtet. Ein Capture enthielt 46 gespielte Noten; nach der Bearbeitung waren 48 Noten gespeichert. Das bestätigt diese konkreten Abläufe, nicht sämtliche Editor-Gesten.

Die Browser-Abnahme wurde anschließend durch die automatische Freigabeprüfung wegen eines Nutzungslimits unterbrochen. Die Übernahme des bearbeiteten Clips im echten Browser, MIDI-Dateiimport über den Dateidialog, Routing-Dialog-Fokus, eine abgeschlossene Browser-WAV-Datei und systematische Prüfungen schmaler Fensterbreiten bleiben dort offen. Die zugehörigen MIDI-, Clip-Override-, Speicher- und Audio-Kernfunktionen sind durch die automatischen Tests geprüft.

Zwei echte Offline-Hörproben wurden mit dem Projektgenerator, den nativen Synthesizern und der Effektkette gerendert: vier Takte Dorian Dawn bzw. Dusty Keys, jeweils mit drei Sekunden Nachklang. WAV: Stereo, 44,1 kHz, 16 Bit, endliche und nicht stumme Samples. Der isolierte Prüf-Renderer ist keine zusätzliche Browser-Abhängigkeit. Offline-Rendern belegt weder Echtzeit-CPU-Verhalten noch einen erfolgreichen Firefox-/IAC-/Ableton-Hardwarelauf.

Nach diesem größeren Update die Browserseite einmal vollständig neu laden. Bei weiteren Entwicklungsänderungen beendet die App ihren bisherigen Motor beim Modulwechsel, um doppelte Clock-/MIDI-Läufe zu vermeiden.
