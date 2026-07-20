/** Short note for review pages: reminders use copy & open Slack. */
export default function RemindStatusBanner() {
  return (
    <aside className="remind-status-banner card" role="status">
      <p>
        <strong>Send reminder</strong> copies a message and opens Slack so you can paste it into
        their DM. Auto bot DMs are not used on this site.
      </p>
    </aside>
  );
}
