-- Normalize LearningPath.subject values to English ids used by the app.
-- Run this manually against the same database as your Prisma datasource.

UPDATE "LearningPath" SET "subject" = 'mathematics' WHERE "subject" = 'Matemática';
UPDATE "LearningPath" SET "subject" = 'history' WHERE "subject" = 'Historia';
UPDATE "LearningPath" SET "subject" = 'grammar' WHERE "subject" = 'Gramática';
UPDATE "LearningPath" SET "subject" = 'science' WHERE "subject" = 'Ciencias';
