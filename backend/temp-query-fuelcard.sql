-- Find Fuel Card by number
SELECT id, "cardNumber", "organizationId" 
FROM fuel_cards 
WHERE "cardNumber" = '1111-2222-3333-4444' 
LIMIT 1;
