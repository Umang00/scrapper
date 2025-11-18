output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "ecs_cluster_id" {
  description = "ECS Cluster ID"
  value       = module.ecs.cluster_id
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = module.rds.database_endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket name for artifacts"
  value       = module.s3.bucket_name
}

output "api_service_url" {
  description = "API service URL"
  value       = module.ecs.api_service_url
}

output "frontend_url" {
  description = "Frontend URL"
  value       = module.ecs.frontend_url
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name"
  value       = module.monitoring.log_group_name
}
