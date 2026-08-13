export interface MealDish {
  name: string;
  allergens: number[];
}

export const NEIS_ALLERGEN_LABELS: Readonly<Record<number, string>>;
export function parseMealDish(raw: unknown): MealDish;
export function parseMealDishes(dishText: unknown): MealDish[];
export function normalizeSchoolMatchKey(name: unknown): string;
export function matchSchoolName(studentSchool: unknown, neisSchoolName: unknown): boolean;
