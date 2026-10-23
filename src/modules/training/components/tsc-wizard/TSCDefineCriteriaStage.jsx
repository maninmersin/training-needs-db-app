import React, { useState, useEffect } from 'react';
import { AlertTriangle, ArrowRight, Info, School } from 'lucide-react';
import { supabase } from '@core/services/supabaseClient';
import { useProject } from '@core/contexts/ProjectContext';
import { calculateClassroomsNeeded, validateClassroomCapacity } from '@core/utils/classroomCalculations';
import { Badge, Button, Card, Checkbox, FormField, Input, Skeleton } from '@/components/ui';
import NumberInput from './NumberInput';
import {
  ALL_DAYS, MODE_HELP, PREFERENCE_HELP, allSelected, applyChange, buildEndUsers, calculationNote, classroomSuggestions, defaultCriteria, groupByLocation,
  hasCapacityWarnings, scopeErrors, scopeIsValid, toggleAll, toggleDay, toggleItem
} from './criteriaLogic';

const PAGE_SIZE = 1000; // the API returns at most 1000 rows per request

// Every row of the TNA view for the project, in pages (a plain select stops at 1000)
async function fetchTrainingRows(projectId) {
  const { count } = await supabase.from('training_data_combined').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
  let rows = [];
  for (let start = 0; start < (count || 0); start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('training_data_combined')
      .select('*')
      .eq('project_id', projectId)
      .order('id') // stable order so pages don't overlap or skip rows
      .range(start, Math.min(start + PAGE_SIZE, count) - 1);
    if (error) throw error;
    rows = rows.concat(data);
  }
  return rows;
}

function SectionCard({ title, description, children, className }) {
  return (
    <Card className={className}>
      <div className="border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-col gap-4 p-4">{children}</div>
    </Card>
  );
}

