import { DataType, Datum, HighScoreError } from '../types';
import StringSpec from './StringSpec';
import NumberSpec from './NumberSpec';
import ArraySpec from './ArraySpec';
import DurationSpec from './DurationSpec';
import KeySpec from './KeySpec';
import PitchSpec from './PitchSpec';

import { createCanvas, writeImage } from 'node-vexflow';

import { Accidental, Dot, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { Mode, Note, Scale } from 'tonal';
import NoteSpec from './NoteSpec';
import { Midi } from '@tonejs/midi';
import fs from 'fs';
import { exec } from 'child_process';

export default class NotationSpec implements Datum {
    type = DataType.Notation as const;
    id: string;
    key: KeySpec;
    timeSignature: DurationSpec;
    notes: ArraySpec<DataType.Note>;

    constructor(notes: ArraySpec<DataType.Note>, timeSignature?: DurationSpec, key?: KeySpec) {
        this.notes = notes;
        this.timeSignature = timeSignature ||
            new DurationSpec(
                4,
                4,
            );
        this.key = key || new KeySpec('C major');

        this.id = `${this.key.id}_k_${this.timeSignature.id}_t_${notes.id}_n`;
    }

    asString() {
        return new StringSpec(this.id);
    }

    asNumber() {
        return new NumberSpec(this.notes.storedData.length);
    }

    asDuration() {
        return this.timeSignature;
    }

    asPitch() {
        return new ArraySpec<DataType.Pitch>(
            this.notes.storedData.map(e => e.asPitch() as PitchSpec),
            DataType.Pitch,
        );
    }

    asArray() {
        return this.notes;
    }

    toMidi(bpm: number) {
        const midi = new Midi();
        const track = midi.addTrack();

        let timeNow = 0;
        (this.notes.storedData as NoteSpec[]).forEach(note => {
            const duration = note.duration.asNumber().value / (4 * bpm);

            (note.chord.pitches.storedData as PitchSpec[]).forEach(pitch => {
                track.addNote(
                    {
                        midi: pitch.position,
                        time: timeNow,
                        duration,
                    },
                );
            });

            timeNow += duration;
        });

        return midi;
    }

    // todo: handle different clefs; multiple bars; ties
    render(destination: string, bpm: number, soundFont: string) {
        const keyName = this.key.asString().id;

        let eventualKeyName = keyName;
        let tonic = keyName.split(' ')[0];
        if (keyName.toLowerCase().endsWith(' minor') || keyName.toLowerCase().endsWith(' aeolian')) {
            tonic += 'm';
        } else if (!keyName.toLowerCase().endsWith(' major')) {
            const mode = keyName.split(' ')[1];

            tonic = Mode.relativeTonic(
                'ionian',
                mode,
                tonic,
            );
        }

        if (!tonic) {
            tonic = 'C';
            eventualKeyName = 'C major';
        }

        let noteNamesInKey = Scale
            .get(eventualKeyName)
            .notes;

        // if we have weird double-sharps, it probably means an irregular key name was specified (e.g. A#maj).
        // in this case, just to make life simpler, we just change it to its enharmonic (Bbmaj) to avoid the
        // artefacts. Can be changed in future if this is in fact desired behaviour.
        if (noteNamesInKey.some(t => t.endsWith('##') || t.endsWith('bb'))) {
            tonic = Note.enharmonic(tonic);

            const keyNameParts = eventualKeyName.split(' ');
            noteNamesInKey = Scale
                .get(`${Note.enharmonic(keyNameParts[0])} ${keyNameParts[1]}`)
                .notes;
        }

        const canvas = createCanvas();
        const renderer = new Renderer(
            canvas,
            Renderer.Backends.CANVAS,
        );

        const stave = new Stave(
            10,
            10,
            350,
        )
            .addClef('treble')
            .addKeySignature(tonic)
            .addTimeSignature(`${this.timeSignature.numerator}/${this.timeSignature.denominator}`);

        renderer.resize(
            stave.getWidth() + 2 * 10,
            stave.getHeight() + 2 * 10,
        );

        const context = renderer.getContext();
        context.save();
        context.fillStyle = 'white';
        context.fillRect(
            0,
            0,
            stave.getWidth() + 2 * 10,
            stave.getHeight() + 2 * 10,
        );

        context.restore();

        stave.setContext(context).draw();

        const voice = new Voice(
            {
                num_beats: this.timeSignature.numerator,
                beat_value: this.timeSignature.denominator,
            },
        );

        this
            .notes
            .storedData
            .forEach(note => {
                const noteHere = note as NoteSpec;

                const noteDuration = noteHere.asDuration();
                noteDuration.populate();

                const dotString = Array(noteDuration.dotCount)
                    .fill('d')
                    .join('');
                const noteDurationName = noteDuration.durationDen === 0.5 ?
                    '1/2' :
                    noteDuration.durationDen.toString();

                const notesHere = noteHere
                    .chord
                    .pitches
                    .storedData
                    .map(t => (t as PitchSpec)
                        .asString()
                        .id
                        .split(/([0-9]+$)/g),
                    );

                let modifiersNeeded = [] as [Accidental, number][];
                notesHere.forEach((e, i) => {
                    const pitch = e[0];

                    if (noteNamesInKey.includes(pitch)) {
                        return;
                    } else if (/[b#]$/g.exec(e[0])) {
                        const noteAlias = Note.enharmonic(e[0]);
                        if (noteNamesInKey.includes(noteAlias)) {
                            notesHere[i][0] = noteAlias;
                        } else { // we need an accidental
                            modifiersNeeded.push(
                                [
                                    new Accidental(e[0].slice(-1)),
                                    i,
                                ],
                            );
                        }
                    } else { // we need a natural
                        modifiersNeeded.push(
                            [
                                new Accidental('n'),
                                i,
                            ],
                        );
                    }
                });

                const staveNote = new StaveNote(
                    {
                        keys: notesHere.map(t => `${t[0]}/${t[1]}`),
                        duration: `${noteDurationName}${dotString}`,
                    },
                );

                modifiersNeeded.forEach(t => {
                    staveNote.addModifier(
                        t[0],
                        t[1],
                    );
                });

                for (let d = 0; d < noteDuration.dotCount; d++) {
                    Dot.buildAndAttach(
                        [staveNote],
                        {
                            all: true,
                        },
                    );
                }

                voice.addTickable(staveNote);
            });

        new Formatter().joinVoices([voice])
            .format(
                [voice],
                350,
            );
        voice.draw(
            context,
            stave,
        );

        const rawFileName = /\.(png|svg|jpg|jpeg|mp3|wav|ogg|mid)/g.test(destination) ?
            destination
                .split('.')
                .slice(
                    0,
                    -1,
                )
                .join('.') :
            destination;
        writeImage(
            canvas,
            `${rawFileName}.png`,
        );

        fs.writeFileSync(
            `${rawFileName}.mid`,
            new Buffer(this.toMidi(bpm).toArray()),
        );

        const command = `fluidsynth -ni "./${soundFont}" "./${rawFileName}.mid" -F "./${rawFileName}.wav" -T wav -r 44100`;
        exec(
            command,
            (error, stdout, stderr) => {
                if (error || stderr.trim().length) {
                    console.warn(
                        `HighScore: something went wrong while compiling ${rawFileName}.wav. Ensure that FluidSynth is installed and available from the current path, and that the provided sound-font file is valid.`,
                    );
                    console.warn('Further details of the error are below:');

                    throw new HighScoreError(
                        `Error in generating .wav from .mid file.

Attempting to run:
    ${command}

Got logs:
    ${stdout}

Got error:
    ${stderr}

`);
                } else {
                    fs.unlinkSync(`${rawFileName}.mid`);
                }
            },
        );
    }
}
