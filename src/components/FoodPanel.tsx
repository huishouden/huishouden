import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, UserPlus, X } from 'lucide-react';
import {
  DEFAULT_PANTRY,
  DIETS,
  DIET_LABELS,
  FOOD_LIMITS,
  SPICE_LABELS,
  SPICE_LEVELS,
  withMembers,
  type Diet,
  type FoodPerson,
  type FoodPreferences,
  type SpiceTolerance,
} from '@huishouden/pwa-kit/food';
import { Chip, Dialog, Field, cardClass, deleteButton, ghostButton, iconButton, inputClass, primaryButton, secondaryButton } from '@huishouden/pwa-kit/react/ui';
import type { HubActions, ReadyHousehold } from '../hub';

interface Props {
  household: ReadyHousehold;
  food: FoodPreferences | undefined;
  actions: HubActions;
  fail: (message: string) => void;
}

/** "Vegetarian, Nut allergy · avoids cilantro and olives", or that there's nothing to plan around. */
export function personSummary(p: FoodPerson): string {
  const parts = [p.diets.map((d) => DIET_LABELS[d]).join(', '), p.avoid.length ? `avoids ${p.avoid.join(', ')}` : ''].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Eats anything';
}

/**
 * Who eats at home and what suits them: every member (named from their profile) plus anyone without
 * an account, each with diets, foods to avoid and a note; and the kitchen basics recipes may assume.
 * One document for the household (`settings/food`), read by every app that suggests meals.
 */
