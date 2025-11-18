terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    # Configure backend in terraform.tfvars or via CLI
    # bucket = "your-terraform-state-bucket"
    # key    = "universal-crawler/terraform.tfstate"
    # region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "UniversalCrawler"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}

# VPC and Networking
module "vpc" {
  source = "./modules/vpc"

  environment = var.environment
  vpc_cidr    = var.vpc_cidr
}

# ECS Cluster for running containers
module "ecs" {
  source = "./modules/ecs"

  environment      = var.environment
  vpc_id           = module.vpc.vpc_id
  private_subnets  = module.vpc.private_subnets
  public_subnets   = module.vpc.public_subnets

  api_image        = var.api_image
  worker_image     = var.worker_image
  frontend_image   = var.frontend_image

  database_url              = module.rds.database_url
  supabase_url              = var.supabase_url
  supabase_anon_key         = var.supabase_anon_key
  supabase_service_role_key = var.supabase_service_role_key
  s3_bucket_name            = module.s3.bucket_name
  encryption_key            = var.encryption_key
}

# RDS PostgreSQL Database
module "rds" {
  source = "./modules/rds"

  environment     = var.environment
  vpc_id          = module.vpc.vpc_id
  private_subnets = module.vpc.private_subnets

  db_name     = var.db_name
  db_username = var.db_username
  db_password = var.db_password
}

# S3 Bucket for storage artifacts
module "s3" {
  source = "./modules/s3"

  environment = var.environment
  bucket_name = var.s3_bucket_name
}

# CloudWatch for monitoring
module "monitoring" {
  source = "./modules/monitoring"

  environment    = var.environment
  ecs_cluster_id = module.ecs.cluster_id
}
