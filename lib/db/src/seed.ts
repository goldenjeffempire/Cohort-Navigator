/**
 * Seeds baseline catalog content (courses, modules, lessons, quizzes,
 * assignments, cohorts) so the platform has something to browse before any
 * real students/mentors have signed in. Users are intentionally NOT seeded
 * here — they are JIT-provisioned from Clerk on first sign-in, and the very
 * first provisioned user becomes the platform admin (see
 * artifacts/api-server/src/middlewares/auth.ts). Safe to re-run: skips
 * seeding if courses already exist.
 */
import { db, pool } from "./index";
import {
  coursesTable,
  modulesTable,
  lessonsTable,
  lessonResourcesTable,
  assignmentsTable,
  quizzesTable,
  quizQuestionsTable,
  quizOptionsTable,
  cohortsTable,
  cohortCoursesTable,
} from "./schema";

async function main() {
  const existing = await db.select().from(coursesTable).limit(1);
  if (existing.length > 0) {
    console.log("Seed skipped: courses already exist.");
    return;
  }

  const [webDev] = await db
    .insert(coursesTable)
    .values({
      title: "Foundations of Web Development",
      description:
        "Build a solid foundation in HTML, CSS, JavaScript, and how the web works before moving into frameworks.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1547658719-da2b51169166?w=800&q=80",
    })
    .returning();

  const [dataSci] = await db
    .insert(coursesTable)
    .values({
      title: "Data Science Essentials",
      description:
        "Learn Python, statistics, and data visualization to start analyzing real-world datasets.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80",
    })
    .returning();

  const [cloudEng] = await db
    .insert(coursesTable)
    .values({
      title: "Cloud Engineering Bootcamp",
      description:
        "Get hands-on with Linux, networking, and cloud infrastructure fundamentals on AWS.",
      thumbnailUrl:
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
    })
    .returning();

  // --- Web Dev modules & lessons ---
  const [htmlCss] = await db
    .insert(modulesTable)
    .values({ courseId: webDev.id, title: "HTML & CSS Basics", order: 0 })
    .returning();
  const [jsFund] = await db
    .insert(modulesTable)
    .values({ courseId: webDev.id, title: "JavaScript Fundamentals", order: 1 })
    .returning();

  const htmlLessons = await db
    .insert(lessonsTable)
    .values([
      {
        moduleId: htmlCss.id,
        title: "Structuring a page with HTML",
        content:
          "Learn how semantic HTML elements like <header>, <main>, and <footer> describe the structure of a page, and why that matters for accessibility and SEO.",
        order: 0,
      },
      {
        moduleId: htmlCss.id,
        title: "Styling with CSS",
        content:
          "Understand the box model, selectors, and the cascade, then apply layout techniques with Flexbox.",
        order: 1,
      },
      {
        moduleId: htmlCss.id,
        title: "Responsive layout with Grid",
        content:
          "Use CSS Grid to build responsive, multi-column layouts that adapt to any screen size.",
        order: 2,
      },
    ])
    .returning();

  await db.insert(lessonResourcesTable).values({
    lessonId: htmlLessons[0].id,
    title: "MDN: HTML basics",
    fileUrl: "https://developer.mozilla.org/en-US/docs/Learn/HTML",
    fileType: "link",
  });

  const jsLessons = await db
    .insert(lessonsTable)
    .values([
      {
        moduleId: jsFund.id,
        title: "Variables, types, and functions",
        content:
          "Cover let/const, primitive types, and how to write and call functions in JavaScript.",
        order: 0,
      },
      {
        moduleId: jsFund.id,
        title: "Working with arrays and objects",
        content:
          "Practice common array methods (map, filter, reduce) and object destructuring.",
        order: 1,
      },
      {
        moduleId: jsFund.id,
        title: "DOM manipulation",
        content:
          "Select elements, listen for events, and update the page dynamically with vanilla JS.",
        order: 2,
      },
    ])
    .returning();

  // --- Data Science modules & lessons ---
  const [pythonBasics] = await db
    .insert(modulesTable)
    .values({ courseId: dataSci.id, title: "Python for Data Analysis", order: 0 })
    .returning();
  await db.insert(lessonsTable).values([
    {
      moduleId: pythonBasics.id,
      title: "Python syntax refresher",
      content: "A quick refresher on Python control flow, functions, and list comprehensions.",
      order: 0,
    },
    {
      moduleId: pythonBasics.id,
      title: "Intro to pandas",
      content: "Load, clean, and explore tabular data using pandas DataFrames.",
      order: 1,
    },
  ]);

  // --- Cloud Engineering modules & lessons ---
  const [linuxBasics] = await db
    .insert(modulesTable)
    .values({ courseId: cloudEng.id, title: "Linux & the Command Line", order: 0 })
    .returning();
  await db.insert(lessonsTable).values([
    {
      moduleId: linuxBasics.id,
      title: "Navigating the filesystem",
      content: "Learn essential commands: ls, cd, pwd, mkdir, and file permissions.",
      order: 0,
    },
    {
      moduleId: linuxBasics.id,
      title: "Processes and shell scripting",
      content: "Understand processes, pipes, and how to automate tasks with basic shell scripts.",
      order: 1,
    },
  ]);

  // --- Assignments ---
  const inTwoWeeks = new Date();
  inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
  const inThreeWeeks = new Date();
  inThreeWeeks.setDate(inThreeWeeks.getDate() + 21);

  await db.insert(assignmentsTable).values([
    {
      courseId: webDev.id,
      moduleId: htmlCss.id,
      title: "Build a personal portfolio page",
      description: "Using only HTML and CSS, build a one-page personal portfolio with a bio, projects, and contact section.",
      dueDate: inTwoWeeks,
      maxScore: 100,
    },
    {
      courseId: webDev.id,
      moduleId: jsFund.id,
      title: "Interactive to-do list",
      description: "Build a to-do list app using vanilla JavaScript DOM manipulation — add, complete, and remove items.",
      dueDate: inThreeWeeks,
      maxScore: 100,
    },
    {
      courseId: dataSci.id,
      moduleId: pythonBasics.id,
      title: "Exploratory data analysis report",
      description: "Load a provided CSV dataset with pandas and write a short report summarizing key trends.",
      dueDate: inThreeWeeks,
      maxScore: 100,
    },
  ]);

  // --- Quizzes ---
  const [htmlQuiz] = await db
    .insert(quizzesTable)
    .values({
      courseId: webDev.id,
      moduleId: htmlCss.id,
      title: "HTML & CSS Basics Quiz",
      description: "Check your understanding of semantic HTML and the CSS box model.",
      timeLimitMinutes: 10,
    })
    .returning();

  const [q1] = await db
    .insert(quizQuestionsTable)
    .values({ quizId: htmlQuiz.id, question: "Which HTML element is used for the main navigation menu?", order: 0 })
    .returning();
  await db.insert(quizOptionsTable).values([
    { questionId: q1.id, optionText: "<nav>", isCorrect: true, order: 0 },
    { questionId: q1.id, optionText: "<div>", isCorrect: false, order: 1 },
    { questionId: q1.id, optionText: "<menu-bar>", isCorrect: false, order: 2 },
    { questionId: q1.id, optionText: "<header>", isCorrect: false, order: 3 },
  ]);

  const [q2] = await db
    .insert(quizQuestionsTable)
    .values({ quizId: htmlQuiz.id, question: "In the CSS box model, what does 'margin' control?", order: 1 })
    .returning();
  await db.insert(quizOptionsTable).values([
    { questionId: q2.id, optionText: "Space inside the border, around the content", isCorrect: false, order: 0 },
    { questionId: q2.id, optionText: "Space outside the border, between elements", isCorrect: true, order: 1 },
    { questionId: q2.id, optionText: "The thickness of the border itself", isCorrect: false, order: 2 },
    { questionId: q2.id, optionText: "The element's text color", isCorrect: false, order: 3 },
  ]);

  const [jsQuiz] = await db
    .insert(quizzesTable)
    .values({
      courseId: webDev.id,
      moduleId: jsFund.id,
      title: "JavaScript Fundamentals Quiz",
      description: "Test your knowledge of variables, arrays, and the DOM.",
      timeLimitMinutes: 10,
    })
    .returning();
  const [q3] = await db
    .insert(quizQuestionsTable)
    .values({ quizId: jsQuiz.id, question: "Which array method returns a new array with transformed items?", order: 0 })
    .returning();
  await db.insert(quizOptionsTable).values([
    { questionId: q3.id, optionText: "forEach", isCorrect: false, order: 0 },
    { questionId: q3.id, optionText: "map", isCorrect: true, order: 1 },
    { questionId: q3.id, optionText: "push", isCorrect: false, order: 2 },
    { questionId: q3.id, optionText: "length", isCorrect: false, order: 3 },
  ]);

  // --- Cohorts ---
  const today = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const end = new Date();
  end.setMonth(end.getMonth() + 4);
  const endDate = end.toISOString().slice(0, 10);

  const [cohort2026a] = await db
    .insert(cohortsTable)
    .values({
      name: "JOE Forge Cohort 2026-A",
      description: "Our current flagship cohort covering web development and cloud engineering tracks.",
      startDate,
      endDate,
      status: "active",
      capacity: 50,
    })
    .returning();

  const futureStart = new Date();
  futureStart.setMonth(futureStart.getMonth() + 5);
  const futureEnd = new Date();
  futureEnd.setMonth(futureEnd.getMonth() + 9);

  await db.insert(cohortsTable).values({
    name: "JOE Forge Cohort 2026-B",
    description: "Upcoming cohort — applications open now.",
    startDate: futureStart.toISOString().slice(0, 10),
    endDate: futureEnd.toISOString().slice(0, 10),
    status: "upcoming",
    capacity: 60,
  });

  await db.insert(cohortCoursesTable).values([
    { cohortId: cohort2026a.id, courseId: webDev.id, order: 0 },
    { cohortId: cohort2026a.id, courseId: cloudEng.id, order: 1 },
  ]);

  console.log("Seed complete:", {
    courses: [webDev.title, dataSci.title, cloudEng.title],
    lessons: htmlLessons.length + jsLessons.length,
    cohorts: [cohort2026a.name],
  });
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("Seed failed:", err);
    return pool.end().finally(() => process.exit(1));
  });
