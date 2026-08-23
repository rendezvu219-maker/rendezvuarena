const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { resolveDatabasePath } = require('./storage-paths');

const dbPath = resolveDatabasePath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK(role IN ('host','player','referee','broadcaster','admin')),
  is_active INTEGER NOT NULL DEFAULT 1,
  last_login_at TEXT,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  password_changed_at TEXT,
  email_verified_at TEXT,
  gamer_tag TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  profile_visibility TEXT NOT NULL DEFAULT 'public',
  show_external_profiles INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS email_verification_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  resend_available_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_change_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  new_email TEXT NOT NULL COLLATE NOCASE,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS external_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('startgg','tonamel','challonge')),
  provider_user_id TEXT NOT NULL DEFAULT '',
  provider_slug TEXT NOT NULL DEFAULT '',
  profile_url TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  gamer_tag TEXT NOT NULL DEFAULT '',
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','verified','revoked')),
  verified_at TEXT,
  access_token_encrypted TEXT NOT NULL DEFAULT '',
  refresh_token_encrypted TEXT NOT NULL DEFAULT '',
  token_expires_at TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id,provider)
);

CREATE TABLE IF NOT EXISTS oauth_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL CHECK(provider IN ('startgg')),
  state_hash TEXT NOT NULL UNIQUE,
  redirect_uri TEXT NOT NULL,
  return_to TEXT NOT NULL DEFAULT '/portal.html',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS provider_oauth_states (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  state_hash TEXT NOT NULL UNIQUE,
  redirect_uri TEXT NOT NULL,
  return_to TEXT NOT NULL DEFAULT '/portal.html',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  access_expires_at TEXT NOT NULL,
  refresh_expires_at TEXT NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT '',
  user_agent_hash TEXT NOT NULL DEFAULT '',
  last_seen_at TEXT,
  revoked_at TEXT,
  revoke_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id INTEGER NOT NULL,
  permission TEXT NOT NULL,
  granted_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,permission),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(granted_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS dev_access_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS draft_socket_tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  draft_room_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('host','teamA','teamB','referee','broadcaster')),
  user_id INTEGER,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(draft_room_id) REFERENCES draft_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS host_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  organizer_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  startgg_url TEXT NOT NULL DEFAULT '',
  experience TEXT NOT NULL DEFAULT '',
  event_plan TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','withdrawn')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  discord_url TEXT NOT NULL DEFAULT '',
  startgg_url TEXT,
  startgg_slug TEXT,
  startgg_tournament_id TEXT,
  source_platform TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  source_external_id TEXT NOT NULL DEFAULT '',
  source_metadata_json TEXT NOT NULL DEFAULT '{}',
  source_last_synced_at TEXT,
  source_sync_status TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'preparing',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  default_server TEXT NOT NULL DEFAULT 'Asia',
  start_at TEXT,
  schedule_mode TEXT NOT NULL DEFAULT 'fixed_tournament_start',
  roster_lock_at TEXT,
  finalized_at TEXT,
  result_reopen_hours INTEGER NOT NULL DEFAULT 24,
  evidence_retention_days INTEGER NOT NULL DEFAULT 90,
  chat_retention_days INTEGER NOT NULL DEFAULT 30,
  public_stream_platform TEXT NOT NULL DEFAULT '',
  public_stream_url TEXT NOT NULL DEFAULT '',
  public_stream_label TEXT NOT NULL DEFAULT '',
  is_public INTEGER NOT NULL DEFAULT 0,
  rules_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(host_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournament_staff (
  tournament_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('host','referee','scheduler','scorekeeper','broadcaster')),
  permissions_json TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY(tournament_id, user_id, role),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  startgg_entrant_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','startgg')),
  seed INTEGER,
  seed_locked INTEGER NOT NULL DEFAULT 0,
  protected_seed_group TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  seeding_note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  team_status TEXT NOT NULL DEFAULT 'captain_pending',
  captain_user_id INTEGER,
  roster_locked_at TEXT,
  withdrawn_at TEXT,
  disqualified_at TEXT,
  terminal_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tournament_id, startgg_entrant_id),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(captain_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id INTEGER NOT NULL,
  user_id INTEGER,
  display_name TEXT NOT NULL,
  gamer_tag TEXT NOT NULL DEFAULT '',
  game_id TEXT NOT NULL DEFAULT '',
  member_role TEXT NOT NULL DEFAULT 'player',
  membership_status TEXT NOT NULL DEFAULT 'active',
  startgg_participant_id TEXT,
  external_provider TEXT NOT NULL DEFAULT '',
  external_user_id TEXT NOT NULL DEFAULT '',
  external_profile_slug TEXT NOT NULL DEFAULT '',
  is_captain INTEGER NOT NULL DEFAULT 0,
  is_substitute INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS team_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  invited_user_id INTEGER,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'captain',
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY(invited_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournament_join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  team_id INTEGER,
  selected_member_id INTEGER,
  user_id INTEGER NOT NULL,
  requested_role TEXT NOT NULL DEFAULT 'player' CHECK(requested_role IN ('player','captain','substitute','coach')),
  requested_team_name TEXT NOT NULL DEFAULT '',
  gamer_tag TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  external_profile_id INTEGER,
  provider_snapshot_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY(selected_member_id) REFERENCES team_members(id) ON DELETE SET NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(external_profile_id) REFERENCES external_profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stage_schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  stage_key TEXT NOT NULL,
  scheduled_at TEXT,
  estimated_duration_minutes INTEGER,
  UNIQUE(tournament_id, stage_key),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  bracket_type TEXT NOT NULL DEFAULT 'single',
  bracket_side TEXT NOT NULL DEFAULT 'winners',
  stage TEXT NOT NULL DEFAULT 'playoff',
  group_name TEXT,
  round_no INTEGER NOT NULL,
  round_name TEXT NOT NULL,
  position INTEGER NOT NULL,
  team_a_id INTEGER,
  team_b_id INTEGER,
  next_match_id INTEGER,
  next_slot TEXT CHECK(next_slot IN ('A','B') OR next_slot IS NULL),
  feeds_into_winner_match_id INTEGER,
  feeds_into_winner_slot TEXT CHECK(feeds_into_winner_slot IN ('A','B') OR feeds_into_winner_slot IS NULL),
  feeds_into_loser_match_id INTEGER,
  feeds_into_loser_slot TEXT CHECK(feeds_into_loser_slot IN ('A','B') OR feeds_into_loser_slot IS NULL),
  reset_of_match_id INTEGER,
  is_reset_match INTEGER NOT NULL DEFAULT 0,
  score_a INTEGER,
  score_b INTEGER,
  winner_team_id INTEGER,
  best_of INTEGER NOT NULL DEFAULT 3,
  series_rule TEXT NOT NULL DEFAULT 'normal',
  current_game_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'available',
  match_status TEXT NOT NULL DEFAULT 'available',
  result_status TEXT NOT NULL DEFAULT 'none',
  resolution_type TEXT NOT NULL DEFAULT 'normal',
  resolution_reason TEXT NOT NULL DEFAULT '',
  result_finalized_at TEXT,
  final_submission_id INTEGER,
  reopened_at TEXT,
  reopened_by INTEGER,
  scheduled_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  estimated_duration_minutes INTEGER,
  station_id TEXT,
  assigned_referee_id INTEGER,
  assigned_broadcaster_id INTEGER,
  server_region TEXT NOT NULL DEFAULT 'Asia',
  room_code TEXT NOT NULL DEFAULT '',
  room_code_status TEXT NOT NULL DEFAULT 'active',
  room_code_archived_at TEXT,
  room_code_expires_at TEXT,
  stream_url TEXT NOT NULL DEFAULT '',
  stream_platform TEXT NOT NULL DEFAULT '',
  rules_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT NOT NULL DEFAULT '',
  private_notes TEXT NOT NULL DEFAULT '',
  public_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tournament_id, stage, round_no, position),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(team_a_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY(team_b_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY(next_match_id) REFERENCES matches(id) ON DELETE SET NULL,
  FOREIGN KEY(feeds_into_winner_match_id) REFERENCES matches(id) ON DELETE SET NULL,
  FOREIGN KEY(feeds_into_loser_match_id) REFERENCES matches(id) ON DELETE SET NULL,
  FOREIGN KEY(reset_of_match_id) REFERENCES matches(id) ON DELETE SET NULL,
  FOREIGN KEY(winner_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY(assigned_referee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(assigned_broadcaster_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(reopened_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS match_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  game_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting_draft',
  winner_team_id INTEGER,
  picks_a_json TEXT NOT NULL DEFAULT '[]',
  picks_b_json TEXT NOT NULL DEFAULT '[]',
  bans_a_json TEXT NOT NULL DEFAULT '[]',
  bans_b_json TEXT NOT NULL DEFAULT '[]',
  divine_json TEXT NOT NULL DEFAULT '[]',
  draft_snapshot_json TEXT NOT NULL DEFAULT '{}',
  room_code TEXT NOT NULL DEFAULT '',
  server_region TEXT NOT NULL DEFAULT '',
  started_at TEXT,
  completed_at TEXT,
  result_status TEXT NOT NULL DEFAULT 'none',
  reported_winner_team_id INTEGER,
  reported_by_user_id INTEGER,
  reported_by_team_id INTEGER,
  reported_at TEXT,
  confirmed_by_user_id INTEGER,
  confirmed_by_team_id INTEGER,
  confirmed_at TEXT,
  dispute_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(match_id, game_number),
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(winner_team_id) REFERENCES teams(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS result_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  submitted_by_user_id INTEGER,
  submitted_by_team_id INTEGER,
  source_type TEXT NOT NULL DEFAULT 'team',
  score_a INTEGER NOT NULL,
  score_b INTEGER NOT NULL,
  winner_team_id INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  superseded_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(match_id, revision),
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(submitted_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(submitted_by_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY(winner_team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS result_confirmations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_submission_id INTEGER NOT NULL,
  match_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  confirmed_by_user_id INTEGER NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('confirm','reject','different_result')),
  comment TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(result_submission_id, team_id),
  FOREIGN KEY(result_submission_id) REFERENCES result_submissions(id) ON DELETE CASCADE,
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY(confirmed_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  result_submission_id INTEGER,
  opened_by_user_id INTEGER,
  opened_by_team_id INTEGER,
  status TEXT NOT NULL DEFAULT 'open',
  reason TEXT NOT NULL DEFAULT '',
  referee_recommendation TEXT NOT NULL DEFAULT '',
  recommended_score_a INTEGER,
  recommended_score_b INTEGER,
  recommended_by_user_id INTEGER,
  recommended_at TEXT,
  resolved_by_user_id INTEGER,
  resolution_note TEXT NOT NULL DEFAULT '',
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(result_submission_id) REFERENCES result_submissions(id) ON DELETE SET NULL,
  FOREIGN KEY(opened_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(opened_by_team_id) REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY(recommended_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS draft_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL UNIQUE,
  room_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'waiting',
  config_json TEXT NOT NULL DEFAULT '{}',
  state_json TEXT NOT NULL DEFAULT '{}',
  access_json TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS draft_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  draft_room_id INTEGER NOT NULL,
  actor_user_id INTEGER,
  actor_role TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(draft_room_id) REFERENCES draft_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uploader_user_id INTEGER,
  storage_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'staff_only',
  retention_policy TEXT NOT NULL DEFAULT 'evidence',
  retention_anchor TEXT NOT NULL DEFAULT 'tournament_final',
  expires_at TEXT,
  legal_hold INTEGER NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY(uploader_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS file_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  purpose TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(file_id, entity_type, entity_id, purpose),
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL,
  sender_user_id INTEGER,
  sender_role TEXT NOT NULL DEFAULT 'host',
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'user',
  file_id INTEGER,
  pinned INTEGER NOT NULL DEFAULT 0,
  edited_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(sender_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(file_id) REFERENCES files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS match_message_reads (
  match_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  last_message_id INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(match_id, user_id),
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS match_checkins (
  match_id INTEGER NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  checked_in_by INTEGER,
  checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(match_id, actor_type, actor_id),
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE CASCADE,
  FOREIGN KEY(checked_in_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS seeding_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  user_id INTEGER,
  snapshot_json TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bracket_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  user_id INTEGER,
  label TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS standings_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  group_name TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  automatic_rank INTEGER NOT NULL,
  override_rank INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reverted_at TEXT,
  UNIQUE(tournament_id, group_name, team_id, active),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(team_id) REFERENCES teams(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER,
  match_id INTEGER,
  user_id INTEGER,
  action TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE SET NULL,
  FOREIGN KEY(match_id) REFERENCES matches(id) ON DELETE SET NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS dev_test_suites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dev_test_suite_users (
  suite_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  persona TEXT NOT NULL,
  PRIMARY KEY(suite_id,user_id),
  FOREIGN KEY(suite_id) REFERENCES dev_test_suites(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dev_test_suite_tournaments (
  suite_id INTEGER NOT NULL,
  tournament_id INTEGER NOT NULL,
  scenario TEXT NOT NULL,
  PRIMARY KEY(suite_id,tournament_id),
  FOREIGN KEY(suite_id) REFERENCES dev_test_suites(id) ON DELETE CASCADE,
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS divine_cards (
  id TEXT PRIMARY KEY,
  image_path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  effect TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  card_type TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 0,
  slot_pool INTEGER CHECK(slot_pool IN (1,2,3) OR slot_pool IS NULL),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS divine_cards_i18n (
  card_id TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('en','ja','zh-CN','ko','es','vi')),
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  effect TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  translation_status TEXT NOT NULL DEFAULT 'draft-native-review-required',
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(card_id, locale),
  FOREIGN KEY(card_id) REFERENCES divine_cards(id) ON DELETE CASCADE,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS divine_card_presets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  energy_threshold INTEGER NOT NULL DEFAULT 100,
  energy_rate REAL NOT NULL DEFAULT 1,
  scenario TEXT NOT NULL DEFAULT '',
  source_key TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL,
  updated_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS divine_card_presets_i18n (
  preset_id INTEGER NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('en','ja','zh-CN','ko','es','vi')),
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  scenario TEXT NOT NULL DEFAULT '',
  translation_status TEXT NOT NULL DEFAULT 'draft-native-review-required',
  updated_by INTEGER,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(preset_id, locale),
  FOREIGN KEY(preset_id) REFERENCES divine_card_presets(id) ON DELETE CASCADE,
  FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS divine_card_preset_slots (
  preset_id INTEGER NOT NULL,
  slot_no INTEGER NOT NULL CHECK(slot_no IN (1,2,3)),
  card_id TEXT NOT NULL,
  PRIMARY KEY(preset_id,slot_no),
  FOREIGN KEY(preset_id) REFERENCES divine_card_presets(id) ON DELETE CASCADE,
  FOREIGN KEY(card_id) REFERENCES divine_cards(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS divine_card_preset_swaps (
  preset_id INTEGER NOT NULL,
  slot_no INTEGER NOT NULL CHECK(slot_no IN (1,2,3)),
  card_id TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(preset_id,slot_no,card_id),
  FOREIGN KEY(preset_id) REFERENCES divine_card_presets(id) ON DELETE CASCADE,
  FOREIGN KEY(card_id) REFERENCES divine_cards(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS hero_divine_card_presets (
  hero_id TEXT NOT NULL,
  preset_id INTEGER NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(hero_id,preset_id),
  FOREIGN KEY(preset_id) REFERENCES divine_card_presets(id) ON DELETE CASCADE
);

`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(item => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Forward-compatible migrations for v0.4 databases.
const migrations = {
  users: [
    ['is_active', 'INTEGER NOT NULL DEFAULT 1'],
    ['last_login_at', 'TEXT'],
    ['failed_login_count', 'INTEGER NOT NULL DEFAULT 0'],
    ['locked_until', 'TEXT'],
    ['password_changed_at', 'TEXT'],
    ['email_verified_at', 'TEXT'],
    ['gamer_tag', "TEXT NOT NULL DEFAULT ''"],
    ['bio', "TEXT NOT NULL DEFAULT ''"],
    ['profile_visibility', "TEXT NOT NULL DEFAULT 'public'"],
    ['show_external_profiles', 'INTEGER NOT NULL DEFAULT 0'],
  ],
  tournaments: [
    ['start_at', 'TEXT'],
    ['schedule_mode', "TEXT NOT NULL DEFAULT 'fixed_tournament_start'"],
    ['roster_lock_at', 'TEXT'],
    ['finalized_at', 'TEXT'],
    ['result_reopen_hours', 'INTEGER NOT NULL DEFAULT 24'],
    ['evidence_retention_days', 'INTEGER NOT NULL DEFAULT 90'],
    ['chat_retention_days', 'INTEGER NOT NULL DEFAULT 30'],
    ['public_stream_platform', "TEXT NOT NULL DEFAULT ''"],
    ['public_stream_url', "TEXT NOT NULL DEFAULT ''"],
    ['public_stream_label', "TEXT NOT NULL DEFAULT ''"],
    ['discord_url', "TEXT NOT NULL DEFAULT ''"],
    ['is_public', 'INTEGER NOT NULL DEFAULT 0'],
    ['source_platform', "TEXT NOT NULL DEFAULT ''"],
    ['source_url', "TEXT NOT NULL DEFAULT ''"],
    ['source_external_id', "TEXT NOT NULL DEFAULT ''"],
    ['source_metadata_json', "TEXT NOT NULL DEFAULT '{}'"],
    ['source_last_synced_at', 'TEXT'],
    ['source_sync_status', "TEXT NOT NULL DEFAULT ''"],
  ],
  tournament_staff: [['permissions_json', "TEXT NOT NULL DEFAULT '[]'"]],
  teams: [
    ['seed_locked', 'INTEGER NOT NULL DEFAULT 0'],
    ['protected_seed_group', "TEXT NOT NULL DEFAULT ''"],
    ['region', "TEXT NOT NULL DEFAULT ''"],
    ['seeding_note', "TEXT NOT NULL DEFAULT ''"],
    ['team_status', "TEXT NOT NULL DEFAULT 'captain_pending'"],
    ['captain_user_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL'],
    ['roster_locked_at', 'TEXT'],
    ['withdrawn_at', 'TEXT'],
    ['disqualified_at', 'TEXT'],
    ['terminal_reason', "TEXT NOT NULL DEFAULT ''"],
    ['updated_at', 'TEXT'],
  ],
  team_members: [
    ['game_id', "TEXT NOT NULL DEFAULT ''"],
    ['membership_status', "TEXT NOT NULL DEFAULT 'active'"],
    ['is_substitute', 'INTEGER NOT NULL DEFAULT 0'],
    ['external_provider', "TEXT NOT NULL DEFAULT ''"],
    ['external_user_id', "TEXT NOT NULL DEFAULT ''"],
    ['external_profile_slug', "TEXT NOT NULL DEFAULT ''"],
    ['updated_at', 'TEXT'],
  ],
  tournament_join_requests: [
    ['external_profile_id', 'INTEGER REFERENCES external_profiles(id) ON DELETE SET NULL'],
    ['provider_snapshot_json', "TEXT NOT NULL DEFAULT '{}'"],
  ],
  match_games: [
    ['result_status', "TEXT NOT NULL DEFAULT 'none'"],
    ['reported_winner_team_id', 'INTEGER'],
    ['reported_by_user_id', 'INTEGER'],
    ['reported_by_team_id', 'INTEGER'],
    ['reported_at', 'TEXT'],
    ['confirmed_by_user_id', 'INTEGER'],
    ['confirmed_by_team_id', 'INTEGER'],
    ['confirmed_at', 'TEXT'],
    ['dispute_reason', "TEXT NOT NULL DEFAULT ''"],
  ],
  matches: [
    ['stage', "TEXT NOT NULL DEFAULT 'playoff'"],
    ['group_name', 'TEXT'],
    ['bracket_side', "TEXT NOT NULL DEFAULT 'winners'"],
    ['feeds_into_winner_match_id', 'INTEGER REFERENCES matches(id) ON DELETE SET NULL'],
    ['feeds_into_winner_slot', 'TEXT'],
    ['feeds_into_loser_match_id', 'INTEGER REFERENCES matches(id) ON DELETE SET NULL'],
    ['feeds_into_loser_slot', 'TEXT'],
    ['reset_of_match_id', 'INTEGER REFERENCES matches(id) ON DELETE SET NULL'],
    ['is_reset_match', 'INTEGER NOT NULL DEFAULT 0'],
    ['series_rule', "TEXT NOT NULL DEFAULT 'normal'"],
    ['current_game_number', 'INTEGER NOT NULL DEFAULT 1'],
    ['match_status', "TEXT NOT NULL DEFAULT 'available'"],
    ['result_status', "TEXT NOT NULL DEFAULT 'none'"],
    ['resolution_type', "TEXT NOT NULL DEFAULT 'normal'"],
    ['resolution_reason', "TEXT NOT NULL DEFAULT ''"],
    ['result_finalized_at', 'TEXT'],
    ['final_submission_id', 'INTEGER'],
    ['reopened_at', 'TEXT'],
    ['reopened_by', 'INTEGER REFERENCES users(id) ON DELETE SET NULL'],
    ['estimated_duration_minutes', 'INTEGER'],
    ['station_id', 'TEXT'],
    ['assigned_referee_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL'],
    ['assigned_broadcaster_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL'],
    ['room_code_status', "TEXT NOT NULL DEFAULT 'active'"],
    ['room_code_archived_at', 'TEXT'],
    ['room_code_expires_at', 'TEXT'],
    ['stream_platform', "TEXT NOT NULL DEFAULT ''"],
    ['private_notes', "TEXT NOT NULL DEFAULT ''"],
    ['public_notes', "TEXT NOT NULL DEFAULT ''"],
  ],
  divine_card_presets: [
    ['scenario', "TEXT NOT NULL DEFAULT ''"],
    ['source_key', "TEXT NOT NULL DEFAULT ''"],
  ],
  divine_cards: [
    ['effect', "TEXT NOT NULL DEFAULT ''"],
    ['note', "TEXT NOT NULL DEFAULT ''"],
    ['card_type', "TEXT NOT NULL DEFAULT ''"],
    ['display_order', 'INTEGER NOT NULL DEFAULT 0'],
  ],
  match_messages: [
    ['message_type', "TEXT NOT NULL DEFAULT 'user'"],
    ['file_id', 'INTEGER REFERENCES files(id) ON DELETE SET NULL'],
    ['pinned', 'INTEGER NOT NULL DEFAULT 0'],
    ['edited_at', 'TEXT'],
    ['deleted_at', 'TEXT'],
  ],
  draft_actions: [
    ['actor_user_id', 'INTEGER REFERENCES users(id) ON DELETE SET NULL'],
  ],
};
for (const [table, columns] of Object.entries(migrations)) {
  for (const [column, definition] of columns) ensureColumn(table, column, definition);
}

// Existing accounts predate email verification. Preserve their access once, while all newly
// registered accounts remain pending until they enter the emailed code.
const emailVerificationMigrationKey = 'auth.existing_users_email_verified.v1';
if (!db.prepare('SELECT 1 FROM app_meta WHERE key=?').get(emailVerificationMigrationKey)) {
  db.exec(`UPDATE users SET email_verified_at=COALESCE(email_verified_at,created_at,CURRENT_TIMESTAMP);`);
  db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)').run(emailVerificationMigrationKey,new Date().toISOString());
}

// Security migration: all pre-existing tournaments require an explicit publish action.
const visibilityMigrationKey = 'security.private_by_default.v1';
if (!db.prepare('SELECT 1 FROM app_meta WHERE key=?').get(visibilityMigrationKey)) {
  db.exec('UPDATE tournaments SET is_public=0;');
  db.prepare('INSERT INTO app_meta(key,value) VALUES (?,?)').run(visibilityMigrationKey,new Date().toISOString());
}

// Normalize legacy rows without destroying their data.
db.exec(`
UPDATE matches SET match_status = CASE
  WHEN status IN ('completed','bye') THEN 'completed'
  WHEN status = 'not_scheduled' THEN 'available'
  WHEN status = 'check_in' THEN 'checkin_open'
  ELSE status END
WHERE match_status IS NULL OR match_status = '' OR (match_status = 'available' AND status != 'available');
UPDATE matches SET result_status = 'final', result_finalized_at = COALESCE(result_finalized_at, updated_at)
WHERE winner_team_id IS NOT NULL AND status IN ('completed','bye') AND result_status = 'none';
UPDATE matches SET feeds_into_winner_match_id = COALESCE(feeds_into_winner_match_id, next_match_id),
  feeds_into_winner_slot = COALESCE(feeds_into_winner_slot, next_slot);
UPDATE teams SET captain_user_id = (
  SELECT tm.user_id FROM team_members tm
  WHERE tm.team_id = teams.id AND tm.is_captain = 1 AND tm.user_id IS NOT NULL
  ORDER BY tm.id LIMIT 1
) WHERE captain_user_id IS NULL;
UPDATE teams SET team_status = CASE
  WHEN team_status IN ('withdrawn','disqualified') THEN team_status
  WHEN captain_user_id IS NOT NULL THEN 'ready'
  ELSE 'captain_pending' END;
UPDATE teams SET status = CASE WHEN team_status='ready' THEN 'approved' ELSE status END;
UPDATE teams SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
UPDATE team_members SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);
`);

// Create indexes only after legacy columns have been added. This keeps v0.4 databases migratable.
db.exec(`
CREATE INDEX IF NOT EXISTS idx_host_applications_user ON host_applications(user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_source_url ON tournaments(source_url) WHERE source_url != '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournaments_source_id ON tournaments(source_platform, source_external_id) WHERE source_platform != '' AND source_external_id != '';
CREATE INDEX IF NOT EXISTS idx_tournaments_owner ON tournaments(host_user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_teams_tournament ON teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_teams_captain ON teams(captain_user_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_result_status ON matches(result_status);
CREATE INDEX IF NOT EXISTS idx_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_tournament ON tournament_join_requests(tournament_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON tournament_join_requests(user_id, status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_join_requests_one_pending ON tournament_join_requests(tournament_id, user_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_draft_actions_room ON draft_actions(draft_room_id);
CREATE INDEX IF NOT EXISTS idx_match_messages_match ON match_messages(match_id, id);
CREATE INDEX IF NOT EXISTS idx_result_submissions_match ON result_submissions(match_id, revision);
CREATE INDEX IF NOT EXISTS idx_disputes_match ON disputes(match_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_tournament ON audit_logs(tournament_id, id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id,revoked_at,refresh_expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_challenges(user_id,used_at,expires_at);
CREATE INDEX IF NOT EXISTS idx_email_change_user ON email_change_challenges(user_id,used_at,expires_at);
CREATE INDEX IF NOT EXISTS idx_provider_oauth_states_expiry ON provider_oauth_states(provider,expires_at,used_at);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(provider,expires_at,used_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_profile_provider_user ON external_profiles(provider,provider_user_id) WHERE provider_user_id!='';
CREATE INDEX IF NOT EXISTS idx_external_profiles_user ON external_profiles(user_id,provider);
CREATE INDEX IF NOT EXISTS idx_draft_socket_tickets_expiry ON draft_socket_tickets(expires_at,used_at);
CREATE INDEX IF NOT EXISTS idx_dev_access_tokens_expiry ON dev_access_tokens(expires_at,used_at);
CREATE INDEX IF NOT EXISTS idx_dev_test_suite_users_suite ON dev_test_suite_users(suite_id,persona);
CREATE INDEX IF NOT EXISTS idx_dev_test_suite_tournaments_suite ON dev_test_suite_tournaments(suite_id,scenario);
CREATE INDEX IF NOT EXISTS idx_divine_cards_slot ON divine_cards(slot_pool,display_order,is_active,name);
CREATE INDEX IF NOT EXISTS idx_divine_cards_i18n_locale ON divine_cards_i18n(locale,card_id);
CREATE INDEX IF NOT EXISTS idx_divine_card_presets_i18n_locale ON divine_card_presets_i18n(locale,preset_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_divine_preset_source_key ON divine_card_presets(source_key) WHERE source_key!='';
CREATE INDEX IF NOT EXISTS idx_divine_preset_slots_card ON divine_card_preset_slots(card_id);
CREATE INDEX IF NOT EXISTS idx_divine_preset_swaps_preset ON divine_card_preset_swaps(preset_id,slot_no,priority);
CREATE INDEX IF NOT EXISTS idx_divine_preset_swaps_card ON divine_card_preset_swaps(card_id);
CREATE INDEX IF NOT EXISTS idx_hero_divine_presets_hero ON hero_divine_card_presets(hero_id,is_default,preset_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hero_divine_one_default ON hero_divine_card_presets(hero_id) WHERE is_default=1;
`);

// Keep an English source row for every card. Localised rows may override individual fields,
// while empty translated fields safely fall back to these canonical values.
db.exec(`
INSERT INTO divine_cards_i18n(card_id,locale,name,description,effect,note,translation_status)
SELECT id,'en',name,description,effect,note,'source' FROM divine_cards WHERE 1
ON CONFLICT(card_id,locale) DO UPDATE SET
  name=excluded.name,description=excluded.description,effect=excluded.effect,note=excluded.note,
  translation_status='source',updated_at=CURRENT_TIMESTAMP;
`);


// Keep an English source row for every preset. Recommendation and Admin-created presets can
// then override their display copy per locale without altering the canonical preset rules.
db.exec(`
INSERT INTO divine_card_presets_i18n(preset_id,locale,name,description,scenario,translation_status)
SELECT id,'en',name,description,scenario,'source' FROM divine_card_presets WHERE 1
ON CONFLICT(preset_id,locale) DO UPDATE SET
  name=excluded.name,description=excluded.description,scenario=excluded.scenario,
  translation_status='source',updated_at=CURRENT_TIMESTAMP;
`);

function transaction(fn) {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

function jsonParse(value, fallback = {}) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

module.exports = { db, transaction, jsonParse, dbPath };
