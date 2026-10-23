import React, { useEffect, useState } from 'react';
import { Home, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, EmptyState, FormField, Input } from '@/components/ui';
import ScheduleCalendar from '../calendar/ScheduleCalendar';

const TSCReviewAdjustStage = ({ sessionsForCalendar, onSessionUpdated, onFinish }) => {
  const navigate = useNavigate();
  const [scheduleName, setScheduleName] = useState(`Training Schedule - ${new Date().toISOString().slice(0, 10)}`);
  const [saving, setSaving] = useState(false);

  const hasSessions = Boolean(sessionsForCalendar) && Object.keys(sessionsForCalendar).length > 0;

  useEffect(() => {
    if (!hasSessions) console.warn('TSCReviewAdjustStage: no sessions received for display');
  }, [hasSessions]);

  const handleSave = async () => {
    if (!scheduleName.trim()) {
      toast.error('Please enter a schedule name');
      return;
    }
    setSaving(true);
    try {
      await onFinish(scheduleName.trim());
    } finally {
      setSaving(false);
    }
  };

  const handleExit = () => {
    localStorage.removeItem('tscWizardState');
    navigate('/');
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        If you need to make amendments - Save this Schedule and use the Schedule Manager to make manual changes or run the Wizard again.
      </p>

      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Schedule Name *" className="min-w-64 flex-1">
            <Input value={scheduleName} onChange={(event) => setScheduleName(event.target.value)} placeholder="Enter schedule name..." />
          </FormField>
          <Button variant="default" onClick={handleSave} disabled={!scheduleName.trim() || saving}><Save /> {saving ? 'Saving...' : 'Save Schedule'}</Button>
          <Button onClick={handleExit}><Home /> Finish &amp; Exit</Button>
        </div>
      </Card>

      {hasSessions ? (
        <ScheduleCalendar sessions={sessionsForCalendar} onSessionUpdated={onSessionUpdated} />
      ) : (
        <Card><EmptyState title="No sessions available to display" description="Go back, check the scope selection and run the wizard again." /></Card>
      )}
    </div>
  );
};

export default TSCReviewAdjustStage;
