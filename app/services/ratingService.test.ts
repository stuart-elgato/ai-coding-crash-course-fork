import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";

let testDb: ReturnType<typeof createTestDb>;
let base: ReturnType<typeof seedBaseData>;

vi.mock("~/db", () => ({
  get db() {
    return testDb;
  },
}));

// Import after mock so the module picks up our test db
import {
  findCourseRating,
  getUserRatingForCourse,
  rateCourse,
  getCourseRatingSummary,
} from "./ratingService";

describe("ratingService", () => {
  beforeEach(() => {
    testDb = createTestDb();
    base = seedBaseData(testDb);
  });

  describe("rateCourse", () => {
    it("creates a new rating", () => {
      const rating = rateCourse(base.user.id, base.course.id, 4);

      expect(rating).toBeDefined();
      expect(rating.rating).toBe(4);
      expect(rating.userId).toBe(base.user.id);
      expect(rating.courseId).toBe(base.course.id);
    });

    it("updates an existing rating instead of creating a duplicate", () => {
      rateCourse(base.user.id, base.course.id, 2);
      rateCourse(base.user.id, base.course.id, 5);

      const rating = findCourseRating(base.user.id, base.course.id);
      expect(rating!.rating).toBe(5);

      const summary = getCourseRatingSummary(base.course.id);
      expect(summary.count).toBe(1);
    });
  });

  describe("getUserRatingForCourse", () => {
    it("returns null when the student has not rated the course", () => {
      expect(getUserRatingForCourse(base.user.id, base.course.id)).toBeNull();
    });

    it("returns the student's rating when present", () => {
      rateCourse(base.user.id, base.course.id, 3);
      expect(getUserRatingForCourse(base.user.id, base.course.id)).toBe(3);
    });
  });

  describe("getCourseRatingSummary", () => {
    it("returns null average and zero count for an unrated course", () => {
      const summary = getCourseRatingSummary(base.course.id);
      expect(summary.average).toBeNull();
      expect(summary.roundedAverage).toBeNull();
      expect(summary.count).toBe(0);
    });

    it("averages only ratings that were actually given, rounded to the nearest half-star", () => {
      const studentB = testDb
        .insert(schema.users)
        .values({
          name: "Student B",
          email: "student-b@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();
      const studentC = testDb
        .insert(schema.users)
        .values({
          name: "Student C",
          email: "student-c@example.com",
          role: schema.UserRole.Student,
        })
        .returning()
        .get();

      rateCourse(base.user.id, base.course.id, 4);
      rateCourse(studentB.id, base.course.id, 5);
      rateCourse(studentC.id, base.course.id, 5);

      const summary = getCourseRatingSummary(base.course.id);
      expect(summary.count).toBe(3);
      expect(summary.average).toBeCloseTo((4 + 5 + 5) / 3, 5);
      expect(summary.roundedAverage).toBe(4.5);
    });
  });
});
