export function isScoredQuestion(question: { totalMarks: number }): boolean {
  return Number(question.totalMarks) > 0;
}
