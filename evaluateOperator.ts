import { DataType, Datum } from './types';
import { operators } from './parseExpression';
import StringSpec from './dataTypes/StringSpec';
import NumberSpec from './dataTypes/NumberSpec';
import ArraySpec from './dataTypes/ArraySpec';
import BooleanSpec from './dataTypes/BooleanSpec';

export default function evaluateOperator(operator: typeof operators[number], operand1: Datum, operand2: Datum): Datum {
    switch (operator) {
        case "*":
            if (operand1.type === DataType.Number && operand2.type === DataType.Number) {
                return new NumberSpec(
                    (operand1 as NumberSpec).value * (operand2 as NumberSpec).value
                );
            }

            if (operand1.type === DataType.String && operand2.type === DataType.Number) {
                return new StringSpec(
                    (operand1 as StringSpec).id.repeat((operand2 as NumberSpec).value)
                );
            }
            break;
        case "/":
            if (operand1.type === DataType.Number && operand2.type === DataType.Number) {
                return new NumberSpec(
                    (operand1 as NumberSpec).value / (operand2 as NumberSpec).value
                );
            }
            break;
        case "+":
            if (operand1.type === DataType.Number && operand2.type === DataType.Number) {
                return new NumberSpec(
                    (operand1 as NumberSpec).value + (operand2 as NumberSpec).value
                );
            }

            if (operand1.type === DataType.String && operand2.type === DataType.String) {
                return new StringSpec(
                    (operand1 as StringSpec).id + (operand2 as StringSpec).id
                );
            }

            if (operand1.type === DataType.Array && operand2.type === DataType.Array) {
                const arr1 = operand1 as ArraySpec;
                const arr2 = operand2 as ArraySpec;

                if (arr1.storedType === arr2.storedType) {
                    return new ArraySpec(
                        [...arr1.storedData, ...arr2.storedData],
                        arr1.storedType
                    );
                } else {
                    throw `Cannot combine arrays of type ${arr1.storedType} and ${arr2.storedType}`;
                }
            }

            if (operand1.type === DataType.Array) {
                const arr1 = operand1 as ArraySpec;

                if (arr1.storedType === operand2.type) {
                    return new ArraySpec(
                        [...arr1.storedData, operand2],
                        arr1.storedType
                    );
                } else {
                    throw `Cannot add element of type ${operand2.type} to ${arr1.storedType} array`;
                }
            }
            break;
        case "-":
            if (operand1.type === DataType.Number && operand2.type === DataType.Number) {
                return new NumberSpec(
                    (operand1 as NumberSpec).value - (operand2 as NumberSpec).value
                );
            }
            break;
        case "&&":
            if (operand1.type === DataType.Boolean && operand2.type === DataType.Boolean) {
                return new BooleanSpec(
                    (operand1 as BooleanSpec).id === 'true' && (operand2 as BooleanSpec).id === 'true'
                );
            }
            break;
        case "//":
            if (operand1.type === DataType.Boolean && operand2.type === DataType.Boolean) {
                return new BooleanSpec(
                    (operand1 as BooleanSpec).id === 'true' || (operand2 as BooleanSpec).id === 'true'
                );
            }
            break;
        case "==":
            if (operand1.type === operand2.type) {
                return new BooleanSpec(
                    operand1.id === operand2.id
                );
            }

            return new BooleanSpec(false);
            break;
        case "!=":
            if (operand1.type === operand2.type) {
                return new BooleanSpec(
                    operand1.id !== operand2.id
                );
            }

            return new BooleanSpec(true);
            break;
        case ">=": {
            let number1 = operand1.asNumber();
            let number2 = operand2.asNumber();

            if (number1?.type === DataType.Number && number2?.type === DataType.Number) {
                return new BooleanSpec(
                    (number1 as NumberSpec).value >= (number2 as NumberSpec).value
                );
            }
            break;
        }
        case ">": {
            let number1 = operand1.asNumber();
            let number2 = operand2.asNumber();

            if (number1?.type === DataType.Number && number2?.type === DataType.Number) {
                return new BooleanSpec(
                    (number1 as NumberSpec).value > (number2 as NumberSpec).value
                );
            }
            break;
        }
        case "<=": {
            let number1 = operand1.asNumber();
            let number2 = operand2.asNumber();

            if (number1?.type === DataType.Number && number2?.type === DataType.Number) {
                return new BooleanSpec(
                    (number1 as NumberSpec).value <= (number2 as NumberSpec).value
                );
            }
            break;
        }
        case "<": {
            let number1 = operand1.asNumber();
            let number2 = operand2.asNumber();

            if (number1?.type === DataType.Number && number2?.type === DataType.Number) {
                return new BooleanSpec(
                    (number1 as NumberSpec).value < (number2 as NumberSpec).value
                );
            }
            break;
        }
    }

    if (operators.includes(operator)) {
        throw `Cannot apply operator ${operator} to types ${operand1.type} and ${operand2.type}`;
    }

    throw `Unrecognised operator ${operator}`;
}
