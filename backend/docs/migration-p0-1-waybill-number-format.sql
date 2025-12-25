-- P0-1: WB-NUM-001 - Fix Waybill Number Format
-- Проблема: В БД хранятся неформатированные номера ("1" вместо "ЧБ 000001")
-- Решение: Обновить существующие записи, используя формат из бланка

-- ============================================================================
-- STEP 1: Preview affected waybills-- ============================================================================

SELECT 
    w.id,
    w.number as current_number,
    CASE 
        WHEN b.series IS NOT NULL THEN CONCAT(b.series, ' ', LPAD(b.number::text, 6, '0'))
        ELSE LPAD(b.number::text, 6, '0')
    END as correct_number,
    b.series,    b.number as blank_number,
    w.status
FROM waybills w
LEFT JOIN blanks b ON b.id = w."blankId"
WHERE w."blankId" IS NOT NULL
    AND (
        -- Number doesn't match expected format
        w.number != CASE 
            WHEN b.series IS NOT NULL THEN CONCAT(b.series, ' ', LPAD(b.number::text, 6, '0'))
            ELSE LPAD(b.number::text, 6, '0')
        END
        OR w.number IS NULL
    )
ORDER BY w.date DESC
LIMIT 20;

-- ============================================================================
-- STEP 2: Count affected waybills
-- ============================================================================

SELECT COUNT(*) as total_affected
FROM waybills w
LEFT JOIN blanks b ON b.id = w."blankId"
WHERE w."blankId" IS NOT NULL
    AND (
        w.number != CASE 
            WHEN b.series IS NOT NULL THEN CONCAT(b.series, ' ', LPAD(b.number::text, 6, '0'))
            ELSE LPAD(b.number::text, 6, '0')
        END
        OR w.number IS NULL
    );

-- ============================================================================
-- STEP 3: Update waybill numbers to formatted values
-- ============================================================================

BEGIN;

UPDATE waybills w
SET number = CASE 
    WHEN b.series IS NOT NULL THEN CONCAT(b.series, ' ', LPAD(b.number::text, 6, '0'))
    ELSE LPAD(b.number::text, 6, '0')
END
FROM blanks b
WHERE b.id = w."blankId"
    AND w."blankId" IS NOT NULL
    AND (
        w.number != CASE 
            WHEN b.series IS NOT NULL THEN CONCAT(b.series, ' ', LPAD(b.number::text, 6, '0'))
            ELSE LPAD(b.number::text, 6, '0')
        END
        OR w.number IS NULL
    );

-- Check results before committing
SELECT 
    w.id,
    w.number,
    w.status,
    b.series,
    b.number as blank_number
FROM waybills w
LEFT JOIN blanks b ON b.id = w."blankId"
WHERE w."blankId" IS NOT NULL
ORDER BY w.date DESC
LIMIT 10;

-- If everything looks good, commit:
COMMIT;

-- If something is wrong, rollback:
-- ROLLBACK;

-- ============================================================================
-- STEP 4: Verify all waybills have formatted numbers
-- ============================================================================

SELECT 
    COUNT(*) as total_waybills_with_blanks,
    COUNT(CASE WHEN w.number ~ '^[А-ЯЁ]{2,10} \d{6}$' THEN 1 END) as properly_formatted,
    COUNT(CASE WHEN w.number !~ '^[А-ЯЁ]{2,10} \d{6}$' AND w.number ~ '^\d+$' THEN 1 END) as short_format,
    COUNT(CASE WHEN w.number IS NULL THEN 1 END) as null_numbers
FROM waybills w
WHERE w."blankId" IS NOT NULL;

-- ============================================================================
-- NOTES
-- ============================================================================
-- Expected format: "ЧБ 000001" (series + space + 6-digit padded number)
-- After this migration, backend formatBlankNumber() will preserve format
-- Frontend should display waybill.number as-is (no formatting needed)