export function FoodPanel({ household, food, actions, fail }: Props) {
  const [editing, setEditing] = useState<FoodPerson | 'new' | null>(null);
  const [pantryItem, setPantryItem] = useState('');
  const members = household.members.map((email) => ({ email, name: household.profiles[email]?.name }));
  const people = withMembers(food?.people ?? [], members);
  const pantry = food?.pantryAssumed ?? [...DEFAULT_PANTRY];

  const save = (next: { people?: FoodPerson[]; pantryAssumed?: string[] }) =>
    actions.saveFood({ people: next.people ?? people, pantryAssumed: next.pantryAssumed ?? pantry }).catch((e) => fail(e instanceof Error ? e.message : String(e)));

  /** Tapping the chosen level again clears it: no preference. */
  const setSpice = (person: FoodPerson, level: SpiceTolerance) => {
    const next = person.spice === level ? { ...person, spice: undefined } : { ...person, spice: level };
    if (!next.spice) delete next.spice;
    void save({ people: people.map((p) => (p.id === person.id ? next : p)) });
  };

  const addPantry = (e: FormEvent) => {
    e.preventDefault();
    const item = pantryItem.trim().replace(/\|/g, '/').slice(0, FOOD_LIMITS.pantryItem);
    if (!item || pantry.some((p) => p.toLowerCase() === item.toLowerCase())) return setPantryItem('');
    void save({ pantryAssumed: [...pantry, item] });
    setPantryItem('');
  };

  return (
    <section aria-label="Food" className={`${cardClass} max-w-2xl p-6`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-forest-700">Food</h2>
        <button type="button" className={secondaryButton} onClick={() => setEditing('new')} disabled={people.length >= FOOD_LIMITS.people}>
          <UserPlus size={18} aria-hidden="true" /> Add someone
        </button>
      </div>
      <p className="mb-3 text-stone-600">Who eats at home, and what suits them. Meal ideas in Tasks follow these.</p>
      <p className="mb-3 text-sm text-stone-600">Meal ideas keep to the lowest heat anyone picked.</p>
      {food === undefined ? (
        <p className="text-stone-600">Loading.</p>
      ) : (
        <ul className="mb-5" aria-label="People">
          {people.map((p) => (
            <li key={p.id} className="border-b border-stone-200 py-2.5">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 [overflow-wrap:break-word]">
                  <span className="block font-semibold">
                    {p.name}
                    {p.member === undefined && <span className="font-normal text-stone-600"> (no account)</span>}
                  </span>
                  <span className="block text-stone-600">{personSummary(p)}</span>
                  {p.note && <span className="block text-sm text-stone-600">{p.note}</span>}
                </span>
                <button type="button" className={iconButton} aria-label={`Edit ${p.name}'s food`} onClick={() => setEditing(p)}>
                  <Pencil size={18} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={`${p.name}'s spice`}>
                <span className="mr-1 text-sm font-medium text-stone-700" aria-hidden="true">
                  Spice
                </span>
                {SPICE_LEVELS.map((level) => (
                  <Chip key={level} active={p.spice === level} onClick={() => setSpice(p, level)}>
                    {SPICE_LABELS[level]}
                  </Chip>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mb-1 font-semibold">Kitchen basics</h3>
      <p className="mb-2 text-sm text-stone-600">Meal ideas assume these are at home and leave them off the shopping list.</p>
      <ul className="mb-2 flex flex-wrap gap-2" aria-label="Kitchen basics">
        {pantry.map((item) => (
          <li key={item} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-stone-200 bg-white pr-1 pl-4 text-sm font-medium text-stone-700">
            {item}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100"
              aria-label={`Remove ${item}`}
              onClick={() => void save({ pantryAssumed: pantry.filter((p) => p !== item) })}
            >
              <X size={16} />
            </button>
          </li>
        ))}
        {pantry.length === 0 && <li className="text-stone-600">None: meal ideas list everything to buy.</li>}
      </ul>
      <form className="flex flex-wrap gap-2" onSubmit={addPantry}>
        <input
          className={`${inputClass} min-w-[200px] flex-1`}
          value={pantryItem}
          maxLength={FOOD_LIMITS.pantryItem}
          onChange={(e) => setPantryItem(e.target.value)}
          placeholder="Another basic, like soy sauce"
          aria-label="Another kitchen basic"
          disabled={pantry.length >= FOOD_LIMITS.pantry}
        />
        <button type="submit" className={secondaryButton} disabled={!pantryItem.trim()}>
          <Plus size={18} aria-hidden="true" /> Add
        </button>
        {pantry.join('|') !== DEFAULT_PANTRY.join('|') && (
          <button type="button" className={ghostButton} onClick={() => void save({ pantryAssumed: [...DEFAULT_PANTRY] })}>
            Back to the usual basics
          </button>
        )}
      </form>

      {editing && (
        <PersonDialog
          person={editing === 'new' ? null : editing}
          onSave={(p) => void save({ people: editing === 'new' ? [...people, p] : people.map((x) => (x.id === p.id ? p : x)) })}
          onDelete={editing !== 'new' && editing.member === undefined ? () => void save({ people: people.filter((x) => x.id !== editing.id) }) : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}

function PersonDialog({ person, onSave, onDelete, onClose }: { person: FoodPerson | null; onSave: (p: FoodPerson) => void; onDelete?: () => void; onClose: () => void }) {
  const [name, setName] = useState(person?.name ?? '');
  const [diets, setDiets] = useState<Diet[]>(person?.diets ?? []);
  const [avoid, setAvoid] = useState<string[]>(person?.avoid ?? []);
  const [avoidItem, setAvoidItem] = useState('');
  const [note, setNote] = useState(person?.note ?? '');
  const valid = name.trim().length > 0;

  const addAvoid = () => {
    const items = avoidItem
      .split(/[,|]/)
      .map((s) => s.trim().slice(0, FOOD_LIMITS.avoidItem))
      .filter((s) => s && !avoid.some((a) => a.toLowerCase() === s.toLowerCase()));
    setAvoid([...avoid, ...items].slice(0, FOOD_LIMITS.avoid));
    setAvoidItem('');
  };

  const save = () => {
    if (!valid) return;
    const pending = avoidItem.trim() ? avoidItem.split(/[,|]/).map((s) => s.trim().slice(0, FOOD_LIMITS.avoidItem)).filter(Boolean) : [];
    const trimmedNote = note.trim().slice(0, FOOD_LIMITS.note);
    onSave({
      id: person?.id ?? `person-${Date.now().toString(36)}`,
      name: name.trim().slice(0, FOOD_LIMITS.name),
      ...(person?.member ? { member: person.member } : {}),
      diets: DIETS.filter((d) => diets.includes(d)),
      avoid: [...avoid, ...pending.filter((s) => !avoid.some((a) => a.toLowerCase() === s.toLowerCase()))].slice(0, FOOD_LIMITS.avoid),
      ...(person?.spice ? { spice: person.spice } : {}),
      ...(trimmedNote ? { note: trimmedNote } : {}),
    });
    onClose();
  };

  return (
    <Dialog
      title={person ? `${person.name}'s food` : 'Someone without an account'}
      onClose={onClose}
      footer={
        <>
          {onDelete && (
            <button
              type="button"
              className={deleteButton}
              onClick={() => {
                onDelete();
                onClose();
              }}
            >
              <Trash2 size={18} /> Remove
            </button>
          )}
          <button type="button" className={ghostButton} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={primaryButton} disabled={!valid} onClick={save}>
            Save
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name" hint={person?.member ? `Signed in as ${person.member}` : 'A child, or anyone else who eats at home.'}>
          <input className={inputClass} value={name} maxLength={FOOD_LIMITS.name} onChange={(e) => setName(e.target.value)} placeholder="Robin" />
        </Field>
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-stone-700">Diets, allergies and health</legend>
          <div className="flex flex-wrap gap-2">
            {DIETS.map((d) => (
              <Chip key={d} active={diets.includes(d)} onClick={() => setDiets(diets.includes(d) ? diets.filter((x) => x !== d) : [...diets, d])}>
                {DIET_LABELS[d]}
              </Chip>
            ))}
          </div>
        </fieldset>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-stone-700">Foods to avoid</span>
          {avoid.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2" aria-label="Foods to avoid">
              {avoid.map((a) => (
                <li key={a} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-stone-200 bg-white pr-1 pl-4 text-sm font-medium text-stone-700">
                  {a}
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100"
                    aria-label={`Remove ${a}`}
                    onClick={() => setAvoid(avoid.filter((x) => x !== a))}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={avoidItem}
              onChange={(e) => setAvoidItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addAvoid();
                }
              }}
              placeholder="Cilantro, olives"
              aria-label="Add foods to avoid"
              disabled={avoid.length >= FOOD_LIMITS.avoid}
            />
            <button type="button" className={secondaryButton} onClick={addAvoid} disabled={!avoidItem.trim()}>
              <Plus size={18} aria-hidden="true" /> Add
            </button>
          </div>
        </div>
        <Field label="Note">
          <input className={inputClass} value={note} maxLength={FOOD_LIMITS.note} onChange={(e) => setNote(e.target.value)} placeholder="Small portions; no spicy food at dinner" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
