-- Find Waybill ЧБ 000001
SELECT id, number, date, status, "fuelCardId", "vehicleId" 
FROM waybills 
WHERE number = 'ЧБ 000001' 
ORDER BY date DESC 
LIMIT 1;
