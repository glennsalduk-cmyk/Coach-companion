// Types correspondant au schéma défini dans supabase/migrations/0001_init_schema.sql.
// À terme, ces types peuvent être regénérés automatiquement avec :
//   npx supabase gen types typescript --project-id <id> > lib/database.types.ts
// Ils sont pour l'instant écrits à la main pour rester lisibles pendant la Phase 1.

export type AppRole = 'coach' | 'coache';
export type TeamMemberRole = 'admin' | 'coach' | 'assistant';
export type ClientStatus = 'active' | 'inactive';
export type ExerciseLevel = 'debutant' | 'intermediaire' | 'avance';
export type SessionFeeling = 'facile' | 'normal' | 'difficile';
export type VideoCallStatus = 'ringing' | 'active' | 'ended' | 'declined';

export interface Profile {
  id: string;
  role: AppRole;
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoachTeam {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  coach_id: string;
  role: TeamMemberRole;
  created_at: string;
}

export interface CoachClient {
  id: string;
  coach_id: string;
  client_id: string;
  status: ClientStatus;
  started_at: string;
  created_at: string;
}

export interface Exercise {
  id: string;
  created_by: string | null;
  name: string;
  muscle_group: string;
  equipment: string;
  level: ExerciseLevel;
  created_at: string;
}

export interface Program {
  id: string;
  coach_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProgramExercise {
  id: string;
  program_id: string;
  exercise_id: string;
  position: number;
  sets: string | null;
  reps: string | null;
  tempo: string | null;
  rpe: string | null;
  rest_seconds: number | null;
  created_at: string;
}

export interface ProgramAssignment {
  id: string;
  program_id: string;
  client_id: string;
  assigned_at: string;
}

export interface WorkoutSession {
  id: string;
  client_id: string;
  program_id: string | null;
  performed_at: string;
  feeling: SessionFeeling | null;
  created_at: string;
}

export interface SessionSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number | null;
  reps_done: number | null;
  rpe: number | null;
  completed: boolean;
  created_at: string;
}

// Vue enrichie utilisée par l'écran de détail de programme
// (jointure program_exercises + exercises).
export interface ProgramExerciseWithDetails extends ProgramExercise {
  exercise: Exercise;
}

export interface VideoCall {
  id: string;
  coach_id: string;
  client_id: string;
  room_name: string;
  status: VideoCallStatus;
  started_by: string;
  created_at: string;
  ended_at: string | null;
}
