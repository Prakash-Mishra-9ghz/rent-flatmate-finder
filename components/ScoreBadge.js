export default function ScoreBadge({ score }) {
  if (score == null) return null;
  let cls = "score-low";
  if (score >= 75) cls = "score-high";
  else if (score >= 50) cls = "score-mid";
  return <span className={`score-badge ${cls}`}>🤖 {score}/100</span>;
}
