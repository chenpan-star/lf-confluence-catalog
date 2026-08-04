import { isRemindTrackConfigured } from '../lib/remindTrack';

/** Short note for review pages: copy/open vs auto DM via remind Worker. */
export default function RemindStatusBanner() {
  const workerOn = isRemindTrackConfigured();

  return (
    <aside className="remind-status-banner card" role="status">
      <p>
        {workerOn ? (
          <>
            <strong>Create Jira task</strong> first for each part, then <strong>Send Slack DM</strong>{' '}
            (when the remind service is reachable). Use <strong>Copy &amp; open Slack</strong> to paste
            manually anytime.
          </>
        ) : (
          <>
            <strong>Send reminder</strong> copies a message and opens Slack so you can paste it into
            their DM.
          </>
        )}
      </p>
    </aside>
  );
}
