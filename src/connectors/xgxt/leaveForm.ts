import { WzvtcError } from '../../core/errors.js';
import { isPlainObject } from '../../core/json.js';

export interface LeaveDuration {
  leaveDay: number;
  leaveHour: number;
  beginHour: string;
  endHour: string;
}

export interface LeaveValidation {
  errors: string[];
  warnings: string[];
  duration?: LeaveDuration;
}

const CONTACT_FIELDS = ['JHRName', 'JHRPhone', 'OutName', 'OutMoveTel', 'StuMoveTel'];

export function summarizeLeaveItem(item: unknown): Record<string, unknown> {
  if (!isPlainObject(item)) return {};
  return {
    id: item.Id,
    type: item.LeaveType,
    date: item.LeaveDate,
    status: item.StatusName,
    big_state: item.BigState,
    days: item.LeaveDay,
    hours: item.LeaveHour,
    address: item.OutAddress,
    with_num: item.WithNumNo,
  };
}

export function normalizeHour(value: unknown): string | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23) {
    return String(value);
  }
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2})(?::\d{2})?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return String(hour);
}

function parseDate(value: unknown): [number, number, number] | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return [year, month, day];
}

function timestamp(value: unknown, hourValue: unknown): number | null {
  const date = parseDate(value);
  const hour = normalizeHour(hourValue);
  if (!date || hour === null) return null;
  return Date.UTC(date[0], date[1] - 1, date[2], Number(hour));
}

function nonEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

export function computeLeaveDuration(info: Record<string, unknown>): LeaveDuration {
  const beginHour = normalizeHour(info.LeaveBeginTime);
  const endHour = normalizeHour(info.LeaveEndTime);
  const begin = timestamp(info.LeaveBeginDate, beginHour);
  const end = timestamp(info.LeaveEndDate, endHour);
  if (begin === null || end === null) {
    throw new WzvtcError('invalid_input', '请假起止日期或时间格式不正确', {
      details: { expected: 'LeaveBeginDate/LeaveEndDate 为 YYYY-MM-DD，时间为 0-23 小时' },
    });
  }
  if (end <= begin) {
    throw new WzvtcError('invalid_input', '请假结束时间必须大于开始时间');
  }

  const leaveDay = Math.trunc((end - begin) / 86_400_000);
  const hourDelta = Number(endHour) - Number(beginHour);
  let leaveHour: number;
  if (leaveDay === 0) {
    leaveHour = hourDelta < 0 ? 24 - Math.abs(hourDelta) : hourDelta;
  } else if (hourDelta === 0) {
    leaveHour = 0;
  } else if (hourDelta > 0) {
    leaveHour = hourDelta;
  } else {
    leaveHour = 24 - Math.abs(hourDelta);
  }

  return { leaveDay, leaveHour, beginHour: beginHour!, endHour: endHour! };
}

export function stableLeaveInfoForHash(info: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(info)) as Record<string, unknown>;
  delete clone.sysid;
  return clone;
}

export function applyLeaveCalculations(info: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(info)) as Record<string, unknown>;
  const duration = computeLeaveDuration(clone);
  clone.LeaveBeginTime = duration.beginHour;
  clone.LeaveEndTime = duration.endHour;
  clone.LeaveBeginTimeIndex = Number(duration.beginHour);
  clone.LeaveEndTimeIndex = Number(duration.endHour);
  clone.LeaveDay = duration.leaveDay;
  clone.LeaveHour = duration.leaveHour;
  return clone;
}

export function validateLeaveInfo(
  info: Record<string, unknown>,
  forExecute = false,
): LeaveValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let duration: LeaveDuration | undefined;

  try {
    duration = computeLeaveDuration(info);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : '请假时间校验失败');
  }

  if (!/^0$|^[1-9]\d{0,2}$/.test(String(info.LeaveAllWhat ?? ''))) {
    errors.push('LeaveAllWhat（请假合计节次）必须是 0-999 的整数');
  }
  if (info.IsInSchool !== '0' && info.IsInSchool !== '1') {
    errors.push('IsInSchool 必须是 "0" 或 "1"');
  }
  if (!nonEmpty(info.LeaveTypeList)) {
    errors.push('LeaveTypeList（请假事由类型）不能为空');
  }
  if (!nonEmpty(info.LeaveThing)) {
    errors.push('LeaveThing（请假事由）不能为空');
  }
  if (!nonEmpty(info.LeaveTypeTwo)) {
    errors.push('LeaveTypeTwo（请假类型）不能为空');
  }

  if (duration) {
    if (info.LeaveTypeTwoText === '晚归') {
      if (duration.leaveDay !== 0 || duration.leaveHour > 12) {
        errors.push('晚归的请假时长不能超过 12 小时且不能跨天');
      }
      if (
        String(info.LeaveBeginDate) !== String(info.LeaveEndDate) &&
        Number(duration.endHour) > 1
      ) {
        errors.push('晚归跨天时结束时间不能超过凌晨 1 点');
      }
    }
    if (info.LeaveTypeTwoText === '不归' && Number(duration.endHour) > 22) {
      errors.push('不归的请假结束时间不能超过 22 点');
    }
  }

  if (info.GoDate || info.BackDate) {
    const go = timestamp(info.GoDate, info.GoTime);
    const back = timestamp(info.BackDate, info.BackTime);
    const begin = timestamp(info.LeaveBeginDate, info.LeaveBeginTime);
    const end = timestamp(info.LeaveEndDate, info.LeaveEndTime);
    if (go === null || back === null) {
      errors.push('往返日期或时间格式不正确');
    } else if (begin !== null && end !== null) {
      if (go < begin || back > end) {
        errors.push('往返时间必须在请假时间内');
      }
      if (back <= go) {
        errors.push('返校时间必须大于出发时间');
      }
    }
  } else {
    warnings.push('未填写 GoDate/BackDate 往返时间，请确认表单是否要求');
  }

  if (!nonEmpty(info.OutWhere)) {
    const message = 'OutWhere（是否温州市内）未填写';
    if (forExecute) errors.push(message);
    else warnings.push(message);
  }

  for (const field of CONTACT_FIELDS) {
    if (!nonEmpty(info[field])) {
      const message = `${field}（联系人/电话）未填写`;
      if (forExecute) errors.push(message);
      else warnings.push(message);
    }
  }

  return { errors, warnings, duration };
}