function CheckGroup({ title, allLabel, options, selected, onToggle, onToggleAll, error, showError }) {
  return (
    <fieldset className="flex flex-col gap-2" aria-invalid={showError && error ? true : undefined}>
      <legend className="mb-1 flex items-center gap-2 text-sm font-medium">
        <span>{title}</span>
        <span className="text-destructive" aria-hidden="true">*</span>
        {showError && error && <Badge variant="danger">Required</Badge>}
      </legend>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border border-border p-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <Checkbox aria-label={allLabel} checked={allSelected(selected, options)} onCheckedChange={(checked) => onToggleAll(checked === true)} />
          {allLabel}
        </label>
        {options.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox aria-label={option} checked={selected.includes(option)} onCheckedChange={(checked) => onToggle(option, checked === true)} />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RadioChoice({ name, value, current, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="radio" name={name} value={value} checked={current === value} onChange={(event) => onChange(event.target.value)} className="size-4 accent-primary" />
      {children}
    </label>
  );
}

function TimeRange({ label, start, end, onStart, onEnd }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 text-sm">
        <Input type="time" aria-label={`${label} start`} value={start} onChange={(event) => onStart(event.target.value)} className="w-32" />
        to
        <Input type="time" aria-label={`${label} end`} value={end} onChange={(event) => onEnd(event.target.value)} className="w-32" />
      </div>
    </div>
  );
}

const TSCDefineCriteriaStage = ({ criteria, setCriteria, onNextStage, setEndUsers, setGroupingKeys }) => {
  const { currentProject } = useProject();

  // Initialize with existing criteria or defaults
  const [formValues, setFormValues] = useState({ ...defaultCriteria(), ...criteria });

  const [availableFunctionalAreas, setAvailableFunctionalAreas] = useState([]);
  const [availableTrainingLocations, setAvailableTrainingLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectionPreview, setSelectionPreview] = useState({ users: 0, courses: 0 });
  const [classroomRequirements, setClassroomRequirements] = useState([]);
  const [showValidation, setShowValidation] = useState(false);

  const errors = scopeErrors(formValues);
  const showScopeErrors = showValidation && (errors.functional_areas || errors.training_locations);

  // Fetch the areas and locations again whenever the project changes or the screen is reopened, so new imports show up
  useEffect(() => {
    const fetchSelectionData = async () => {
      try {
        setLoading(true);
        setLoadError(null);

        // Distinct values come from RPCs: the API caps plain selects at 1000 rows, so
        // de-duplicating fetched rows in JS can miss values in larger projects
        const { data: functionalAreasData, error: functionalAreasError } = await supabase
          .rpc('get_distinct_functional_areas', { p_project_id: currentProject?.id });
        if (functionalAreasError) throw functionalAreasError;
        const uniqueAreas = functionalAreasData.map((item) => item.functional_area).filter(Boolean);

        const { data: trainingLocationsData, error: trainingLocationsError } = await supabase
          .rpc('get_distinct_training_locations', { p_project_id: currentProject?.id });

        let uniqueLocations;
        if (trainingLocationsError) {
          // The RPC is not available: read the rows instead
          const rows = await fetchTrainingRows(currentProject?.id);
          uniqueLocations = [...new Set(rows.map((row) => row.training_location).filter(Boolean))];
        } else {
          uniqueLocations = (trainingLocationsData || []).map((item) => item.training_location).filter(Boolean);
        }

        setAvailableFunctionalAreas(uniqueAreas);
        setAvailableTrainingLocations(uniqueLocations);
      } catch (error) {
        console.error('Error fetching selection data:', error);
        setLoadError(error.message || 'Could not load the training needs data.');
      } finally {
        setLoading(false);
      }
    };

    if (currentProject?.id) fetchSelectionData();
    // Intentionally re-fetches each time the screen mounts, so data is fresh after imports
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id]);

  // Follow criteria changes made by the parent
  useEffect(() => {
    setFormValues({ ...defaultCriteria(), ...criteria });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria]);

  // Hand the defaults to the parent on first show
  useEffect(() => {
    if (!criteria || Object.keys(criteria).length === 0) setCriteria(formValues);
  }, [formValues, criteria, setCriteria]);

  const update = (newValues) => {
    setFormValues(newValues);
    setCriteria(newValues); // the parent always has the latest values
  };

  const handleChange = (key, value) => update(applyChange(formValues, key, value));

  const handleScopeChange = (key, newList) => {
    const newValues = { ...formValues, [key]: newList };
    update(newValues); // the preview follows from the effect below
  };

  // Rebuild the people-and-courses list for the chosen scope and the classroom estimate
  const updateSelectionPreview = async (values) => {
    try {
      if (values.selected_functional_areas.length === 0 || values.selected_training_locations.length === 0) {
        setSelectionPreview({ users: 0, courses: 0 });
        setClassroomRequirements([]);
        if (setEndUsers) setEndUsers([]);
        if (setGroupingKeys) setGroupingKeys(['training_location', 'functional_area']);
        return;
      }

      const trainingData = await fetchTrainingRows(currentProject?.id);
      const { endUsers, peopleCount, courseCount } = buildEndUsers(trainingData, values);

      const requirements = groupByLocation(endUsers).map((entry) => {
        const classroomReq = calculateClassroomsNeeded(entry.totalTrainingHours, values);
        return { ...entry, ...classroomReq, validation: validateClassroomCapacity(classroomReq.numberOfClassrooms) };
      });

      setClassroomRequirements(requirements);
      setSelectionPreview({ users: peopleCount, courses: courseCount });
      if (setEndUsers) setEndUsers(endUsers);
      if (setGroupingKeys) setGroupingKeys(['training_location', 'functional_area']);
    } catch (error) {
      console.error('Error updating selection preview:', error);
    }
  };

  // Update the preview when the scope or the classroom settings change
  useEffect(() => {
    if (!loading && availableFunctionalAreas.length > 0 && availableTrainingLocations.length > 0) {
      updateSelectionPreview(formValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formValues.selected_functional_areas, formValues.selected_training_locations,
    formValues.max_attendees, formValues.total_weeks, formValues.daily_hours,
    formValues.days_per_week, formValues.contingency, loading]);

  const handleSubmit = () => {
    setShowValidation(true);
    if (!scopeIsValid(formValues)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCriteria(formValues);
    onNextStage();
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <p className="text-sm text-muted-foreground">Loading selection data...</p>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  const preference = formValues.scheduling_preference;
  const warnings = hasCapacityWarnings(classroomRequirements);

  return (
    <div className="flex flex-col gap-4">
      {loadError && (
        <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          Could not load the training needs data: {loadError}
        </div>
      )}

      {showScopeErrors && (
        <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">
          <p className="font-medium">Please complete the required selections:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.functional_areas && <li>At least one Functional Area must be selected</li>}
            {errors.training_locations && <li>At least one Training Location must be selected</li>}
          </ul>
        </div>
      )}

      <SectionCard
        title="Scope selection (required)"
        description="Both Training Location and Functional Area are needed. This keeps every schedule in context and prevents assignment conflicts across locations."
      >
        <CheckGroup
          title="Functional Areas (from courses)"
          allLabel="All Functional Areas"
          options={availableFunctionalAreas}
          selected={formValues.selected_functional_areas}
          onToggle={(area, checked) => handleScopeChange('selected_functional_areas', toggleItem(formValues.selected_functional_areas, area, checked))}
          onToggleAll={(checked) => handleScopeChange('selected_functional_areas', toggleAll(availableFunctionalAreas, checked))}
          error={errors.functional_areas}
          showError={showValidation}
        />
        <CheckGroup
          title="Training Locations (from users)"
          allLabel="All Training Locations"
          options={availableTrainingLocations}
          selected={formValues.selected_training_locations}
          onToggle={(location, checked) => handleScopeChange('selected_training_locations', toggleItem(formValues.selected_training_locations, location, checked))}
          onToggleAll={(checked) => handleScopeChange('selected_training_locations', toggleAll(availableTrainingLocations, checked))}
          error={errors.training_locations}
          showError={showValidation}
        />

        <div className="rounded-md bg-muted px-3 py-2 text-center text-sm">
          <strong>Selection preview:</strong> {selectionPreview.users} users across {selectionPreview.courses} courses
        </div>

        {classroomRequirements.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-border p-3">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold"><School className="size-4" /> Estimated classroom requirements</h4>
            <ul className="flex flex-col gap-1">
              {classroomRequirements.map((req) => (
                <li key={req.location} className="flex items-center justify-between gap-3 text-sm">
                  <span><strong>{req.location}:</strong> {req.users} users, {req.totalTrainingHours.toFixed(1)} training hours</span>
                  <Badge variant={req.validation.severity === 'error' ? 'danger' : req.validation.severity === 'warning' ? 'warning' : 'success'}>
                    {req.numberOfClassrooms} {req.numberOfClassrooms === 1 ? 'classroom' : 'classrooms'}
                  </Badge>
                </li>
              ))}
            </ul>

            {warnings && (
              <div className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                <p className="flex items-center gap-1.5 font-medium"><AlertTriangle className="size-4" /> Classroom capacity warnings</p>
                <ul className="mt-1 list-disc pl-5">
                  {classroomRequirements
                    .filter((req) => req.validation.severity === 'warning' || req.validation.severity === 'error')
                    .map((req) => <li key={req.location}><strong>{req.location}:</strong> {req.validation.message}</li>)}
                </ul>
                {classroomSuggestions(classroomRequirements).length > 0 && (
                  <p className="mt-1.5 text-xs italic">Suggestions: {classroomSuggestions(classroomRequirements).join(' ')}</p>
                )}
              </div>
            )}

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0" /> {calculationNote(formValues)}</p>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Scheduling parameters">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <FormField label="Max Attendees"><NumberInput value={formValues.max_attendees} onValueChange={(n) => handleChange('max_attendees', n)} /></FormField>
          <FormField label="Total Weeks"><NumberInput value={formValues.total_weeks} onValueChange={(n) => handleChange('total_weeks', n)} /></FormField>
          <FormField label="Daily Hours"><NumberInput value={formValues.daily_hours} onValueChange={(n) => handleChange('daily_hours', n)} /></FormField>
          <FormField label="Days Per Week"><NumberInput value={formValues.days_per_week} onValueChange={(n) => handleChange('days_per_week', n)} /></FormField>
          <FormField label="Contingency Factor"><NumberInput step="0.1" value={formValues.contingency} onValueChange={(n) => handleChange('contingency', n)} /></FormField>
          <FormField label="Start Date"><Input type="date" value={formValues.start_date} onChange={(event) => handleChange('start_date', event.target.value)} /></FormField>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Scheduling Preference</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            <RadioChoice name="scheduling_preference" value="both" current={preference} onChange={(v) => handleChange('scheduling_preference', v)}>Both AM &amp; PM Sessions</RadioChoice>
            <RadioChoice name="scheduling_preference" value="am_only" current={preference} onChange={(v) => handleChange('scheduling_preference', v)}>Morning Only</RadioChoice>
            <RadioChoice name="scheduling_preference" value="pm_only" current={preference} onChange={(v) => handleChange('scheduling_preference', v)}>Afternoon Only</RadioChoice>
          </div>
          <p className="text-xs italic text-muted-foreground">{PREFERENCE_HELP[preference]}</p>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Classroom Scheduling Mode</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            <RadioChoice name="scheduling_mode" value="group_complete" current={formValues.scheduling_mode} onChange={(v) => handleChange('scheduling_mode', v)}>Complete by Group (Independent Classrooms)</RadioChoice>
            <RadioChoice name="scheduling_mode" value="course_complete" current={formValues.scheduling_mode} onChange={(v) => handleChange('scheduling_mode', v)}>Complete by Course (Synchronized Classrooms)</RadioChoice>
          </div>
          <p className="text-xs italic text-muted-foreground">{MODE_HELP[formValues.scheduling_mode]}</p>
        </fieldset>

        <div className="flex flex-wrap gap-6">
          {(preference === 'both' || preference === 'am_only') && (
            <TimeRange label="Morning Time" start={formValues.start_time_am} end={formValues.end_time_am}
              onStart={(v) => handleChange('start_time_am', v)} onEnd={(v) => handleChange('end_time_am', v)} />
          )}
          {(preference === 'both' || preference === 'pm_only') && (
            <TimeRange label="Afternoon Time" start={formValues.start_time_pm} end={formValues.end_time_pm}
              onStart={(v) => handleChange('start_time_pm', v)} onEnd={(v) => handleChange('end_time_pm', v)} />
          )}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">Scheduling Days</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {ALL_DAYS.map((day) => (
              <label key={day} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox aria-label={day} checked={formValues.scheduling_days.includes(day)} onCheckedChange={() => update({ ...formValues, scheduling_days: toggleDay(formValues.scheduling_days, day) })} />
                {day}
              </label>
            ))}
          </div>
        </fieldset>
      </SectionCard>

      <div className="flex justify-end">
        <Button variant="default" onClick={handleSubmit}>Next <ArrowRight /></Button>
      </div>
    </div>
  );
};

export default TSCDefineCriteriaStage;
