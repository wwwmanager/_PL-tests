-- Check if Driver has assigned FuelCard
SELECT 
    w.number,
    w."driverId",
    fc.id as fuel_card_id,
    fc."cardNumber"
FROM waybills w
JOIN drivers d ON d.id = w."driverId"
LEFT JOIN fuel_cards fc ON fc."assignedToDriverId" = w."driverId"
WHERE w.id = '859200fc-f5c7-4fb2-b1d9-bb103bac726b';
