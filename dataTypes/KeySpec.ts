import { DataType, Datum } from '../types';
import StringSpec from './StringSpec';
import NumberSpec from './NumberSpec';
import PitchSpec from './PitchSpec';
import { Note, Scale } from 'tonal';
import ArraySpec from './ArraySpec';

export default class KeySpec implements Datum {
    type = DataType.Key as const;
    id: string;

    constructor(id: string) {
        this.id = id.toUpperCase()[0] + id.toLowerCase().slice(1);

        try {
            const res = this.asPitch();
            if (!res.storedData.length) {
                throw '';
            }
        } catch (e) {
            throw `Invalid identifier given for key constructor: '${this.id}'`;
        }
    }

    asString() {
        return new StringSpec(this.id);
    }

    asNumber() {
        return new NumberSpec(0);
    }

    asDuration() {
        return null;
    }

    asPitch() {
        return new ArraySpec(
            Scale
                .get(this.id)
                .notes
                .map(e => new PitchSpec(
                    Note.midi(`${e.replaceAll(/[0-9]+$/g, '')}4`) || 0
                     )),
            DataType.Pitch
        );
    }

    asArray() {
        return this.asPitch();
    }
}
