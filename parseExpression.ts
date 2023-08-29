import { DataMap, DataType, Datum } from './types';
import ArraySpec from './dataTypes/ArraySpec';
import NumberSpec from './dataTypes/NumberSpec';
import StringSpec from './dataTypes/StringSpec';
import DurationSpec from './dataTypes/DurationSpec';
import KeySpec from './dataTypes/KeySpec';
import NoteSpec from './dataTypes/NoteSpec';
import ChordSpec from './dataTypes/ChordSpec';
import NotationSpec from './dataTypes/NotationSpec';
import PitchSpec from './dataTypes/PitchSpec';
import BooleanSpec from './dataTypes/BooleanSpec';
import IntervalSpec from './dataTypes/IntervalSpec';
import { Midi, Scale } from 'tonal';
import evaluateOperator from './evaluateOperator';

function findLastIndex<T>(array: T[], predicate: (value: T, index: number, obj: T[]) => unknown): number {
    let l = array.length;
    while (l--) {
        if (predicate(
            array[l],
            l,
            array,
        )) {
            return l;
        }
    }

    return -1;
}

export const operators = [
    '*', '/', '+', '-', '==', '!=', '>=', '>', '<=', '<', '&&', '//'
] as const;
const possibleCasts = [
    'array', 'bool', 'chord', 'duration', 'interval', 'key', 'notation', 'note', 'number', 'pitch', 'string',
] as const;

const defaultExpressions: DataMap = {};

enum TokenType {
    Variable = 1, //
    Cast, //
    Duration, //
    Datum, //
    FilterExpression, //
    Operator, //
    String, //
    Notation, //
}

const splitIfNotInBrackets = (str: string, splitChar: string, track: [string, string, boolean][] = [
    ['{', '}', false], ['[', ']', false], ['(', ')', false], ['"', '"', true],
]) => {
    let res = [] as string[];

    let depths = track.map(() => 0);
    let expectingNextClosure: string[] = [];
    let isInPassthrough = false;
    let segmentHere = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (isInPassthrough) {
            const nextClosure = expectingNextClosure.slice(-1)[0];
            if (char === nextClosure) {
                isInPassthrough = false;

                const index = track.findIndex(e => e[1] === nextClosure);
                depths[index]--;
                expectingNextClosure = expectingNextClosure.slice(0, -1);
            }
        } else {
            const charOpensIndex = track.findIndex(e => e[0] === char);
            if (charOpensIndex > -1) {
                expectingNextClosure.push(track[charOpensIndex][1]);
                if (track[charOpensIndex][2]) {
                    isInPassthrough = true;
                }

                depths[charOpensIndex]++;
            } else {
                const charClosesIndex = track.findIndex(e => e[1] === char);
                if (charClosesIndex > -1) {
                    if (char !== expectingNextClosure.slice(-1)[0]) {
                        throw 'Illegal nesting sequence';
                    }

                    depths[charClosesIndex]--;
                    expectingNextClosure = expectingNextClosure.slice(0, -1);
                }
            }
        }

        if (depths.every(t => t === 0) && char === splitChar) {
            res.push(segmentHere);
            segmentHere = '';
            continue;
        }

        segmentHere += char;
    }

    return [...res, segmentHere];
};

