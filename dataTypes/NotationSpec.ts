import { DataType, Datum } from '../types';
import StringSpec from './StringSpec';
import NumberSpec from './NumberSpec';
import ArraySpec from './ArraySpec';
import DurationSpec from './DurationSpec';
import KeySpec from './KeySpec';
import PitchSpec from './PitchSpec';

import { createCanvas, writeImage } from 'node-vexflow';

import { Accidental, Dot, Flow, Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import { Key, Midi, Mode, Note, Scale } from 'tonal';
import NoteSpec from './NoteSpec';

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

    // todo: handle different clefs; multiple bars; ties
    render(destination: string) {
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
                beat_value: this.timeSignature.denominator
            }
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
                            .split(/([0-9]+$)/g)
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
                                    i
                                ]
                            );
                        }
                    } else { // we need a natural
                        modifiersNeeded.push(
                            [
                                new Accidental('n'),
                                i
                            ]
                        );
                    }
                });

                const staveNote = new StaveNote(
                    {
                        keys: notesHere.map(t => `${t[0]}/${t[1]}`),
                        duration: `${noteDurationName}${dotString}`,
                    }
                )

                modifiersNeeded.forEach(t => {
                    staveNote.addModifier(t[0], t[1]);
                });

                for (let d = 0; d < noteDuration.dotCount; d++) {
                    Dot.buildAndAttach(
                        [staveNote],
                        {
                            all: true,
                        }
                    );
                }

                voice.addTickable(staveNote);
            });

        new Formatter().joinVoices([voice]).format([voice], 350);
        voice.draw(context, stave);

        writeImage(
            canvas,
            `${
                /\.(png|svg|jpg|jpeg)/g.test(destination) ? 
                    destination.split('.').slice(0, -1).join('.') :
                    destination
            }.png`,
        );

    }
}
