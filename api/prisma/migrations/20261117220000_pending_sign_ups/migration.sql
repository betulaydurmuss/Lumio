-- AlterTable
ALTER TABLE "email_verifications" ADD COLUMN     "pending_account_type" "OrganizationKind",
ADD COLUMN     "pending_display_name" TEXT,
ADD COLUMN     "pending_locale" "Locale",
ADD COLUMN     "pending_marketing_consent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pending_organization_name" TEXT,
ADD COLUMN     "pending_password_hash" TEXT;
