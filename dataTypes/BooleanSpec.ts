import { Datum, DataType } from '../types';
import StringSpec from './StringSpec';
import NumberSpec from './NumberSpec';

export default class BooleanSpec implements Datum {
    type = DataType.Boolean as const;
    id: string;

    constructor(value: boolean) {
        this.id = value ? 'true' : 'false';
    }

    asString() {
        return new StringSpec(this.id);
    }

    asNumber() {
        return new NumberSpec(this.id === 'true' ? 1 : 0);
    }

    asDuration() {
        return null;
    }

    asPitch() {
        return null;
    }

    asArray() {
        return null;
    }
}
