export const SALES_BY_STATE_QUERY = `SELECT
  advertiser,
  advertiser_id,
  iso_state_province_code,
  SUM(total_purchases) AS total_conversions,
  SUM(new_to_brand_total_purchases) AS ntb_conversions,
  CASE
    WHEN SUM(total_purchases) > 0 THEN (
      CAST(SUM(new_to_brand_total_purchases) AS DOUBLE) / SUM(total_purchases)
    ) * 100
    ELSE 0
  END AS ntb_conversion_pct,
  SUM(total_product_sales) AS total_sales,
  SUM(new_to_brand_total_product_sales) AS ntb_sales,
  CASE
    WHEN SUM(total_product_sales) > 0 THEN (
      CAST(SUM(new_to_brand_total_product_sales) AS DOUBLE) / SUM(total_product_sales)
    ) * 100
    ELSE 0
  END AS ntb_sales_pct
FROM
  amazon_attributed_events_by_conversion_time
WHERE
  total_purchases > 0
  AND NOT user_id IS NULL
  AND NOT iso_state_province_code IS NULL
GROUP BY
  advertiser,
  advertiser_id,
  iso_state_province_code
`;
