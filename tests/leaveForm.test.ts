import { describe, expect, it } from 'vitest';
import {
  applyLeaveCalculations,
  computeLeaveDuration,
  normalizeHour,
  stableLeaveInfoForHash,
  summarizeLeaveItem,
  validateLeaveInfo,
} from '../src/connectors/xgxt/leaveForm.js';

function validLeave(): Record<string, unknown> {
  return {
    LeaveBeginDate: '2026-11-02',
    LeaveBeginTime: '08:00',
    LeaveEndDate: '2026-11-02',
    LeaveEndTime: '12:00',
    LeaveAllWhat: '4',
    IsInSchool: '1',
    LeaveTypeList: ['02048007'],
    LeaveThing: 'test reason',
    LeaveTypeTwo: '02062003',
    LeaveTypeTwoText: '课假',
    OutWhere: '1',
    JHRName: 'contact',
    JHRPhone: '13800000000',
    OutName: 'contact',
    OutMoveTel: '13800000000',
    StuMoveTel: '13800000000',
  };
}

describe('xgxt leave form calculations', () => {
  it('normalizes hour strings', () => {
    expect(normalizeHour('08:00')).toBe('8');
    expect(normalizeHour(23)).toBe('23');
    expect(normalizeHour('24')).toBeNull();
    expect(normalizeHour('abc')).toBeNull();
  });

  it('computes same-day duration', () => {
    const duration = computeLeaveDuration(validLeave());
    expect(duration).toMatchObject({ leaveDay: 0, leaveHour: 4, beginHour: '8', endHour: '12' });
  });

  it('computes cross-day duration', () => {
    const duration = computeLeaveDuration({
      ...validLeave(),
      LeaveEndDate: '2026-11-03',
    });
    expect(duration).toMatchObject({ leaveDay: 1, leaveHour: 4 });
  });

  it('applies calculated fields', () => {
    const info = applyLeaveCalculations(validLeave());
    expect(info.LeaveBeginTime).toBe('8');
    expect(info.LeaveEndTime).toBe('12');
    expect(info.LeaveDay).toBe(0);
    expect(info.LeaveHour).toBe(4);
    expect(info.LeaveBeginTimeIndex).toBe(8);
  });

  it('rejects an end time before the start time', () => {
    expect(() =>
      computeLeaveDuration({
        ...validLeave(),
        LeaveBeginTime: '12',
        LeaveEndTime: '8',
      }),
    ).toThrowError();
  });

  it('summarizes a leave item without PII fields', () => {
    const summary = summarizeLeaveItem({
      Id: 'record-1',
      LeaveType: '事假',
      LeaveDate: '2026-11-02',
      StatusName: '待审核',
      studentId: '20240000001',
      JHRName: 'contact-name',
      JHRPhone: '13800138000',
    });
    expect(summary).toMatchObject({ id: 'record-1', type: '事假', status: '待审核' });
    expect(JSON.stringify(summary)).not.toContain('20240000001');
    expect(JSON.stringify(summary)).not.toContain('contact-name');
    expect(JSON.stringify(summary)).not.toContain('13800138000');
  });

  it('excludes the volatile sysid from the confirmation hash input', () => {
    const a = { ...validLeave(), sysid: 'generated-1' };
    const b = { ...validLeave(), sysid: 'generated-2' };
    expect(stableLeaveInfoForHash(a)).not.toHaveProperty('sysid');
    expect(JSON.stringify(stableLeaveInfoForHash(a))).toBe(
      JSON.stringify(stableLeaveInfoForHash(b)),
    );
  });

  it('reports missing required fields', () => {
    const info = validLeave();
    delete info.LeaveAllWhat;
    delete info.IsInSchool;
    delete info.LeaveThing;
    const validation = validateLeaveInfo(info);
    expect(validation.errors.join('\n')).toContain('LeaveAllWhat');
    expect(validation.errors.join('\n')).toContain('IsInSchool');
    expect(validation.errors.join('\n')).toContain('LeaveThing');
  });

  it('treats missing contacts as warnings in preview and errors for execute', () => {
    const info = validLeave();
    for (const field of ['JHRName', 'JHRPhone', 'OutName', 'OutMoveTel', 'StuMoveTel']) {
      delete info[field];
    }
    const preview = validateLeaveInfo(info, false);
    expect(preview.errors).toHaveLength(0);
    expect(preview.warnings.length).toBeGreaterThan(0);

    const execute = validateLeaveInfo(info, true);
    expect(execute.errors.length).toBeGreaterThan(0);
  });
});
