export const ADVERTISER_OVERLAP_QUERY = `WITH
  exposures AS (
    SELECT
      user_id,
      advertiser_id,
      advertiser,
      CAST(campaign_id AS VARCHAR) AS campaign_id,
      campaign
    FROM
      dsp_impressions
    WHERE
      NOT user_id IS NULL
  ),
  user_campaigns AS (
    SELECT
      user_id,
      ARRAY_SORT (COLLECT(DISTINCT campaign_id)) AS campaign_id_combination,
      ARRAY_SORT (COLLECT(DISTINCT campaign)) AS campaign_name_combination,
      ARRAY_SORT (COLLECT(DISTINCT advertiser)) AS advertiser_combination,
      COUNT(DISTINCT advertiser_id) AS advertiser_count
    FROM
      exposures
    GROUP BY
      user_id
  ),
  overlap_summary AS (
    SELECT
      advertiser_combination,
      campaign_id_combination,
      campaign_name_combination,
      advertiser_count,
      COUNT(1) AS unique_users
    FROM
      user_campaigns
    GROUP BY
      advertiser_combination,
      campaign_id_combination,
      campaign_name_combination,
      advertiser_count
  )
SELECT
  advertiser_combination,
  campaign_id_combination,
  campaign_name_combination,
  advertiser_count,
  SUM(unique_users) AS unique_users
FROM
  overlap_summary
GROUP BY
  advertiser_combination,
  campaign_id_combination,
  campaign_name_combination,
  advertiser_count
`;
