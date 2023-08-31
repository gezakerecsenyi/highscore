# HighScore

**A simple scripting language for easy score and MIDI generation**

This repository contains the interpreter for HighScore, a language
designed to make generating basic music score engravings and
corresponding audio files simple and consistent.

## Installation

You will need a few things for setup:

 - A functioning Node.JS install
 - The TypeScript command-line utility
 - A globally-installed version of [FluidSynth](https://github.com/FluidSynth/fluidsynth/wiki/Download)
 - A sound-font file (`.sf2` preferable)

To build the code:

```
npm install
tsc
```

Then, proceed as listed under 'Usage' below.

## Usage

The basic usage of this interpreter is by calling the main file
using `node`:

```
node index.js --f index.hsc --o output_folder --sf Piano.sf2 --bpm 60 --log 100
```

The program takes up to five arguments (two required, three optional):

 - `--f [file]` (required) - designates the HighScore file to run. 
This can include the `.hsc` extension, but this is not required.
 - `--sf [file]` (required) - the path to a valid `.sf2` or similar
sound font file, to be used for generating audio samples. Some good
options can be downloaded for free
[here](https://musical-artifacts.com/artifacts?formats=sf2&tags=piano).
 - `--bpm [number]` - the BPM to use for audio exports. This defaults to 60.
 - `--log [number]` - provides a status-update log to the console after every 
`[number]`th entry. This defaults to 100. Setting to any value `<= 0` will 
disable logging. 
 - `--o [folder]` - designates the folder in which to dump all of
the generated content. If this is left unspecified, a random folder
name will be generated and logged at runtime.

## The HighScore language

### 1. Commands

The core of HighScore rests in three main commands:

 - `$var := [value]` defines a variable in the current scope. Variables
declared in one scope are accessible by all lower, but no higher scopes -
as is the case in most languages. Variables can freely be redeclared using
this syntax, too.
 - `render [notation] as [name]` compiles the given notation object -
that is, outputs a corresponding pair of `.wav` and `.png` files, with
the audio and engraving of the notation respectively. `[name]` should
be a string without any extensions, as the two files will take this name
root and append the relevant extension. The files will be outputted to
the selected output folder.
 - `output [data]` saves the internal `id` of the given `data` to the output
log, which is outputted to the console as well as a `log.txt` at the end
of a successful run. The exception is if an array is passed, in which case
the `id` of each entry in the array is saved instead, joined 
comma-separated into a single entry.

### 2. Control statements

The sub-statements of control statements should be indented, as in Python.

 - `if [condition]:`: `[condition]` is checked loosely - that is, it is
not required to be a `bool` type: all that matters is whether the passed
object's internal `id` is equal to the value `"true"`.
   - `else:` can directly follow an `if` statement.
 - `for $var in [array]:` does the expected. If `[array]` is not yet an
array, it will be coalesced into one, though the result of such automatic
coalescence is not always ideal - so worth checking/doing manually instead.

### 3. Data types

The following constructors exist for fundamental data types. Importantly,
note that all data types have an `id`, which is used for comparisons as well
as when the given datum is `output`ted.

Note that not all data types have their own direct constructors. This might 
change in future, but for the moment, it feels like there isn't much of a 
use-case for these.

 - `array` - an array of any (single) data-type
   - Cast using: `<array>`
   - ID format: (do not use)
   - Constructor syntax:
     1. square brackets - `[ item 1, item 2 ]`
     2. range syntax - `[[A-G#]]`, `[[1-10]]`
 - `bool` - a boolean value (true or false)
   - Cast using: `<bool>`
   - ID format: `"true"` if true, `"false"` if false.
   - Constructor:
     - None. Can be obtained using comparison operators.
 - `chord` - a combination of pitches
   - Cast using `<chord>`
   - ID format: (do not use)
   - Constructor:
     - None directly, but the intended usage is by casting an array
of pitches, i.e., `<chord>[ pitch 1, pitch 2, pitch 3 ]`
 - `duration` - ostensibly just a fraction, though generally used for time,
either as time signatures or note durations. All instances are measured as
fractions of whole notes, so e.g. `{2}` is two whole notes, `{1^4}` is a
quarter note, etc.
   - Cast using: `<duration>`
   - ID format: `[numerator]/[denominator]`
   - Constructor:
     - None directly
     - Before notes/chords/pitches, 
`{numerator^denominator}[note/pitch/chord]` returns a `note` with the pitches
of the original, but the specified duration applied
       - The `^denominator` can be omitted; in this case, it will be assumed
to be `1`.
     - In `notation` syntax, the same, except without curly braces.
 - `interval` - represents the interval between two pitches
   - Cast using: `<interval>`
   - ID format: a coded string representing the name of the interval, e.g. 
`-5d` would be diminished fifth down from the first pitch
   - Constructor:
     - None directly, but the intended usage is by casting an array of two
pitches, i.e., `<interval>[ pitch 1, pitch 2 ]`
 - `key` - a representation of a (musical) key
   - Cast using: `<key>`
   - ID format: a normalised representation of the name of the key
   - Constructor:
     - None directly. Cast e.g. from a string: `<key>"C major"`
 - `notation` - a set of notes, combined with a key and time signature. Contains
all the information for a `render`.
   - Cast using: (cannot be cast)
   - ID format: (do not use)
   - Constructor:
     - `|| key | num^den | note1 note2 note3 ||`
       - The key and time signatures can come in any order, or be omitted
altogether - the default values are Cmaj and 4/4 respectively.
       - The `[a]^[b]` syntax for time signature can have either `[a]` or `[b]`
substituted for an expression; however, the whole specifier _cannot_ be substituted
for a `duration` object - i.e., `|| $duration | ... ||` is not legal, but
`|| $num1^$num2 | ... ||` _is_.
 - `note` - a combination of a (set of) `pitch`es and a `duration`
   - Cast using:
     - Technically `<note>` exists, but is only really usable in niche cases
     - More generally, duration-pitch syntax is preferred (see above under
`duration`)
   - ID format: `[pitch id] -- [duration id]`
   - Constructor:
     - (see 'Cast using')
 - `number` - equivalent to a JS `number` type, and subject to the same limitations
   - Cast using: `<number>`
   - ID format: a stringified version of the number
   - Constructor:
     - Just type a number
     - Decimals should be separated with a '.'
     - ','s to separate blocks of 1000's can _not_ be used
 - `pitch` - a pitch, stored internally as a note name (A-G, with flats or sharps)
and octave (e.g. `C#3`)
   - Cast using: `<pitch>`
   - ID format: a normalised representation of the name of the pitch
   - Constructor:
     - None directly, but can be cast from a variety of sources. Most crucially:
       - `<pitch>$number` returns the pitch at the MIDI value of the number
       - `<pitch>$string` returns the pitch at the given name (e.g. `<pitch>"C4"`)
       - `<pitch>$chord` returns an array of the pitches in the given chord
 - `string` - a string
   - Cast using `<string>`
   - ID format: the contents of the string
   - Constructor:
     - Use double quotes `"`. Cannot be escaped as of the moment.

### 4. Operators

A range of available operators are available. The exact function of most of these
is self-explanatory, but some special behaviours are listed:

 - Casting, e.g. `<number>"5"` -> `5`
 - Apply duration, e.g. `{1^2}<pitch>"C4"` -> a half-note `note` with pitch C4
 - Multiply - `*`
 - Divide - `/`
 - Subtract - `-`
 - Add - `+`
   - Works for numbers, e.g. `1 + 1` -> `2`
   - Works for string concatenation, e.g. `"1" + "1"` -> `"11"`
   - Is the syntax for appending to an array, e.g.:
     - `[5] + 6` -> `[5, 6]`
     - `[5] + [6, 7]` -> `[5, 6, 7]`
 - Comparison operators:
   - `==`, `!=`
   - Compare the `id`s of the provided operands
 - Numeric comparison operators:
   - `>`, `>=`, `<`, `<=`
   - (Try to) coalesce the operands to numbers, and compare them thus
 - Boolean 'and' - `&&`
 - Boolean 'or' - `//`
   - This is a little weird, just to avoid clashes with the `||` already in use
for `notation` constructor syntax

### 5. Array operations

A few special operations are available for array types specifically:

 - `$array[[ $i -> $i > 5 ]]` filters an array, keeping only items where the executed predicate
is 'truthy'
 - `$array[[ $i => $i + 1 ]]` maps an array, replacing each item with the result of the predicate
when called with that item

## Examples

An example can be found in `intervals.hsc` in the root of this repository.

## Open-source credits

This package makes use of the following open-source packages:

 - [`jsdom`](https://www.npmjs.com/package/jsdom)
 - [`mathjs`](https://www.npmjs.com/package/mathjs)
 - [`tonal`](https://www.npmjs.com/package/tonal)
 - [`number-to-words`](https://www.npmjs.com/package/number-to-words)
 - [`vexflow`](https://www.npmjs.com/package/vexflow)
 - [`node-vexflow`](https://www.npmjs.com/package/node-vexflow)
 - [`minimist`](https://www.npmjs.com/package/minimist)
 - [`typescript`](https://www.npmjs.com/package/typescript)
