/**
 * Mindfulness feature — the breathing session's supporting components.
 *
 *   import { BreathingCircle, type Phase } from "@/features/mindfulness";
 *
 * `CountdownTimer`, `ExerciseCard` and `ProgressBar` were exported from here
 * and imported by nothing — leftovers from an earlier version of the screen.
 * They carried 13 of the app's remaining hardcoded colours between them, so
 * they were dead code that still had to be migrated to be counted as done.
 * Deleted instead.
 */

export { default as BreathingCircle, type Phase } from "./components/BreathingCircle";
