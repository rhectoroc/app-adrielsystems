-- Remove duplicate clients, keeping only the most recent entry for each email.

WITH duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY email 
               ORDER BY created_at DESC, id DESC
           ) as row_num
    FROM clients
)
DELETE FROM clients
WHERE id IN (
    SELECT id FROM duplicates WHERE row_num > 1
);

-- Also clean up any users that might be orphaned or duplicated (though CASCADE might handle it, better to be safe)
-- If users are linked to deleted clients, they will be set to NULL or deleted depending on FK. 
-- Schema says: "client_id" INTEGER REFERENCES "clients" ("id") ON DELETE SET NULL
-- So we might have orphaned users. Let's delete users that are CLIENT role but have NULL client_id if that's not desired.
-- For now, just cleaning clients is the priority.
