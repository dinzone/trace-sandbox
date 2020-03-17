export function wait(ms: number): void {
    let stop = new Date().getTime();
    while (new Date().getTime() < stop + ms);
}