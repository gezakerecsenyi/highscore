declare module 'node-vexflow' {
    export function createCanvas(): HTMLCanvasElement;
    export function writeImage(canvas: HTMLCanvasElement, filename: string): void;
    export function extractImage(canvas: HTMLCanvasElement): Buffer;
}
