-- Add Reply-To column on OutreachCampaign so customer replies land in
-- leo.liu@jytech.us while sends originate from leo@sienovo.cn (brand
-- alignment). Also retire the Gmail-based default sender (would tank
-- Brevo deliverability) in favor of the Brevo-authenticated address.

ALTER TABLE "OutreachCampaign"
  ALTER COLUMN "senderEmail" SET DEFAULT 'leo@sienovo.cn';

ALTER TABLE "OutreachCampaign"
  ADD COLUMN IF NOT EXISTS "replyTo" TEXT NOT NULL DEFAULT 'leo.liu@jytech.us';

-- Backfill: any existing campaign still pinned to the legacy Gmail sender
-- gets moved to the Brevo-authenticated address.
UPDATE "OutreachCampaign"
SET "senderEmail" = 'leo@sienovo.cn'
WHERE "senderEmail" = 'sienovoleo@gmail.com';
