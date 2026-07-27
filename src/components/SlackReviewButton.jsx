import { useEffect, useState } from 'react';
import { useCatalog } from '../context/CatalogContext';
import { guessEmail, primaryContact } from '../lib/contact';
import {
  buildReviewMessage,
  guessSlackHandle,
  openSlackReview,
  resolveSlackRecipient,
} from '../lib/slack';
import {
  buildRemindJiraPartKey,
  canAutoSendSlack,
  dispatchRemind,
  isRemindTrackConfigured,
  readRemindJiraPartLock,
  rememberRemindJiraSuccess,
  slackRemindAccepted,
  slackRemindDelivered,
} from '../lib/remindTrack';
import RemindConfirmModal from './RemindConfirmModal';

export default function SlackReviewButton({
  page,
  spaceName,
  spaceKey,
  catalogPageUrl = '',
  className = 'btn btn-sm btn-primary',
  children = 'Send reminder',
}) {
  const { catalog, slackConfig, remindTrackConfig } = useCatalog();
  const [hint, setHint] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [jiraCreated, setJiraCreated] = useState(null);
  const contact = primaryContact(page);
  const handle = guessSlackHandle(contact);
  const email = guessEmail(contact);
  const site = catalog?.meta?.source || 'lotusflare.atlassian.net';
  const workerOn = isRemindTrackConfigured();
  const autoSlack = canAutoSendSlack(contact, slackConfig);
  const slackRecipient = resolveSlackRecipient(contact, slackConfig);
  const slackUserId = slackRecipient?.userId ?? null;

  const messagePreview = buildReviewMessage({
    page,
    spaceName,
    spaceKey,
    site,
    catalogPageUrl,
    jiraPending: workerOn,
  });

  const jiraPartKey = buildRemindJiraPartKey({
    editor: contact || 'Unknown',
    partIndex: 1,
    partTotal: 1,
    pageIds: page?.id ? [page.id] : [],
  });

  useEffect(() => {
    if (!confirmOpen) return;
    const fromSession = readRemindJiraPartLock(jiraPartKey);
    if (fromSession?.issueKey) setJiraCreated(fromSession);
  }, [confirmOpen, jiraPartKey]);

  const jiraReady = Boolean(jiraCreated?.issueKey);

  function storeJira(jira) {
    const entry = rememberRemindJiraSuccess(jiraPartKey, jira);
    if (entry) setJiraCreated(entry);
  }

  async function dispatch(action) {
    if (action === 'jira' && jiraReady) {
      throw new Error(`Jira ${jiraCreated.issueKey} is already linked to this reminder.`);
    }
    if (action === 'slack' && !jiraReady) {
      throw new Error('Create the Jira task first, then send Slack DM.');
    }
    if (!workerOn && action !== 'copy') {
      throw new Error('Remind service is not configured.');
    }

    if (action === 'copy') {
      await openSlackReview({
        page,
        spaceName,
        spaceKey,
        site,
        catalogPageUrl,
        slackConfig,
      });
      const label = handle ? `@${handle}` : contact || 'editor';
      setHint(`Message copied — paste in Slack to ${label}`);
      setTimeout(() => setHint(''), 5000);
      return;
    }

    const result = await dispatchRemind({
      editor: contact || 'Unknown',
      editorEmail: email,
      message: buildReviewMessage({
        page,
        spaceName,
        spaceKey,
        site,
        catalogPageUrl,
      }),
      pagesCount: 1,
      partIndex: 1,
      partTotal: 1,
      remindTrackConfig,
      slackUserId,
      sendSlack: action === 'slack' && autoSlack,
      createJira: action === 'jira',
      jiraIssueKey: action === 'slack' ? jiraCreated?.issueKey : undefined,
      jiraIssueUrl: action === 'slack' ? jiraCreated?.issueUrl : undefined,
    });

    if (action === 'slack') {
      if (slackRemindDelivered(result.slack)) {
        const to =
          result.slack.recipientName || slackRecipient?.matchedAs || (handle ? `@${handle}` : contact);
        const jiraBit = result.jira?.issueKey ? ` · ${result.jira.issueKey} in message` : '';
        setHint(`Slack DM verified to ${to}${jiraBit}`);
        setTimeout(() => setHint(''), 6000);
        return;
      }
      if (slackRemindAccepted(result.slack)) {
        const to = result.slack.recipientName || contact;
        const jiraBit = result.jira?.issueKey ? ` · ${result.jira.issueKey} linked` : '';
        setHint(`Slack accepted DM to ${to}${jiraBit} — owner checks bot DMs`);
        setTimeout(() => setHint(''), 8000);
        return;
      }
      throw new Error(result.slack?.error || result.error || 'Slack DM did not send');
    }

    if (action === 'jira') {
      if (result.jira?.ok) {
        storeJira(result.jira);
        const notify = result.jira.notifyEmail;
        let extra = '';
        if (result.jira.duplicate) {
          extra = ' · existing open task (not duplicated)';
        } else if (notify?.ok) {
          extra = notify.mentionOk ? ' · @mention sent' : notify.notifyOk ? ' · email queued' : ' · notified';
        } else if (notify?.error) {
          extra = ` · notify failed: ${notify.error}`;
        }
        setHint(`Jira ${result.jira.issueKey}${result.jira.duplicate ? ' (already open)' : ' created'}${extra}`);
        setTimeout(() => setHint(''), 6000);
        return;
      }
      throw new Error(result.jira?.error || result.error || 'Jira task was not created');
    }
  }

  return (
    <span className="slack-review-wrap">
      <button type="button" className={className} onClick={() => setConfirmOpen(true)}>
        {children}
      </button>
      {hint && <span className="slack-hint">{hint}</span>}
      {confirmOpen && (
        <RemindConfirmModal
          title="Send reminder?"
          recipientName={contact || 'Unknown'}
          recipientHandle={slackRecipient?.matchedAs || handle}
          recipientEmail={email}
          messagePreview={messagePreview}
          workerOn={workerOn}
          autoSlack={autoSlack}
          onSendSlackDm={autoSlack && workerOn ? () => dispatch('slack') : undefined}
          onCreateJira={workerOn ? () => dispatch('jira') : undefined}
          onCopyOpenSlack={() => dispatch('copy')}
          jiraCreated={jiraCreated}
          onClose={() => {
            setConfirmOpen(false);
          }}
        />
      )}
    </span>
  );
}
