import { Datum, DataType } from '../types';
import StringSpec from './StringSpec';
import NumberSpec from './NumberSpec';
import { Midi } from 'tonal';

export default class PitchSpec implements Datum {
    type = DataType.Pitch as const;
    id: string;
    position: number;

    constructor(position: number) {
        this.position = position;
        this.id = position.toString();
    }

    asString() {
        return new StringSpec(Midi.midiToNoteName(this.position));
    }

    asNumber() {
        return new NumberSpec(this.position);
    }

    asDuration() {
        return null;
    }

    asPitch() {
        return new PitchSpec(this.position);
    }

    asArray() {
        return null;
    }
}
