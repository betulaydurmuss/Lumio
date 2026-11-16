-- CreateTable
CREATE TABLE "signing_keys" (
    "id" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'Ed25519',
    "public_key" TEXT NOT NULL,
    "private_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retired_at" TIMESTAMP(3),

    CONSTRAINT "signing_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "cert_no" TEXT NOT NULL,
    "org_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "verify_code" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "org_name" TEXT,
    "course_title_tr" TEXT NOT NULL,
    "course_title_en" TEXT NOT NULL,
    "instructor_name" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signature" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_cert_no_key" ON "certificates"("cert_no");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_enrollment_id_key" ON "certificates"("enrollment_id");

-- CreateIndex
CREATE INDEX "certificates_org_id_idx" ON "certificates"("org_id");

-- CreateIndex
CREATE INDEX "certificates_user_id_idx" ON "certificates"("user_id");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Certificate numbers come from a sequence, so two certificates issued at the
-- same moment can never share a number. LMS-2026-000042 uses value 42.
CREATE SEQUENCE "certificate_number_seq" START 1;
