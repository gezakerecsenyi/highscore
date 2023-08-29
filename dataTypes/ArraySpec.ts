import { DataType, Datum } from '../types';
import StringSpec from './StringSpec';
import NumberSpec from './NumberSpec';
import DurationSpec from './DurationSpec';
import PitchSpec from './PitchSpec';

export type ArrayDatum<T extends DataType> = Omit<Datum, 'type'> & {type: T};

export default class ArraySpec<T extends DataType = DataType> implements Datum {
    type = DataType.Array as const;
    storedType: T;
    storedData: ArrayDatum<T>[];
    id: string;

    constructor(data: ArrayDatum<T>[], type: T) {
        this.storedData = data;
        this.storedType = type;
        this.id = `${type}--${data.map(e => e.id).join('__')}`;
    }

    asString() {
        return new ArraySpec<DataType.String>(
            this
                .storedData
                .map(e => {
                    const res = e.asString();
                    if (!res || res.type !== DataType.String) {
                        throw `Failed to convert ${e.type} to string`
                    }

                    return res as StringSpec;
                }),
            DataType.String,
        );
    }

    asNumber() {
        return new ArraySpec<DataType.Number>(
            this
                .storedData
                .map(e => {
                    const res = e.asNumber();
                    if (!res || res.type !== DataType.Number) {
                        throw `Failed to convert ${e.type} to number`
                    }

                    return res as NumberSpec;
                }),
            DataType.Number,
        );
    }

    asDuration() {
        return new ArraySpec<DataType.Duration>(
            this
                .storedData
                .map(e => {
                    const res = e.asDuration();
                    if (!res || res.type !== DataType.Duration) {
                        throw `Failed to convert ${e.type} to duration`
                    }

                    return res as DurationSpec;
                }),
            DataType.Duration,
        );
    }

    asPitch() {
        return new ArraySpec<DataType.Pitch>(
            this
                .storedData
                .map(e => {
                    const res = e.asPitch();
                    if (res) {
                        if (res.type === DataType.Pitch) {
                            return res;
                        }

                        // happens often with notes -> chords storing just one pitch
                        if (res.type === DataType.Array && res.storedData.length === 1) {
                            return res.storedData[0] as PitchSpec;
                        }
                    }

                    throw `Failed to convert ${e.type} to pitch`
                }),
            DataType.Pitch,
        );
    }

    asArray() {
        return new ArraySpec(this.storedData, this.storedType);
    }
}
