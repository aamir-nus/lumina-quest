function gradeSession(session, game) {
  if (!session || !game) return 'N/A';
  const score = session.stats.points;
  const target = game.constraints.targetPoints;
  if (session.status === 'won' && score >= target + 3) return 'S';
  if (session.status === 'won' && score >= target) return 'A';
  if (session.status === 'won') return 'B';
  if (score >= target - 1) return 'C';
  return 'D';
}

export function EndingPanel({ session, game }) {
  if (!session || !game || session.status === 'active') return null;
  const grade = gradeSession(session, game);

  return (
    <section className="endingPanel">
      <h3>{session.status === 'won' ? 'Victory' : 'Defeat'}</h3>
      <p>Final Grade: <strong>{grade}</strong></p>
      <p className="muted">points: {session.stats.points} | target: {game.constraints.targetPoints}</p>
    </section>
  );
}
