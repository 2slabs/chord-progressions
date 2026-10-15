# chord progressions

A chord progression generator for Ableton Live, tuned for techno, dub techno and house. Start from scratch, or from an existing bassline or melody and get chords that fit it. Pick a style, audition, and insert the result as a MIDI clip.

A [2sl](https://2sl.to) project. Built on Ableton's Extensions SDK (public beta).

## What it does

Right-click → **Generate Chord Progression…**

| where | what it follows | where the chords go |
|---|---|---|
| a MIDI clip | that clip (a bassline, a melody, or chords to restyle) | a new "Chords" track or another MIDI track, same scene slot (or the same arrangement position), in the clip's colour |
| an empty clip slot | nothing (from scratch), or a MIDI clip in the same scene | that slot |
| a time selection on a MIDI track | nothing, or other tracks' clips under the selection | that track, at the selection |

Following a clip:
- The key comes from Live's Scale Mode when it's on, otherwise it's detected from the clip. You can change it.
- The clip's length sets the number of chords, and **chords** sets how often they change.
- Each of the style's real progressions, in every rotation, is scored against the notes under each chord. The bass note counts most, and notes that rub a semitone against the chord count against it. The best fit wins. When none fits, it picks the best of the style's chords bar by bar, and the hint says which it did.
- **generate** (g) picks another good fit, and ↻ on a pad picks another chord that fits that stretch.
- **with clip** plays the followed clip under the preview.

- **Styles** set everything at once, and every control stays editable. Each genre picks from **real progressions** (taken from transcriptions and analyses of Kerri Chandler, Masters at Work, Mr Fingers, Inner City, Crystal Waters, MK, Galaxy 2 Galaxy and others; sources in [RESEARCH.md](RESEARCH.md)). A short loop repeats to fill the clip, sometimes with a different last chord:

  | style | harmony | rhythm |
  |---|---|---|
  | dub techno | mostly one minor 7th, sometimes moved to iv, ♭vii or v (chord memory) | sparse dotted stabs |
  | deep house | two-chord minor 9th loops (i–iv, i–v, i–♭vii, i–♭vi), i–♭IIImaj7–v, i–♭VImaj7–♭VII; root left to the bass | stabs off the kick, swung, landing a 16th early |
  | classic house | Imaj7–IVmaj7, ii–V–I–vi; Chicago minor loops (♭III–iv–i, iv–♭VI–♭VII) | 3-3-4 piano riff |
  | detroit techno | i–v–♭vii–iv, all minor ("Good Life"); IVmaj7–iii7 in major | held 9th pads |
  | hypnotic techno | one minor stab, or the same shape moved to ♭II, ♭vii, iv or v | single 16ths off the beat |
  | functional (pop) | tonic–predominant–dominant triads | sustained |

- **Chords:** triads, 7ths, 9ths, 11ths, sus2, sus4, quartal. Names come from the actual notes (`Am11`, `♭VIImaj9`). Clashing ♭9s are left out.
- **Movement:** *diatonic* (chords built from the scale) or *parallel* (one shape moved to each root).
- **Voicing:** smooth (minimal movement), close, spread, or rootless (the root left to the bass, the deep house stab), with low/mid/high register and an optional bass note.
- **Rhythm:** 23 patterns (held, house, dub, techno, pulse, arpeggio), or draw your own on the 16-step grid. 16th swing from 50–75%, and push (chord changes land a 16th early).
- **Preview:** hear the progression in the dialog at your Set's tempo (dub styles get a dotted-8th delay). Click a pad to hear one chord; ↻ re-rolls it.
- Follows Live's Scale Mode key on first use, and remembers your settings.

## Install

Requires **Ableton Live 12 Suite, 12.4.5 or later, with Extensions** (currently the Live beta).

1. Get `chord-progressions-<version>.ablx` (from a release, or build it below).
2. In Live, open **Settings → Extensions** and drop the `.ablx` file onto the page.
3. On a MIDI track, right-click an empty clip slot → **Generate Chord Progression…**

The clip is MIDI only. Put an instrument on the track; for dub styles, add Echo.

If the right-click item doesn't appear, turn off **Settings → Extensions → Developer Mode**: while it's on, Live waits for a development host and installed extensions' menus don't show.

## Develop

You need Node.js ≥ 24.16 and the **Ableton Extensions SDK zip** from Ableton's beta programme. The SDK isn't in this repo because its licence doesn't allow redistributing it.

```sh
# one-time setup on a new machine
mkdir -p vendor
cp /path/to/extensions-sdk-1.0.0-beta.1/ableton-extensions-{sdk,cli}-1.0.0-beta.1.tgz vendor/
echo 'EXTENSION_HOST_PATH=/Applications/Ableton Live 12 Beta.app/Contents/Helpers/ExtensionHost/ExtensionHostNodeModule.node' > .env
npm install

# in Live: Settings → Extensions → Developer Mode on
npm start                          # build + run in Live (restart after changes; restart if Live restarts)
npm start -- --storage-directory "$PWD/.dev-storage"   # same, with settings remembered
npm test                           # music theory + rhythm unit tests
npm run ui                         # the dialog in a browser, for UI work
npm run package                    # production build → chord-progressions-<version>.ablx
```

Don't use `--verbose` with the beta.1 CLI: it never detects the connection and quits after 10 s.

### Layout

| path | what |
|---|---|
| `src/theory.ts` | scales, chord building and naming, progression generation, voicing |
| `src/analysis.ts` | key and chord detection from any MIDI (shared with bassline) |
| `src/harmonize.ts` | chords for an existing clip: scoring the style's progressions against it |
| `src/rhythm.ts` | rhythm patterns (16-step strings), swing, push |
| `src/styles.ts` | genre presets and their real progressions |
| `src/extension.ts` | Live side: context menus, dialog, clip creation, saved settings |
| `ui/` | the dialog: `interface.html` + `app.ts`, bundled and inlined into one string by `build.ts` |
| `ui/2sl/` | the 2sl-ui design system (synced copy; edit in the `2sl-ui` repo) |
| `test/` | `node --test` suites |

## Credits

- UI: the 2sl-ui design system, after [2sl.to](https://2sl.to).
- Font: [Cozette](https://github.com/slavfox/Cozette) by Slavfox, MIT (`ui/2sl/fonts/LICENSE-Cozette.txt`).
- Ableton and Live are trademarks of Ableton AG. This project isn't affiliated with or endorsed by Ableton.

## License

MIT, see [LICENSE](LICENSE). That covers this repo's code. The Ableton Extensions SDK isn't included and is under Ableton's own licence. Fonts and other bundled assets keep their own licences (Cozette: MIT).
