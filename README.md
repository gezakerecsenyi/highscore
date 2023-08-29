# HighScore

**A simple scripting language for easy score and MIDI generation**

This repository contains the interpreter for HighScore, a language
designed to make generating basic music score engravings and
corresponding audio files simple and consistent.

## Usage

The basic usage of this interpreter is by calling the main file
using `node`:

```
node index.js -f index.hsc -o output_folder
```

The program takes two arguments:

 - `-f [file]` (required) - designates the HighScore file to run. 
This can include the `.hsc` extension, but this is not required.
 - `-o [folder]` - designates the folder in which to dump all of
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
that is, outputs a corresponding pair of `.mp3` and `.png` files, with
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

- `if [condition]`: `[condition]` is checked loosely - that is, it is
not required to be a `bool` type: all that matters is whether the passed
object's internal `id` is equal to the value `"true"`.
- `for $var in [array]:` does the expected. If `[array]` is not yet an
array, it will be coalesced into one, though the result of such automatic
coalescence is not always ideal - so worth checking/doing manually instead.

