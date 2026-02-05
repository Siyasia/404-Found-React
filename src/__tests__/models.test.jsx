import { describe, it, expect } from 'vitest';
import { Task, BuildHabit, BreakHabit, FormedHabit, User } from '../models';

describe('Frontend models - basic behavior', () => {
  it('Task: constructor, from, toJSON, meta flattening', () => {
    const raw = {
      id: 't-1',
      title: 'Do the thing',
      taskType: 'simple',
      extraKey: 'extra-value',
      steps: ['step1'],
      needsApproval: true,
    };

    const t = new Task(raw);
    expect(t).toBeInstanceOf(Task);
    expect(t.title).toBe('Do the thing');
    expect(t.steps).toEqual(['step1']);
    // extraKey should be in meta because it's not an explicit field
    expect(t.meta.extraKey).toBe('extra-value');
    // toJSON should flatten meta so extraKey is at top-level
    const json = t.toJSON();
    expect(json.id).toBe('t-1');
    expect(json.extraKey).toBe('extra-value');
    expect(json.needsApproval).toBe(true);

    // from should return an instance
    const t2 = Task.from(json);
    expect(t2).toBeInstanceOf(Task);
    expect(t2.title).toBe('Do the thing');
  });

  it('BuildHabit: round-trip serialization', () => {
    const raw = { id: 'b-1', account_id: 'u1', goal: 'Read', cue: 'After dinner', steps: ['open book'] };
    const bh = new BuildHabit(raw);
    expect(bh).toBeInstanceOf(BuildHabit);
    const json = bh.toJSON();
    expect(json.goal).toBe('Read');
    const bh2 = BuildHabit.from(json);
    expect(bh2.goal).toBe('Read');
  });

  it('BreakHabit: round-trip serialization', () => {
    const raw = { id: 'br-1', account_id: 'u1', habit: 'scroll', replacements: ['read'], microSteps: ['put phone away'] };
    const bh = new BreakHabit(raw);
    expect(bh).toBeInstanceOf(BreakHabit);
    const json = bh.toJSON();
    expect(json.habit).toBe('scroll');
    const bh2 = BreakHabit.from(json);
    expect(bh2.replacements).toEqual(['read']);
  });

  it('FormedHabit: meta and explicit extras preserved', () => {
    const raw = { id: 'f-1', userId: 'u1', title: 'Read habit', type: 'build', details: { duration: 10 }, foo: 'bar' };
    const fh = new FormedHabit(raw);
    expect(fh).toBeInstanceOf(FormedHabit);
    expect(fh.details).toEqual({ duration: 10 });
    // foo should be in meta
    expect(fh.meta.foo).toBe('bar');
    const json = fh.toJSON();
    expect(json.foo).toBe('bar');
    const fh2 = FormedHabit.from(json);
    expect(fh2.title).toBe('Read habit');
  });

  it('User: construction aliases and toJSON flattening', () => {
    const raw = { user_id: 'u-x', username: 'alice', email: 'a@x.com', type: 'parent', code: 'ABC' };
    const u = new User(raw);
    expect(u).toBeInstanceOf(User);
    expect(u.id).toBe('u-x');
    expect(u.role).toBe('parent');
    // code explicit
    expect(u.code).toBe('ABC');
    const json = u.toJSON();
    expect(json.code).toBe('ABC');
    // round-trip
    const u2 = User.from(json);
    expect(u2.username).toBe('alice');
  });
});
