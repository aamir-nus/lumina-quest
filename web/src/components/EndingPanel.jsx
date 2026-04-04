import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

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

function getGradeEmoji(grade) {
  const emojis = {
    S: '🌟',
    A: '🎉',
    B: '👍',
    C: '😅',
    D: '🥄'
  };
  return emojis[grade] || '❓';
}

function getGradeColor(grade) {
  const colors = {
    S: '#ffd700',
    A: '#4caf50',
    B: '#2196f3',
    C: '#ff9800',
    D: '#757575'
  };
  return colors[grade] || '#999';
}

/**
 * @param {{ session: any, game: any, history: any[] }} props
 */
export function EndingPanel({ session, game, history }) {
  const [showDialogue, setShowDialogue] = useState(false);

  const grade = gradeSession(session, game);

  const wizardDialogueQuery = useQuery({
    queryKey: ['wizard-dialogue', session?._id],
    queryFn: async () => (await api.post(`/sessions/${session._id}/wizard-dialogue`)).data,
    enabled: showDialogue && !!session && session.status !== 'active'
  });

  useEffect(() => {
    if (session && session.status !== 'active') {
      setShowDialogue(true);
    }
  }, [session]);

  if (!session || !game || session.status === 'active') return null;

  return (
    <section className={`endingPanel ${session.status}`}>
      {/* Grade Header */}
      <div className="gradeHeader">
        <div className="gradeDisplay" style={{ borderColor: getGradeColor(grade) }}>
          <span className="gradeEmoji">{getGradeEmoji(grade)}</span>
          <span className="gradeLetter" style={{ color: getGradeColor(grade) }}>{grade}</span>
        </div>
        <h3>{session.status === 'won' ? 'Victory!' : 'Game Over'}</h3>
        <p className="muted">
          Final Score: <strong>{session.stats.points}</strong> / {game.constraints.targetPoints} target
        </p>
      </div>

      {/* Score Card */}
      <div className="scoreCard">
        <h4>📜 Journey Log</h4>
        <div className="journeyStats">
          <div className="statItem">
            <span className="statLabel">Turns Taken</span>
            <span className="statValue">{session.stats.turnsUsed} / {game.constraints.maxTurns}</span>
          </div>
          <div className="statItem">
            <span className="statLabel">Points Earned</span>
            <span className="statValue">{session.stats.points}</span>
          </div>
          <div className="statItem">
            <span className="statLabel">Target Points</span>
            <span className="statValue">{game.constraints.targetPoints}</span>
          </div>
        </div>

        {/* Choices History */}
        <div className="choicesHistory">
          <h5>Path Taken</h5>
          {(history || []).map((item) => (
            <div key={`${item.turn}-${item.sceneId}`} className="choiceItem">
              <div className="choiceTurn">Turn {item.turn}</div>
              <div className="choiceDetails">
                <p className="choiceAction">"{item.userQuery}"</p>
                <p className="choiceResult">
                  <span className={`choiceBadge ${item.pointsDelta >= 0 ? 'positive' : 'negative'}`}>
                    {item.resolvedAvenueId || 'wildcard'} ({item.pointsDelta >= 0 ? '+' : ''}{item.pointsDelta})
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wizard Dialogue */}
      {showDialogue && (
        <div className="wizardEnding">
          <div className="wizardEndingSprite">
            <div className="miniWizard">
              <div className="miniHat">🧙</div>
              <div className="miniFace">
                <span className="miniEye">•</span>
                <span className="miniEye">•</span>
              </div>
            </div>
          </div>
          <div className="wizardSpeechBubble">
            {wizardDialogueQuery.isLoading ? (
              <p className="muted">✨ Consulting the arcane scrolls...</p>
            ) : wizardDialogueQuery.error ? (
              <p className="muted">
                {session.status === 'won'
                  ? 'Well done, brave adventurer! Your legend shall be remembered!'
                  : 'The journey was treacherous... but perhaps fortune favors you next time!'}
              </p>
            ) : (
              <p>{wizardDialogueQuery.data?.dialogue || 'Ah, a tale well told!'}</p>
            )}
          </div>
        </div>
      )}

      {/* Play Again Button */}
      <div className="endingActions">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="playAgainBtn"
        >
          🎮 Play Again
        </button>
      </div>
    </section>
  );
}
