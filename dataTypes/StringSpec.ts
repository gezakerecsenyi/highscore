import { DataType, Datum } from '../types';
import NumberSpec from './NumberSpec';
import PitchSpec from './PitchSpec';
import ArraySpec from './ArraySpec';
import { Midi } from 'tonal';

export default class StringSpec implements Datum {
    type = DataType.String as const;
    id: string;

    constructor(id: string) {
        this.id = id.toString();
    }

    asString() {
        return new StringSpec(this.id);
    }

    asNumber() {
        const parsed = parseFloat(this.id);
        if (parsed !== undefined && !isNaN(parsed)) {
            return new NumberSpec(parsed);
        }

        return null;
    }

    asDuration() {
        return null;
    }

    asPitch() {
        const number = Midi.toMidi(/[0-9]$/g.test(this.id) ? this.id : `${this.id}4`);
        if (number !== null) {
            return new PitchSpec(number);
        }

        return null;
    }

    asArray() {
        return new ArraySpec(
            this.id.split('').map(e => new StringSpec(e)),
            DataType.String,
        ) as ArraySpec<DataType.String>;
    }
}
