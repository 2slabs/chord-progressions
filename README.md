# chord progressions

A chord progression generator for Ableton Live, tuned for techno, dub techno and house. Right-click an empty clip slot (or a time selection in Arrangement View) on a MIDI track, pick a style, audition, and insert the result as a MIDI clip.

A [2sl](https://2sl.to) project. Built on Ableton's Extensions SDK (public beta).

## What it does

- **Styles** set everything at once, and every control stays editable:

  | style | harmony | rhythm |
  |---|---|---|
  | dub techno | one minor-11 shape moved to new roots (chord memory) | sparse dotted stabs |
  | deep house | minor 9ths in Dorian, i–iv, i–♭VII–♭VI | swung stabs that land a 16th early |
  | classic house | 7ths, I–vi–IV–V and ii–V | 3-3-4 piano riff |
  | detroit techno | minor 9th pads over i, ♭VI, ♭VII, ♭III | held pads |
  | hypnotic techno | quartal stacks in Phrygian, ♭II moves | 16th 3-3-2 stabs |
  | functional (pop) | tonic–predominant–dominant triads | sustained |

- **Chords:** triads, 7ths, 9ths, 11ths, sus2, sus4, quartal. Names come from the actual notes (`Am11`, `♭VIImaj9`). Clashing ♭9s are left out.
- **Movement:** *diatonic* (chords built from the scale) or *parallel* (one shape moved to each root).
- **Voicing:** smooth (minimal movement), close, or spread, with low/mid/high register and an optional bass note.
- **Rhythm:** 21 patterns (held, house, dub, techno, pulse, arpeggio), or draw your own on the 16-step grid. 16th swing from 50–75%, and push (chord changes land a 16th early).
- **Preview:** hear the progression in the dialog at your Set's tempo (dub styles get a dotted-8th delay). Click a pad to hear one chord; ↻ re-rolls it.
- Follows Live's Scale Mode key on first use, and remembers your settings.

## Install

Requires **Ableton Live 12 Suite, 12.4.5 or later, with Extensions** (currently the Live beta).

1. Get `chord-progressions-<version>.ablx` (from a release, or build it below).
2. In Live, open **Settings → Extensions** and drop the `.ablx` file onto the page.
3. On a MIDI track, right-click an empty clip slot → **Generate Chord Progression…**

The clip is MIDI only. Put an instrument on the track; for dub styles, add Echo.

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
| `src/rhythm.ts` | rhythm patterns (16-step strings), swing, push |
| `src/styles.ts` | genre presets and their chord-movement tendencies |
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
