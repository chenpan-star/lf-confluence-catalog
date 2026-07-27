import { isRemindTrackConfigured } from '../lib/remindTrack';

/** Short note for review pages: copy/open vs auto DM via remind Worker. */
export default function RemindStatusBanner() {
  const workerOn = isRemindTrackConfigured();

  return (
    <aside className="remind-status-banner card" role="status">
      <p>
        {workerOn ? (
          <>
            <strong>Send reminder</strong> can <strong>DM people on Slack automatically</strong>{' '}
            (when your network can reach the remind service) and create <strong>Jira</strong>{' '}
            tasks. Recipients must appear in <span className="mono">slack.json</span>. Otherwise you
            get copy &amp; open Slack to paste manually.
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
