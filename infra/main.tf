terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
  backend "s3" {
    bucket         = "sienovo-tofu-state"
    key            = "sienovo-intl/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "sienovo-tofu-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project   = "sienovo-intl"
      ManagedBy = "OpenTofu"
      Repo      = "dotku/sienovo-intl"
    }
  }
}
