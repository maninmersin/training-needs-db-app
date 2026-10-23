import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Badge, Button, Input, Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { addableCourses, courseLabel, splitCourses } from './userCoursesLogic';

/**
 * A person's courses: the ones their role gives (read-only) and extra individual ones (add / remove).
 * `extraIds` is the working list; `onChange(newIds)` is called when one is added or removed. Nothing is saved here.
 */
export default function UserCoursesSection({ context, loading, error, role, extraIds, onChange, canEdit, disabled }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading courses...</p>;
  if (error) return <div role="alert" className="rounded-md bg-destructive-soft px-3 py-2 text-sm text-destructive">Could not load courses: {error}</div>;
  if (!context) return null;

  const roleIds = (role && context.roleCourses.get(role)) || [];
  const { fromRole, extra } = splitCourses(context.courses, roleIds, extraIds);
  const choices = addableCourses(context.courses, roleIds, extraIds, search);

  const add = (courseId) => {
    onChange([...extraIds, courseId]);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-medium text-muted-foreground">
          {role ? `From the role (${role})` : 'From the role'} <span className="tabular-nums">- {fromRole.length}</span>
        </div>
        {fromRole.length === 0 ? (
          <p className="text-sm text-subtle-foreground">{role ? 'This role has no courses yet.' : 'No role chosen.'}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label="Courses from the role">
            {fromRole.map((course) => (
              <li key={course.course_id}><Badge title={courseLabel(course)}>{course.course_id}</Badge></li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-medium text-muted-foreground">Extra courses for this person <span className="tabular-nums">- {extra.length}</span></div>
        {canEdit ? (
          <ul className="flex flex-wrap items-center gap-1.5" aria-label="Extra courses">
            {extra.map((course) => (
              <li key={course.course_id} className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-secondary pl-2.5 pr-1 text-xs">
                <span title={courseLabel(course)}>{course.course_id}</span>
                <button
                  type="button"
                  aria-label={`Remove ${course.course_id}`}
                  disabled={disabled}
                  onClick={() => onChange(extraIds.filter((id) => id !== course.course_id))}
                  className="grid size-4 place-content-center rounded-full text-subtle-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              </li>
            ))}
            <li>
              <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(''); }}>
                <PopoverTrigger asChild>
                  <Button size="sm" disabled={disabled} className="h-6 rounded-full px-2.5"><Plus /> Add course</Button>
                </PopoverTrigger>
                <PopoverContent className="flex w-72 flex-col gap-2 p-2">
                  <Input aria-label="Search courses to add" placeholder="Search courses..." value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
                  <ul className="max-h-56 overflow-y-auto" aria-label="Courses you can add">
                    {choices.map((course) => (
                      <li key={course.course_id}>
                        <button
                          type="button"
                          onClick={() => add(course.course_id)}
                          className="flex w-full flex-col rounded px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <span className="font-medium">{course.course_id}</span>
                          {course.course_name && <span className="text-xs text-muted-foreground">{course.course_name}</span>}
                        </button>
                      </li>
                    ))}
                    {choices.length === 0 && <li className="px-2 py-1.5 text-sm italic text-muted-foreground">No courses to add</li>}
                  </ul>
                </PopoverContent>
              </Popover>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-subtle-foreground">Extra courses can be added once the person has been saved.</p>
        )}
      </div>
    </div>
  );
}
