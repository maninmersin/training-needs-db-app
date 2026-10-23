import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { saveAs } from 'file-saver';
import { Download, Loader2, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentUser } from '@core/components/shell/useCurrentUser';
import { planInviteChanges, KIND } from '@core/calendar/planChanges';
import { buildInviteEmails, buildInviteFiles } from '@core/calendar/inviteFiles';
import { recordSent } from '@core/calendar/ledger';
import { loadSettings, saveSettings, validateSettings } from '@core/calendar/inviteSettings';
import { loadLedger, saveSent } from '@core/services/calendarInviteService';
import {
  Badge, Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, FormField, Input, Switch
} from '@/components/ui';
import { loadInviteInputs } from '../../services/inviteDataService';

const KIND_LABEL = {
  [KIND.NEW]: ['New invite', 'success'],
  [KIND.UPDATE]: ['Update', 'primary'],
  [KIND.CANCEL_ATTENDEES]: ['People removed', 'warning'],
  [KIND.CANCEL]: ['Cancelled', 'danger']
};

const TEST_LIMIT_DEFAULT = 3;

// 'YYYY-MM-DDTHH:mm' as 'dd/mm/yyyy hh:mm'
const formatWhen = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value || '');
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]}` : '';
};

// The ledger tables come from migration 0008; until it is applied they do not exist
const isMissingTable = (error) => ['42P01', 'PGRST205', 'PGRST200'].includes(error?.code) || /schema cache|does not exist/i.test(error?.message || '');

/**
 * Create the Outlook invitation files (.ics) for the people assigned to a schedule. In test mode only a test
 * address is invited and nothing is remembered, so it is safe to try. Otherwise only what has CHANGED since the
 * last send is included, and "Mark as sent" remembers it.
 */
const InviteChangesDialog = ({ isOpen, onClose, schedule, projectId }) => {
  const { user } = useCurrentUser();
  const [settings, setSettings] = useState(() => loadSettings(projectId));
  const [inputs, setInputs] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [ledgerMissing, setLedgerMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [testLimit, setTestLimit] = useState(TEST_LIMIT_DEFAULT);
  const [downloaded, setDownloaded] = useState(null); // { items, testMode } after files were created
  const [saving, setSaving] = useState(false);

  const update = (patch) => setSettings((previous) => ({ ...previous, ...patch }));

  const load = useCallback(async () => {
    if (!schedule?.id) return;
    setLoading(true);
    setError(null);
    setDownloaded(null);
    try {
      setInputs(await loadInviteInputs({ scheduleId: schedule.id, projectId }));
      try {
        setLedger(await loadLedger(projectId, schedule.id));
        setLedgerMissing(false);
      } catch (ledgerError) {
        if (!isMissingTable(ledgerError)) throw ledgerError;
        setLedger([]);
        setLedgerMissing(true);
      }
    } catch (err) {
      console.error('Error preparing invites:', err);
      setError(err.message || 'Could not read the schedule');
    } finally {
      setLoading(false);
    }
  }, [schedule?.id, projectId]);

  // Each time the dialog opens: the saved choices (the signed-in person fills the blanks), then the data
  useEffect(() => {
    if (!isOpen) return;
    setSettings(loadSettings(projectId, { organizerEmail: user?.email || '', testEmail: user?.email || '' }));
    setFieldErrors({});
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, projectId, schedule?.id]);

  // What would be sent for real (compared with what was sent before), and what a test would contain
  const realPlan = useMemo(() => (inputs ? planInviteChanges({ sessions: inputs, ledger }) : null), [inputs, ledger]);
  const testPlan = useMemo(() => {
    if (!inputs) return null;
    const everything = planInviteChanges({ sessions: inputs, ledger: [] });
    const withPeople = everything.items
      .filter((item) => item.kind === KIND.NEW && item.current.attendees.length > 0)
      .sort((a, b) => a.current.start.localeCompare(b.current.start))
      .slice(0, Math.max(1, Number(testLimit) || TEST_LIMIT_DEFAULT));
    return { ...everything, items: withPeople, counts: { new: withPeople.length, update: 0, cancelAttendees: 0, cancel: 0, total: withPeople.length } };
  }, [inputs, testLimit]);

  const plan = settings.testMode ? testPlan : realPlan;
  const blockedByMissingTables = !settings.testMode && ledgerMissing;
  const canCreate = Boolean(plan) && plan.items.length > 0 && !blockedByMissingTables && !loading;

  // Make the files with `build` and download them. kind: 'ics' (a calendar file) or 'email' (an unsent Outlook draft)
  const create = (build, kind) => {
    const problems = validateSettings(settings);
    setFieldErrors(problems);
    if (Object.keys(problems).length > 0) return;
    saveSettings(projectId, settings);

    const result = build(plan.items, {
      organizer: { name: settings.organizerName.trim(), email: settings.organizerEmail.trim() },
      testMode: settings.testMode,
      testEmail: settings.testEmail,
      label: schedule?.name || 'Training'
    });
    if (result.error) {
      setError(result.error);
      return;
    }
    setError(null);
    const type = kind === 'email' ? 'message/rfc822' : 'text/calendar;charset=utf-8';
    result.files.forEach((file) => saveAs(new Blob([file.content], { type }), file.filename));
    result.warnings.forEach((warning) => toast.warning(warning));
    setDownloaded({ items: plan.items, testMode: settings.testMode, files: result.files, kind });
    toast.success(`Created ${result.files.length} ${kind === 'email' ? 'email draft' : 'calendar file'}${result.files.length === 1 ? '' : 's'}`, {
      description: result.files.map((file) => file.filename).join(', ')
    });
  };

  const handleCreate = () => create(buildInviteFiles, 'ics');
  const handleCreateEmails = () => create(buildInviteEmails, 'email');

  // After the files were really sent: remember them, so the next plan only shows new changes
  const handleMarkSent = async () => {
    setSaving(true);
    try {
      await saveSent(recordSent(downloaded.items, { projectId, scheduleId: schedule.id, userId: user?.id || null, testMode: false }));
      toast.success('Marked as sent');
      await load();
    } catch (err) {
      console.error('Error saving the sent invites:', err);
      setError(`The invitations were not marked as sent: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-w-4xl" aria-label="Calendar invites">
        <DialogHeader>
          <DialogTitle>Calendar invites</DialogTitle>
          <DialogDescription>
            Create the Outlook invitations for the people assigned to {schedule?.name}: calendar files (.ics) to open, or email drafts you can send.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <section className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
            <FormField label="Your name (shown as the organiser)">
              <Input value={settings.organizerName} onChange={(event) => update({ organizerName: event.target.value })} placeholder="Training Coordinator" />
            </FormField>
            <FormField label="Your email address (the organiser)" error={fieldErrors.organizerEmail}>
              <Input type="email" value={settings.organizerEmail} onChange={(event) => update({ organizerEmail: event.target.value })} placeholder="you@company.com" />
            </FormField>

            <label className="flex cursor-pointer items-start gap-3 sm:col-span-2">
              <Switch aria-label="Test mode" checked={settings.testMode} onCheckedChange={(checked) => update({ testMode: checked })} className="mt-0.5" />
              <span className="flex flex-col text-sm">
                <span className="font-medium">Test mode</span>
                <span className="text-muted-foreground">
                  Only the test address below is invited, the titles say [TEST], and nothing is remembered, so you can try it as often as you like. Switch it off to create the real invitations.
                </span>
              </span>
            </label>

            {settings.testMode && (
              <>
                <FormField label="Send the test to" error={fieldErrors.testEmail} hint="Your own address is a good choice.">
                  <Input type="email" value={settings.testEmail} onChange={(event) => update({ testEmail: event.target.value })} placeholder="you@company.com" />
                </FormField>
                <FormField label="Number of meetings in the test" hint="The first meetings by date that have people assigned.">
                  <Input type="number" min="1" max="20" value={testLimit} onChange={(event) => setTestLimit(event.target.value)} />
                </FormField>
              </>
            )}
          </section>

          {error && <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</div>}

          {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Checking the schedule...</p>}

          {!loading && ledgerMissing && (
            <div role="alert" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
              {settings.testMode
                ? 'The invite history tables are not set up yet (not needed for a test). Before sending real invitations, run npm run db:migrate and restart the app.'
                : 'The invite history tables are not set up yet, so real invitations cannot be created. Run npm run db:migrate, restart the app, and open this again. You can use test mode meanwhile.'}
            </div>
          )}

          {!loading && plan && (
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="success">{plan.counts.new} new</Badge>
                {!settings.testMode && <Badge variant="primary">{plan.counts.update} updated</Badge>}
                {!settings.testMode && <Badge variant="warning">{plan.counts.cancelAttendees} with people removed</Badge>}
                {!settings.testMode && <Badge variant="danger">{plan.counts.cancel} cancelled</Badge>}
                {!settings.testMode && <Badge>{plan.unchanged} unchanged</Badge>}
              </div>

              {plan.items.length === 0 ? (
                <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {settings.testMode
                    ? 'No meeting has anyone with an email address assigned yet, so there is nothing to test with.'
                    : 'Nothing has changed since the last invitations, so there is nothing to send.'}
                </p>
              ) : (
                <div className="max-h-72 overflow-auto rounded-md border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-secondary text-xs text-muted-foreground">
                      <tr><th className="h-8 px-3 text-left">What</th><th className="px-3 text-left">Meeting</th><th className="px-3 text-left">When</th><th className="px-3 text-right">People</th><th className="px-3 text-left">Details</th></tr>
                    </thead>
                    <tbody>
                      {plan.items.map((item) => {
                        const [label, variant] = KIND_LABEL[item.kind];
                        const state = item.current || item.previous;
                        return (
                          <tr key={item.uid} className="border-t border-border align-top">
                            <td className="px-3 py-1.5"><Badge variant={variant}>{label}</Badge></td>
                            <td className="px-3 py-1.5 font-medium">{item.title}</td>
                            <td className="whitespace-nowrap px-3 py-1.5 text-muted-foreground">{formatWhen(state?.start)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{state?.attendees?.length ?? 0}</td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground">{item.description}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!settings.testMode && plan.missingEmails.length > 0 && (
                <details className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                  <summary className="cursor-pointer font-medium">{plan.missingEmails.length} assignment(s) have no email address and cannot be invited</summary>
                  <ul className="mt-1 list-disc pl-5">
                    {plan.missingEmails.slice(0, 50).map((person, index) => <li key={`${person.sessionId}-${person.id}-${index}`}>{person.name} ({person.title})</li>)}
                  </ul>
                </details>
              )}
            </section>
          )}

          {downloaded && (
            <section className="flex flex-col gap-2 rounded-md bg-primary-soft px-3 py-3 text-sm text-primary-soft-foreground">
              {downloaded.testMode ? (
                downloaded.kind === 'email' ? (
                  <>
                    <p><strong>Test email drafts created.</strong> Find them in your Downloads folder and double-click one: Outlook opens a new, unsent message addressed to the test address, with the meeting inside it.</p>
                    <p>Press Send, then open the message you receive. Tell me whether it shows Accept / Decline and whether the meeting lands in your calendar. Nothing was remembered, so you can make them again.</p>
                  </>
                ) : (
                  <>
                    <p><strong>Test files created.</strong> Find them in your Downloads folder and double-click one to open it in Outlook. Nothing was remembered, so you can create them again.</p>
                    <p>Outlook shows a calendar file as an invitation you have <em>received</em> (Accept / Decline), with no Send button. To really send it to someone, use the email drafts instead.</p>
                  </>
                )
              ) : (
                <>
                  <p><strong>Files created.</strong> Open each one in Outlook and send it. Once you have sent them, mark them as sent so the next time only new changes are listed.</p>
                  <div><Button variant="default" onClick={handleMarkSent} disabled={saving}>{saving ? 'Saving...' : 'I have sent them: mark as sent'}</Button></div>
                </>
              )}
            </section>
          )}
        </DialogBody>

        <DialogFooter>
          <Button onClick={load} disabled={loading}><RefreshCw /> Refresh</Button>
          <Button onClick={onClose} disabled={saving}>Close</Button>
          {settings.testMode && (
            <Button onClick={handleCreateEmails} disabled={!canCreate}><Mail /> Create test email drafts</Button>
          )}
          <Button variant="default" onClick={handleCreate} disabled={!canCreate}>
            <Download /> {settings.testMode ? 'Create test file' : 'Create invite files'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InviteChangesDialog;
