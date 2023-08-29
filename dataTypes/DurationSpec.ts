import { Datum, DataType } from '../types';
import StringSpec from './StringSpec';
import NumberSpec from './NumberSpec';

import { toWordsOrdinal } from 'number-to-words';
import { fraction } from 'mathjs';

export default class DurationSpec implements Datum {
    type = DataType.Duration as const;
    id: string;
    denominator: number;
    numerator: number;

    name: string = '';
    dotCount: number = 0;
    durationDen: number = 4;

    constructor(numerator: number, denominator: number) {
        this.numerator = numerator;
        this.denominator = denominator;
        this.id = `${numerator}/${denominator}`;

        this.populate();
    }

    populate() {
        this.name = '';
        this.dotCount = 0;
        this.durationDen = 1;

        const getDenominatorName = (x: number) => {
            return x === 1 ? 'whole' : x === 2 ? 'half' : toWordsOrdinal(proportion.d);
        };

        // e.g. 15/16 | 3/4
        const proportion = fraction(this.numerator, this.denominator);
        const loggedDenominator = Math.log2(proportion.d); // 4 | 2
        if (loggedDenominator === Math.floor(loggedDenominator)) {
            if (proportion.n === 1) {
                this.durationDen = proportion.d;
                this.dotCount = 0;
                this.name = `${getDenominatorName(proportion.d)} note`;

                return;
            }

            // 15 >= 8 | 3 >= 2
            if (proportion.n >= proportion.d / 2) {
                const difference = proportion.d - proportion.n; // 1 | 1
                const loggedDifference = Math.log(difference); // 0 | 0

                if (loggedDifference === Math.floor(loggedDifference)) {
                    const newDenominator = proportion.d / 2; // 8 | 2
                    const newBaseDenominator = getDenominatorName(newDenominator);
                    const dotCountIndex = loggedDenominator - loggedDifference - 2; // 2 | 0
                    const dotCountName = ['', 'double-', 'triple-', 'quadruple-', 'pentuple-', 'sextuple-'][dotCountIndex] || `${dotCountIndex.toString()}-`;

                    this.dotCount = dotCountIndex + 1; // 3 | 1
                    this.durationDen = newDenominator; // 8 | 2

                    this.name = `${dotCountName}dotted ${newBaseDenominator} note`; // triple-dotted eighth note
                }
            }
        }

        this.name = `${this.id} note`;
    }

    asString() {
        return new StringSpec(this.name);
    }

    asNumber() {
        return new NumberSpec(this.numerator / this.denominator);
    }

    asDuration() {
        return new DurationSpec(this.numerator, this.denominator);
    }

    asPitch() {
        return null;
    }

    asArray() {
        return null;
    }
}
