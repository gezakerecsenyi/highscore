import PitchSpec from './dataTypes/PitchSpec';
import DurationSpec from './dataTypes/DurationSpec';
import StringSpec from './dataTypes/StringSpec';
import NumberSpec from './dataTypes/NumberSpec';
import ArraySpec from './dataTypes/ArraySpec';

export interface DepthMap {
    line: string;
    depth: number;
    index: number;
}

export interface Block {
    line: string;
    index: number;
    continuation: Block[];
    depth: number;
}

export enum DataType {
    Number = 'number',
    String = 'string',
    Pitch = 'pitch',
    Duration = 'duration',
    Note = 'note',
    Key = 'key',
    Boolean = 'boolean',
    Chord = 'chord',
    Interval = 'interval',
    Array = 'array',
    Notation = 'notation',
}

export type Datum = {
    type: DataType;
    id: string;
    asString(): StringSpec | ArraySpec<DataType.String> | null;
    asNumber(): NumberSpec | ArraySpec<DataType.Number> | null;
    asDuration(): DurationSpec | ArraySpec<DataType.Duration> | null;
    asPitch(): PitchSpec | ArraySpec<DataType.Pitch> | null;
    asArray(): ArraySpec | null;
}

export class HighScoreError extends Error {
    name = 'HighScoreError';
}

export type DataMap = {
    [key: string]: Datum;
}
