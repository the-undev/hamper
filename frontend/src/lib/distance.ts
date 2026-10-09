/** The Damerau-Levenshtein distance in its optimal string alignment form: how many insertions, deletions, substitutions and swaps of neighbouring characters turn one string into the other. */
export function editDistance(first: string, second: string): number {
  const width = second.length + 1;
  const distances: number[] = [];
  const at = (row: number, column: number): number =>
    distances[row * width + column] ?? 0;
  for (let row = 0; row <= first.length; row += 1) {
    for (let column = 0; column <= second.length; column += 1) {
      if (row === 0 || column === 0) {
        distances[row * width + column] = row + column;
        continue;
      }
      const substitution = first[row - 1] === second[column - 1] ? 0 : 1;
      let distance = Math.min(
        at(row - 1, column) + 1,
        at(row, column - 1) + 1,
        at(row - 1, column - 1) + substitution,
      );
      const swapped =
        row > 1 &&
        column > 1 &&
        first[row - 1] === second[column - 2] &&
        first[row - 2] === second[column - 1];
      if (swapped) {
        distance = Math.min(distance, at(row - 2, column - 2) + 1);
      }
      distances[row * width + column] = distance;
    }
  }
  return at(first.length, second.length);
}

/** Whether a name is close to typed text, ignoring case: within two edits, or one when the text is four characters or fewer. */
export function isCloseMatch(name: string, typed: string): boolean {
  const allowedEdits = typed.length <= 4 ? 1 : 2;
  if (Math.abs(name.length - typed.length) > allowedEdits) {
    return false;
  }
  return editDistance(name.toLowerCase(), typed.toLowerCase()) <= allowedEdits;
}