export function parseExpression(e: string, variableMap: DataMap): Datum {
    let tokens = [] as (Datum | string)[];
    let tokenTypes = [] as TokenType[];

    let currentToken = '';
    let currentTokenType = null as TokenType | null;

    let awaiting = null as string | null;

    let parentheses = 0;

    let brackets = 0;
    let arrayHere = [] as Datum[];
    let couldBeFilterBracket = false;

    let isMaybeInCast = false;

    let isInNotation = false;

    let skipNext = false;

    let string = e.trim();
    let char = string[0];
    const saveToken = (appendChar: boolean = false) => {
        const value = currentToken + (appendChar ? char : '');

        if (currentTokenType) {
            tokens.push(value);
            tokenTypes.push(currentTokenType);
        } else {
            if (/^[0-9]+(\.[0-9]*)?$/g.test(value.trim())) {
                tokens.push(new NumberSpec(parseFloat(value.trim())));
                tokenTypes.push(TokenType.Datum);
            }
        }

        currentTokenType = null;
        currentToken = '';
    };

    for (let i = 0; i < string.length; i++) {
        if (skipNext) {
            skipNext = false;
            continue;
        }

        char = string[i];

        if (isInNotation) {
            if (char === '|' && string[i + 1] === '|') {
                saveToken();
                skipNext = true;
                isInNotation = false;

                continue;
            }

            currentToken += char;
            continue;
        }

        if (awaiting) {
            if (char !== awaiting) {
                currentToken += char;
            } else {
                saveToken(true);
                awaiting = null;
            }

            continue;
        }

        if (char === '(') {
            parentheses++;

            if (parentheses === 1) {
                saveToken();
                continue;
            }

            currentToken += char;
            continue;
        }

        if (char === ')') {
            if (parentheses === 0) {
                throw 'Unbalanced parentheses';
            }

            parentheses--;

            if (parentheses === 0) {
                tokens.push(parseExpression(
                    currentToken,
                    variableMap,
                ));
                tokenTypes.push(TokenType.Datum);

                currentToken = '';
                currentTokenType = null;

                continue;
            }

            currentToken += char;
            continue;
        } else if (parentheses > 0) {
            currentToken += char;
            continue;
        }

        if (char === '[') {
            brackets++;

            if (brackets === 1) {
                saveToken();

                arrayHere = [];
                couldBeFilterBracket = true;

                continue;
            }

            currentToken += char;
            continue;
        }

        if (char === ']') {
            if (brackets === 0) {
                throw 'Unbalanced array literal braces';
            }

            brackets--;

            if (brackets === 1 && string[i + 1] !== ']') {
                couldBeFilterBracket = false;
            }

            if (brackets === 0) {
                if (couldBeFilterBracket &&
                    !arrayHere.length &&
                    currentToken.startsWith('[') &&
                    currentToken.endsWith(']')) {
                    tokens.push(currentToken.slice(
                        1,
                        -1,
                    ));
                    tokenTypes.push(TokenType.FilterExpression);

                    currentToken = '';
                    currentTokenType = null;

                    continue;
                }

                tokens.push(new ArraySpec(
                    [
                        ...arrayHere, parseExpression(
                        currentToken,
                        variableMap,
                    ),
                    ],
                    arrayHere[0]?.type || DataType.Number,
                ));
                tokenTypes.push(TokenType.Datum);

                currentToken = '';
                currentTokenType = null;

                continue;
            }

            currentToken += char;
            continue;
        } else if (brackets > 0) {
            if (brackets > 1) {
                currentToken += char;
            } else {
                couldBeFilterBracket = false;

                if (char === ',' && !awaiting) {
                    arrayHere.push(parseExpression(
                        currentToken,
                        variableMap,
                    ));

                    currentToken = '';
                    currentTokenType = null;
                } else {
                    currentToken += char;
                }
            }

            continue;
        }

        if (currentTokenType === TokenType.Variable) {
            if (!/[a-zA-Z0-9_]/g.test(char)) {
                saveToken();
                continue;
            }
        }

        if (char === '$') {
            saveToken();

            currentToken = '$';
            currentTokenType = TokenType.Variable;

            continue;
        }

        if (isMaybeInCast) {
            if (char === '>' && possibleCasts.includes(currentToken as typeof possibleCasts[number])) {
                saveToken();
                isMaybeInCast = false;
                continue;
            } else if (!possibleCasts.some(t => t.startsWith(currentToken))) {
                isMaybeInCast = false;

                tokens.push('<');
                tokenTypes.push(TokenType.Operator);

                currentTokenType = null;
            }
        }

        if (char === '<' && string[i + 1] !== '=') {
            saveToken();

            isMaybeInCast = true;
            currentToken = '';
            currentTokenType = TokenType.Cast;

            continue;
        }

        if (char === '{') {
            saveToken();

            currentToken = '{';
            currentTokenType = TokenType.Duration;
            awaiting = '}';

            continue;
        }

        if (char === '|' && string[i + 1] === '|' && !isInNotation) {
            saveToken();

            isInNotation = true;
            currentTokenType = TokenType.Notation;

            continue;
        }

        if (char === '"') {
            saveToken();

            currentToken = '"';
            currentTokenType = TokenType.String;
            awaiting = '"';

            continue;
        }

        if (operators.includes((char + string[i + 1]) as typeof operators[number])) {
            saveToken();

            skipNext = true;
            tokens.push(char + string[i + 1]);
            tokenTypes.push(TokenType.Operator);

            currentToken = '';
            currentTokenType = null;

            continue;
        }

        if (operators.includes(char as typeof operators[number])) {
            saveToken();

            tokens.push(char);
            tokenTypes.push(TokenType.Operator);

            currentToken = '';
            currentTokenType = null;

            continue;
        }

        currentToken += char;
    }

    saveToken();

    if (brackets > 0) {
        throw 'Unmatched opening brace';
    }

    if (parentheses > 0) {
        throw 'Unmatched opening parentheses';
    }

    if (awaiting) {
        throw `Expected token '${awaiting}' before end of expression`;
    }

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const type = tokenTypes[i];

        if (type === TokenType.String) {
            tokens[i] = new StringSpec((token as string).slice(
                1,
                -1,
            ));
            tokenTypes[i] = TokenType.Datum;
        }

        if (type === TokenType.Variable) {
            const varName = (token as string).trim();
            if (variableMap.hasOwnProperty(varName)) {
                tokens[i] = variableMap[varName];
                tokenTypes[i] = TokenType.Datum;
            } else {
                throw `Could not resolve variable '${token}'`;
            }
        }

        if (type === TokenType.Duration) {
            const parts = (token as string)
                .replace(/}$/g, '')
                .replace(/^\{/g, '')
                .split('^')
                .map(e => parseInt(e));

            if (parts.length === 0 || parts.length > 2) {
                throw 'Invalid or malformed duration notation';
            }

            tokens[i] = parts.length === 2 ? new DurationSpec(
                parts[0],
                parts[1],
            ) : new DurationSpec(
                parts[0],
                1,
            );
            tokenTypes[i] = TokenType.Datum;
        }

        if (type === TokenType.Notation) {
            const cleanedVal = splitIfNotInBrackets(
                (token as string)
                    .slice(1)
                    .trim(),
                '|',
            )
                .map(e => e.trim());

            let notes: NoteSpec[];
            notes = splitIfNotInBrackets(
                cleanedVal.slice(-1)[0],
                ' ',
            )
                .map(e => e.trim())
                .filter(e => e)
                .map(e => {
                    const res = parseExpression(
                        e,
                        variableMap,
                    );
                    if (res.type === DataType.Pitch) {
                        return new NoteSpec(
                            new ChordSpec(new ArraySpec<DataType.Pitch>(
                                [res as PitchSpec],
                                DataType.Pitch,
                            )),
                            new DurationSpec(
                                1,
                                1,
                            ),
                        );
                    } else if (res.type === DataType.Chord) {
                        return new NoteSpec(
                            res as ChordSpec,
                            new DurationSpec(
                                1,
                                1,
                            ),
                        );
                    } else if (res.type !== DataType.Note) {
                        throw `Expected a note, pitch, or chord to place into notation, but got ${res.type} instead`;
                    }

                    return res as NoteSpec;
                });

            let key: KeySpec | undefined = undefined;
            let time: DurationSpec | undefined = undefined;
            cleanedVal.slice(
                0,
                -1,
            ).forEach(val => {
                const timeAttempt = splitIfNotInBrackets(
                    val,
                    '^',
                );
                if (timeAttempt.length === 2) {
                    let timeSpec = timeAttempt
                        .map(e => parseExpression(
                            e,
                            variableMap,
                        ).asNumber());
                    if (timeSpec.every(t => t && t.type === DataType.Number)) {
                        time = new DurationSpec(
                            (timeSpec[0] as NumberSpec).value,
                            (timeSpec[1] as NumberSpec).value,
                        );
                    } else {
                        throw 'Malformed time signature specifier';
                    }
                } else {
                    const keyAttempt = parseExpression(
                        val,
                        variableMap,
                    );
                    if (keyAttempt.type === DataType.Key) {
                        key = keyAttempt as KeySpec;
                    } else {
                        throw `Unrecognised data provided to notation constructor: ${keyAttempt.type}`;
                    }
                }
            });

            tokens[i] = new NotationSpec(
                new ArraySpec<DataType.Note>(
                    notes,
                    DataType.Note,
                ),
                time,
                key,
            );
            tokenTypes[i] = TokenType.Datum;
        }
    }

    while (tokenTypes.includes(TokenType.FilterExpression)) {
        const nextFilterIndex = tokenTypes.indexOf(TokenType.FilterExpression);
        const filterString = tokens[nextFilterIndex] as string;

        let res: Datum | null = null;

        if (tokenTypes[nextFilterIndex - 1] === TokenType.Datum) {
            const arrayToFilter = tokens[nextFilterIndex - 1] as ArraySpec;

            if (arrayToFilter.type !== DataType.Array) {
                throw 'Invalid target for array filter expression';
            }

            const filterUnits = filterString.trim().match(/(\$[a-zA-Z0-9_]+) *([-=]>) *(.+)/);
            if (filterUnits && filterUnits.length === 4) {
                const mapRes = arrayToFilter
                    .storedData
                    .map(d => {
                        return parseExpression(
                            filterUnits[3],
                            {...variableMap, [filterUnits[1]]: d},
                        );
                    });

                if (filterUnits[2] === '=>') {
                    res = new ArraySpec(
                        mapRes,
                        mapRes[0]?.type ?? DataType.Number,
                    );
                } else {
                    res = new ArraySpec(
                        arrayToFilter
                            .storedData
                            .filter((_, i) => {
                                if (mapRes[i].type === DataType.Boolean) {
                                    return mapRes[i].id === 'true';
                                }

                                throw 'Filter expression must return a boolean for each item in array';
                            }),
                        arrayToFilter.storedType,
                    );
                }
            } else {
                const shouldBeNumber = parseExpression(
                    filterString,
                    variableMap,
                );
                if (shouldBeNumber.type === DataType.Number) {
                    res = arrayToFilter.storedData[(shouldBeNumber as NumberSpec).value];

                    if (!res) {
                        throw 'Array index out of range';
                    }
                } else {
                    throw 'Could not parse array index expression';
                }
            }

            if (res) {
                tokenTypes.splice(
                    nextFilterIndex - 1,
                    2,
                    TokenType.Datum,
                );
                tokens.splice(
                    nextFilterIndex - 1,
                    2,
                    res,
                );
            }
        } else {
            const units = splitIfNotInBrackets(
                filterString,
                '-',
            );

            if (units.length === 2) {
                const segments = units
                    .map(t => t.trim())
                    .map(t => t.match(/([a-gA-G])([Bb#]?)([0-9]*)/));

                if (segments.every(t => t)) {
                    const composedSegments = (segments as RegExpMatchArray[])
                        .map(segment => segment[3] ? segment[0] : `${segment[0]}4`)
                        .map(e => Midi.toMidi(e))
                        .filter(e => e !== null) as number[];

                    if (composedSegments.length !== 2) {
                        throw 'Could not parse note name in range';
                    }

                    if (composedSegments[1] < composedSegments[0]) {
                        composedSegments[1] += 12;
                    }

                    res = new ArraySpec(
                        Array(composedSegments[1] - composedSegments[0] + 1)
                            .fill(0)
                            .map((_, i) => new PitchSpec(i + composedSegments[0])),
                        DataType.Pitch,
                    );
                } else {
                    const parsedUnits = units.map(e => parseExpression(
                        e,
                        variableMap,
                    ));
                    if (parsedUnits.every(t => t.type === DataType.Number)) {
                        const numberUnits = parsedUnits as NumberSpec[];

                        res = new ArraySpec(
                            Array(numberUnits[1].value - numberUnits[0].value + 1)
                                .fill(0)
                                .map((_, i) => new NumberSpec(i + numberUnits[0].value)),
                            DataType.Number,
                        );
                    } else if (parsedUnits.every(t => t.type === DataType.Pitch)) {
                        const pitchPositions = (parsedUnits as PitchSpec[]).map(e => e.position);

                        res = new ArraySpec(
                            Array(pitchPositions[1] - pitchPositions[0] + 1)
                                .fill(0)
                                .map((_, i) => new PitchSpec(i + pitchPositions[0])),
                            DataType.Pitch,
                        );
                    } else {
                        throw `Invalid types for range syntax: ${parsedUnits[0].type}-${parsedUnits[1].type}`;
                    }
                }
            } else {
                throw 'Malformed range expression syntax';
            }

            if (res) {
                tokenTypes.splice(
                    nextFilterIndex,
                    1,
                    TokenType.Datum,
                );
                tokens.splice(
                    nextFilterIndex,
                    1,
                    res,
                );
            }
        }

        if (!res) {
            throw 'Could not parse range/filter syntax';
        }
    }

    while (tokenTypes.includes(TokenType.Cast)) {
        const nextCastIndex = tokenTypes.indexOf(TokenType.Cast);

        if (tokenTypes[nextCastIndex + 1] !== TokenType.Datum) {
            throw 'Malformed cast notation - ambiguous target specified';
        }

        const castRequested = tokens[nextCastIndex] as typeof possibleCasts[number];
        const datumToCast = tokens[nextCastIndex + 1] as Datum;

        let res: Datum | null = null;
        switch (castRequested) {
            case 'array':
                res = datumToCast.asArray();
                break;
            case 'bool':
                if (datumToCast.type === DataType.Boolean) {
                    res = datumToCast;
                    break;
                }

                const valAsNumber = datumToCast.asNumber();
                if (valAsNumber === null) {
                    res = new BooleanSpec(false);
                } else if (valAsNumber.type === DataType.Array) {
                    res = new BooleanSpec((valAsNumber as ArraySpec).storedData.length > 0);
                } else {
                    res = new BooleanSpec((valAsNumber as NumberSpec).value !== 0);
                }

                break;
            case 'chord':
                if (datumToCast.type === DataType.Chord) {
                    res = datumToCast;
                    break;
                }

                const toPitch = datumToCast.asPitch();
                if (toPitch === null) {
                    res = null;
                } else if (toPitch.type === DataType.Array) {
                    res = new ChordSpec(toPitch);
                } else {
                    res = new ChordSpec(new ArraySpec(
                        [toPitch],
                        DataType.Pitch,
                    ));
                }

                break;
            case 'duration':
                res = datumToCast.asDuration();
                break;
            case 'interval':
                if (datumToCast.type === DataType.Interval) {
                    res = datumToCast;
                    break;
                }

                const asPitch = datumToCast.asPitch();
                if (asPitch?.type === DataType.Array && asPitch.storedData.length === 2) {
                    res = new IntervalSpec(
                        asPitch.storedData[0] as PitchSpec,
                        asPitch.storedData[1] as PitchSpec,
                    );
                } else if (asPitch?.type === DataType.Pitch) {
                    res = new IntervalSpec(
                        new PitchSpec(0),
                        asPitch,
                    );
                }

                break;
            case 'key':
                if (datumToCast.type === DataType.Key) {
                    res = datumToCast;
                    break;
                }

                if (datumToCast.type === DataType.String) {
                    res = new KeySpec(datumToCast.id);
                    break;
                }

                const evaluateForDatum = (datum: Datum) => {
                    const asKeyCenter = datum.asPitch();
                    if (asKeyCenter === null) {
                        return null;
                    } else if (asKeyCenter.type === DataType.Pitch) {
                        return new KeySpec(`${asKeyCenter.asString().id.replaceAll(/[0-9]+$/g, '')} major`);
                    } else {
                        const detected = Scale.detect(
                            asKeyCenter
                                .storedData
                                .map(e => (e as PitchSpec).asString().id),
                        );

                        if (detected.length) {
                            return new KeySpec(detected[0]);
                        }
                    }
                }

                if (datumToCast.type === DataType.Array) {
                    const data = (datumToCast as ArraySpec).storedData.map(e => evaluateForDatum(e));
                    if (data.every(t => t?.type === DataType.Key)) {
                        res = new ArraySpec(
                            data as KeySpec[],
                            DataType.Key,
                        );
                    }
                } else {
                    res = evaluateForDatum(datumToCast) || null;
                }
                break;
            case 'notation':
                break;
            case 'note':
                const notePitch = datumToCast.asPitch();
                const noteDuration = datumToCast.asDuration();

                let chordHere: ChordSpec | null;
                if (notePitch === null) {
                    chordHere = null;
                } else if (notePitch.type === DataType.Array) {
                    chordHere = new ChordSpec(notePitch);
                } else {
                    chordHere = new ChordSpec(new ArraySpec(
                        [notePitch],
                        DataType.Pitch,
                    ));
                }

                let durationHere: DurationSpec | null;
                if (noteDuration === null) {
                    durationHere = null;
                } else if (noteDuration.type === DataType.Array) {
                    durationHere = noteDuration.storedData[0] as DurationSpec;
                } else {
                    durationHere = noteDuration;
                }

                if (chordHere) {
                    if (durationHere) {
                        res = new NoteSpec(
                            chordHere,
                            durationHere,
                        );
                    } else {
                        res = new NoteSpec(
                            chordHere,
                            new DurationSpec(
                                1,
                                1,
                            ),
                        );
                    }
                } else {
                    if (durationHere) {
                        res = new NoteSpec(
                            new ChordSpec(new ArraySpec(
                                [new PitchSpec(60)],
                                DataType.Pitch,
                            )),
                            durationHere,
                        );
                    }
                }

                break;
            case 'number':
                res = datumToCast.asNumber();
                break;
            case 'pitch':
                res = datumToCast.asPitch();
                break;
            case 'string':
                res = datumToCast.asString();
                break;
        }

        if (res) {
            tokenTypes.splice(
                nextCastIndex,
                1,
            );
            tokens.splice(
                nextCastIndex,
                2,
                res,
            );
        } else {
            throw `Invalid or illegal cast: ${datumToCast.type} to ${castRequested}`;
        }
    }

    while (true) {
        const matchingIndex = findLastIndex(
            tokens,
            (token, index) => tokenTypes[index] ===
                TokenType.Datum &&
                (token as Datum).type ===
                DataType.Duration &&
                tokenTypes[index + 1] ===
                TokenType.Datum &&
                [DataType.Pitch, DataType.Chord, DataType.Note].includes((tokens[index + 1] as Datum).type),
        );

        if (matchingIndex === -1) {
            break;
        }

        const duration = tokens[matchingIndex] as DurationSpec;
        const note = tokens[matchingIndex + 1] as Datum;

        let res: NoteSpec | null = null;
        switch (note.type) {
            case DataType.Pitch:
                res = new NoteSpec(
                    new ChordSpec(new ArraySpec(
                        [note as PitchSpec],
                        DataType.Pitch,
                    )),
                    duration,
                );
                break;
            case DataType.Chord:
                res = new NoteSpec(
                    note as ChordSpec,
                    duration,
                );
                break;
            case DataType.Note:
                res = new NoteSpec(
                    (note as NoteSpec).chord,
                    duration,
                );
                break;
        }

        if (!res) {
            throw 'Could not parse duration-pitch notation';
        }

        tokenTypes.splice(
            matchingIndex,
            1,
        );
        tokens.splice(
            matchingIndex,
            2,
            res,
        );
    }

    let currentDepth = 0;
    while (tokens.length > 1) {
        const currentOperator = operators[currentDepth];
        if (!currentOperator) {
            throw 'Illegal operator combination - perhaps an operator is missing';
        }

        const operatorInstanceIndex = tokens.findIndex(
            (t, i) => t === currentOperator
                && tokenTypes[i] === TokenType.Operator
                && tokenTypes[i + 1] === TokenType.Datum
                && tokenTypes[i - 1] === TokenType.Datum,
        );

        if (operatorInstanceIndex === -1) {
            currentDepth++;
            continue;
        }

        const datum1 = tokens[operatorInstanceIndex - 1] as Datum;
        const datum2 = tokens[operatorInstanceIndex + 1] as Datum;

        const valueHere = evaluateOperator(
            currentOperator,
            datum1,
            datum2,
        );
        tokens.splice(
            operatorInstanceIndex - 1,
            3,
            valueHere,
        );
        tokenTypes.splice(
            operatorInstanceIndex - 1,
            3,
            TokenType.Datum,
        );
    }

    if (tokens.length === 1 && tokenTypes[0] === TokenType.Datum) {
        return tokens[0] as Datum;
    } else {
        throw 'Failed to parse expression';
    }
}
