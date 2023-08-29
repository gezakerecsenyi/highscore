import { DataType, Datum } from '../types';
import StringSpec from './StringSpec';
import PitchSpec from './PitchSpec';
import ArraySpec from './ArraySpec';

export default class NumberSpec implements Datum {
    type = DataType.Number as const;
    id: string;
    value: number;

    constructor(value: number) {
        this.id = value.toString();
        this.value = value;
    }

    asString() {
        return new StringSpec(this.id);
    }

    asNumber() {
        return new NumberSpec(this.value);
    }

    asPitch() {
        return new PitchSpec(Math.floor(this.value));
    }

    asDuration() {
        return null;
    }

    asArray() {
        return new ArraySpec(
            Array(this.value).fill(0).map((_, i) => new NumberSpec(i)),
            DataType.Number,
        ) as ArraySpec<DataType.Number>;
    }
}
