variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

# Database variables
variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "universal_crawler"
}

variable "db_username" {
  description = "PostgreSQL database username"
  type        = string
  default     = "crawler_admin"
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

# Supabase variables
variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase anonymous key"
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Supabase service role key"
  type        = string
  sensitive   = true
}

# S3 variables
variable "s3_bucket_name" {
  description = "S3 bucket name for storage artifacts"
  type        = string
}

# Encryption
variable "encryption_key" {
  description = "Encryption key for sensitive data"
  type        = string
  sensitive   = true
}

# Container images
variable "api_image" {
  description = "Docker image for API server"
  type        = string
  default     = "ghcr.io/your-org/universal-crawler/api-server:latest"
}

variable "worker_image" {
  description = "Docker image for workers"
  type        = string
  default     = "ghcr.io/your-org/universal-crawler/workers:latest"
}

variable "frontend_image" {
  description = "Docker image for frontend"
  type        = string
  default     = "ghcr.io/your-org/universal-crawler/frontend:latest"
}

# ECS Configuration
variable "api_cpu" {
  description = "CPU units for API server (1024 = 1 vCPU)"
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "Memory for API server (MB)"
  type        = number
  default     = 1024
}

variable "worker_cpu" {
  description = "CPU units for workers (1024 = 1 vCPU)"
  type        = number
  default     = 2048
}

variable "worker_memory" {
  description = "Memory for workers (MB)"
  type        = number
  default     = 4096
}

variable "worker_count" {
  description = "Number of worker instances"
  type        = number
  default     = 2
}

variable "frontend_cpu" {
  description = "CPU units for frontend (1024 = 1 vCPU)"
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Memory for frontend (MB)"
  type        = number
  default     = 512
}
