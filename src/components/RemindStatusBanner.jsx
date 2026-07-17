import { useCatalog } from '../context/CatalogContext';
import { isBotRemindConfigured } from '../lib/slack';
import './HygieneHelp.css';

/** Calm status for Slack remind capability (bot pending vs ready). */
export default function RemindStatusBanner() {
  const { slackConfig } = useCatalog();
  const botReady = isBotRemindConfigured(slackConfig);

  return (
    <aside
      className={`remind-status-banner card${botReady ? ' remind-status-banner-ok' : ''}`}
      role="status"
    >
      {botReady ? (
        <p>
          <strong>Slack bot ready.</strong> After you confirm, reminders can DM the page owner
          directly. You can still copy &amp; open Slack manually if needed.
        </p>
      ) : (
        <p>
          <strong>Slack bot not set up yet.</strong> Send reminder will copy a message and open
          Slack so you can paste it into their DM. Bot DMs will work after workspace approval and
          Worker setup.
        </p>
      )}
    </aside>
  );
}
