import { useNavigate, useParams } from 'react-router-dom'

import { ChallengeStage } from '@/game/challenge-stage'
import { FinalResultsStage } from '@/game/final-results-stage'
import { LobbyStage } from '@/game/lobby-stage'
import { RoomHeader } from '@/game/room-header'
import { RoundResultsStage } from '@/game/round-results-stage'
import { SpinStage } from '@/game/spin-stage'
import { useRoom } from '@/game/use-room'

export function RoomPage() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const room = useRoom(code)

  return (
    <div className="min-h-dvh bg-background">
      <RoomHeader
        code={room.joinCode}
        phase={room.phase}
        round={room.round}
        totalRounds={room.totalRounds}
        doneRounds={room.history.length}
      />

      {room.phase === 'lobby' && (
        <LobbyStage
          players={room.players}
          statuses={room.statuses}
          canStart={room.canStart}
          isHost={room.isHost}
          onStart={room.startGame}
          onAddPlayer={room.addPlayer}
        />
      )}

      {room.phase === 'spinning' && (
        <SpinStage
          landed={room.landedCategory}
          round={room.round}
          players={room.players}
          statuses={room.statuses}
          spinCount={room.spinCount}
        />
      )}

      {(room.phase === 'challenge' || room.phase === 'waiting') && room.challenge && (
        <ChallengeStage
          challenge={room.challenge}
          players={room.players}
          statuses={room.statuses}
          endsAt={room.endsAt}
          totalMs={room.roundMs}
          round={room.round}
          locked={room.phase === 'waiting'}
          submission={room.submissions.find((s) => s.playerId === room.you.id) ?? null}
          onSubmit={room.submit}
        />
      )}

      {room.phase === 'round-results' && (
        <RoundResultsStage
          round={room.round}
          totalRounds={room.totalRounds}
          challenge={room.challenge}
          scores={room.ranked}
          players={room.players}
          statuses={room.statuses}
          isHost={room.isHost}
          onNextRound={room.nextRound}
          onEndGame={room.endGame}
        />
      )}

      {room.phase === 'final-results' && (
        <FinalResultsStage
          players={room.players}
          history={room.history}
          onPlayAgain={room.returnToLobby}
          onBackToDashboard={() => navigate('/dashboard')}
        />
      )}
    </div>
  )
}
