-- Give each user-created food a stable, case-insensitive identity.
ALTER TABLE "UserFood" ADD COLUMN "normalizedName" TEXT;

UPDATE "UserFood"
SET "normalizedName" = LOWER(BTRIM("name"));

-- Preserve the most recently updated row for each duplicate food and redirect
-- snapshot identifiers before deleting the redundant rows.
CREATE TEMP TABLE "_UserFoodDuplicateMap" AS
SELECT id AS duplicate_id, keeper_id, user_id
FROM (
  SELECT
    "id" AS id,
    "userId" AS user_id,
    FIRST_VALUE("id") OVER (
      PARTITION BY "userId", "normalizedName"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id"
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "normalizedName"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id"
    ) AS row_number
  FROM "UserFood"
) AS ranked
WHERE row_number > 1;

UPDATE "FoodEntry" AS entry
SET "foodIdentifier" = 'user:' || duplicates.keeper_id
FROM "_UserFoodDuplicateMap" AS duplicates
WHERE entry."userId" = duplicates.user_id
  AND entry."foodIdentifier" = 'user:' || duplicates.duplicate_id;

-- A user can favorite one identifier only once. Track one duplicate favorite
-- per canonical food so multiple old favorites cannot collide during redirect.
CREATE TEMP TABLE "_DuplicateFavoriteMap" AS
SELECT
  favorite."id" AS favorite_id,
  duplicates.keeper_id,
  ROW_NUMBER() OVER (
    PARTITION BY favorite."userId", duplicates.keeper_id
    ORDER BY favorite."createdAt" ASC, favorite."id"
  ) AS row_number
FROM "FavoriteFood" AS favorite
JOIN "_UserFoodDuplicateMap" AS duplicates
  ON favorite."userId" = duplicates.user_id
 AND favorite."foodIdentifier" = 'user:' || duplicates.duplicate_id;

-- When the canonical food is already favorited, every duplicate favorite is
-- redundant and can be removed.
DELETE FROM "FavoriteFood" AS favorite
USING "_UserFoodDuplicateMap" AS duplicates
WHERE favorite."userId" = duplicates.user_id
  AND favorite."foodIdentifier" = 'user:' || duplicates.duplicate_id
  AND EXISTS (
    SELECT 1
    FROM "FavoriteFood" AS keeper
    WHERE keeper."userId" = duplicates.user_id
      AND keeper."foodIdentifier" = 'user:' || duplicates.keeper_id
  );

-- Otherwise keep the oldest favorite for the canonical food and remove any
-- additional duplicate favorites before redirecting it.
DELETE FROM "FavoriteFood" AS favorite
USING "_DuplicateFavoriteMap" AS duplicate_favorites
WHERE favorite."id" = duplicate_favorites.favorite_id
  AND duplicate_favorites.row_number > 1;

UPDATE "FavoriteFood" AS favorite
SET "foodIdentifier" = 'user:' || duplicate_favorites.keeper_id
FROM "_DuplicateFavoriteMap" AS duplicate_favorites
WHERE favorite."id" = duplicate_favorites.favorite_id
  AND duplicate_favorites.row_number = 1;

DROP TABLE "_DuplicateFavoriteMap";

DELETE FROM "UserFood" AS food
USING "_UserFoodDuplicateMap" AS duplicates
WHERE food."id" = duplicates.duplicate_id;

DROP TABLE "_UserFoodDuplicateMap";

ALTER TABLE "UserFood" ALTER COLUMN "normalizedName" SET NOT NULL;

CREATE UNIQUE INDEX "UserFood_userId_normalizedName_key"
ON "UserFood"("userId", "normalizedName");
