import { DataType, Datum } from '../types';
import StringSpec from './StringSpec';
import NumberSpec from './NumberSpec';
import PitchSpec from './PitchSpec';
import { Chord } from 'tonal';
import ArraySpec from './ArraySpec';

export default class ChordSpec implements Datum {
    type = DataType.Chord as const;
    id: string;
    pitches: ArraySpec<DataType.Pitch>;

    constructor(pitches: ArraySpec<DataType.Pitch>) {
        this.id = pitches.storedData.map(e => e.id).join('/');
        this.pitches = pitches;
    }

    asString() {
        if (this.pitches.storedData.length === 1) {
            return this.pitches.storedData[0].asString();
        }

        const detectedName = Chord.detect(
            this
                .pitches
                .storedData
                .map(e => (e as PitchSpec).asString().id)
        )[0];
        if (detectedName) {
            return new StringSpec(detectedName);
        }

        return new StringSpec(this.id);
    }

    asNumber() {
        return new NumberSpec(
            Math.min(
                ...this
                    .pitches
                    .storedData
                    .map(e => (e as PitchSpec).position)
            )
        );
    }

    asDuration() {
        return null;
    }

    asPitch() {
        return new ArraySpec(this.pitches.storedData, DataType.Pitch);
    }

    asArray() {
        return new ArraySpec(this.pitches.storedData, DataType.Pitch);
    }
}
