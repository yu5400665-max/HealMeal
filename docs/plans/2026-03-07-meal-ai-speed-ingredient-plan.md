# Meal AI Speed & Ingredient Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce meal-plan generation latency and improve ingredient coverage fidelity without breaking existing UX flow.

**Architecture:** Keep existing API/UI endpoints intact, but tune runtime knobs (model/timeout/retry) and replace aggressive post-processing with additive coverage logic. Preserve fallback behavior and template rendering path.

**Tech Stack:** Next.js 14, TypeScript, React, API Routes

---

### Task 1: Backend speed tuning for meal generation

**Files:**
- Modify: `app/api/generate-meal-plan/route.ts`
- Test: `npm run lint`

**Step 1: Write the failing test**
- Operational regression case: meal endpoint currently takes 30s+ under 32B model default.

**Step 2: Run test to verify it fails**
- Baseline evidence from logs: `POST /api/generate-meal-plan ... 38257ms/39047ms/46166ms`.

**Step 3: Write minimal implementation**
- Add `AI_MODEL_MEAL_TEXT` selection with fallback chain.
- Change default timeout to `30000`.
- Add configurable `MEAL_AI_MAX_ATTEMPTS` default `1`.

**Step 4: Run test to verify it passes**
- Run lint and ensure no type/lint errors.

### Task 2: Backend ingredient coverage from hard rewrite to additive fill

**Files:**
- Modify: `app/api/generate-meal-plan/route.ts`
- Test: `npm run lint`

**Step 1: Write the failing test**
- Behavioral issue: only first 6 ingredients guaranteed; dish details overwritten.

**Step 2: Run test to verify it fails**
- Baseline evidence in code path: `slice(0, 6)` and full dish field overwrite.

**Step 3: Write minimal implementation**
- Expand hint cap to 20.
- Remove global rewrite of steps/alternatives/dishName.
- Only append missing ingredients and lightweight name marker.

**Step 4: Run test to verify it passes**
- Run lint and spot-check logic path.

### Task 3: Frontend post-process preservation and input parsing robustness

**Files:**
- Modify: `app/meal-plan/page.tsx`
- Modify: `src/lib/ingredientsCatalog.ts`
- Test: `npm run lint`

**Step 1: Write the failing test**
- Behavioral issue: frontend secondary processing truncates ingredients and rewrites AI content.

**Step 2: Run test to verify it fails**
- Baseline evidence in code path: `.slice(0, 3)` and forced `buildStrictDishName`.

**Step 3: Write minimal implementation**
- Keep existing dish fields, only dedupe/append missing hints.
- Increase per-dish ingredient cap to 8 in post-process.
- Extend ingredient split delimiters to include semicolon/newline/tab/pipe.

**Step 4: Run test to verify it passes**
- Run lint and confirm build path remains valid.

### Task 4: Config docs alignment

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Test: manual review

**Step 1: Write the failing test**
- Config drift: new runtime knobs undocumented.

**Step 2: Run test to verify it fails**
- Check current env/docs missing `AI_MODEL_MEAL_TEXT`, `MEAL_AI_TIMEOUT_MS`, `MEAL_AI_MAX_ATTEMPTS`.

**Step 3: Write minimal implementation**
- Add the 3 env vars to sample config and README.

**Step 4: Run test to verify it passes**
- Verify docs now match code options.
