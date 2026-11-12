import { eq, and, sql } from "drizzle-orm";
import { db } from "~/db";
import { courseRatings } from "~/db/schema";

// ─── Rating Service ───
// Handles per-student course star ratings and average rating calculation.
// Uses positional parameters (project convention).

export function findCourseRating(userId: number, courseId: number) {
  return db
    .select()
    .from(courseRatings)
    .where(
      and(eq(courseRatings.userId, userId), eq(courseRatings.courseId, courseId))
    )
    .get();
}

export function getUserRatingForCourse(userId: number, courseId: number) {
  return findCourseRating(userId, courseId)?.rating ?? null;
}

export function rateCourse(userId: number, courseId: number, rating: number) {
  const existing = findCourseRating(userId, courseId);

  if (existing) {
    return db
      .update(courseRatings)
      .set({ rating, updatedAt: new Date().toISOString() })
      .where(eq(courseRatings.id, existing.id))
      .returning()
      .get();
  }

  return db
    .insert(courseRatings)
    .values({ userId, courseId, rating })
    .returning()
    .get();
}

// A student who gives no rating isn't a zero — their row simply doesn't
// exist, so the average only ever reflects students who bothered to rate.
export function getCourseRatingSummary(courseId: number) {
  const result = db
    .select({
      average: sql<number | null>`avg(${courseRatings.rating})`,
      count: sql<number>`count(*)`,
    })
    .from(courseRatings)
    .where(eq(courseRatings.courseId, courseId))
    .get();

  const count = result?.count ?? 0;
  const average = count > 0 ? Number(result!.average) : null;
  // Round to the nearest half-star (e.g. 3.74 -> 3.5, 3.76 -> 4).
  const roundedAverage =
    average !== null ? Math.round(average * 2) / 2 : null;

  return { average, roundedAverage, count };
}
