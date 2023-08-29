import { DataType, Datum } from '../types';
import StringSpec from './StringSpec';
import NumberSpec from './NumberSpec';
import DurationSpec from './DurationSpec';
import ChordSpec from './ChordSpec';
import ArraySpec from './ArraySpec';
import PitchSpec from './PitchSpec';

export default class NoteSpec implements Datum {
    type = DataType.Note as const;
    id: string;
    duration: DurationSpec;
    chord: ChordSpec;

    constructor(chord: ChordSpec, duration: DurationSpec) {
        this.chord = chord;
        this.duration = duration;
        this.id = `${chord.id} -- ${duration.id}`;
    }

    asString() {
        return new StringSpec(`${this.chord.asString()} ${this.duration.asString()}`);
    }

    asNumber() {
        return new NumberSpec(0);
    }

    asDuration() {
        return this.duration;
    }

    asPitch() {
        return this.chord.asPitch();
    }

    asArray(): ArraySpec<DataType.Note> {
        return new ArraySpec(
            this
                .chord
                .asPitch()
                .storedData
                .map(e => new NoteSpec(
                    new ChordSpec(
                        new ArraySpec([e as PitchSpec], DataType.Pitch)
                    ),
                    this.duration
                )),
            DataType.Note,
        );
    }
}
