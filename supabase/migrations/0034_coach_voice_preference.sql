-- Lets a user opt into real TTS narration of AI Coach replies and pick which
-- of the 4 available Speechmatics voices to use. Off by default — audio
-- playback is a bigger UX change than the app has had before, not something
-- to switch on silently for existing users.
alter table public.profiles
  add column if not exists coach_voice text not null default 'off'
    check (coach_voice in ('off', 'sarah', 'theo', 'megan', 'jack'));
