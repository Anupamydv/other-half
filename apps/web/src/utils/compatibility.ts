import {LifestylePreferences} from '../types';

export interface CompatibilityAxisResult {
  key: string;
  label: string;
  userValue: string;
  otherValue: string;
  score: number; // 0 to 100
  matched: boolean;
}

export interface CompatibilityBreakdown {
  overallPercent: number;
  sharedHabits: string[];
  axes: CompatibilityAxisResult[];
}

export function calculateCompatibility(
  user: LifestylePreferences,
  other: LifestylePreferences,
  otherBudgetOrRent: number
): CompatibilityBreakdown {
  const axes: CompatibilityAxisResult[] = [];
  const sharedHabits: string[] = [];

  // 1. Sleep Schedule
  let sleepScore = 55;
  if (user.sleep === other.sleep) {
    sleepScore = 100;
    sharedHabits.push(other.sleep);
  } else if (user.sleep === 'Balanced' || other.sleep === 'Balanced') {
    sleepScore = 82;
  }
  axes.push({
    key: 'sleep',
    label: 'Sleep Rhythm',
    userValue: user.sleep,
    otherValue: other.sleep,
    score: sleepScore,
    matched: sleepScore >= 80,
  });

  // 2. Kitchen & Food
  let kitchenScore = 50;
  if (user.kitchen === other.kitchen) {
    kitchenScore = 100;
    sharedHabits.push(other.kitchen);
  } else if (
    (user.kitchen === 'Eggetarian' && other.kitchen === 'Pure Veg') ||
    (user.kitchen === 'Pure Veg' && other.kitchen === 'Eggetarian') ||
    (user.kitchen === 'Eggetarian' && other.kitchen === 'Non-Veg Friendly') ||
    (user.kitchen === 'Non-Veg Friendly' && other.kitchen === 'Eggetarian')
  ) {
    kitchenScore = 76;
  }
  axes.push({
    key: 'kitchen',
    label: 'Kitchen & Diet',
    userValue: user.kitchen,
    otherValue: other.kitchen,
    score: kitchenScore,
    matched: kitchenScore >= 76,
  });

  // 3. Work Rhythm
  let workScore = 65;
  if (user.work === other.work) {
    workScore = 100;
    sharedHabits.push(other.work);
  } else if (user.work === 'Hybrid' || other.work === 'Hybrid') {
    workScore = 84;
  }
  axes.push({
    key: 'work',
    label: 'Work Schedule',
    userValue: user.work,
    otherValue: other.work,
    score: workScore,
    matched: workScore >= 80,
  });

  // 4. Cleanliness
  let cleanScore = 50;
  if (user.cleanliness === other.cleanliness) {
    cleanScore = 100;
    sharedHabits.push(`${other.cleanliness} Home`);
  } else if (user.cleanliness === 'Tidy' || other.cleanliness === 'Tidy') {
    cleanScore = 80;
  }
  axes.push({
    key: 'cleanliness',
    label: 'Cleanliness',
    userValue: user.cleanliness,
    otherValue: other.cleanliness,
    score: cleanScore,
    matched: cleanScore >= 80,
  });

  // 5. Social Battery
  let socialScore = 58;
  if (user.social === other.social) {
    socialScore = 100;
    sharedHabits.push(other.social);
  } else if (user.social === 'Balanced' || other.social === 'Balanced') {
    socialScore = 82;
  }
  axes.push({
    key: 'social',
    label: 'Social Battery',
    userValue: user.social,
    otherValue: other.social,
    score: socialScore,
    matched: socialScore >= 80,
  });

  // 6. Budget Alignment
  const budgetDiff = Math.abs(user.maxBudget - otherBudgetOrRent);
  let budgetScore = 100;
  if (otherBudgetOrRent <= user.maxBudget) {
    budgetScore = budgetDiff <= 5000 ? 100 : 90;
    sharedHabits.push('Budget Match');
  } else if (otherBudgetOrRent - user.maxBudget <= 4000) {
    budgetScore = 78;
  } else {
    budgetScore = Math.max(45, 78 - Math.floor((otherBudgetOrRent - user.maxBudget) / 1000) * 4);
  }

  axes.push({
    key: 'budget',
    label: 'Monthly Budget',
    userValue: `Up to ₹${user.maxBudget.toLocaleString('en-IN')}`,
    otherValue: `₹${otherBudgetOrRent.toLocaleString('en-IN')}`,
    score: budgetScore,
    matched: budgetScore >= 80,
  });

  if (user.petFriendly && other.petFriendly) {
    sharedHabits.push('Pet Friendly');
  }
  if (user.nonSmoker && other.nonSmoker) {
    sharedHabits.push('Non-Smoker');
  }

  const weights = [0.18, 0.2, 0.14, 0.18, 0.14, 0.16];
  const weightedSum = axes.reduce((acc, axis, idx) => acc + axis.score * weights[idx], 0);
  const bonus =
    (user.petFriendly === other.petFriendly ? 2 : -2) +
    (user.nonSmoker === other.nonSmoker ? 2 : -4);

  const overallPercent = Math.min(99, Math.max(54, Math.round(weightedSum + bonus)));

  return {
    overallPercent,
    sharedHabits: sharedHabits.slice(0, 4),
    axes,
  };
}
