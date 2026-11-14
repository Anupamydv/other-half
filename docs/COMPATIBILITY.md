# Lifestyle compatibility

The percentage shown on discovery and match cards is a deterministic summary of the two members' saved lifestyle answers. It is informational: it does not filter candidates, create matches, or guarantee that people will live well together.

## Score inputs

| Area | Weight | Scoring rule |
| --- | ---: | --- |
| Sleep schedule | 18% | Same schedule scores 100; a balanced schedule paired with another scores 82; other differences score 55. |
| Kitchen and diet | 20% | Same preference scores 100; compatible eggetarian combinations score 76; other differences score 50. |
| Work schedule | 14% | Same schedule scores 100; a hybrid pairing scores 84; other differences score 65. |
| Cleanliness | 18% | Same preference scores 100; a pairing with tidy scores 80; other differences score 50. |
| Social energy | 14% | Same preference scores 100; a balanced pairing scores 82; other differences score 58. |
| Monthly budget | 16% | Budgets within ₹5,000 score 100; each further ₹5,000 difference reduces the score by 10 points, down to 45. |

Pet-friendly and non-smoker preferences add a small adjustment. The final result is rounded and bounded between 54% and 99%. The algorithm and its weights live in `apps/web/src/utils/compatibility.ts` so the displayed explanation and percentage use the same calculation.

## Product rule

Only mutual positive interest creates a match: a `LIKE` or `SUPER_LIKE` from each member. A high compatibility percentage never substitutes for either person's choice. Passes, likes, matches, and match conversations are stored by the API and PostgreSQL, not browser storage.

## Limits

This score is a product heuristic, not a validated prediction of roommate success. Budget values are self-reported maximums, and missing context such as chores, guests, lease timing, and conflict style can matter more than the percentage. Members should compare expectations directly before making housing decisions.
