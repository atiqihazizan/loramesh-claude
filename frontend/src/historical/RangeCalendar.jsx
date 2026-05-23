// E4-b2 — range calendar for historical query.
// Pick 2 dates → from/to range. Pick 1 date → single day.
// Days outside [minDate, maxDate] are disabled.

import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

/**
 * @param {object}   props
 * @param {{from?:Date,to?:Date}|undefined} props.range  selected range
 * @param {Function} props.onChange  (range) => void
 * @param {Date|null} props.minDate  earliest selectable day
 * @param {Date|null} props.maxDate  latest selectable day
 * @param {boolean}  props.disabled  whole calendar disabled
 */
export default function RangeCalendar({
  range,
  onChange,
  minDate,
  maxDate,
  disabled,
}) {
  if (disabled) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-6
                      text-center text-xs text-slate-400">
        Select a device first
      </div>
    );
  }

  const disabledMatcher = [];
  if (minDate) disabledMatcher.push({ before: minDate });
  if (maxDate) disabledMatcher.push({ after: maxDate });

  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <DayPicker
        mode="range"
        selected={range}
        onSelect={onChange}
        disabled={disabledMatcher}
        defaultMonth={maxDate || minDate || undefined}
        captionLayout="dropdown"
        startMonth={minDate || undefined}
        endMonth={maxDate || undefined}
      />
    </div>
  );
}
