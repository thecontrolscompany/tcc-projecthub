alter table public.user_activity_events
  drop constraint if exists user_activity_events_event_type_check;

alter table public.user_activity_events
  add constraint user_activity_events_event_type_check
  check (
    event_type in (
      'login_success',
      'login_failed',
      'logout',
      'password_changed',
      'password_reset_requested',
      'portal_user_created',
      'portal_access_enabled',
      'portal_access_disabled'
    )
  );
