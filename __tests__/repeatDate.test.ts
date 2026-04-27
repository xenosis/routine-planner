import { matchesRepeatDate } from '../src/utils/repeatDate';

const START = '2026-04-27'; // 월요일

describe('matchesRepeatDate - 공통', () => {
  test('시작일보다 이전 날짜 → false (모든 반복 유형)', () => {
    expect(matchesRepeatDate('daily', START, '2026-04-26')).toBe(false);
    expect(matchesRepeatDate('weekly', START, '2026-04-26')).toBe(false);
    expect(matchesRepeatDate('monthly', START, '2026-04-26')).toBe(false);
    expect(matchesRepeatDate('yearly', START, '2026-04-26')).toBe(false);
  });

  test('시작일 당일 → true (모든 반복 유형)', () => {
    expect(matchesRepeatDate('daily', START, START)).toBe(true);
    expect(matchesRepeatDate('weekly', START, START)).toBe(true);
    expect(matchesRepeatDate('monthly', START, START)).toBe(true);
    expect(matchesRepeatDate('yearly', START, START)).toBe(true);
  });
});

describe('matchesRepeatDate - daily', () => {
  test('미래 모든 날짜 → true', () => {
    expect(matchesRepeatDate('daily', START, '2026-04-28')).toBe(true);
    expect(matchesRepeatDate('daily', START, '2026-12-31')).toBe(true);
  });
});

describe('matchesRepeatDate - weekly', () => {
  test('같은 요일(월) → true', () => {
    expect(matchesRepeatDate('weekly', START, '2026-05-04')).toBe(true); // 다음 월
    expect(matchesRepeatDate('weekly', START, '2027-04-26')).toBe(true); // 1년 뒤 월
  });

  test('다른 요일 → false', () => {
    expect(matchesRepeatDate('weekly', START, '2026-04-28')).toBe(false); // 화
    expect(matchesRepeatDate('weekly', START, '2026-05-01')).toBe(false); // 금
  });
});

describe('matchesRepeatDate - monthly', () => {
  test('같은 날짜(27일) → true', () => {
    expect(matchesRepeatDate('monthly', START, '2026-05-27')).toBe(true);
    expect(matchesRepeatDate('monthly', START, '2027-01-27')).toBe(true);
  });

  test('다른 날짜 → false', () => {
    expect(matchesRepeatDate('monthly', START, '2026-05-28')).toBe(false);
    expect(matchesRepeatDate('monthly', START, '2026-05-26')).toBe(false);
  });
});

describe('matchesRepeatDate - yearly', () => {
  test('같은 월+일(4/27) → true', () => {
    expect(matchesRepeatDate('yearly', START, '2027-04-27')).toBe(true);
    expect(matchesRepeatDate('yearly', START, '2030-04-27')).toBe(true);
  });

  test('월이 다르면 false', () => {
    expect(matchesRepeatDate('yearly', START, '2027-05-27')).toBe(false);
  });

  test('일이 다르면 false', () => {
    expect(matchesRepeatDate('yearly', START, '2027-04-28')).toBe(false);
  });
});

describe('matchesRepeatDate - minutes:N (테스트용)', () => {
  test('시작일 당일 → true', () => {
    expect(matchesRepeatDate('minutes:5', START, START)).toBe(true);
    expect(matchesRepeatDate('minutes:30', START, START)).toBe(true);
  });

  test('다음 날 → false', () => {
    expect(matchesRepeatDate('minutes:5', START, '2026-04-28')).toBe(false);
  });
});

describe('matchesRepeatDate - 알 수 없는 유형', () => {
  test('알 수 없는 반복 유형 → false', () => {
    expect(matchesRepeatDate('biweekly', START, '2026-05-11')).toBe(false);
  });
});
