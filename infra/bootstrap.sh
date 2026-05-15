#!/usr/bin/env bash
# One-time AWS bootstrap. Run ONCE, locally, with admin AWS credentials
# (`aws sso login` or root account temporary credentials).
#
# After this script:
#   - S3 bucket "sienovo-tofu-state" holds OpenTofu state (versioned + encrypted)
#   - DynamoDB table "sienovo-tofu-locks" prevents concurrent apply
#   - IAM OIDC provider trusts token.actions.githubusercontent.com
#   - IAM role "sienovo-github-actions" has AdministratorAccess, trusted by
#     dotku/sienovo-intl repo only
#   - The role's ARN is printed at the end — add it to the repo as variable
#     AWS_ROLE_ARN (Settings → Secrets and variables → Actions → Variables).
#
# This is the chicken-and-egg step: you need admin to create the IAM that
# replaces admin. After this runs, you should never need admin AWS creds again.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
STATE_BUCKET="sienovo-tofu-state"
LOCK_TABLE="sienovo-tofu-locks"
ROLE_NAME="sienovo-github-actions"
REPO="dotku/sienovo-intl"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "==> Bootstrapping AWS account ${ACCOUNT_ID} in ${REGION}"

echo "==> 1/4  S3 state bucket"
if ! aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
	if [ "$REGION" = "us-east-1" ]; then
		aws s3api create-bucket --bucket "$STATE_BUCKET"
	else
		aws s3api create-bucket --bucket "$STATE_BUCKET" \
			--create-bucket-configuration LocationConstraint="$REGION"
	fi
	aws s3api put-bucket-versioning --bucket "$STATE_BUCKET" \
		--versioning-configuration Status=Enabled
	aws s3api put-bucket-encryption --bucket "$STATE_BUCKET" \
		--server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
	aws s3api put-public-access-block --bucket "$STATE_BUCKET" \
		--public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
	echo "    created s3://$STATE_BUCKET"
else
	echo "    s3://$STATE_BUCKET already exists"
fi

echo "==> 2/4  DynamoDB lock table"
if ! aws dynamodb describe-table --table-name "$LOCK_TABLE" >/dev/null 2>&1; then
	aws dynamodb create-table --table-name "$LOCK_TABLE" \
		--attribute-definitions AttributeName=LockID,AttributeType=S \
		--key-schema AttributeName=LockID,KeyType=HASH \
		--billing-mode PAY_PER_REQUEST >/dev/null
	aws dynamodb wait table-exists --table-name "$LOCK_TABLE"
	echo "    created $LOCK_TABLE"
else
	echo "    $LOCK_TABLE already exists"
fi

echo "==> 3/4  OIDC provider for GitHub Actions"
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
if ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_ARN" >/dev/null 2>&1; then
	aws iam create-open-id-connect-provider \
		--url https://token.actions.githubusercontent.com \
		--client-id-list sts.amazonaws.com \
		--thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 >/dev/null
	echo "    created OIDC provider"
else
	echo "    OIDC provider already exists"
fi

echo "==> 4/4  IAM role ${ROLE_NAME}"
TRUST=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "${OIDC_ARN}" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike":   { "token.actions.githubusercontent.com:sub": "repo:${REPO}:*" }
    }
  }]
}
EOF
)
if ! aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
	aws iam create-role --role-name "$ROLE_NAME" \
		--assume-role-policy-document "$TRUST" \
		--description "GitHub Actions OIDC role for ${REPO}" >/dev/null
	aws iam attach-role-policy --role-name "$ROLE_NAME" \
		--policy-arn arn:aws:iam::aws:policy/AdministratorAccess
	echo "    created role + attached AdministratorAccess"
else
	aws iam update-assume-role-policy --role-name "$ROLE_NAME" \
		--policy-document "$TRUST"
	echo "    role exists, refreshed trust policy"
fi

ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text)

cat <<EOF

╔══════════════════════════════════════════════════════════════════════╗
║  Bootstrap complete                                                  ║
╠══════════════════════════════════════════════════════════════════════╣
║  Next step:                                                          ║
║  Add this as a GitHub repo VARIABLE (not secret — ARN is not secret):║
║                                                                      ║
║    gh variable set AWS_ROLE_ARN --body "${ROLE_ARN}"
║                                                                      ║
║  Or via UI: Settings → Secrets and variables → Actions → Variables   ║
╚══════════════════════════════════════════════════════════════════════╝
EOF
