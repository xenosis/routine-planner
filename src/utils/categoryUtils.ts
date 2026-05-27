import type { Category } from '../db/categoryDb';
import { NAME_TAG_DEFAULT_COLOR } from './nameTag';

/** 카테고리 이름으로 색상을 조회한다. 없으면 기본 회색 반환. */
export function getCategoryColor(name: string, categories: Category[]): string {
  return categories.find((c) => c.name === name)?.color ?? NAME_TAG_DEFAULT_COLOR;
}
