import minimist from 'minimist';
import * as fs from 'fs';
import { Block, DataMap, DataType, Datum, DepthMap, HighScoreError } from './types';
import { parseExpression } from './parseExpression';
import KeySpec from './dataTypes/KeySpec';
import { Mode } from 'tonal';
import ArraySpec from './dataTypes/ArraySpec';
import StringSpec from './dataTypes/StringSpec';
import NotationSpec from './dataTypes/NotationSpec';

const args = minimist(process.argv.slice(2));

const inputFile = args.f as string;
if (!inputFile) {
    throw new Error('No entry file specified. Please specify a file to compile using the -f flag, e.g. "-f index.hsc".');
}

let outputFolder = args.o as string;
if (!outputFolder) {
    outputFolder = Math.random().toString().slice(2);
    console.warn(`No output folder provided. Reverting to randomly-generated ./${outputFolder}/.`);
}

if (fs.existsSync(outputFolder)){
    if (fs.readdirSync(outputFolder).length > 0) {
        console.warn(`The output folder ./${outputFolder}/ is not empty. Resulting files will be overwritten.`)
    }
} else{
    fs.mkdirSync(outputFolder);
}

const cleanedName = inputFile.replace(
    /\.hsc$/g,
    '',
) + '.hsc';
const file = fs.readFileSync(
    `./${cleanedName}`,
    'utf-8',
);

const getOnlySpaces = <T extends string | undefined>(e: T) => e?.replace(
    /(?<=^[ \t]+)[^ \t][^\n]*/g,
    '',
) as T;

const lines = file.split('\n');
const tabCharacter = getOnlySpaces(lines.find(q => q.startsWith(' ') || q.startsWith('\t'))) || '\t';

const depthMappedLines: DepthMap[] = lines
    .map((e, i) => ({
        line: e.trim(),
        depth: getOnlySpaces(e).split(tabCharacter).length - 1,
        index: i + 1,
    }))
    .filter(e => e.line.trim().length)
    .filter(e => !e.line.trim().startsWith('#'));

const goUntilDepthMatched = (block: DepthMap[]) => {
    const res = [block[0]] as DepthMap[];
    for (
        let index = 1, line = block[index];
        index < block.length && line.depth > block[0].depth;
        index++, line = block[index]
    ) {
        res.push(line);
    }

    return res;
};

const nestSection = (block: DepthMap[]): Block[] => {
    if (!block.length) return [];

    const firstSection = goUntilDepthMatched(block);
    const firstBlock: Block = {
        ...firstSection[0],
        continuation: nestSection(firstSection.slice(1)),
    };

    return [firstBlock, ...nestSection(block.slice(firstSection.length))];
};

const blocks = nestSection(depthMappedLines);

let outputMap = [] as string[];
const interpretLevel = (level: Block[], variableMap: DataMap) => {
    const variableMapHere = Object.assign(
        {},
        variableMap,
    );
    for (let {continuation, line, index} of level) {
        const parseExpressionSafely = (e: string, variableMap: DataMap) => {
            try {
                return parseExpression(
                    e,
                    variableMap,
                );
            } catch (e) {
                throw new HighScoreError(`Could not parse on line ${index} - ${e}.`);
            }
        };

        if (line.startsWith('if ')) {
            const data = line.match(/^if +([^:\n]+):$/);

            if (!data) {
                throw new HighScoreError(`SyntaxError on line ${index} - invalid or incomplete 'if' syntax.`);
            }

            const condition = parseExpressionSafely(data[1], variableMapHere);

            if (condition.id === 'true') {
                interpretLevel(
                    continuation,
                    variableMapHere,
                );
            }

            continue;
        }

        if (line.startsWith('for ')) {
            const data = line.match(/^for +(\$[a-zA-Z0-9_]+) +in +([^:\n]+):$/);

            if (!data) {
                throw new HighScoreError(`SyntaxError on line ${index} - invalid or incomplete 'for' syntax.`);
            }

            const loopVarName = data[1];
            const loopObjExpression = data[2];

            let loopObj = parseExpressionSafely(
                loopObjExpression,
                variableMapHere,
            );

            if (loopObj.type !== DataType.Array) {
                const arrayifiedObj = (loopObj as Datum).asArray();

                if (!arrayifiedObj) {
                    throw new HighScoreError(`TypeError on line ${index} - cannot coalesce type ${(loopObj as Datum).type} to array.`);
                }

                loopObj = arrayifiedObj;
            }

            (loopObj as ArraySpec).storedData.forEach(datum => {
                interpretLevel(
                    continuation,
                    {
                        ...variableMapHere,
                        [loopVarName]: datum,
                    },
                );
            });
            continue;
        }

        if (line.startsWith('output ')) {
            const toOutput = parseExpressionSafely(
                line.slice('output '.length).trim(),
                variableMapHere,
            );

            if (toOutput.type === DataType.Array) {
                outputMap.push(
                    (toOutput as ArraySpec).storedData.map(e => e.id).join(',')
                );
            } else {
                outputMap.push(toOutput.id);
            }

            continue;
        }

        const varMatch = line.match(/(\$[a-zA-Z0-9_]+) *:= *([^\n]+$)/);
        if (varMatch) {
            variableMapHere[varMatch[1]] = parseExpressionSafely(
                varMatch[2],
                variableMapHere,
            );
            continue;
        }

        if (line.startsWith('render ')) {
            // feels a bit dodgy, but I'm pretty sure there's no other syntactic way to get this??
            let [toRender, dest] = line
                .slice('render '.length)
                .split(' as ')
                .map(e => e.trim())
                .map(e => parseExpressionSafely(
                    e,
                    variableMapHere,
                ));

            const stringifiedDest = dest.type === DataType.String ? dest : dest.asString() as StringSpec | null;
            if (stringifiedDest?.type !== DataType.String) {
                throw new HighScoreError(
                    `RenderError on line ${index} - Invalid type specified for destination path for render: ${dest.type}`,
                );
            }

            if (toRender.type !== DataType.Notation) {
                throw new HighScoreError(
                    `RenderError on line ${index} - The data to render must be notation (received ${toRender.type})`,
                );
            }

            (toRender as NotationSpec).render(`${outputFolder}/${stringifiedDest.id}`);

            continue;
        }

        throw new HighScoreError(`Unrecognised structure on line ${index}.`);
    }
};

const allNotes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
interpretLevel(
    blocks,
    {
        '$KEYS': new ArraySpec<DataType.Key>(
            Mode
                .names()
                .map(e => allNotes.map(q => new KeySpec(`${q} ${e}`)))
                .flat(),
            DataType.Key,
        ),
    },
);

const logText = outputMap.map((e, i) => `\t[${i + 1}]: ${e}`).join('\n');
const logPath = `${outputFolder}/log.txt`;
fs.openSync(logPath, 'w');
const stream = fs.createWriteStream(logPath);
stream.write(logText);

console.warn('Completed successfully. Outputting log below:\n');
console.log(logText);
