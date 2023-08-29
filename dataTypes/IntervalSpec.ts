import { DataType, Datum } from '../types';
import StringSpec from './StringSpec';
import NumberSpec from './NumberSpec';
import PitchSpec from './PitchSpec';
import { Interval } from 'tonal';
import { toWordsOrdinal } from 'number-to-words';
import ArraySpec from './ArraySpec';

export default class IntervalSpec implements Datum {
    type = DataType.Interval as const;
    id: string;
    pitchA: PitchSpec;
    pitchB: PitchSpec;

    constructor(pitchA: Datum, pitchB: Datum) {
        if (pitchA.type === DataType.Array && (pitchA as ArraySpec).storedType === DataType.Pitch) {
            this.pitchA = ((pitchA as ArraySpec).storedData as PitchSpec[])[0];
        } else if (pitchA.type === DataType.Pitch) {
            this.pitchA = pitchA as PitchSpec;
        } else {
            throw `Invalid types for interval constructor - ${pitchA.type} and ${pitchB.type}`
        }

        if (pitchB.type === DataType.Array && (pitchB as ArraySpec).storedType === DataType.Pitch) {
            this.pitchB = ((pitchB as ArraySpec).storedData as PitchSpec[])[0];
        } else if (pitchB.type === DataType.Pitch) {
            this.pitchB = pitchB as PitchSpec;
        } else {
            throw `Invalid types for interval constructor - (${pitchA.type} and) ${pitchB.type}`
        }

        this.id = Interval.distance(this.pitchA.asString().id, this.pitchB.asString().id);
    }

    asString() {
        return new StringSpec(`${{
            'P': 'Perfect', 
            'M': 'Major', 
            'm': 'Minor',
            'd': 'Diminished', 
            'A': 'Augmented',
            'dd': 'Doubly diminished',
            'AA': 'Doubly augmented',
        }[this.id.slice(-1)[0]]} ${toWordsOrdinal(Math.abs(parseInt(this.id)))}`);
    }

    asNumber() {
        return new NumberSpec(Interval.semitones(this.id) || 0);
    }

    asDuration() {
        return null;
    }

    asPitch() {
        return null;
    }

    asArray() {
        return new ArraySpec([this.pitchA, this.pitchB], DataType.Pitch);
    }
}
