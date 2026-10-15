# Erweiterungspunkte

instajammable ist so gebaut, dass neue Dinge meist ein Eintrag in einer Tabelle sind. Kein Eintrag verlangt Änderungen an der Oberfläche; sie liest die Tabellen.

| Du willst … | Wo | Was zu tun ist |
|---|---|---|
| eine **Szene** hinzufügen | `src/engine/jam/scenes.ts` | Eintrag in `SCENES` (Name, Stil, Tempo, Grundton, Skala, `mood`). Optional ein Eintrag in `SCENE_TUNING` für Makros, Lautstärken, Timbres, Atmosphäre, Kick-Atmung, Fluss und Drum-Klang. Die Szenenliste, Vorschau und Validierung übernehmen sie. |
| ein **Timbre** (Klangcharakter) hinzufügen | `src/types/jam.ts` (`TIMBRES`) und `ambientPatch` in `src/engine/jam/JamEngine.ts` | Namen in `TIMBRES` ergänzen, einen `else if (timbre === '…')`-Zweig mit den Synth-Parametern, und den Anzeigenamen in `TIMBRE_NAMES` in `src/App.tsx`. |
| eine **Akkord-Voicing** hinzufügen | `VOICINGS` in `src/engine/jam/music.ts` | Zeile mit Skalenstufen-Abständen (`[0, 2, 6, 8]`), Gewicht und der Bewegung, ab der sie vorkommt. Das Akkordsymbol wird aus den Tönen berechnet (`chordSuffix`). |
| eine **Atmosphäre** (generierte Textur) hinzufügen | `ATMOSPHERE_SOURCES` in `src/engine/audio/atmosphere.ts` und `ATMOSPHERE_KINDS` in `src/types/jam.ts` | Eintrag mit Beschreibung, Puffer-Generator, Filterbereich und Pegel. |
| eine **Atmosphären-Quelle aus dem Netz** anbinden | `AtmosphereBed.loadSample(data, name)` | Lade die Datei selbst (zum Beispiel über eine Quelle mit klarer Lizenz und eigenem API-Schlüssel) und übergib die Bytes. `loadSample` kümmert sich um Dekodierung, Längenprüfung, Loop und Aufräumen. Lizenz und Quelle sind Sache des Aufrufers. |
| einen **Flow-Zug** (Übergang) hinzufügen | `flowMove` in `src/engine/jam/JamEngine.ts` | Neuer Wert in der `rng.pick([...])`-Liste und ein Zweig, der `set({...})` (Makro-Offsets) und optional `f.drumsTarget` setzt. |
| einen **Rhythmus-Generator** hinzufügen | `src/engine/generators/rhythm/` und der `rhythmAlgorithm`-Zweig in `makePlan` (`src/engine/jam/music.ts`) | Generator nach dem Muster der vorhandenen schreiben; Namen in `normalizeLayer` und `LayerDetails` ergänzen. |
| einen **Effektparameter** hinzufügen | `EFFECT_PATCH_RANGES` (`src/engine/jam/sound.ts`), `EffectsParams` (`src/types/index.ts`), `EffectsRack.updateParams`, `effectiveEffects`, `EFFECT_SPECS` (`SoundLab.tsx`) | Bereich, Typ, Audio-Verdrahtung, Standardwert und Regler. Bereiche gelten auch für Import und Anheften. |
| einen **Drum-Sound** ändern | `src/engine/audio/drumSynth.ts` und `drumPatch` | Szenen können Werte über `drumPatch` in `SCENE_TUNING` überschreiben. |

## Regeln, die beim Erweitern gelten

- **Keine Delay-Länge automatisieren.** Jede sprunghafte Änderung einer Verzögerungszeit klickt. Zeit gleitet nur mit langer Zeitkonstante (siehe `effects.ts`).
- **Rückkopplungsschleifen brauchen flache Filter.** `BiquadFilter.Q` ist bei Tiefpass und Hochpass in dB; der Standardwert hebt die Schleife an und macht lange Nachhallzeiten instabil. Setze `-3.01` (siehe `FLAT_Q`).
- **Nichts Persistentes in den Audiospeicher legen.** Samples bleiben im Arbeitsspeicher; Sessions speichern nur Namen und Einstellungen.
- **Neue Sessionfelder** gehören in `validateSession` (Wertebereiche prüfen, alte Sessions behalten Standardwerte).
- **Neue Regler, die gezogen werden**, gehören in die `continuous`-Liste in `updateSession`, damit eine Geste nur einen Undo-Schritt ergibt.

## Offline-Audioprüfung

`scripts/audio-check.mts` rendert echte Audiodaten ohne Browser und prüft Endlichkeit, Pegel und Unstetigkeiten beim Reglerschwenk. Es braucht ein Node-Web-Audio-Paket, das bewusst nicht in `package.json` steht:

```bash
npm i --no-save node-web-audio-api
npm run audio:check
```
