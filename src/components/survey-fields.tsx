import { inputCls, labelCls } from '@/components/ui';
import { CHANGES, DRESSY, MONTH_NAMES, SPARE, type Answers } from '@/lib/domain';

export function SurveySelect({ name, label, value, options }: { name: string; label: string; value: string; options: readonly (readonly [string, string])[] }) {
  return (
    <label className={labelCls}>{label}
      <select className={inputCls} name={name} defaultValue={value}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );
}

const entries = (o: Record<string, { label: string }>): [string, string][] => Object.entries(o).map(([k, v]) => [k, v.label]);
const yesNo: [string, string][] = [['no', 'No'], ['yes', 'Yes']];

/** The questions that apply to every size. Rendered inside a form that submits these field names. */
export function LifestyleFields({ answers }: { answers: Answers }) {
  return (
    <>
      <label className={labelCls}>How many days between laundry loads?
        <input className={inputCls} type="number" name="laundry" min={1} max={14} defaultValue={answers.laundry} />
      </label>
      <SurveySelect name="changes" label="Outfit changes on a typical day" value={answers.changes} options={entries(CHANGES)} />
      <SurveySelect name="spare" label="Spare outfits needed (extra changes, daycare, etc.)" value={answers.spare} options={entries(SPARE)} />
      <SurveySelect name="dressy" label="How many times a week does baby wear dressy clothes?" value={answers.dressyPerWeek} options={entries(DRESSY)} />
      <SurveySelect name="hot" label="Hot summers where you live?" value={answers.hot ? 'yes' : 'no'} options={yesNo} />
      <SurveySelect name="cold" label="Cold winters where you live?" value={answers.cold ? 'yes' : 'no'} options={yesNo} />
      <SurveySelect name="birth" label="Birth month, or due month" value={String(answers.birthMonth)} options={MONTH_NAMES.map((m, i) => [String(i), m] as [string, string])} />
    </>
  );
}
